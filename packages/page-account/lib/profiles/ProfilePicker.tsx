import { StrokeIcon } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useNavigate } from "react-router";
import * as shell from "../FloatingShell.module.less";
import { useProfiles } from "./context.tsx";
import { ProfileAvatar } from "./ProfileAvatar.tsx";
import * as styles from "./ProfilePicker.module.less";

/**
 * Shown once after signing in to an account that has several grown-ups and no
 * learner chosen yet: a floating window asking who is practising. Every
 * profile — kids and grown-ups — is offered; picking one switches to it, and
 * dismissing keeps the admin account for now.
 */
export function ProfilePicker(): ReactNode {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { needsPick, household, select, dismissPick } = useProfiles();

  if (!needsPick) {
    return null;
  }

  const pick = (id: string, kind: "adult" | "kid") => {
    select(id);
    navigate(kind === "kid" ? "/kids" : "/");
  };

  return (
    <div
      className={shell.overlay}
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) {
          dismissPick();
        }
      }}
    >
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
            className={shell.windowClose}
            title={formatMessage({
              id: "profiles.picker.dismiss",
              defaultMessage: "Stay on the account",
            })}
            onClick={dismissPick}
          >
            <StrokeIcon name="close" />
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
    </div>
  );
}
