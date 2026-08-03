import { clsx } from "clsx";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { LeaveIcon, PeopleIcon } from "./image/icons.tsx";
import * as styles from "./Status.module.less";

/**
 * The states you meet before a race: connecting, offline, removed.
 *
 * One card, the app's own furniture — the mint mark, the value font for the
 * title, muted body text. They used to be bare headings and paragraphs, which
 * read like a server error page had been dropped into the middle of the
 * product.
 */
function Status({
  icon,
  title,
  body,
  warn = false,
  busy = false,
}: {
  readonly icon: ReactNode;
  readonly title: ReactNode;
  readonly body: ReactNode;
  readonly warn?: boolean;
  readonly busy?: boolean;
}): ReactNode {
  return (
    <div className={clsx(styles.root, warn && styles.warn)} role="status">
      <span className={styles.mark}>{icon}</span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{body}</p>
      {busy && (
        <span className={styles.dots} aria-hidden={true}>
          <i />
          <i />
          <i />
        </span>
      )}
    </div>
  );
}

export function Connecting(): ReactNode {
  return (
    <Status
      busy={true}
      icon={<PeopleIcon />}
      title={
        <FormattedMessage
          id="multiplayer.status.connecting.title"
          defaultMessage="Finding you a room"
        />
      }
      body={
        <FormattedMessage
          id="multiplayer.status.connecting.body"
          defaultMessage="One moment while we sit you down with the others."
        />
      }
    />
  );
}

export function Offline(): ReactNode {
  return (
    <Status
      warn={true}
      icon={<LeaveIcon />}
      title={
        <FormattedMessage
          id="multiplayer.status.offline.title"
          defaultMessage="Live practice is unreachable"
        />
      }
      body={
        <FormattedMessage
          id="multiplayer.status.offline.body"
          defaultMessage="We cannot reach the practice rooms right now. Solo practice is unaffected — try again in a few minutes."
        />
      }
    />
  );
}

export function Kicked(): ReactNode {
  return (
    <Status
      warn={true}
      icon={<LeaveIcon />}
      title={
        <FormattedMessage
          id="multiplayer.status.kicked.title"
          defaultMessage="You were away too long"
        />
      }
      body={
        <FormattedMessage
          id="multiplayer.status.kicked.body"
          defaultMessage="Your place went to somebody who was waiting. Reload the page to join another room."
        />
      }
    />
  );
}
