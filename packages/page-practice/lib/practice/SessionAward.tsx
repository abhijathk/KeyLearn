import { useFormatter } from "@keylearn/lesson-ui";
import { StrokeIcon } from "@keylearn/widget";
import { type CSSProperties, type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useKidsPractice } from "./kids-flavour.ts";
import * as styles from "./SessionAward.module.less";
import { type LessonEvent } from "./state/index.ts";

/**
 * How long a toast stays up. PracticeScreen owns the timer (`awardTimer`,
 * 3500 ms) — this mirrors it so the kids countdown ring drains over exactly
 * the time the toast is on screen. Change both together.
 */
const AWARD_LIFETIME_MS = 3500;

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
  const kids = useKidsPractice();
  const { formatSpeed } = useFormatter();
  const { formatMessage } = useIntl();

  if (kids) {
    return <KidsAward event={event} />;
  }

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
        title={formatMessage({ id: "t_Dismiss", defaultMessage: "Dismiss" })}
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

const TONES = {
  speed: styles.kidsToneSpeed,
  score: styles.kidsToneScore,
  accuracy: styles.kidsToneAccuracy,
  smooth: styles.kidsToneSmooth,
  beat: styles.kidsToneBeat,
  close: styles.kidsToneClose,
} as const;

type KidsTone = keyof typeof TONES;

/**
 * The Classic screen's record toast: a vivid card in the record's own colour,
 * a white icon disc, and a thin ring around it that drains over the toast's
 * lifetime so a child can see it will go away by itself. No close button —
 * the card closes on its own and never asks for a click mid-lesson.
 */
function KidsAward({ event }: { readonly event: LessonEvent }): ReactNode {
  const { formatSpeed } = useFormatter();
  const { formatNumber } = useIntl();

  let tone: KidsTone;
  let glyph: ReactNode;
  let kicker: ReactNode;
  let title: ReactNode;
  let sub: ReactNode;

  switch (event.type) {
    case "top-speed":
      tone = "speed";
      glyph = <path d="M13 2L4 14h7l-1 8 9-12h-7z" />;
      kicker = <KickerRecord />;
      title = (
        <FormattedMessage
          id="kids.award.topSpeed.title"
          defaultMessage="Top speed · {value}"
          values={{ value: formatSpeed(event.speed) }}
        />
      );
      sub = (
        <FormattedMessage
          id="kids.award.topSpeed.sub"
          defaultMessage="Your fastest ever"
        />
      );
      break;
    case "top-score":
      tone = "score";
      glyph = (
        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
      );
      kicker = <KickerRecord />;
      title = (
        <FormattedMessage
          id="kids.award.topScore.title"
          defaultMessage="Top score · {value}"
          values={{ value: formatNumber(Math.round(event.score)) }}
        />
      );
      sub = (
        <FormattedMessage
          id="kids.award.topScore.sub"
          defaultMessage="Highest score yet"
        />
      );
      break;
    case "top-accuracy":
      tone = "accuracy";
      glyph = (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
        </>
      );
      kicker = <KickerBest />;
      title = (
        <FormattedMessage
          id="kids.award.topAccuracy.title"
          defaultMessage="Accuracy · {value}"
          values={{ value: `${Math.round(event.accuracy * 1000) / 10}%` }}
        />
      );
      sub = (
        <FormattedMessage
          id="kids.award.topAccuracy.sub"
          defaultMessage="Your cleanest run"
        />
      );
      break;
    case "top-consistency":
      tone = "smooth";
      glyph = <path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />;
      kicker = <KickerBest />;
      title = (
        <FormattedMessage
          id="kids.award.topConsistency.title"
          defaultMessage="Smoothest run · {value}"
          values={{ value: `${Math.round(event.consistency * 100)}%` }}
        />
      );
      sub = (
        <FormattedMessage
          id="kids.award.topConsistency.sub"
          defaultMessage="Your steadiest rhythm"
        />
      );
      break;
    case "beat-last-run":
      tone = "beat";
      glyph = <path d="M5 12h14M13 6l6 6-6 6" />;
      kicker = (
        <FormattedMessage
          id="kids.award.kicker.beat"
          defaultMessage="Beat it"
        />
      );
      title = (
        <FormattedMessage
          id="kids.award.beatLast.title"
          defaultMessage="+{value} on your last run"
          values={{ value: formatSpeed(event.score - event.previous) }}
        />
      );
      sub = (
        <FormattedMessage
          id="kids.award.beatLast.sub"
          defaultMessage="Keep it going"
        />
      );
      break;
    case "near-last-run":
      tone = "close";
      glyph = <path d="M5 21V4M5 4h11l-2 4 2 4H5" />;
      kicker = (
        <FormattedMessage
          id="kids.award.kicker.close"
          defaultMessage="So close"
        />
      );
      title = (
        <FormattedMessage
          id="kids.award.nearLast.title"
          defaultMessage="{gap}% off your last run"
          values={{ gap: event.gap }}
        />
      );
      sub = (
        <FormattedMessage
          id="kids.award.nearLast.sub"
          defaultMessage="One more try?"
        />
      );
      break;
    default:
      return null;
  }

  return (
    <div className={styles.layer}>
      <div
        // A fresh event restarts the entry and the countdown ring, even when
        // two awards of the same kind arrive back to back.
        key={eventKey(event)}
        className={`${styles.kidsCard} ${TONES[tone]}`}
        role="status"
        style={
          { "--kids-award-life": `${AWARD_LIFETIME_MS}ms` } as CSSProperties
        }
      >
        <span className={styles.kidsBadge}>
          <svg
            className={styles.kidsRing}
            viewBox="0 0 72 72"
            aria-hidden={true}
          >
            <circle className={styles.kidsRingTrack} cx="36" cy="36" r="30" />
            <circle
              className={styles.kidsRingLeft}
              cx="36"
              cy="36"
              r="30"
              pathLength={100}
            />
          </svg>
          <span className={styles.kidsDisc}>
            <svg viewBox="0 0 24 24" aria-hidden={true}>
              {glyph}
            </svg>
          </span>
        </span>
        <span className={styles.kidsText}>
          <span className={styles.kidsKicker}>{kicker}</span>
          <span className={styles.kidsTitle}>{title}</span>
          <span className={styles.kidsSub}>{sub}</span>
        </span>
      </div>
    </div>
  );
}

function KickerRecord(): ReactNode {
  return (
    <FormattedMessage
      id="kids.award.kicker.record"
      defaultMessage="New record"
    />
  );
}

function KickerBest(): ReactNode {
  return (
    <FormattedMessage
      id="kids.award.kicker.best"
      defaultMessage="Personal best"
    />
  );
}

const eventKeys = new WeakMap<LessonEvent, number>();
let nextEventKey = 0;

function eventKey(event: LessonEvent): number {
  let key = eventKeys.get(event);
  if (key == null) {
    eventKeys.set(event, (key = ++nextEventKey));
  }
  return key;
}
