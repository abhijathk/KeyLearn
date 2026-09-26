import { type IntlShape } from "react-intl";

/**
 * What to tell a person when a passkey prompt does not end in a passkey.
 *
 * The browser's own errors are written for developers: cancelling the prompt
 * produced "The operation either timed out or was not allowed. See:
 * https://www.w3.org/TR/webauthn-2/#sctn-privacy-considerations-client." on
 * the Security card. Those come from WebAuthn (and from the library wrapping
 * it) and are recognised here by name or code, then replaced with a plain
 * sentence. Anything else is our own server's message, which is already
 * written for people, and is shown as it is.
 */
export function passkeyErrorMessage(
  err: unknown,
  action: "add" | "confirm",
  { formatMessage }: Pick<IntlShape, "formatMessage">,
): string | null {
  const e = err as { name?: string; code?: string; message?: string } | null;
  const name = e?.name ?? "";
  const code = e?.code ?? "";
  const message = e?.message ?? "";
  // Cancelled, dismissed, or left until it timed out. Browsers deliberately
  // report all three the same way, so they get one answer.
  if (
    name === "NotAllowedError" ||
    name === "AbortError" ||
    code === "ERROR_CEREMONY_ABORTED" ||
    /timed out or was not allowed/i.test(message)
  ) {
    return action === "add"
      ? formatMessage({
          id: "security.passkey.cancelled",
          defaultMessage:
            "No passkey was added. The request was cancelled or took too long. You can try again.",
        })
      : formatMessage({
          id: "security.passkey.confirmCancelled",
          defaultMessage:
            "The passkey check was cancelled or took too long. You can try again.",
        });
  }
  if (
    name === "InvalidStateError" ||
    code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"
  ) {
    return formatMessage({
      id: "security.passkey.already",
      defaultMessage: "This device already has a passkey for your account.",
    });
  }
  // Any other WebAuthn failure: unsupported, blocked by the page, no
  // authenticator. The detail helps nobody; what to do next does.
  if (
    [
      "NotSupportedError",
      "SecurityError",
      "UnknownError",
      "ConstraintError",
      "EncodingError",
    ].includes(name) ||
    code.startsWith("ERROR_")
  ) {
    return formatMessage({
      id: "security.passkey.unavailable",
      defaultMessage:
        "This browser or device couldn’t use a passkey. Try again, or use another device.",
    });
  }
  if (/webauthn|w3\.org/i.test(message)) {
    return formatMessage({
      id: "security.passkey.unavailable",
      defaultMessage:
        "This browser or device couldn’t use a passkey. Try again, or use another device.",
    });
  }
  return message || null;
}
