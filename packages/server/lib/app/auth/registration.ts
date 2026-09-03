import { ApplicationError } from "@fastr/errors";
import { inviteCodes, registrationMode } from "../site-config/readers.ts";
import { type SiteConfigService } from "../site-config/service.ts";

/**
 * Who may create an account (control centre, `registration.mode`).
 *
 *  - open     anyone, as today.
 *  - invite   the register page needs a valid code from the list; a code
 *             is used once. Sign-in links and OAuth create no new account,
 *             because neither has anywhere to carry a code.
 *  - closed   no new accounts by any path.
 *
 * Existing users always sign in, whichever mode is chosen; nothing here
 * runs on a sign-in path. The refusal carries a code so the register page
 * can show the invite-code field or the closed notice rather than a bare
 * error.
 */

export class RegistrationRefused extends ApplicationError {
  constructor(
    readonly code: "registration-closed" | "invite-required" | "invite-invalid",
    message: string,
  ) {
    super(message, { status: 403, body: { error: { message, code } } });
  }
}

const CLOSED =
  "KeyLearn is not taking new accounts right now. If you already have one, sign in instead.";
const INVITE_NEEDED =
  "KeyLearn is invite-only right now. Enter your invite code to create an account, or sign in if you already have one.";
const INVITE_WRONG =
  "That invite code is not on the list, or has already been used. Check it and try again.";
const NO_CODE_PATH =
  "KeyLearn is invite-only right now. Create your account on the register page with your invite code; sign-in links and Google create accounts only while registration is open.";

function normalise(code: string): string {
  return code.trim();
}

/**
 * The register page: a password sign-up. Throws unless the mode allows it,
 * and returns the code that must be consumed after the account is created
 * (null in open mode).
 */
export function assertMayRegister(
  inviteCode: string | null | undefined,
): string | null {
  switch (registrationMode()) {
    case "open":
      return null;
    case "closed":
      throw new RegistrationRefused("registration-closed", CLOSED);
    case "invite": {
      const code = inviteCode == null ? "" : normalise(inviteCode);
      if (code === "") {
        throw new RegistrationRefused("invite-required", INVITE_NEEDED);
      }
      if (!inviteCodes().includes(code)) {
        throw new RegistrationRefused("invite-invalid", INVITE_WRONG);
      }
      return code;
    }
  }
}

/**
 * A path with no code field — a sign-in link for an unknown address, or an
 * OAuth first sign-in. Allowed only while registration is open.
 */
export function assertMayCreateAccountWithoutCode(): void {
  switch (registrationMode()) {
    case "open":
      return;
    case "closed":
      throw new RegistrationRefused("registration-closed", CLOSED);
    case "invite":
      throw new RegistrationRefused("invite-required", NO_CODE_PATH);
  }
}

/**
 * Removes a used code from the list, as a system change in the history
 * (actor null), so the control centre shows the list shrinking and the
 * audit trail says why. Never throws: an account that has just been
 * created must not fail because bookkeeping did.
 */
export async function consumeInviteCode(
  code: string,
  siteConfig: SiteConfigService,
): Promise<void> {
  try {
    const remaining = inviteCodes().filter((item) => item !== code);
    await siteConfig.set("registration.inviteCodes", remaining, {
      userId: null,
      reason: `invite code used`,
    });
  } catch {
    // Logged by the service; the account exists either way.
  }
}
