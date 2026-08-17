import { isStaffEmail } from "@keylearn/config";
import { Credential, type User } from "@keylearn/database";

export type StaffAccessReason = "signed-out" | "not-staff" | "needs-2fa";

export type StaffAccessStatus =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: StaffAccessReason };

/**
 * The same rule {@link requireStaff} enforces, exposed as data instead of a
 * thrown error — the staff sign-in screen needs to tell "wrong account" apart
 * from "right account, no second factor yet" rather than showing one generic
 * failure for both.
 *
 * "Is this account staff at all" is decided by the `STAFF_EMAILS` env-var
 * allowlist ({@link isStaffEmail}), not a database column — granting or
 * revoking staff access is a deploy, not an in-app action.
 */
export async function staffAccessStatus(
  user: User | null,
): Promise<StaffAccessStatus> {
  if (user == null) {
    return { ok: false, reason: "signed-out" };
  }
  if (!isStaffEmail(user.email)) {
    return { ok: false, reason: "not-staff" };
  }
  const hasPasskey = (await Credential.listForUser(user.id!)).length > 0;
  if (!hasPasskey && !user.totpEnabled) {
    return { ok: false, reason: "needs-2fa" };
  }
  return { ok: true };
}
