import { test } from "node:test";
import { equal, isNull } from "rich-assert";
import { passkeyErrorMessage } from "./passkey-errors.ts";

const intl = {
  formatMessage: ({ defaultMessage }: { defaultMessage?: unknown }) =>
    String(defaultMessage),
} as Parameters<typeof passkeyErrorMessage>[2];

test("a cancelled prompt reads as plain words, with no link", () => {
  const err = Object.assign(
    new Error(
      "The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/#sctn-privacy-considerations-client.",
    ),
    { name: "NotAllowedError" },
  );
  equal(
    passkeyErrorMessage(err, "add", intl),
    "No passkey was added. The request was cancelled or took too long. You can try again.",
  );
  equal(
    passkeyErrorMessage(err, "confirm", intl),
    "The passkey check was cancelled or took too long. You can try again.",
  );
});

test("the library's own abort code counts as a cancel", () => {
  const err = Object.assign(new Error("aborted"), {
    name: "AbortError",
    code: "ERROR_CEREMONY_ABORTED",
  });
  equal(
    passkeyErrorMessage(err, "add", intl),
    "No passkey was added. The request was cancelled or took too long. You can try again.",
  );
});

test("a device that already has one says so", () => {
  const err = Object.assign(new Error("x"), {
    name: "InvalidStateError",
    code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
  });
  equal(
    passkeyErrorMessage(err, "add", intl),
    "This device already has a passkey for your account.",
  );
});

test("other browser failures get one plain answer", () => {
  const err = Object.assign(new Error("RP ID mismatch, see webauthn spec"), {
    name: "SecurityError",
  });
  equal(
    passkeyErrorMessage(err, "add", intl),
    "This browser or device couldn’t use a passkey. Try again, or use another device.",
  );
});

test("our own server's message is shown as it is", () => {
  const err = new Error("That passkey could not be verified.");
  equal(
    passkeyErrorMessage(err, "add", intl),
    "That passkey could not be verified.",
  );
  isNull(passkeyErrorMessage(null, "add", intl));
});
