import { useIntlDates } from "@keylearn/intl";
import { FloatingShell } from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { RELEASE_NOTES } from "./release-notes.ts";
import * as styles from "./ReleaseNotesDialog.module.less";

/**
 * What changed, release by release — newest first, opened from the About
 * page's Version section.
 */
export function ReleaseNotesDialog({
  onClose,
}: {
  readonly onClose: () => void;
}): ReactNode {
  const { formatDateTime } = useIntlDates();
  return (
    <FloatingShell
      compact={true}
      onClose={onClose}
      title={
        <FormattedMessage
          id="releaseNotes.title"
          defaultMessage="Release notes"
        />
      }
    >
      <ul className={styles.list}>
        {RELEASE_NOTES.map((note) => (
          <li key={note.version} className={styles.entry}>
            <div className={styles.entryHead}>
              <span className={styles.version}>
                <FormattedMessage
                  id="releaseNotes.version"
                  defaultMessage="v{version}"
                  values={{ version: note.version }}
                />
              </span>
              <time className={styles.date} dateTime={note.date}>
                {formatDateTime(new Date(note.date))}
              </time>
            </div>
            <ul className={styles.changes}>
              {note.changes.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </FloatingShell>
  );
}
