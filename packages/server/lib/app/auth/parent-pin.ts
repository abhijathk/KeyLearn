import { type Context } from "@fastr/core";
import { ApplicationError } from "@fastr/errors";
import { type SessionState } from "@fastr/middleware-session";
import { Profile, SupportPinProof, type User } from "@keylearn/database";

/**
 * The grown-up PIN gate, shared.
 *
 * It began as a private method on the auth controller, guarding profile
 * management. Support needs the same gate for a different reason, and a
 * second copy of a security check is a second thing to forget to update —
 * so it lives here and both call it.
 *
 * The rule it enforces, in one sentence: **on a household account that has
 * a kid profile, the support section is a grown-up's.**
 */

/** How long a proved PIN lasts before it has to be entered again. */
export const PARENT_PIN_TTL_MS = 15 * 60 * 1000;

/** Has this browser proved the PIN recently enough? */
export function parentPinProved(ctx: Context<SessionState>): boolean {
  const at = Number(ctx.state.session.get("parentPinAt") ?? 0);
  return at !== 0 && Date.now() - at <= PARENT_PIN_TTL_MS;
}

/**
 * Support keeps its own proof, in its own table.
 *
 * Two reasons it is not the same one profile management uses:
 *
 * The first is scope. The support proof is revoked the moment the section
 * is left — a timer is the wrong unit for "is a grown-up still the one
 * holding the tablet", because the answer changes when they hand it back,
 * not fifteen minutes later. Sharing a key would mean closing Support also
 * re-locked profile management, which nobody asked for.
 *
 * The third is why it is a row and not a session key: the session is one
 * blob, rewritten whole on every request, so any overlapping request that
 * loaded before a revoke and committed after it wrote the deleted key
 * back. Closing the account window did precisely that — leaving the pane
 * fires the rail's unread count alongside the revoke — so the proof was
 * revoked and instantly restored, every single time.
 *
 * The second is what is behind each door. Profile management can rename a
 * learner; support is a private channel to an adult stranger carrying the
 * account's email and every ticket ever written. The stricter of the two
 * should not be loosened to match the other.
 *
 * The TTL stays as a backstop for a tab left open on the section itself.
 */
export async function supportPinProved(
  ctx: Context<SessionState>,
  user: User,
): Promise<boolean> {
  const sessionId = ctx.state.session.id;
  if (sessionId == null) {
    return false;
  }
  return await SupportPinProof.proved(sessionId, user.id!, PARENT_PIN_TTL_MS);
}

export async function proveSupportPin(
  ctx: Context<SessionState>,
  user: User,
): Promise<void> {
  ctx.state.session.start();
  await SupportPinProof.prove(ctx.state.session.id!, user.id!);
  // Cheap, and it keeps the table from accumulating a row per sign-in
  // forever without needing a scheduled sweep of its own.
  void SupportPinProof.sweep(PARENT_PIN_TTL_MS);
}

/** Called when the section is left, and on the way out of the window. */
export async function revokeSupportPin(
  ctx: Context<SessionState>,
): Promise<void> {
  const sessionId = ctx.state.session.id;
  if (sessionId != null) {
    await SupportPinProof.revoke(sessionId);
  }
}

/**
 * Gate an action behind the PIN when one is set.
 *
 * Checked on the server, never only in the browser: the on-screen gate is
 * a speed bump, and a curious child with devtools — or a direct fetch —
 * walks straight past it.
 */
export function requireParentPin(ctx: Context<SessionState>, user: User): void {
  // Both conditions, or this is a gate that never opens: it used to throw
  // whenever a PIN was set, proved or not. The auth controller kept its own
  // correct copy at the time, so nothing was broken by it — the profile
  // routes call THIS one now, and a mistake here reaches them.
  if (user.parentPinHash == null || parentPinProved(ctx)) {
    return;
  }
  throw new ApplicationError("Enter the grown-up PIN to continue.", {
    status: 428,
    body: { error: { message: "Grown-up PIN required", parentPin: true } },
  });
}

/**
 * The support section's gate, which is stricter than the one above in a way
 * that matters.
 *
 * Everywhere else, no PIN set means no gate — the household chose not to
 * have one. Support cannot work that way. The reason is what a support
 * conversation *is*: a private channel to an adult stranger, carrying the
 * account's email address, its billing details, and whatever anybody has
 * ever written into a ticket. On an account a child uses, that is not an
 * optional protection, so a household with a kid profile is asked to set a
 * PIN rather than offered one.
 *
 * The three outcomes:
 *
 * - **No kid profile** — no gate at all. Most accounts, unchanged.
 * - **Kid profile, PIN set** — prove it, same as any grown-up action.
 * - **Kid profile, no PIN** — 428 asking for setup first, with
 *   `parentPinSetupRequired` so the client knows to run setup rather than
 *   prompt for a PIN that doesn't exist.
 *
 * And the honest limit, which belongs in the code rather than only in a
 * conversation: **this protects registered households only.** Anyone can
 * open a ticket without an account, and there we know nothing about who is
 * typing — no profile, no age, no PIN, nothing to check. The gate makes the
 * registered path safe; it does not make the product's support surface
 * child-free, and no gate here could.
 */
export type SupportGateStatus = {
  /** This account's support section is behind the grown-up PIN. */
  readonly required: boolean;
  /** Required, but no PIN exists yet — the household has to make one. */
  readonly setupRequired: boolean;
  /** This browser has proved the PIN recently enough. */
  readonly proved: boolean;
  /**
   * How many digits it has, so the prompt draws one box per digit. Null
   * when there is no PIN, or when one was set before the length was
   * recorded — the prompt then falls back to a single free-length field.
   */
  readonly length: number | null;
};

/**
 * The same decision as {@link requireParentPinForSupport}, reported rather
 * than thrown.
 *
 * The page needs this on load, not on submit: the requirement is that the
 * support section does not open without a PIN, and a gate that only fires
 * when somebody presses Send has already shown them the section. Only the
 * server knows whether the PIN has been proved in this session, so the
 * client has to ask.
 *
 * Deliberately the same function underneath as the enforcing version, so
 * what the page shows and what the server permits can never drift apart.
 */
export async function supportGateStatus(
  ctx: Context<SessionState>,
  user: User | null,
): Promise<SupportGateStatus> {
  const open = {
    required: false,
    setupRequired: false,
    proved: true,
    length: null,
  } as const;
  if (user == null) {
    return open;
  }
  // Two ways to be gated, and the second is why the first is not enough:
  // a live learner profile, or the sticky record that this household has
  // had one. Deleting the profile is exactly the move somebody would try to
  // get past the gate, so the requirement does not travel with it.
  const kidProfiles = await Profile.query()
    .where("userId", user.id!)
    .where("kind", "kid")
    .resultSize();
  if (kidProfiles === 0 && !user.supportPinRequired) {
    return open;
  }
  return {
    required: true,
    setupRequired: user.parentPinHash == null,
    proved: user.parentPinHash != null && (await supportPinProved(ctx, user)),
    length: user.parentPinHash == null ? null : (user.parentPinLength ?? null),
  };
}

/**
 * The account window's own gate.
 *
 * Simpler than support's: if the household has set a PIN at all, opening
 * the account window asks for it. No PIN means no gate — that household
 * chose not to have one, and inventing a lock they never asked for would
 * only teach them to resent it.
 *
 * The proof is the same one support uses, so entering the PIN once opens
 * the window and the section within it, and closing the window ends both.
 * Two prompts for the same secret in the same visit is a lock nobody
 * would keep.
 */
export type AccountGateStatus = {
  readonly required: boolean;
  readonly proved: boolean;
  readonly length: number | null;
};

export async function accountGateStatus(
  ctx: Context<SessionState>,
  user: User | null,
): Promise<AccountGateStatus> {
  if (user == null || user.parentPinHash == null) {
    return { required: false, proved: true, length: null };
  }
  return {
    required: true,
    proved: await supportPinProved(ctx, user),
    length: user.parentPinLength ?? null,
  };
}

export async function requireParentPinForSupport(
  ctx: Context<SessionState>,
  user: User | null,
): Promise<void> {
  const gate = await supportGateStatus(ctx, user);
  if (!gate.required || gate.proved) {
    return;
  }
  if (gate.setupRequired) {
    throw new ApplicationError(
      "Set a grown-up PIN to use support on an account with a kid profile.",
      {
        status: 428,
        body: {
          error: {
            message: "Grown-up PIN required",
            parentPin: true,
            parentPinSetupRequired: true,
          },
        },
      },
    );
  }
  // `gate.required` is only true for a signed-in account, so this cannot
  // be null here — stated rather than asserted so the narrowing is local.
  if (user != null && !(await supportPinProved(ctx, user))) {
    throw new ApplicationError("Enter the grown-up PIN to continue.", {
      status: 428,
      body: { error: { message: "Grown-up PIN required", parentPin: true } },
    });
  }
}
