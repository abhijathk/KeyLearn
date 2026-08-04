import { controller, http } from "@fastr/controller";
import { Context } from "@fastr/core";
import { ForbiddenError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { websocket } from "@fastr/middleware-websocket";
import { Env } from "@keylearn/config";
import { Profile } from "@keylearn/database";
import { WebSocketServer } from "ws";
import { type AuthState, clientIp } from "../auth/index.ts";
import { allowWebSocketOrigin } from "./origin.ts";
import { SessionFactory } from "./session.ts";

// Live game connections per client address.
const perIp = new Map<string, number>();

function maxPerIp(): number {
  return Env.getNumber("MULTIPLAYER_MAX_PER_IP", 8);
}

function acquire(ip: string): boolean {
  const n = perIp.get(ip) ?? 0;
  if (n >= maxPerIp()) {
    return false;
  }
  perIp.set(ip, n + 1);
  return true;
}

function release(ip: string): void {
  const n = (perIp.get(ip) ?? 1) - 1;
  if (n > 0) {
    perIp.set(ip, n);
  } else {
    perIp.delete(ip);
  }
}

@injectable()
@controller()
export class Controller {
  constructor(
    readonly server: WebSocketServer,
    readonly sessions: SessionFactory,
  ) {}

  @http.GET("/_/game/server")
  async connect(ctx: Context<RouterState & AuthState>) {
    const { sessionId, user } = ctx.state;
    // Which learner is playing. The client asserts it, so it is VERIFIED here:
    // the profile must belong to this session's account and be a grown-up one
    // (children are kept out of multiplayer). Anything else falls back to the
    // account identity rather than being honoured.
    let publicUser = ctx.state.publicUser;
    if (user != null) {
      const claimed = Number(ctx.request.query.get("profile"));
      if (Number.isSafeInteger(claimed) && claimed > 0) {
        const profile = await Profile.findOwned(user.id!, claimed);
        if (profile != null && profile.kind === "adult") {
          publicUser = profile.toPublicUser(user);
        }
      }
    }
    // The endpoint is deliberately open to anonymous players, so the only thing
    // standing between it and a connection flood is this per-address ceiling.
    //
    // The check happens INSIDE the upgrade callback and refuses with a WebSocket
    // close frame. Throwing an HTTP error here instead would leave the client
    // hanging: the request has already been upgraded, so there is no longer an
    // HTTP response to deliver, and the socket would sit open — a worse leak
    // than the flood being prevented.
    const ip = clientIp(ctx);
    // Who opened this socket. An upgrade is a GET, so the CSRF guard never
    // sees it, and the game server has its own middleware chain anyway —
    // without this, any page on the web could open game sockets from its
    // visitors' browsers (see origin.ts).
    const originOk = allowWebSocketOrigin(
      ctx.request.headers.get("origin"),
      ctx.request.origin,
    );
    await websocket(this.server, {
      callback: (webSocket) => {
        if (!originOk) {
          // Refused after the upgrade for the same reason the connection cap
          // is: the HTTP response is already gone, so a close frame is the
          // only way left to tell the client anything. 1008 = policy violation.
          webSocket.close(1008, "Cross-site connection refused");
          return;
        }
        if (!acquire(ip)) {
          // 1013 = "try again later".
          webSocket.close(1013, "Too many connections");
          return;
        }
        // The slot is held for the life of the connection. `close` fires for
        // clean closes, transport errors and terminations alike, so the slot is
        // always returned.
        webSocket.once("close", () => {
          release(ip);
        });
        this.sessions.connect(webSocket, { id: sessionId, user: publicUser });
      },
    })(ctx, () => Promise.reject());
  }

  /**
   * Who is in the room a newcomer would join.
   *
   * The one part of multiplayer that cannot use the socket: it has to be
   * answerable before a socket exists, so that somebody can decide whether to
   * join — and under what name — while still outside. Cheap, cached for a few
   * seconds, and it names only people any visitor would see a moment later.
   */
  @http.GET("/_/game/rooms")
  async rooms(ctx: Context<RouterState & AuthState>) {
    ctx.response.body = this.sessions.peek();
    // Short enough to feel live while the dialog is open, long enough that a
    // page left sitting on it does not poll the room list at full rate.
    ctx.response.headers.set("Cache-Control", "public, max-age=3");
  }

  @http.GET("/_/game/stats")
  async stats(ctx: Context<RouterState & AuthState>) {
    // Room stats name every connected player, so this is not public. Signed-in
    // callers only; use MULTIPLAYER_STATS_PUBLIC=true to restore the old
    // behaviour for an internal dashboard.
    if (
      !Env.getBoolean("MULTIPLAYER_STATS_PUBLIC", false) &&
      ctx.state.user == null
    ) {
      throw new ForbiddenError();
    }
    ctx.response.body = this.sessions.collectStats();
  }
}
