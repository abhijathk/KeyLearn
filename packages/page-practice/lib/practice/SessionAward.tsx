import { useFormatter } from "@keybr/lesson-ui";
import { StrokeIcon } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./SessionAward.module.less";
import { type LessonEvent } from "./state/index.ts";

/**
 * A KeyLearn-styled celebration shown at eye level, just above the practice
 * text, when a round sets a new record or clears the daily goal — close to
 * where the user is already looking, so it actually gets read.
 */
export function SessionAward({
  event,
  onClose,
}: {
  readonly event: LessonEvent;
  readonly onClose: () => void;
}): ReactNode {
  const { formatSpeed } = useFormatter();

  let icon: ReactNode;
  let title: ReactNode;
  let detail: ReactNode = null;

  switch (event.type) {
    case "top-speed":
      icon = <StrokeIcon name="trophy" />;
      title = (
        <FormattedMessage id="t_ev_Top_speed" defaultMessage="New top speed!" />
      );
      detail = formatSpeed(event.speed);
      break;
    case "top-score":
      icon = <StrokeIcon name="trophy" />;
      title = (
        <FormattedMessage id="t_ev_Top_score" defaultMessage="New top score!" />
      );
      break;
    case "top-consistency":
      icon = <StrokeIcon name="gauge" />;
      title = (
        <FormattedMessage
          id="t_ev_Top_consistency"
          defaultMessage="Smoothest run yet!"
        />
      );
      detail = `${Math.round(event.consistency * 100)}%`;
      break;
    case "top-accuracy":
      icon = <StrokeIcon name="crown" />;
      title = (
        <FormattedMessage
          id="t_ev_Top_accuracy"
          defaultMessage="Best accuracy yet!"
        />
      );
      detail = `${Math.round(event.accuracy * 100)}%`;
      break;
    case "daily-goal":
      icon = <StrokeIcon name="crown" />;
      title = (
        <FormattedMessage
          id="t_ev_Daily_goal_reached"
          defaultMessage="You hit your daily goal!"
        />
      );
      break;
    default:
      return null;
  }

  return (
    <div className={styles.layer}>
      <div
        className={styles.card}
        role="status"
        onClick={onClose}
        title="Dismiss"
      >
        <div className={styles.tile}>{icon}</div>
        <div className={styles.text}>
          <div className={styles.title}>{title}</div>
          {detail != null && <div className={styles.detail}>{detail}</div>}
        </div>
      </div>
    </div>
  );
}
