import { makeAccuracyDistribution, makeSpeedDistribution } from "@keybr/chart";
import { useIntlNumbers } from "@keybr/intl";
import { LearningRate, Target } from "@keybr/lesson";
import { useFormatter, useKeyStyles } from "@keybr/lesson-ui";
import { type NamedUser, usePageData } from "@keybr/pages-shared";
import {
  type DailyStatsMap,
  type KeyStatsMap,
  makeSummaryStats,
  MutableStreakList,
  type SummaryStats,
  timeToSpeed,
  useResults,
} from "@keybr/result";
import { booleanProp, Preferences, useSettings } from "@keybr/settings";
import {
  Explainer,
  formatDuration,
  useClipboard,
  useExplainerState,
} from "@keybr/widget";
import { clsx } from "clsx";
import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { CalendarHeat } from "./CalendarHeat.tsx";
import {
  AllKeysChart,
  OneKeyChart,
  OwnAccuracyChart,
  PopulationChart,
  SpeedStoryChart,
} from "./charts.tsx";
import { KeysViews } from "./KeysViews.tsx";
import * as styles from "./road.module.less";
import { SlowTransitions } from "./SlowTransitions.tsx";

const propExplainSettings = booleanProp("prefs.profile.explain", true);

/**
 * The Long Road: the profile page as the story of the whole journey, in the
 * practice page's design language — one narrative column, no boxes, roads and
 * whisper typography — carrying every statistic of the classic profile.
 */
export function RoadProfile({
  keyStatsMap,
  dailyStatsMap,
  stats,
  user = null,
}: {
  readonly keyStatsMap: KeyStatsMap;
  readonly dailyStatsMap: DailyStatsMap;
  readonly stats: SummaryStats;
  readonly user?: NamedUser | null;
}): ReactNode {
  const { settings } = useSettings();
  const target = useMemo(() => new Target(settings), [settings]);
  const confidenceOf = (timeToType: number | null) =>
    timeToType == null
      ? null
      : Math.max(0, Math.min(1, target.confidence(timeToType)));
  const { results } = keyStatsMap;
  return (
    <div className={styles.col}>
      <Identity stats={stats} results={results} user={user} />
      <LifeRoad stats={stats} />
      <StatStrips stats={stats} today={dailyStatsMap.today.stats} />
      <Journey keyStatsMap={keyStatsMap} confidenceOf={confidenceOf} />
      <SpeedStory results={results} target={target} />
      <OneKeyStory
        keyStatsMap={keyStatsMap}
        target={target}
        confidenceOf={confidenceOf}
      />
      <div className={styles.sect}>
        <FormattedMessage
          id="profile.road.allKeys"
          defaultMessage="All keys over time — every key's speed, lesson by lesson"
        />
      </div>
      <Explainer>
        <div className={styles.whisper}>
          <span>
            <FormattedMessage
              id="profile.chart.progress.description"
              defaultMessage="Gives you a bird's-eye view of your learning progress across every key."
            />
          </span>
        </div>
      </Explainer>
      <div className={styles.chartwrap}>
        <AllKeysChart keyStatsMap={keyStatsMap} confidenceOf={confidenceOf} />
        <div className={styles.axisRow}>
          <span className={styles.axis}>
            <FormattedMessage
              id="profile.road.lessonOne"
              defaultMessage="lesson 1"
            />
          </span>
          <span className={styles.axis}>
            <FormattedMessage
              id="profile.road.allKeysLegend"
              defaultMessage="each line is one key · red = slow → green = fast"
            />
          </span>
          <span className={styles.axis}>
            <FormattedMessage
              id="profile.road.lessonLast"
              defaultMessage="lesson {count}"
              values={{ count: results.length }}
            />
          </span>
        </div>
      </div>
      <div className={styles.sect}>
        <FormattedMessage id="profile.road.keys" defaultMessage="Your keys" />
      </div>
      <KeysViews keyStatsMap={keyStatsMap} confidenceOf={confidenceOf} />
      <Compared stats={stats} />
      <AccuracySection results={results} />
      {/* Own profile only — the n-gram stats live in this browser's storage. */}
      {user == null && <SlowTransitions keyStatsMap={keyStatsMap} />}
      <div className={styles.sect}>
        <FormattedMessage
          id="profile.road.calendar"
          defaultMessage="Practice calendar — last year"
        />
      </div>
      <Explainer>
        <div className={styles.whisper}>
          <span>
            <FormattedMessage
              id="profile.chart.calendar.description"
              defaultMessage="Marks every day you've spent practicing."
            />
          </span>
        </div>
      </Explainer>
      <CalendarHeat dailyStatsMap={dailyStatsMap} />
      {user == null && <DataRow />}
      <div className={styles.foot}>
        <FormattedMessage
          id="profile.road.foot"
          defaultMessage="keylearn · your data stays yours"
        />
      </div>
    </div>
  );
}

// ---- identity band -------------------------------------------------------

function Identity({
  stats,
  results,
  user,
}: {
  readonly stats: SummaryStats;
  readonly results: readonly { readonly timeStamp: number }[];
  readonly user: NamedUser | null;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatNumber } = useIntlNumbers();
  const { publicUser } = usePageData();
  const { explainersVisible, toggleExplainers } = useExplainerState();
  useLayoutEffect(() => {
    toggleExplainers(Preferences.get(propExplainSettings));
  });
  const streak = dailyStreak(results);
  const signedIn = user != null || publicUser.id != null;
  const name =
    user != null
      ? user.name
      : signedIn
        ? publicUser.name
        : formatMessage({
            id: "profile.road.guest",
            defaultMessage: "Guest learner",
          });
  return (
    <div className={styles.id}>
      <span className={styles.avatar}>
        <svg viewBox="0 0 24 24" aria-hidden={true}>
          <circle cx="12" cy="9" r="3.4" />
          <path d="M5.5 19c1.2-3 3.6-4.5 6.5-4.5s5.3 1.5 6.5 4.5" />
          <circle cx="12" cy="12" r="10.2" />
        </svg>
      </span>
      <span className={styles.who}>
        <b>{name}</b>
        <i>
          <FormattedMessage
            id="profile.road.subline"
            defaultMessage="{time} typed · {lessons} lessons · {streak} day streak"
            values={{
              time: formatDuration(stats.time),
              lessons: formatNumber(stats.count),
              streak: formatNumber(streak),
            }}
          />
          {!signedIn && (
            <>
              {" · "}
              <span className={styles.signInHint}>
                <FormattedMessage
                  id="profile.road.notSignedIn"
                  defaultMessage="not signed in — sign in to keep and share your progress"
                />
              </span>
            </>
          )}
        </i>
      </span>
      <span className={styles.idActions}>
        <button
          type="button"
          onClick={() => {
            toggleExplainers(!explainersVisible);
            Preferences.set(propExplainSettings, !explainersVisible);
          }}
        >
          {explainersVisible ? "▾ " : "▸ "}
          <FormattedMessage
            id="t_Explain_charts"
            defaultMessage="Show chart explanations"
          />
        </button>
      </span>
    </div>
  );
}

function dailyStreak(
  results: readonly { readonly timeStamp: number }[],
): number {
  if (results.length === 0) {
    return 0;
  }
  const days = new Set(
    results.map(({ timeStamp }) => new Date(timeStamp).toDateString()),
  );
  const dayMs = 24 * 60 * 60 * 1000;
  let now = Date.now();
  if (!days.has(new Date(now).toDateString())) {
    now -= dayMs;
  }
  let streak = 0;
  while (days.has(new Date(now).toDateString())) {
    streak += 1;
    now -= dayMs;
  }
  return streak;
}

// ---- the lifetime road ---------------------------------------------------

function LifeRoad({ stats }: { readonly stats: SummaryStats }): ReactNode {
  const { formatSpeed } = useFormatter();
  const { speed } = stats;
  const frac =
    speed.max > 0 ? Math.max(0.02, Math.min(1, speed.avg / speed.max)) : 0;
  return (
    <div className={styles.liferoad}>
      <span className={styles.hero}>
        {formatSpeed(speed.avg, { unit: false })}
        <i>{formatSpeed(speed.avg).replace(/^[\d.,]+/, "")}</i>
        <em>
          <FormattedMessage
            id="t_Average_speed"
            defaultMessage="Typical speed"
          />
        </em>
      </span>
      <span className={styles.road}>
        <span
          className={styles.rdone}
          style={{ inlineSize: `${frac * 88}%` }}
        />
        <span className={styles.rdot} />
        <span className={styles.rahead} />
        <span className={styles.goal}>
          <svg className={styles.flag} viewBox="0 0 14 16" aria-hidden={true}>
            <path d="M3 15V2m0 0h8l-2.5 3L11 8H3" />
          </svg>
          {formatSpeed(speed.max)}
          <em>
            <FormattedMessage
              id="profile.road.personalBest"
              defaultMessage="· personal best"
            />
          </em>
        </span>
      </span>
    </div>
  );
}

// ---- the stat strips -----------------------------------------------------

function StatStrips({
  stats,
  today,
}: {
  readonly stats: SummaryStats;
  readonly today: SummaryStats;
}): ReactNode {
  const { formatNumber, formatPercents } = useIntlNumbers();
  const { formatSpeed } = useFormatter();
  const speedDelta = today.count > 0 ? today.speed.avg - stats.speed.avg : 0;
  const accDelta =
    today.count > 0 ? today.accuracy.avg - stats.accuracy.avg : 0;
  const strip = (
    label: ReactNode,
    s: SummaryStats,
    deltas: boolean,
  ): ReactNode => (
    <div className={clsx(styles.whisper, deltas && styles.whisperTight)}>
      <span className={clsx(styles.lab, styles.labAccent)}>{label}</span>
      <span>
        <span className={styles.lab}>
          <FormattedMessage id="t_Time_spent" defaultMessage="Time spent" />
        </span>
        <b>{formatDuration(s.time)}</b>
      </span>
      <span>
        <span className={styles.lab}>
          <FormattedMessage id="t_Lessons_done" defaultMessage="Lessons done" />
        </span>
        <b>{formatNumber(s.count)}</b>
      </span>
      <span>
        <span className={styles.lab}>
          <FormattedMessage id="t_Top_speed" defaultMessage="Best speed" />
        </span>
        <b>{s.count > 0 ? formatSpeed(s.speed.max) : "—"}</b>
      </span>
      <span>
        <span className={styles.lab}>
          <FormattedMessage
            id="t_Average_speed"
            defaultMessage="Typical speed"
          />
        </span>
        <b>{s.count > 0 ? formatSpeed(s.speed.avg) : "—"}</b>{" "}
        {deltas && s.count > 0 && speedDelta !== 0 && (
          <span className={speedDelta > 0 ? styles.up : styles.down}>
            {speedDelta > 0 ? "+" : "−"}
            {formatSpeed(Math.abs(speedDelta), { unit: false })}
          </span>
        )}
      </span>
      <span>
        <span className={styles.lab}>
          <FormattedMessage
            id="t_Top_accuracy"
            defaultMessage="Best accuracy"
          />
        </span>
        <b>{s.count > 0 ? formatPercents(s.accuracy.max) : "—"}</b>
      </span>
      <span>
        <span className={styles.lab}>
          <FormattedMessage
            id="t_Average_accuracy"
            defaultMessage="Typical accuracy"
          />
        </span>
        <b>{s.count > 0 ? formatPercents(s.accuracy.avg) : "—"}</b>{" "}
        {deltas && s.count > 0 && accDelta !== 0 && (
          <span className={accDelta > 0 ? styles.up : styles.down}>
            {accDelta > 0 ? "+" : "−"}
            {formatPercents(Math.abs(accDelta))}
          </span>
        )}
      </span>
    </div>
  );
  return (
    <>
      {strip(
        <FormattedMessage
          id="profile.overview.allTimeStats"
          defaultMessage="Lifetime Stats"
        />,
        stats,
        false,
      )}
      {strip(
        <FormattedMessage
          id="profile.overview.todayStats"
          defaultMessage="Today's Stats"
        />,
        today,
        true,
      )}
    </>
  );
}

// ---- the journey trail ---------------------------------------------------

function Journey({
  keyStatsMap,
  confidenceOf,
}: {
  readonly keyStatsMap: KeyStatsMap;
  readonly confidenceOf: (timeToType: number | null) => number | null;
}): ReactNode {
  const { confidenceColor } = useKeyStyles();
  const { letters } = keyStatsMap;
  const facts = letters.map((letter) => {
    const stats = keyStatsMap.get(letter);
    return {
      label: String.fromCodePoint(letter.codePoint).toUpperCase(),
      conf: confidenceOf(stats.timeToType),
    };
  });
  const unlocked = facts.filter(({ conf }) => conf != null).length;
  const here = facts.findIndex(({ conf }) => conf == null);
  const STEP = 40;
  const PAD = 20;
  const width = PAD * 2 + (facts.length - 1) * STEP;
  return (
    <>
      <div className={styles.sect}>
        <FormattedMessage
          id="profile.road.journey"
          defaultMessage="The journey — {unlocked} of {total} letters unlocked"
          values={{ unlocked, total: facts.length }}
        />
      </div>
      <div className={styles.chartwrap}>
        <svg
          className={styles.chart}
          viewBox={`0 0 ${width} 74`}
          style={{ blockSize: "4.6rem" }}
        >
          {facts.slice(0, -1).map((a, i) => {
            const b = facts[i + 1];
            const x1 = PAD + i * STEP;
            const x2 = PAD + (i + 1) * STEP;
            const y1 = 34 + 8 * Math.sin(i * 0.55);
            const y2 = 34 + 8 * Math.sin((i + 1) * 0.55);
            const cx = (x1 + x2) / 2;
            const on = a.conf != null && b.conf != null;
            const color = on
              ? String(confidenceColor(((a.conf ?? 0) + (b.conf ?? 0)) / 2))
              : "var(--primary-d2)";
            return (
              <path
                key={i}
                d={`M${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={color}
                strokeWidth={on ? 2 : 1.4}
                strokeDasharray={on ? undefined : "1 5"}
                strokeLinecap="round"
              />
            );
          })}
          {facts.map(({ label, conf }, i) => {
            const x = PAD + i * STEP;
            const y = 34 + 8 * Math.sin(i * 0.55);
            const on = conf != null;
            const isHere = i === here;
            return (
              <g key={label}>
                <circle
                  cx={x}
                  cy={y}
                  r={isHere ? 8 : on ? 6 : 3.5}
                  fill={
                    on
                      ? String(confidenceColor(conf ?? 0))
                      : "var(--primary-l2)"
                  }
                  stroke={isHere ? "var(--accent)" : "none"}
                  strokeWidth={isHere ? 2 : 0}
                />
                <text
                  x={x}
                  y={66}
                  fill={
                    isHere
                      ? "var(--accent)"
                      : on
                        ? "var(--text-color)"
                        : "var(--text-color-f2)"
                  }
                  fontSize="10"
                  fontWeight="700"
                  textAnchor="middle"
                  style={{ fontFamily: "inherit" }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

// ---- the speed story -----------------------------------------------------

function SpeedStory({
  results,
  target,
}: {
  readonly results: KeyStatsMap["results"];
  readonly target: Target;
}): ReactNode {
  const [smoothness, setSmoothness] = useState(0.5);
  if (results.length < 2) {
    return null;
  }
  return (
    <>
      <div className={styles.sect}>
        <FormattedMessage
          id="profile.road.speedStory"
          defaultMessage="The speed story — all {count} lessons"
          values={{ count: results.length }}
        />
      </div>
      <Explainer>
        <div className={styles.whisper}>
          <span>
            <FormattedMessage
              id="profile.chart.speed.description"
              defaultMessage="Tracks how your overall typing speed has changed over time."
            />
          </span>
        </div>
      </Explainer>
      <div className={styles.chartwrap}>
        <label className={styles.smooth}>
          <FormattedMessage id="t_Smoothness" defaultMessage="Smoothing" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={smoothness}
            onChange={(ev) => {
              setSmoothness(Number(ev.target.value));
            }}
          />
        </label>
        <SpeedStoryChart
          results={results}
          smoothness={smoothness}
          target={target.targetSpeed}
        />
        <div className={styles.axisRow}>
          <span className={styles.axis}>
            <FormattedMessage
              id="profile.road.lessonOne"
              defaultMessage="lesson 1"
            />
          </span>
          <span className={styles.axis}>
            <span style={{ color: "var(--accent)" }}>
              — <FormattedMessage id="t_Speed" defaultMessage="Speed" />
            </span>{" "}
            <span style={{ color: "var(--fast-key-color)" }}>
              — <FormattedMessage id="t_Accuracy" defaultMessage="Accuracy" />
            </span>{" "}
            <span
              style={{ color: "var(--textinput--special__color, #b58ee0)" }}
            >
              —{" "}
              <FormattedMessage
                id="profile.road.keysInPlay"
                defaultMessage="Keys in play"
              />
            </span>
          </span>
          <span className={styles.axis}>
            <FormattedMessage
              id="profile.road.lessonLast"
              defaultMessage="lesson {count}"
              values={{ count: results.length }}
            />
          </span>
        </div>
      </div>
    </>
  );
}

// ---- one key's story -----------------------------------------------------

function OneKeyStory({
  keyStatsMap,
  target,
  confidenceOf,
}: {
  readonly keyStatsMap: KeyStatsMap;
  readonly target: Target;
  readonly confidenceOf: (timeToType: number | null) => number | null;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatSpeed, formatConfidence, formatLearningRate } = useFormatter();
  const { letters } = keyStatsMap;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [smoothness, setSmoothness] = useState(0.5);
  if (letters.length === 0) {
    return null;
  }
  const current = letters[Math.min(currentIndex, letters.length - 1)];
  const keyStats = keyStatsMap.get(current);
  const speeds = keyStats.samples.map(({ filteredTimeToType }) =>
    timeToSpeed(filteredTimeToType),
  );
  const learningRate =
    LearningRate.from(keyStats.samples, target)?.learningRate ?? null;
  return (
    <>
      <div className={styles.sect}>
        <FormattedMessage
          id="profile.road.oneKey"
          defaultMessage="One key's story — pick a key"
        />
      </div>
      <Explainer>
        <div className={styles.whisper}>
          <span>
            <FormattedMessage
              id="profile.chart.keySpeed.description"
              defaultMessage="Tracks how the typing speed for each individual key has changed."
            />
          </span>
        </div>
      </Explainer>
      <div className={styles.chartwrap}>
        <label className={styles.smooth}>
          <FormattedMessage id="t_Smoothness" defaultMessage="Smoothing" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={smoothness}
            onChange={(ev) => {
              setSmoothness(Number(ev.target.value));
            }}
          />
        </label>
        <div className={styles.keychips}>
          {letters.map((letter, index) => {
            const locked = keyStatsMap.get(letter).timeToType == null;
            return (
              <button
                key={String(letter)}
                type="button"
                className={clsx(
                  styles.kc,
                  locked && styles.kcLocked,
                  index === currentIndex && styles.kcOn,
                )}
                onClick={() => {
                  setCurrentIndex(index);
                }}
              >
                {String.fromCodePoint(letter.codePoint).toUpperCase()}
              </button>
            );
          })}
        </div>
        <div className={clsx(styles.whisper, styles.whisperTight)}>
          <span>
            <span className={styles.lab}>
              <FormattedMessage
                id="t_Last_speed"
                defaultMessage="Latest speed"
              />
            </span>
            {keyStats.timeToType != null ? (
              <>
                <b>{formatSpeed(timeToSpeed(keyStats.timeToType))}</b>
                {" · "}
                {formatConfidence(confidenceOf(keyStats.timeToType))}
              </>
            ) : (
              <b>—</b>
            )}
          </span>
          <span>
            <span className={styles.lab}>
              <FormattedMessage id="t_Top_speed" defaultMessage="Best speed" />
            </span>
            {keyStats.bestTimeToType != null ? (
              <>
                <b>{formatSpeed(timeToSpeed(keyStats.bestTimeToType))}</b>
                {" · "}
                {formatConfidence(confidenceOf(keyStats.bestTimeToType))}
              </>
            ) : (
              <b>—</b>
            )}
          </span>
          <span>
            <span className={styles.lab}>
              <FormattedMessage
                id="t_Learning_rate"
                defaultMessage="Progress rate"
              />
            </span>
            <b>{formatLearningRate(learningRate)}</b>
          </span>
        </div>
        <OneKeyChart
          speeds={speeds}
          smoothness={smoothness}
          target={target.targetSpeed}
        />
        <div className={styles.axisRow}>
          <span className={styles.axis}>
            <FormattedMessage
              id="profile.road.lessonOne"
              defaultMessage="lesson 1"
            />
          </span>
          <span className={styles.axis}>
            <span style={{ color: "var(--accent)" }}>
              —{" "}
              <FormattedMessage
                id="profile.road.speedForKey"
                defaultMessage="Speed for {key}"
                values={{
                  key: String.fromCodePoint(current.codePoint).toUpperCase(),
                }}
              />
            </span>{" "}
            {formatMessage({
              id: "profile.road.aimLegend",
              defaultMessage: "╌ ╌ the speed you're aiming for",
            })}
          </span>
          <span className={styles.axis}>
            <FormattedMessage
              id="profile.road.lessonLast"
              defaultMessage="lesson {count}"
              values={{ count: Math.max(1, speeds.length) }}
            />
          </span>
        </div>
      </div>
    </>
  );
}

// ---- compared to everyone ------------------------------------------------

function Compared({ stats }: { readonly stats: SummaryStats }): ReactNode {
  const { formatPercents } = useIntlNumbers();
  const { formatSpeed } = useFormatter();
  const speedDist = useMemo(() => makeSpeedDistribution(), []);
  const accDist = useMemo(() => makeAccuracyDistribution(), []);
  const { speed, accuracy, count } = stats;
  if (count === 0) {
    return null;
  }
  const sTypical = Math.min(speedDist.length - 1, Math.round(speed.avg));
  const sBest = Math.min(speedDist.length - 1, Math.round(speed.max));
  const aTypical = accDist.scale(accuracy.avg);
  const aBest = accDist.scale(accuracy.max);
  return (
    <>
      <div className={styles.sect}>
        <FormattedMessage
          id="profile.road.compared"
          defaultMessage="Compared to everyone"
        />
      </div>
      <Explainer>
        <div className={styles.whisper}>
          <span>
            <FormattedMessage
              id="profile.chart.compareSpeed.description"
              defaultMessage="A histogram of typing speeds across all users, with your own standing marked on it."
            />
          </span>
        </div>
      </Explainer>
      <div className={styles.accrow}>
        <div className={styles.hist}>
          <PopulationChart
            distribution={speedDist}
            typical={sTypical}
            best={sBest}
            typicalLabel={`you ${formatSpeed(speed.avg, { unit: false })}`}
            bestLabel={`best ${formatSpeed(speed.max, { unit: false })}`}
            loLabel="0"
            hiLabel={formatSpeed(speedDist.length - 1)}
          />
          <div className={styles.whisper}>
            <span>
              <span className={styles.lab}>
                <FormattedMessage id="t_Speed" defaultMessage="Speed" />
              </span>
              <FormattedMessage
                id="profile.road.outpaces"
                defaultMessage="typical outpaces {typical} · best outpaces {best} of all typists"
                values={{
                  typical: <b>{formatPercents(speedDist.cdf(speed.avg))}</b>,
                  best: <b>{formatPercents(speedDist.cdf(speed.max))}</b>,
                }}
              />
            </span>
          </div>
        </div>
        <div className={styles.hist}>
          <PopulationChart
            distribution={accDist}
            typical={aTypical}
            best={aBest}
            typicalLabel={`you ${formatPercents(accuracy.avg, 1)}`}
            bestLabel={`best ${formatPercents(accuracy.max, 1)}`}
            loLabel="0%"
            hiLabel="100%"
          />
          <div className={styles.whisper}>
            <span>
              <span className={styles.lab}>
                <FormattedMessage id="t_Accuracy" defaultMessage="Accuracy" />
              </span>
              <FormattedMessage
                id="profile.road.outpaces"
                defaultMessage="typical outpaces {typical} · best outpaces {best} of all typists"
                values={{
                  typical: <b>{formatPercents(accDist.cdf(aTypical))}</b>,
                  best: <b>{formatPercents(accDist.cdf(aBest))}</b>,
                }}
              />
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ---- accuracy: own lessons + streaks -------------------------------------

const milestones = [5, 10, 25, 50, 100, 250];

function AccuracySection({
  results,
}: {
  readonly results: KeyStatsMap["results"];
}): ReactNode {
  const { formatDate, formatTime } = useIntl();
  const { formatNumber, formatPercents } = useIntlNumbers();
  const { formatSpeed } = useFormatter();
  const streaks = MutableStreakList.findLongest(results);
  return (
    <>
      <div className={styles.sect}>
        <FormattedMessage
          id="profile.road.accuracy"
          defaultMessage="Accuracy — your own lessons"
        />
      </div>
      <Explainer>
        <div className={styles.whisper}>
          <span>
            <FormattedMessage
              id="profile.accuracy.legend"
              defaultMessage="Listed above are your longest unbroken runs of lessons that kept accuracy above a chosen minimum, along with the stats for each run. Longer runs are better."
            />
          </span>
        </div>
      </Explainer>
      <div className={styles.accrow}>
        <div className={styles.hist}>
          <OwnAccuracyChart results={results} />
          <div className={styles.axisRow}>
            <span className={styles.axis}>90%</span>
            <span className={styles.axis}>
              <FormattedMessage
                id="profile.road.distribution"
                defaultMessage="distribution of your lessons"
              />
            </span>
            <span className={styles.axis}>100%</span>
          </div>
        </div>
        <div className={styles.streaks}>
          {streaks.length === 0 && (
            <div className={styles.whisper}>
              <span>
                <FormattedMessage
                  id="profile.accuracy.noData"
                  defaultMessage="No accuracy streaks yet. Try finishing a lesson at your highest possible accuracy, no matter how fast you type."
                />
              </span>
            </div>
          )}
          {streaks.map((streak, index) => {
            const { level, results: run } = streak;
            const runStats = makeSummaryStats(run);
            const chars = run.reduce((x, { length }) => length + x, 0);
            const next = milestones.find((m) => m > run.length) ?? run.length;
            const prev =
              [0, ...milestones].filter((m) => m <= run.length).pop() ?? 0;
            const frac = next > prev ? (run.length - prev) / (next - prev) : 1;
            return (
              <div key={index}>
                <div className={styles.streakline}>
                  <svg
                    className={styles.flame}
                    viewBox="0 0 24 24"
                    aria-hidden={true}
                  >
                    <path d="M12 3.5c.6 2.8-1.3 4.6-2.5 6.2-1.2 1.6-2 3.2-2 5a6.5 6.5 0 0 0 13 0c0-1.4-.4-2.7-1.1-3.8-.9 1.1-2 1.4-2.9.9.9-2.4.1-5.8-4.5-8.3z" />
                  </svg>
                  <b>{formatPercents(level, 0)}</b>
                  <span className={styles.sbar}>
                    <i
                      style={
                        {
                          inlineSize: `${Math.round(frac * 100)}%`,
                        } as CSSProperties
                      }
                    />
                  </span>
                  <b>{formatNumber(run.length)}</b>
                  <FormattedMessage
                    id="profile.road.streakLessons"
                    defaultMessage="{count, plural, one {lesson} other {lessons}}"
                    values={{ count: run.length }}
                  />
                </div>
                <div className={clsx(styles.whisper, styles.streakStats)}>
                  <span>
                    <span className={styles.lab}>
                      <FormattedMessage
                        id="t_Characters"
                        defaultMessage="Characters"
                      />
                    </span>
                    <b>{formatNumber(chars)}</b>
                  </span>
                  <span>
                    <span className={styles.lab}>
                      <FormattedMessage
                        id="t_Top_speed"
                        defaultMessage="Best speed"
                      />
                    </span>
                    <b>{formatSpeed(runStats.speed.max)}</b>
                  </span>
                  <span>
                    <span className={styles.lab}>
                      <FormattedMessage
                        id="t_Average_speed"
                        defaultMessage="Typical speed"
                      />
                    </span>
                    <b>{formatSpeed(runStats.speed.avg)}</b>
                  </span>
                  <span>
                    <span className={styles.lab}>
                      <FormattedMessage
                        id="t_Streak_started"
                        defaultMessage="Streak started"
                      />
                    </span>
                    <b>
                      {formatDate(run[0].timeStamp, { dateStyle: "short" })}
                      {", "}
                      {formatTime(run[0].timeStamp, { timeStyle: "short" })}
                    </b>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ---- your data -----------------------------------------------------------

function DataRow(): ReactNode {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  const { copyText } = useClipboard();
  const { results, clearResults } = useResultsSafe();
  const [confirming, setConfirming] = useState(false);
  const named = "id" in publicUser && publicUser.id != null;
  const href = named
    ? (() => {
        const url = new URL(window.location.href);
        url.pathname = `/profile/${(publicUser as NamedUser).id}`;
        return String(url);
      })()
    : null;
  return (
    <>
      <div className={styles.sect}>
        <FormattedMessage id="profile.road.data" defaultMessage="Your data" />
      </div>
      <div className={styles.dataRow}>
        {href != null && (
          <span>
            <span className={styles.lab}>
              <FormattedMessage
                id="t_Share_your_profile:"
                defaultMessage="Your profile link:"
              />
            </span>
            <b>{href.replace(/^https?:\/\//, "")}</b>
            {" · "}
            <button
              type="button"
              onClick={() => {
                copyText(href);
              }}
            >
              <FormattedMessage id="t_Copy" defaultMessage="Copy" />
            </button>
            {" · "}
            <button
              type="button"
              onClick={() => {
                window.open(href, "_blank");
              }}
            >
              <FormattedMessage id="t_Open" defaultMessage="Open" />
            </button>
          </span>
        )}
        <button
          type="button"
          title={formatMessage({
            id: "profile.download.description",
            defaultMessage:
              "Get a full export of your typing history as a JSON file.",
          })}
          onClick={() => {
            const json = JSON.stringify(results);
            const blob = new Blob([json], { type: "application/json" });
            const a = document.createElement("a");
            a.setAttribute("href", URL.createObjectURL(blob));
            a.setAttribute("download", "typing-data.json");
            a.setAttribute("hidden", "");
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
        >
          ⬇{" "}
          <FormattedMessage
            id="t_Download_data"
            defaultMessage="Export your data"
          />
        </button>
        <button
          type="button"
          className={styles.danger}
          title={formatMessage({
            id: "profile.reset.description",
            defaultMessage:
              "Wipes your typing history for good and resets every statistic.",
          })}
          onClick={() => {
            setConfirming(true);
          }}
        >
          ⌫{" "}
          <FormattedMessage
            id="t_Reset_statistics"
            defaultMessage="Clear statistics"
          />
        </button>
      </div>
      {confirming && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmCard}>
            <svg
              className={styles.confirmIcon}
              viewBox="0 0 24 24"
              aria-hidden={true}
            >
              <path d="M5 7h14M10 7V5a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 14 5v2M7 7l1 13h8l1-13M10 11v5M14 11v5" />
            </svg>
            <h2 className={styles.confirmTitle}>
              <FormattedMessage
                id="profile.reset.title"
                defaultMessage="Erase your whole typing history?"
              />
            </h2>
            <p className={styles.confirmBody}>
              <FormattedMessage
                id="profile.reset.message"
                defaultMessage="Do you really want to erase all your data and reset your profile? This can't be undone once you confirm!"
              />
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancel}
                onClick={() => {
                  setConfirming(false);
                }}
              >
                <FormattedMessage
                  id="profile.reset.keep"
                  defaultMessage="Keep my data"
                />
              </button>
              <button
                type="button"
                className={styles.confirmDelete}
                onClick={() => {
                  setConfirming(false);
                  clearResults();
                }}
              >
                <FormattedMessage
                  id="profile.reset.confirm"
                  defaultMessage="Erase everything"
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function useResultsSafe() {
  return useResults();
}
