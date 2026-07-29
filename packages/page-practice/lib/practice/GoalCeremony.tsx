import { useFormatter } from "@keybr/lesson-ui";
import { Pages } from "@keybr/pages-shared";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useNavigate } from "react-router";
import {
  pickRandom,
  QUOTES,
  REST_MAIN_LINES,
  REST_SUB_LINES,
  ROLL_LINES,
} from "./goal-copy.ts";
import * as styles from "./GoalCeremony.module.less";

export type GoalMode = "roll" | "rest";

// The daily-goal report: shown the moment today's practice crosses the goal
// (and again if the learner keeps going past the healthy ceiling). It reports
// today's numbers, a trend over the last practice days, what to work on next,
// and a rotating line of encouragement — nudging "one more" while it's still
// productive, then gently steering toward rest once it isn't.
export function GoalCeremony({
  goalMinutes,
  minutes,
  lessons,
  topSpeed,
  accuracy,
  weeklySpeeds,
  slowestKeys,
  isPersonalBest,
  mode,
  onContinue,
  onDone,
}: {
  readonly goalMinutes: number;
  readonly minutes: number;
  readonly lessons: number;
  readonly topSpeed: number;
  readonly accuracy: number;
  readonly weeklySpeeds: readonly number[];
  readonly slowestKeys: readonly string[];
  readonly isPersonalBest: boolean;
  readonly mode: GoalMode;
  readonly onContinue: () => void;
  readonly onDone: () => void;
}): ReactNode {
  const { formatMessage, formatDate } = useIntl();
  const { formatSpeed } = useFormatter();
  const navigate = useNavigate();
  const doneRef = useRef<HTMLButtonElement>(null);

  // Pick the copy once, when the window opens.
  const [copy] = useState(() => ({
    roll: pickRandom(ROLL_LINES),
    restMain: pickRandom(REST_MAIN_LINES),
    restSub: pickRandom(REST_SUB_LINES),
    quote: pickRandom(QUOTES),
  }));

  // Space = keep practising, but only under the healthy ceiling and only once
  // the window has been open ~1s (so a keystroke still in flight from the last
  // lesson can't dismiss it by accident).
  const armed = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      armed.current = true;
    }, 1000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") {
        return;
      }
      e.preventDefault();
      if (mode === "roll" && armed.current) {
        onContinue();
      }
      // In rest mode Space does nothing — the learner must choose Done.
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onContinue]);

  // Over the ceiling: focus Done for keyboard users.
  useEffect(() => {
    if (mode === "rest") {
      doneRef.current?.focus();
    }
  }, [mode]);

  const done = () => {
    onDone();
    navigate(Pages.profile.path);
  };

  const gain =
    weeklySpeeds.length >= 2
      ? weeklySpeeds[weeklySpeeds.length - 1] - weeklySpeeds[0]
      : 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.card} data-mode={mode} role="dialog" aria-modal="true">
        <div className={styles.tape} />
        <div className={styles.inner}>
          <div className={styles.rcHead}>
            <h1 className={styles.title}>
              <FormattedMessage
                id="goalReport.title"
                defaultMessage="Goal <b>report</b>"
                values={{ b: (c) => <b>{c}</b> }}
              />
            </h1>
            <div className={styles.stamp}>
              <FormattedMessage id="goalReport.stamp" defaultMessage="GOAL MET" />
            </div>
          </div>
          <div className={styles.metaline}>
            <FormattedMessage
              id="goalReport.meta"
              defaultMessage="{date} · Your goal: {minutes} min a day ✓"
              values={{
                date: formatDate(new Date(), {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }),
                minutes: goalMinutes,
              }}
            />
          </div>

          <div className={styles.rows}>
            <Row
              label={
                <FormattedMessage
                  id="goalReport.lessons"
                  defaultMessage="Lessons done"
                />
              }
              value={String(lessons)}
            />
            <Row
              label={
                <FormattedMessage
                  id="goalReport.time"
                  defaultMessage="Time practised"
                />
              }
              value={formatMinutes(minutes)}
            />
            <Row
              pb={isPersonalBest}
              label={
                <FormattedMessage
                  id="goalReport.topSpeed"
                  defaultMessage="Top speed"
                />
              }
              value={formatSpeed(topSpeed)}
            />
            <Row
              label={
                <FormattedMessage
                  id="goalReport.accuracy"
                  defaultMessage="Accuracy"
                />
              }
              value={`${Math.round(accuracy * 100)}%`}
            />
          </div>

          {weeklySpeeds.length >= 2 && (
            <>
              <hr className={styles.dash} />
              <div className={styles.barsCap}>
                <span>
                  <FormattedMessage
                    id="goalReport.chart"
                    defaultMessage="Speed · last {n} practice days"
                    values={{ n: weeklySpeeds.length }}
                  />
                </span>
                {gain > 0 && <span className={styles.gain}>+{formatSpeed(gain)}</span>}
              </div>
              <SpeedChart speeds={weeklySpeeds} />
            </>
          )}

          {slowestKeys.length > 0 && (
            <div className={styles.focus}>
              <span className={styles.focusIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <circle cx="12" cy="12" r="8.5" />
                  <circle cx="12" cy="12" r="3.4" />
                </svg>
              </span>
              <div className={styles.focusBody}>
                <span className={styles.focusLead}>
                  <FormattedMessage
                    id="goalReport.focus.lead"
                    defaultMessage="Focus next"
                  />
                </span>
                <FormattedMessage
                  id="goalReport.focus.body"
                  defaultMessage="Your slowest keys lately are {keys} — a two-minute drill tomorrow will smooth them out."
                  values={{
                    keys: (
                      <>
                        {slowestKeys.map((k, i) => (
                          <span key={i} className={styles.keycap}>
                            {k}
                          </span>
                        ))}
                      </>
                    ),
                  }}
                />
              </div>
            </div>
          )}

          {mode === "roll" ? (
            <p className={styles.encourage}>{formatMessage(copy.roll)}</p>
          ) : (
            <p className={`${styles.encourage} ${styles.encourageRest}`}>
              {formatMessage(copy.restMain)}
              <span className={styles.encourageSub}>
                {formatMessage(copy.restSub)}
              </span>
            </p>
          )}

          <p className={styles.quote}>
            {"“" + copy.quote.text + "”"}
            <span className={styles.who}>{"— " + copy.quote.who}</span>
          </p>

          <div className={styles.actions}>
            {mode === "roll" ? (
              <>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.primary}`}
                  onClick={onContinue}
                >
                  <svg className={styles.arrow} viewBox="0 0 24 24">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                  <FormattedMessage
                    id="goalReport.keep"
                    defaultMessage="Keep practising"
                  />
                  <span className={styles.kbd}>
                    <FormattedMessage
                      id="goalReport.space"
                      defaultMessage="Space"
                    />
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.ghost}`}
                  onClick={done}
                >
                  <FormattedMessage id="goalReport.done" defaultMessage="Done" />
                </button>
              </>
            ) : (
              <>
                <button
                  ref={doneRef}
                  type="button"
                  className={`${styles.btn} ${styles.primary}`}
                  onClick={done}
                >
                  <FormattedMessage
                    id="goalReport.doneToday"
                    defaultMessage="Done for today"
                  />
                </button>
                <button
                  type="button"
                  className={styles.linklike}
                  onClick={onContinue}
                >
                  <FormattedMessage
                    id="goalReport.keepAnyway"
                    defaultMessage="keep practising anyway"
                  />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  pb = false,
}: {
  readonly label: ReactNode;
  readonly value: string;
  readonly pb?: boolean;
}): ReactNode {
  return (
    <div className={pb ? `${styles.lrow} ${styles.pb}` : styles.lrow}>
      <span className={styles.k}>
        {label}
        {pb && (
          <span className={styles.pbBadge}>
            <FormattedMessage id="goalReport.pb" defaultMessage="NEW PB" />
          </span>
        )}
      </span>
      <span className={styles.fill} />
      <span className={styles.val}>{value}</span>
    </div>
  );
}

// A compact area+line chart of top speed over the last practice days, with the
// most recent point emphasised.
function SpeedChart({ speeds }: { speeds: readonly number[] }): ReactNode {
  const W = 300;
  const H = 92;
  const padX = 12;
  const padTop = 14;
  const padBot = 12;
  const n = speeds.length;
  const min = Math.min(...speeds);
  const max = Math.max(...speeds);
  const span = max - min || 1;
  const x = (i: number) => padX + (i * (W - 2 * padX)) / (n - 1);
  const y = (v: number) => padTop + (1 - (v - min) / span) * (H - padTop - padBot);
  const pts = speeds.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = pts.join(" ");
  const area = `M${pts.join(" L")} L${x(n - 1).toFixed(1)},${H - padBot} L${x(0).toFixed(1)},${H - padBot} Z`;
  const lastX = x(n - 1);
  const lastY = y(speeds[n - 1]);
  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line
        className={styles.chartBase}
        x1={padX}
        y1={H - padBot}
        x2={W - padX}
        y2={H - padBot}
      />
      <path className={styles.chartArea} d={area} />
      <polyline className={styles.chartLine} points={line} />
      {speeds.slice(0, -1).map((v, i) => (
        <circle key={i} className={styles.chartDot} cx={x(i)} cy={y(v)} r={2.4} />
      ))}
      <circle className={styles.chartDotGlow} cx={lastX} cy={lastY} r={6} />
      <circle className={styles.chartDotLast} cx={lastX} cy={lastY} r={3.4} />
    </svg>
  );
}

function formatMinutes(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? `${h}h ${r}min` : `${h}h`;
  }
  return `${m}min`;
}
