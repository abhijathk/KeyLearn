import { useFormatter } from "@keylearn/lesson-ui";
import { StrokeIcon } from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
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
  const { formatMessage } = useIntl();

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
    case "beat-last-run":
      icon = <StrokeIcon name="chart" />;
      title = (
        <FormattedMessage
          id="t_ev_Beat_last_run"
          defaultMessage="You beat your last run!"
        />
      );
      // How much better this round was, in effective speed (speed × accuracy),
      // so the claim is concrete and trustworthy.
      detail = `+${formatSpeed(event.score - event.previous)}`;
      break;
    case "near-last-run":
      icon = <StrokeIcon name="chart" />;
      title = (
        <FormattedMessage
          id="t_ev_Near_last_run"
          defaultMessage="So close — keep going!"
        />
      );
      detail = (
        <FormattedMessage
          id="t_ev_Near_last_run_gap"
          defaultMessage="{gap}% to go"
          values={{ gap: event.gap }}
        />
      );
      break;
    // "daily-goal" is intentionally not handled here — it opens the full
    // goal-report window instead of a transient toast.
    default:
      return null;
  }

  return (
    <div className={styles.layer}>
      <div
        className={styles.card}
        role="status"
        onClick={onClose}
        title={formatMessage({ id: "t_Close", defaultMessage: "Dismiss" })}
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
