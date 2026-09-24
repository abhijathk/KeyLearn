import { useIntlDates } from "@keylearn/intl";
import { useFormatter } from "@keylearn/lesson-ui";
import { Pages } from "@keylearn/pages-shared";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useNavigate } from "react-router";
import {
  KIDS_REST_MAIN_LINES,
  pickRandom,
  QUOTES,
  REST_MAIN_LINES,
  REST_SUB_LINES,
  ROLL_LINES,
} from "./goal-copy.ts";
import * as styles from "./GoalCeremony.module.less";
import { useKidsPractice } from "./kids-flavour.ts";
import {
  IconBolt,
  IconBook,
  IconClock,
  IconEye,
  IconHand,
  IconTarget,
  KidsTile,
  KidsWindow,
  kidsWindowStyles as kw,
} from "./KidsWindow.tsx";

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
  weeklyDays = [],
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
  /** Local-midnight timestamps of the same days. Kids window only. */
  readonly weeklyDays?: readonly number[];
  readonly slowestKeys: readonly string[];
  readonly isPersonalBest: boolean;
  readonly mode: GoalMode;
  readonly onContinue: () => void;
  readonly onDone: () => void;
}): ReactNode {
  const kids = useKidsPractice();
  const { formatMessage } = useIntl();
  const { format } = useIntlDates();
  const { formatSpeed } = useFormatter();
  const navigate = useNavigate();
  const doneRef = useRef<HTMLButtonElement>(null);

  // Pick the copy once, when the window opens.
  const [copy] = useState(() => ({
    roll: pickRandom(ROLL_LINES),
    restMain: pickRandom(kids ? KIDS_REST_MAIN_LINES : REST_MAIN_LINES),
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

  if (kids) {
    return (
      <KidsGoal
        goalMinutes={goalMinutes}
        minutes={minutes}
        lessons={lessons}
        topSpeed={topSpeed}
        accuracy={accuracy}
        weeklySpeeds={weeklySpeeds}
        weeklyDays={weeklyDays}
        slowestKeys={slowestKeys}
        isPersonalBest={isPersonalBest}
        mode={mode}
        line={
          mode === "roll"
            ? { main: formatMessage(copy.roll), sub: null }
            : {
                main: formatMessage(copy.restMain),
                sub: formatMessage(copy.restSub),
              }
        }
        doneRef={doneRef}
        onContinue={onContinue}
        onDone={done}
      />
    );
  }

  const gain =
    weeklySpeeds.length >= 2
      ? weeklySpeeds[weeklySpeeds.length - 1] - weeklySpeeds[0]
      : 0;

  const stamp = (
    <div className={styles.stamp}>
      <FormattedMessage id="goalReport.stamp" defaultMessage="GOAL MET" />
    </div>
  );

  const title = (
    <h1 className={styles.title}>
      <FormattedMessage
        id="goalReport.title"
        defaultMessage="Goal <b>report</b>"
        values={{ b: (c) => <b>{c}</b> }}
      />
    </h1>
  );

  const metaline = (
    <div className={styles.metaline}>
      <FormattedMessage
        id="goalReport.meta"
        defaultMessage="{date} · Your goal: {minutes} min a day ✓"
        values={{
          date: format(new Date(), {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          minutes: goalMinutes,
        }}
      />
    </div>
  );

  const stats = (
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
  );

  const trend = weeklySpeeds.length >= 2 && (
    <>
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
  );

  const focus = slowestKeys.length > 0 && (
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
  );

  const encourage =
    mode === "roll" ? (
      <p className={styles.encourage}>{formatMessage(copy.roll)}</p>
    ) : (
      <p className={`${styles.encourage} ${styles.encourageRest}`}>
        {formatMessage(copy.restMain)}
        <span className={styles.encourageSub}>
          {formatMessage(copy.restSub)}
        </span>
      </p>
    );

  const quote = (
    <p className={styles.quote}>
      {"“" + copy.quote.text + "”"}
      <span className={styles.who}>{"— " + copy.quote.who}</span>
    </p>
  );

  const actions = (
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
              <FormattedMessage id="goalReport.space" defaultMessage="Space" />
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
  );

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        data-mode={mode}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.tape} />
        <div className={styles.innerLandscape}>
          <div className={styles.colLeft}>
            {title}
            {metaline}
            {stats}
            {trend}
            {actions}
          </div>
          <div className={styles.colDivider} />
          <div className={styles.colRight}>
            <div className={styles.stampRight}>{stamp}</div>
            {focus}
            {encourage}
            {quote}
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
  const y = (v: number) =>
    padTop + (1 - (v - min) / span) * (H - padTop - padBot);
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
        <circle
          key={i}
          className={styles.chartDot}
          cx={x(i)}
          cy={y(v)}
          r={2.4}
        />
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

/**
 * The kids Classic flavour of the goal report. Same numbers, same copy, same
 * keys; laid out as one bright window. "roll" celebrates and offers one
 * more; "rest" shows today's minutes as a full ring and steers toward a
 * break, with carrying on still there, smaller.
 */
function KidsGoal({
  goalMinutes,
  minutes,
  lessons,
  topSpeed,
  accuracy,
  weeklySpeeds,
  weeklyDays,
  slowestKeys,
  isPersonalBest,
  mode,
  line,
  doneRef,
  onContinue,
  onDone,
}: {
  readonly goalMinutes: number;
  readonly minutes: number;
  readonly lessons: number;
  readonly topSpeed: number;
  readonly accuracy: number;
  readonly weeklySpeeds: readonly number[];
  readonly weeklyDays: readonly number[];
  readonly slowestKeys: readonly string[];
  readonly isPersonalBest: boolean;
  readonly mode: GoalMode;
  readonly line: { readonly main: string; readonly sub: string | null };
  readonly doneRef: RefObject<HTMLButtonElement | null>;
  readonly onContinue: () => void;
  readonly onDone: () => void;
}): ReactNode {
  const { formatNumber } = useIntl();
  const { formatSpeed, speedUnit } = useFormatter();
  const rest = mode === "rest";

  const tiles = (
    <div className={`${kw.tiles} ${kw.tilesFour}`}>
      <KidsTile
        tint="violet"
        icon={<IconBook />}
        small={rest}
        label={
          <FormattedMessage
            id="goalReport.lessons"
            defaultMessage="Lessons done"
          />
        }
        value={formatNumber(lessons)}
      />
      <KidsTile
        tint="blue"
        icon={<IconClock />}
        small={rest}
        label={
          <FormattedMessage
            id="goalReport.time"
            defaultMessage="Time practised"
          />
        }
        value={formatNumber(minutes)}
        unit="min"
      />
      <KidsTile
        tint="orange"
        icon={<IconBolt />}
        small={rest}
        label={
          <FormattedMessage
            id="goalReport.topSpeed"
            defaultMessage="Top speed"
          />
        }
        value={formatSpeed(topSpeed, { unit: false })}
        unit={speedUnit.id}
        badge={
          isPersonalBest ? (
            <FormattedMessage id="goalReport.pb" defaultMessage="NEW PB" />
          ) : undefined
        }
      />
      <KidsTile
        tint="green"
        icon={<IconTarget />}
        small={rest}
        label={
          <FormattedMessage
            id="goalReport.accuracy"
            defaultMessage="Accuracy"
          />
        }
        value={formatNumber(Math.round(accuracy * 100))}
        unit="%"
      />
    </div>
  );

  if (rest) {
    return (
      <KidsWindow
        tone="rest"
        width={26.25}
        headHeight={128}
        head={<KidsRing minutes={minutes} goalMinutes={goalMinutes} />}
      >
        <div className={`${kw.body} ${kw.bodyCentered}`}>
          <div className={kw.heading}>
            <span className={`${kw.pill} ${kw.pillWarm}`}>
              <FormattedMessage
                id="kidsWindow.rest.pill"
                defaultMessage="Time for a break"
              />
            </span>
            <h2 className={`${kw.title} ${kw.titleSmall}`}>{line.main}</h2>
            {line.sub != null && <p className={kw.lead}>{line.sub}</p>}
          </div>
          <div className={kw.section}>
            <span className={kw.caption}>
              <FormattedMessage
                id="kidsWindow.rest.session"
                defaultMessage="Today’s session"
              />
            </span>
            {tiles}
          </div>
          <div className={kw.section}>
            <div className={`${kw.strip} ${kw.stripTip}`} data-tint="green">
              <span
                className={`${kw.chip} ${kw.tipIcon} ${kw.tipIconGreen}`}
                aria-hidden="true"
              >
                <IconHand />
              </span>
              <span className={kw.tipText}>
                <FormattedMessage
                  id="kidsWindow.rest.tip.hands"
                  defaultMessage="Shake out your hands and stretch your fingers"
                />
              </span>
            </div>
            <div className={`${kw.strip} ${kw.stripTip}`} data-tint="blue">
              <span
                className={`${kw.chip} ${kw.tipIcon} ${kw.tipIconBlue}`}
                aria-hidden="true"
              >
                <IconEye />
              </span>
              <span className={kw.tipText}>
                <FormattedMessage
                  id="kidsWindow.rest.tip.eyes"
                  defaultMessage="Look at something far away for a minute"
                />
              </span>
            </div>
          </div>
          <div className={kw.actions}>
            <button
              ref={doneRef}
              type="button"
              className={kw.primary}
              onClick={onDone}
            >
              <FormattedMessage
                id="goalReport.doneToday"
                defaultMessage="Done for today"
              />
            </button>
            <button type="button" className={kw.text} onClick={onContinue}>
              <FormattedMessage
                id="goalReport.keepAnyway"
                defaultMessage="keep practising anyway"
              />
            </button>
          </div>
        </div>
      </KidsWindow>
    );
  }

  return (
    <KidsWindow
      tone="goal"
      width={30}
      headHeight={120}
      head={<KidsGoalHead goalMinutes={goalMinutes} />}
    >
      <div className={`${kw.body} ${kw.bodyTight}`}>
        {tiles}
        {weeklySpeeds.length >= 2 && (
          <KidsWeek speeds={weeklySpeeds} days={weeklyDays} />
        )}
        {slowestKeys.length > 0 && (
          <div className={kw.strip} data-tint="orange">
            <span className={kw.stripLabel}>
              <FormattedMessage
                id="practice.session.slowest"
                defaultMessage="slowest keys"
              />
            </span>
            {slowestKeys.map((k, i) => (
              <span key={i} className={kw.chip}>
                {k}
              </span>
            ))}
            <span className={kw.stripText}>
              <FormattedMessage
                id="kidsWindow.goal.drill"
                defaultMessage="a 2-minute drill tomorrow will speed them up"
              />
            </span>
          </div>
        )}
        <p className={kw.line}>{line.main}</p>
        <div className={`${kw.actions} ${kw.actionsRow}`}>
          <button type="button" className={kw.primary} onClick={onContinue}>
            <FormattedMessage
              id="goalReport.keep"
              defaultMessage="Keep practising"
            />
            <span className={kw.kbd}>
              <FormattedMessage id="goalReport.space" defaultMessage="Space" />
            </span>
          </button>
          <button type="button" className={kw.secondary} onClick={onDone}>
            <FormattedMessage id="goalReport.done" defaultMessage="Done" />
          </button>
        </div>
      </div>
    </KidsWindow>
  );
}

function KidsGoalHead({
  goalMinutes,
}: {
  readonly goalMinutes: number;
}): ReactNode {
  const { format } = useIntlDates();
  return (
    <div className={kw.headRow}>
      <svg className={kw.medal} viewBox="0 0 96 110" aria-hidden="true">
        <path d="M28 0h14l10 30H38zM68 0H54L44 30h14z" fill="#fff" />
        <circle className={kw.medalDisc} cx="48" cy="64" r="36" />
        <circle
          cx="48"
          cy="64"
          r="28"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.6"
          strokeWidth="3"
        />
        <path
          d="M34 64l10 10 19-20"
          fill="none"
          stroke="#e0357f"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className={kw.headText}>
        <span className={`${kw.pill} ${kw.pillOnHead}`}>
          <FormattedMessage
            id="kidsWindow.goal.pill"
            defaultMessage="Goal complete"
          />
        </span>
        <span className={kw.headBig}>
          <FormattedMessage
            id="kidsWindow.goal.minutes"
            defaultMessage="{minutes} min"
            values={{ minutes: goalMinutes }}
          />
        </span>
        <span className={kw.headSub}>
          <FormattedMessage
            id="kidsWindow.goal.sub"
            defaultMessage="Daily goal · {date}"
            values={{
              date: format(new Date(), {
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
            }}
          />
        </span>
      </div>
    </div>
  );
}

// Top speed for each of the last practice days as bars, today's lit warm.
function KidsWeek({
  speeds,
  days,
}: {
  readonly speeds: readonly number[];
  readonly days: readonly number[];
}): ReactNode {
  const { formatNumber } = useIntl();
  const { format } = useIntlDates();
  const max = Math.max(...speeds) || 1;
  const first = speeds[0];
  const last = speeds[speeds.length - 1];
  const gain = first > 0 ? (last - first) / first : 0;
  const labelled = days.length === speeds.length;
  return (
    <div className={kw.panel}>
      <div className={kw.panelHead}>
        <span className={kw.caption}>
          <FormattedMessage
            id="goalReport.chart"
            defaultMessage="Speed · last {n} practice days"
            values={{ n: speeds.length }}
          />
        </span>
        {gain > 0 && (
          <span className={kw.gain}>
            {"▲ " +
              formatNumber(gain, {
                style: "percent",
                maximumFractionDigits: 0,
              })}
          </span>
        )}
      </div>
      <div className={kw.bars} aria-hidden="true">
        {speeds.map((v, i) => {
          const today = i === speeds.length - 1;
          return (
            <div key={i} className={kw.barCol}>
              <div
                className={today ? `${kw.bar} ${kw.barToday}` : kw.bar}
                style={{ blockSize: `${Math.max(8, (v / max) * 78)}%` }}
              />
              <span
                className={
                  today ? `${kw.barLabel} ${kw.barLabelToday}` : kw.barLabel
                }
              >
                {today ? (
                  <FormattedMessage
                    id="practice.session.today"
                    defaultMessage="Today"
                  />
                ) : labelled ? (
                  format(new Date(days[i]), { weekday: "narrow" })
                ) : (
                  " "
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Today's minutes as a ring on the rest window's band — full once the goal
// is met, which it always is by the time this window opens.
function KidsRing({
  minutes,
  goalMinutes,
}: {
  readonly minutes: number;
  readonly goalMinutes: number;
}): ReactNode {
  const id = useId();
  const r = 62;
  const c = 2 * Math.PI * r;
  const frac = goalMinutes > 0 ? Math.min(1, minutes / goalMinutes) : 1;
  return (
    <div className={kw.ring}>
      <svg viewBox="0 0 150 150" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop className={kw.ringStopA} offset="0" />
            <stop className={kw.ringStopB} offset="1" />
          </linearGradient>
        </defs>
        <circle className={kw.ringTrack} cx="75" cy="75" r={r} />
        <circle
          className={kw.ringFill}
          cx="75"
          cy="75"
          r={r}
          stroke={`url(#${id})`}
          strokeDasharray={`${(c * frac).toFixed(1)} ${c.toFixed(1)}`}
          transform="rotate(-90 75 75)"
        />
      </svg>
      <div className={kw.ringText}>
        <span className={kw.ringValue}>
          {minutes}
          <span className={kw.ringUnit}>min</span>
        </span>
        <span className={kw.ringCaption}>
          <FormattedMessage
            id="practice.session.today"
            defaultMessage="Today"
          />
        </span>
      </div>
    </div>
  );
}
