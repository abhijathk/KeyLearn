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
   * The door for the separate ops app (formerly the desk, now a closed
   * sibling repo) — checked against `OPS_API_KEY` via a request header,
   * checked against a request header rather than a session. It reaches
   * staff-auth verification, account reveal and deletion, since it is the
   * ops app's OWN staff members acting through it, already authenticated
   * on that app's own side — this key
   * only proves the request came from that app's server, not a browser.
   */
  readonly requireOpsApi: () => void;
};
