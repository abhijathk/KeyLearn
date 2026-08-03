import { type User } from "@keylearn/database";
import { type AnyUser } from "@keylearn/pages-shared";

export type AuthState = {
  readonly sessionId: string;
  readonly user: User | null;
  readonly publicUser: AnyUser;
  readonly requireUser: () => User;
};
