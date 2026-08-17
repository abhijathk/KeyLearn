import { type User } from "@keylearn/database";
import { type AnyUser } from "@keylearn/pages-shared";

export type AuthState = {
  readonly sessionId: string;
  readonly user: User | null;
  readonly publicUser: AnyUser;
  readonly requireUser: () => User;
  /**
   * As {@link requireUser}, but also rejects a signed-in account that isn't
   * staff, or that is staff but has neither a passkey nor two-step
   * verification set up — the support desk can read every message ever
   * sent, and that is not reachable with a password alone.
   */
  readonly requireStaff: () => Promise<User>;
  /**
   * A completely separate door for the automation agent — checked against
   * `SUPPORT_AGENT_API_KEY` via a request header, never a session or a
   * passkey. Deliberately not `requireStaff`: the agent is not staff, has
   * no user, and the routes it's allowed to reach are a small, fixed
   * subset (see the support controller's `/agent/*` routes) — this exists
   * so that subset never has to be reachable through the human sign-in
   * path at all.
   */
  readonly requireSupportAgent: () => void;
  /**
   * The door for the separate ops app (formerly the desk, now a closed
   * sibling repo) — checked against `OPS_API_KEY` via a request header,
   * same shape as {@link requireSupportAgent}. It reaches a wider surface
   * than the automation agent (staff-auth verification, account reveal
   * and deletion) since it's the ops app's OWN staff members acting
   * through it, already authenticated on that app's own side — this key
   * only proves the request came from that app's server, not a browser.
   */
  readonly requireOpsApi: () => void;
};
