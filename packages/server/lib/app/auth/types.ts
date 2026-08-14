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
};
