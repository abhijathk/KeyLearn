import { body, controller, http } from "@fastr/controller";
import { Context } from "@fastr/core";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { User } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import { PublicId } from "@keylearn/publicid";
import { EventName } from "@paddle/paddle-node-sdk";
import { type AuthState } from "../auth/index.ts";
import { PaddleConfig } from "./config.ts";

@injectable()
@controller()
export class Controller {
  constructor(readonly config: PaddleConfig) {}

  @http.POST("/_/checkout")
  async checkout(
    ctx: Context<RouterState & AuthState>,
    @body.text(null, { expectType: "application/json" }) payload: string,
  ): Promise<void> {
    const paddle = this.config.makePaddle();

    // Parse.

    let event = null;
    const signature = ctx.request.headers.get("paddle-signature");
    if (payload && signature) {
      try {
        event = await paddle.webhooks.unmarshal(
          payload,
          this.config.secretKey,
          signature,
        );
      } catch (err: any) {
        Logger.error(err, "Paddle notification parse error");
      }
    }
    if (!event) {
      ctx.response.status = 400;
      ctx.response.body = "Invalid notification";
      ctx.response.type = "text/plain";
      return;
    }

    // Process.

    try {
      switch (event.eventType) {
        // Paid for. The only event that ever granted anything, which was the
        // whole of the problem: nothing took it away again.
        case EventName.TransactionCompleted:
          await this.#grant(event.data, event.data.id);
          break;
        // A subscription coming back to life, after a pause or a failed
        // payment that was later settled.
        case EventName.SubscriptionActivated:
        case EventName.SubscriptionResumed:
          await this.#grant(event.data, event.data.id);
          break;
        // And the ways it ends. Cancelled is the learner's own decision or a
        // refund; paused is Paddle holding the subscription, which is not a
        // state anyone should keep premium through.
        case EventName.SubscriptionCanceled:
        case EventName.SubscriptionPaused:
          await this.#revoke(event.data);
          break;
      }
    } catch (err: any) {
      // The detail goes to the log, not down the wire. Whatever a failure here
      // says — a driver message naming the database, a stack quoting a path —
      // it describes our internals, and the caller only needs to know to retry.
      Logger.error(err, "Paddle notification processing error");
      ctx.response.status = 500;
      ctx.response.body = "Processing error";
      ctx.response.type = "text/plain";
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = "OK";
    ctx.response.type = "text/plain";
  }

  /**
   * Give this account premium, or renew what it already had.
   *
   * One order row per account, so a repeat of the same event simply rewrites
   * the same row — which is what makes Paddle's retries harmless.
   */
  async #grant(data: PaddleData, orderId: string): Promise<void> {
    const user = await this.#userOf(data);
    Logger.info(`Granting premium to user [${user.id}] from [${orderId}]`);
    await user.$relatedQuery("order").delete();
    await user.$relatedQuery("order").insert({
      provider: "paddle",
      id: orderId,
      createdAt: data.createdAt != null ? new Date(data.createdAt) : new Date(),
      name: null,
      email: null,
    });
  }

  /**
   * Take premium away.
   *
   * Deleting the order is the whole of it: `premium` is read as "has an
   * order", so there is no second flag to leave out of step. Nothing else
   * about the account is touched — the learner keeps their profiles and their
   * history, and simply falls back to the free allowances, so re-subscribing
   * picks up exactly where they left off.
   */
  async #revoke(data: PaddleData): Promise<void> {
    const user = await this.#userOf(data);
    Logger.info(`Revoking premium from user [${user.id}]`);
    await user.$relatedQuery("order").delete();
  }

  /**
   * The account an event is about.
   *
   * Paddle carries the custom data set at checkout onto the subscription as
   * well as the transaction, so the same lookup serves both. An event without
   * it is a real problem rather than something to shrug at — it means money
   * moved and we cannot say for whom — so it raises instead of returning
   * quietly, and the handler logs and answers 500 so Paddle retries.
   */
  async #userOf(data: PaddleData): Promise<User> {
    const id = userIdOf(data);
    if (id == null) {
      throw new Error("Invalid user id");
    }
    const user = await User.findById(id);
    if (user == null) {
      throw new Error("Unknown user id");
    }
    return user;
  }
}

/** The shape of every Paddle event body this controller acts on. */
type PaddleData = {
  readonly id: string;
  readonly createdAt?: string | null;
  readonly customData: Record<string, any> | null;
};

function userIdOf({
  customData,
}: {
  readonly customData: Record<string, any> | null;
}): number | null {
  const id = customData?.id;
  if (typeof id === "string" && id) {
    try {
      return PublicId.of(id).id;
    } catch {
      // Ignore.
    }
  }
  return null;
}
