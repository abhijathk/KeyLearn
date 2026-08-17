import { type ReactNode, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./AboutPage.module.less";
import * as common from "./common.module.less";
import { DESK_APP_VERSION } from "./desk-release-notes.ts";
import { DeskReleaseNotesDialog } from "./DeskReleaseNotesDialog.tsx";
import { DeskShell } from "./DeskShell.tsx";

export function AboutPage(): ReactNode {
  return (
    <DeskShell active="about">
      <About />
    </DeskShell>
  );
}

function About(): ReactNode {
  const [notesOpen, setNotesOpen] = useState(false);
  return (
    <div className={styles.page}>
      <h1 className={styles.headline}>
        <FormattedMessage
          id="deskAbout.headline"
          defaultMessage="About QDesk"
        />
      </h1>
      <p className={styles.intro}>
        <FormattedMessage
          id="deskAbout.intro"
          defaultMessage="QDesk is an AI-automated support desk: tickets are classified, drafted, and closed by an agent for the routine cases, and anything genuinely critical — a security concern, a distressed customer, an explicit request for a human — is left untouched for staff. It isn't KeyLearn's support desk; it's a standalone support platform that KeyLearn happens to be the first app running on. Each app it supports keeps its own accounts and data — QDesk only ever sees the conversation."
        />
      </p>

      <div className={common.card} style={{ marginBlockStart: 0 }}>
        <p className={common.micro}>
          <FormattedMessage
            id="deskAbout.version.title"
            defaultMessage="Version"
          />
        </p>
        <p className={styles.versionLine}>
          <FormattedMessage
            id="deskAbout.version.p"
            defaultMessage="You're running QDesk <em>v{version}</em>."
            values={{
              version: DESK_APP_VERSION,
              em: (chunks: ReactNode) => <em>{chunks}</em>,
            }}
          />{" "}
          <button
            type="button"
            className={styles.inlineLink}
            onClick={() => setNotesOpen(true)}
          >
            <FormattedMessage
              id="deskAbout.version.seeWhatChanged"
              defaultMessage="See what changed"
            />
          </button>
        </p>
      </div>

      <div className={common.card}>
        <p className={common.micro}>
          <FormattedMessage
            id="deskAbout.scope.title"
            defaultMessage="What lives here"
          />
        </p>
        <ul className={styles.scopeList}>
          <li>
            <FormattedMessage
              id="deskAbout.scope.1"
              defaultMessage="Tickets, replies, and the automation that drafts and resolves the routine ones."
            />
          </li>
          <li>
            <FormattedMessage
              id="deskAbout.scope.2"
              defaultMessage="Account actions on the apps it supports — lookups, deletion requests — always logged."
            />
          </li>
          <li>
            <FormattedMessage
              id="deskAbout.scope.3"
              defaultMessage="Site notices, staff settings, and the audit log of every staff and automated action."
            />
          </li>
        </ul>
        <p className={common.noteSmall}>
          <FormattedMessage
            id="deskAbout.scope.note"
            defaultMessage="Nothing about typing practice itself — lessons, profiles, kids mode — lives here; that's KeyLearn's own, same as any other app QDesk supports keeps its own product."
          />
        </p>
      </div>

      <div className={common.card}>
        <p className={common.micro}>
          <FormattedMessage
            id="deskAbout.apps.title"
            defaultMessage="Apps it supports"
          />
        </p>
        <div className={common.facts}>
          <div className={common.fact}>
            <span className={common.factK}>KeyLearn</span>
            <span className={common.factV}>
              <FormattedMessage
                id="deskAbout.apps.active"
                defaultMessage="Active"
              />
            </span>
          </div>
        </div>
        <p className={common.noteSmall}>
          <FormattedMessage
            id="deskAbout.apps.note"
            defaultMessage="The first app, not the only one it's built for — more can be added without rebuilding the desk."
          />
        </p>
      </div>

      <div className={styles.foot}>
        <FormattedMessage
          id="deskAbout.foot"
          defaultMessage="QDesk · v{version}"
          values={{ version: DESK_APP_VERSION }}
        />
      </div>

      {notesOpen && (
        <DeskReleaseNotesDialog onClose={() => setNotesOpen(false)} />
      )}
    </div>
  );
}
