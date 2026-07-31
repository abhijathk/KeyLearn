import { logout as doLogout } from "@keybr/pages-shared";
import { type ReactNode, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { useNavigate } from "react-router";
import { ConfirmDialog } from "../ConfirmDialog.tsx";
import * as shell from "../FloatingShell.module.less";
import { useProfiles } from "./context.tsx";
import { ProfileAvatar } from "./ProfileAvatar.tsx";
import * as styles from "./ProfilePicker.module.less";

/**
 * Shown once per session after signing in to an account that has several
 * grown-ups: a compact floating window asking who is practising. Every profile
 * — kids and grown-ups — is offered; picking one switches to it. There is no
 * dismiss, only a small log-out button (with confirmation) to leave.
 */
export function ProfilePicker(): ReactNode {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { needsPick, household, select } = useProfiles();
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!needsPick) {
    return null;
  }

  const pick = (id: string, kind: "adult" | "kid") => {
    select(id);
    navigate(kind === "kid" ? "/kids" : "/");
  };

  return (
    <div className={shell.overlay} role="presentation">
      <div
        className={`${shell.window} ${shell.compact}`}
        role="dialog"
        aria-modal={true}
      >
        <div className={shell.windowHead}>
          <span className={shell.windowTitle}>
            <FormattedMessage
              id="profiles.picker.title"
              defaultMessage="Who's practising?"
            />
          </span>
          <button
            className={styles.logoutBtn}
            onClick={() => setConfirmLogout(true)}
          >
            <FormattedMessage id="nav.logOut" defaultMessage="Log out" />
          </button>
        </div>
        <div className={shell.windowBody}>
          <div className={styles.grid}>
            {household.profiles.map((p) => (
              <button
                key={p.id}
                className={styles.tile}
                onClick={() => pick(p.id, p.kind)}
              >
                <ProfileAvatar avatar={p.avatar} name={p.firstName} size={72} />
                <span className={styles.name}>{p.firstName}</span>
                <span className={styles.kind}>
                  {p.kind === "kid" ? (
                    <FormattedMessage id="profiles.kid" defaultMessage="Kid" />
                  ) : (
                    <FormattedMessage
                      id="profiles.adult"
                      defaultMessage="Grown-up"
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {confirmLogout && (
        <ConfirmDialog
          title={formatMessage(
            defineMessage({
              id: "drawer.logout.title",
              defaultMessage: "Log out?",
            }),
          )}
          message={formatMessage(
            defineMessage({
              id: "drawer.logout.message",
              defaultMessage:
                "Practice history stays on this device and on your account. You can log back in any time.",
            }),
          )}
          confirmLabel={formatMessage(
            defineMessage({ id: "nav.logOut", defaultMessage: "Log out" }),
          )}
          onConfirm={() => {
            void doLogout();
          }}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </div>
  );
}
