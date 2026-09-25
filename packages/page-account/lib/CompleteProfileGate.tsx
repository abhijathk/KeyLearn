import { logout, usePageData } from "@keylearn/pages-shared";
import { Button, TextField, type TextFieldRef } from "@keylearn/widget";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./AuthPage.module.less";
import { DobEntry, type DobResult, GrownUpGate } from "./DobEntry.tsx";
import { AccountService } from "./service.ts";

function reload(url: string) {
  window.location.href = url;
}

/**
 * A blocking overlay that collects the account owner's date of birth when it
 * was never asked — chiefly OAuth sign-ups, which skip the register form and
 * so bypass the age gate. Under-13 owners aren't allowed, so their (already
 * created) account is deleted and they're signed out.
 */
export function CompleteProfileGate(): ReactNode {
  const { user } = usePageData();
  // Only for a signed-in account that has no date of birth on record.
  if (user == null || user.dateOfBirth != null) {
    return null;
  }
  return <Gate name={user.name} />;
}

function Gate({ name }: { readonly name: string }): ReactNode {
  const { formatMessage } = useIntl();
  const [displayName, setDisplayName] = useState(name);
  const [dob, setDob] = useState<DobResult>({
    dateOfBirth: null,
    tooYoung: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const nameField = useRef<TextFieldRef>(null);
  const card = useRef<HTMLDivElement>(null);

  // The page underneath grabs focus as it mounts (the practice text area,
  // which keeps Tab for itself, focuses itself after this gate has), and then
  // a keyboard user can never reach this form. Hold focus inside the gate:
  // anything that lands outside it is sent back to the name field.
  useEffect(() => {
    nameField.current?.focus();
    const hold = (ev: FocusEvent) => {
      if (!card.current?.contains(ev.target as Node)) {
        nameField.current?.focus();
      }
    };
    document.addEventListener("focusin", hold);
    return () => {
      document.removeEventListener("focusin", hold);
    };
  }, []);

  const save = async () => {
    if (dob.dateOfBirth == null || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const trimmed = displayName.trim();
      if (trimmed !== "" && trimmed !== name) {
        await AccountService.patchAccount({ name: trimmed });
      }
      // Land on the account page next, where the first learner is set up.
      await AccountService.completeProfile(dob.dateOfBirth);
      reload("/account");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
      setBusy(false);
    }
  };

  // Under-13: the account already exists (created during the OAuth callback),
  // so deleting it is the COPPA-correct move — completeProfile does that
  // server-side, then we land back logged out.
  const removeUnderage = () => {
    if (dob.dateOfBirth == null || busy) {
      return;
    }
    setBusy(true);
    AccountService.completeProfile(dob.dateOfBirth).finally(() => reload("/"));
  };

  return (
    <div className={styles.overlay}>
      <div
        ref={card}
        className={styles.overlayCard}
        role="dialog"
        aria-modal={true}
        aria-labelledby={titleId}
      >
        <div className={styles.overlayTitle} id={titleId}>
          <FormattedMessage
            id="auth.finish.welcome"
            defaultMessage="Welcome to KeyLearn, {name}!"
            values={{ name }}
          />
        </div>
        <p className={styles.intro}>
          <FormattedMessage
            id="auth.finish.intro2"
            defaultMessage="Just one thing to keep KeyLearn safe for children — your date of birth. Next, you’ll add a profile for each learner in your household."
          />
        </p>
        <TextField
          ref={nameField}
          size="full"
          type="text"
          autoComplete="name"
          placeholder={formatMessage({
            id: "auth.finish.namePlaceholder",
            defaultMessage: "Your name",
          })}
          value={displayName}
          onChange={setDisplayName}
        />
        <DobEntry onResult={setDob} />
        {dob.tooYoung ? (
          <>
            <GrownUpGate />
            <div className={styles.primary}>
              <Button
                size="full"
                label={formatMessage({
                  id: "auth.finish.signOut",
                  defaultMessage: "Sign out",
                })}
                disabled={busy}
                onClick={removeUnderage}
              />
            </div>
          </>
        ) : (
          <div className={styles.primary}>
            <Button
              size="full"
              label={formatMessage({
                id: "auth.finish.save",
                defaultMessage: "Continue",
              })}
              disabled={dob.dateOfBirth == null || busy}
              onClick={save}
            />
          </div>
        )}
        {error != null && <p className={styles.error}>{error}</p>}
        <div className={styles.links}>
          <a
            className={styles.link}
            href="#"
            onClick={(ev) => {
              ev.preventDefault();
              void logout();
            }}
          >
            <FormattedMessage
              id="auth.finish.logout"
              defaultMessage="Log out"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
