import { useIntlDates } from "@keylearn/intl";
import { FloatingShell } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useState } from "react";
import { FormattedMessage } from "react-intl";
import { RELEASE_NOTES } from "./release-notes.ts";
import * as styles from "./ReleaseNotesDialog.module.less";

/**
 * What changed, release by release — opened from the About page's Version
 * section. A left rail lists every version (newest first); picking one shows
 * just that release in the pane, so the window stays a fixed size no matter
 * how many releases pile up, rather than growing into one long scroll.
 */
export function ReleaseNotesDialog({
  onClose,
}: {
  readonly onClose: () => void;
}): ReactNode {
  const { formatDate, formatDateTime } = useIntlDates();
  const [version, setVersion] = useState(RELEASE_NOTES[0]?.version);
  const note =
    RELEASE_NOTES.find((n) => n.version === version) ?? RELEASE_NOTES[0];
  return (
    <FloatingShell flush={true} onClose={onClose}>
      <div className={styles.layout}>
        <nav className={styles.rail}>
          <span className={styles.railLabel}>
            <FormattedMessage
              id="releaseNotes.title"
              defaultMessage="Release notes"
            />
          </span>
          <ul className={styles.railList}>
            {RELEASE_NOTES.map((n) => (
              <li key={n.version}>
                <button
                  className={clsx(
                    styles.railItem,
                    n.version === note?.version && styles.railItemOn,
                  )}
                  onClick={() => setVersion(n.version)}
                >
                  <span className={styles.railVersion}>
                    <FormattedMessage
                      id="releaseNotes.version"
                      defaultMessage="v{version}"
                      values={{ version: n.version }}
                    />
                  </span>
                  <time className={styles.railDate} dateTime={n.date}>
                    {formatDate(new Date(n.date))}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {note != null && (
          <div className={styles.pane}>
            <div className={styles.paneScroll}>
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
            </div>
          </div>
        )}
      </div>
    </FloatingShell>
  );
}
