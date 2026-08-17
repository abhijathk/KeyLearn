import { useIntlDates } from "@keylearn/intl";
import { FloatingShell } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useState } from "react";
import { FormattedMessage } from "react-intl";
import { DESK_RELEASE_NOTES } from "./desk-release-notes.ts";
import * as styles from "./DeskReleaseNotesDialog.module.less";

/**
 * What changed on the desk, release by release — opened from the About
 * page's Version section. Same rail-plus-pane shape as the learner app's
 * own release notes window, kept as its own copy rather than a shared
 * import: this package is the part of the codebase meant to peel off into
 * its own repo later, so it doesn't reach into `@keylearn/page-static`.
 */
export function DeskReleaseNotesDialog({
  onClose,
}: {
  readonly onClose: () => void;
}): ReactNode {
  const { formatDate, formatDateTime } = useIntlDates();
  const [version, setVersion] = useState(DESK_RELEASE_NOTES[0]?.version);
  const note =
    DESK_RELEASE_NOTES.find((n) => n.version === version) ??
    DESK_RELEASE_NOTES[0];
  return (
    <FloatingShell flush={true} onClose={onClose}>
      <div className={styles.layout}>
        <nav className={styles.rail}>
          <span className={styles.railLabel}>
            <FormattedMessage
              id="deskAbout.releaseNotes.title"
              defaultMessage="Release notes"
            />
          </span>
          <ul className={styles.railList}>
            {DESK_RELEASE_NOTES.map((n) => (
              <li key={n.version}>
                <button
                  type="button"
                  className={clsx(
                    styles.railItem,
                    n.version === note?.version && styles.railItemOn,
                  )}
                  onClick={() => setVersion(n.version)}
                >
                  <span className={styles.railVersion}>
                    <FormattedMessage
                      id="deskAbout.releaseNotes.version"
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
                    id="deskAbout.releaseNotes.version"
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
