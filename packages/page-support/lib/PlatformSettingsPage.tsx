import { type StaffRosterEntry } from "@keylearn/pages-shared";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as common from "./common.module.less";
import { DeskShell } from "./DeskShell.tsx";
import { relativeTime } from "./relativeTime.ts";
import { SupportService } from "./service.ts";

/**
 * Every app this desk is built to run support for — not just what's
 * actually wired up today. Kept in sync by hand with the About page's own
 * "Apps it supports" list; the app-switcher below only turns on once a
 * staff member's own email appears in more than one of these.
 */
const APPS: readonly { readonly id: string; readonly name: string }[] = [
  { id: "keylearn", name: "KeyLearn" },
];

export function PlatformSettingsPage(): ReactNode {
  return (
    <DeskShell active="platformSettings">
      <PlatformSettings />
    </DeskShell>
  );
}

function PlatformSettings(): ReactNode {
  return (
    <div className={common.split}>
      <div>
        <AppSwitcher />
      </div>
      <div>
        <StaffRoster />
      </div>
    </div>
  );
}

/**
 * Only one app exists today, so there's nothing to switch between — this
 * renders the single app as a plain fact, not a selector, until a second
 * app is actually assigned to the same staff email. The real "which apps
 * is this staff member assigned to" check needs a second app's own staff
 * roster to compare against, which doesn't exist yet; `APPS.length` is the
 * honest stand-in until it does.
 */
function AppSwitcher(): ReactNode {
  const single = APPS.length <= 1;
  return (
    <div className={common.card} style={{ marginBlockStart: 0 }}>
      <p className={common.micro}>
        <FormattedMessage
          id="deskPlatform.apps.title"
          defaultMessage="Managing"
        />
      </p>
      {single ? (
        <>
          <div className={common.facts}>
            <div className={common.fact}>
              <span className={common.factK}>{APPS[0].name}</span>
              <span className={common.factV}>
                <FormattedMessage
                  id="deskPlatform.apps.active"
                  defaultMessage="Active"
                />
              </span>
            </div>
          </div>
          <p className={common.noteSmall}>
            <FormattedMessage
              id="deskPlatform.apps.singleNote"
              defaultMessage="The only app assigned to your account. Once you're assigned to more than one, a switcher shows up here instead."
            />
          </p>
        </>
      ) : (
        <div className={common.tabs}>
          {APPS.map((app) => (
            <button key={app.id} type="button" className={common.tab}>
              {app.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StaffRoster(): ReactNode {
  const { formatMessage } = useIntl();
  const [roster, setRoster] = useState<StaffRosterEntry[] | null>(null);

  useEffect(() => {
    SupportService.getStaffRoster().then(setRoster);
  }, []);

  const statusFor = (entry: StaffRosterEntry): string => {
    if (!entry.hasPasskey && !entry.hasAuthenticator) {
      return formatMessage({
        id: "deskSettings.roster.noFactor",
        defaultMessage: "No second factor yet",
      });
    }
    const factor = entry.hasPasskey
      ? formatMessage({
          id: "deskSettings.roster.passkey",
          defaultMessage: "Passkey",
        })
      : formatMessage({
          id: "deskSettings.roster.authenticator",
          defaultMessage: "Authenticator",
        });
    const when =
      entry.lastSignedInAt != null
        ? formatMessage(
            {
              id: "deskSettings.roster.signedIn",
              defaultMessage: "signed in {when}",
            },
            { when: relativeTime(entry.lastSignedInAt) },
          )
        : formatMessage({
            id: "deskSettings.roster.neverSignedIn",
            defaultMessage: "never signed in",
          });
    return `${factor} · ${when}`;
  };

  return (
    <div className={common.card} style={{ marginBlockStart: 0 }}>
      <p className={common.micro}>
        <FormattedMessage
          id="deskSettings.roster.title"
          defaultMessage="Staff — shown but not editable"
        />
      </p>
      {roster == null && (
        <p className={common.note}>
          <FormattedMessage id="staffDesk.loading" defaultMessage="Loading…" />
        </p>
      )}
      <div className={common.facts}>
        {roster?.map((entry) => (
          <div className={common.fact} key={entry.email}>
            <span className={common.factK}>{entry.name ?? entry.email}</span>
            <span className={common.factV}>{statusFor(entry)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
