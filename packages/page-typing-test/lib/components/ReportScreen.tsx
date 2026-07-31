import { makeAccuracyDistribution, makeSpeedDistribution } from "@keybr/chart";
import { useIntlNumbers } from "@keybr/intl";
import { useFormatter } from "@keybr/lesson-ui";
import { Screen } from "@keybr/pages-shared";
import { useSettings } from "@keybr/settings";
import { computeSpeed, type Step } from "@keybr/textinput";
import { formatDuration, Kbd, useHotkeys, useView } from "@keybr/widget";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";
import {
  loadSummary,
  recordTest,
  type SpeedTestRecord,
  type SpeedTestSummary,
  type TestMode,
} from "../history.ts";
import {
  type Duration,
  durations,
  DurationType,
  type TestResult,
} from "../session/index.ts";
import { toCompositeSettings } from "../settings.ts";
import { views } from "../views.tsx";
import { Replay } from "./Replay.tsx";
import {
  PopulationChart,
  RecentTrendChart,
  RollingSpeedChart,
  TimeToTypeChart,
} from "./report-charts.tsx";
import * as styles from "./road.module.less";

export function ReportScreen({ result }: { result: TestResult }) {
  const { setView } = useView(views);
  const { formatNumber, formatPercents } = useIntlNumbers();
  const { speedUnit, formatSpeed } = useFormatter();
  const { settings } = useSettings();

  const handleNext = () => setView("test");

  useHotkeys({
    ["Enter"]: handleNext,
    ["Space"]: handleNext,
  });

  // Treat the report as a sub-step of the test: pressing Back (browser or the
  // header's back-swipe) returns to the test rather than leaving the page.
  useEffect(() => {
    window.history.pushState({ typingTestReport: true }, "");
    const onPop = () => setView("test");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setView]);

  const { time, speed, length, errors, accuracy } = result.stats;
  const cpm = Math.round(speed);

  // The summary as it stood before this run — read once, synchronously, on
  // the first render, so it can never race with the `recordTest` write below.
  const [before] = useState<SpeedTestSummary>(() => loadSummary(7));
  const [trajectory, setTrajectory] = useState<SpeedTestSummary | null>(null);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (recordedRef.current) {
      return;
    }
    recordedRef.current = true;
    const composite = toCompositeSettings(settings);
    const record: SpeedTestRecord = {
      ts: Date.now(),
      cpm,
      accuracy,
      mode: modeOf(composite.duration.type),
      lengthLabel: lengthLabelOf(composite.duration),
      chars: length,
      errors,
    };
    setTrajectory(recordTest(record));
    // Record exactly once per finished test, regardless of later re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPersonalBest = cpm > (before.best?.cpm ?? 0);
  const delta = before.best != null ? cpm - before.best.cpm : null;

  const consistency = useMemo(
    () => computeConsistency(result.steps),
    [result.steps],
  );
  const insight = useMemo(() => computeInsight(result.steps), [result.steps]);

  const recent = trajectory?.recent ?? [];
  const bestCpm = trajectory?.best?.cpm ?? before.best?.cpm ?? null;
  const testCount = trajectory?.count ?? before.count;
  const streakDays = trajectory?.streakDays ?? before.streakDays;

  const dSpeed = makeSpeedDistribution();
  const dAccuracy = makeAccuracyDistribution();
  const pSpeed = dSpeed.cdf(speed);
  const pAccuracy = dAccuracy.cdf(dAccuracy.scale(accuracy));

  return (
    <Screen>
      <div className={styles.col}>
        <div className={styles.heroRow}>
          <div className={styles.heroCell}>
            <div className={styles.heroLab}>
              <FormattedMessage id="t_Speed" defaultMessage="Speed" />
            </div>
            <div className={styles.heroBadgeRow}>
              <div className={`${styles.hero} ${styles.heroAccent}`}>
                {formatSpeed(speed, { unit: false })}
                <i>{speedUnit.id}</i>
              </div>
              {isPersonalBest && (
                <span className={styles.bestChip}>
                  {delta != null ? (
                    <FormattedMessage
                      id="typingTest.report.newBestWithDelta"
                      defaultMessage="New best · +{delta}"
                      values={{ delta: formatSpeed(delta, { unit: false }) }}
                    />
                  ) : (
                    <FormattedMessage
                      id="typingTest.report.newBest"
                      defaultMessage="New best"
                    />
                  )}
                </span>
              )}
            </div>
          </div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStats}>
            <div className={styles.statMini}>
              <div className={styles.heroLab}>
                <FormattedMessage id="t_Accuracy" defaultMessage="Accuracy" />
              </div>
              <div className={styles.statMiniValue}>
                {formatNumber(accuracy * 100, 1)}
                <i>%</i>
              </div>
            </div>
            {consistency != null && (
              <div className={styles.statMini}>
                <div className={styles.heroLab}>
                  <FormattedMessage
                    id="typingTest.report.consistency"
                    defaultMessage="Consistency"
                  />
                </div>
                <div className={styles.statMiniValue}>
                  {formatNumber(consistency * 100, 0)}
                  <i>%</i>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.whisper} ${styles.whisperCenter}`}>
          <span>
            <span className={styles.lab}>
              <FormattedMessage
                id="typingTest.report.characters"
                defaultMessage="Characters"
              />
            </span>
            {formatNumber(length)}
          </span>
          <span>
            <span className={styles.lab}>
              <FormattedMessage
                id="typingTest.report.errors"
                defaultMessage="Errors"
              />
            </span>
            {formatNumber(errors)}
          </span>
          <span>
            <span className={styles.lab}>
              <FormattedMessage
                id="typingTest.report.time"
                defaultMessage="Time"
              />
            </span>
            {formatDuration(time, { showMillis: true })}
          </span>
        </div>

        <div className={styles.insightCard}>
          {insight.kind === "speedUp" && (
            <FormattedMessage
              id="typingTest.report.insightSpeedUp"
              defaultMessage="You sped up {percent}% in the second half of the test."
              values={{ percent: insight.percent }}
            />
          )}
          {insight.kind === "slowDown" && (
            <FormattedMessage
              id="typingTest.report.insightSlowDown"
              defaultMessage="Your pace eased by {percent}% in the second half — no rush."
              values={{ percent: insight.percent }}
            />
          )}
          {insight.kind === "slowKeys" && (
            <FormattedMessage
              id="typingTest.report.insightSlowKeys"
              defaultMessage="Your slowest keys this time: {keys}."
              values={{ keys: insight.keys.join(", ") }}
            />
          )}
          {insight.kind === "steady" && (
            <FormattedMessage
              id="typingTest.report.insightSteady"
              defaultMessage="Your pace stayed steady all the way through."
            />
          )}
        </div>

        <div className={styles.sect}>
          {testCount >= 2 ? (
            <FormattedMessage
              id="typingTest.report.recentTests"
              defaultMessage="Your last {n} tests"
              values={{ n: recent.length }}
            />
          ) : (
            <FormattedMessage
              id="typingTest.report.recentTestsHeader"
              defaultMessage="Your recent tests"
            />
          )}
        </div>
        {testCount >= 2 ? (
          <div className={styles.hist}>
            <RecentTrendChart
              values={recent.map((r) => r.cpm)}
              bestValue={bestCpm}
              formatValue={(v) => formatSpeed(v, { unit: false })}
            />
            {streakDays >= 2 && (
              <div className={styles.legendRow}>
                <FormattedMessage
                  id="typingTest.report.streak"
                  defaultMessage="{n}-day streak"
                  values={{ n: streakDays }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className={styles.legendRow}>
            <FormattedMessage
              id="typingTest.report.firstTest"
              defaultMessage="Your first test — run a few more to see your trend"
            />
          </div>
        )}

        <div className={styles.sect}>
          <FormattedMessage
            id="typingTest.report.overTheTest"
            defaultMessage="Speed over the test"
          />
        </div>
        <div className={styles.hist}>
          <RollingSpeedChart
            steps={result.steps}
            averageSpeed={speed}
            formatSpeed={(value) => formatSpeed(value, { unit: false })}
          />
          <div className={styles.legendRow}>
            <FormattedMessage
              id="typingTest.report.overTheTestLegend"
              defaultMessage="your speed as the test went on — the dashed line is your average"
            />
          </div>
        </div>

        <div className={styles.sect}>
          <FormattedMessage
            id="typingTest.report.timePerChar"
            defaultMessage="Time per character"
          />
        </div>
        <div className={styles.hist}>
          <TimeToTypeChart steps={result.steps} />
          <div className={styles.legendRow}>
            <FormattedMessage
              id="typingTest.report.timePerCharLegend"
              defaultMessage="how long each character took — shorter bars to the left mean faster fingers"
            />
          </div>
        </div>

        <div className={styles.sect}>
          <FormattedMessage
            id="typingTest.report.compared"
            defaultMessage="Compared to everyone"
          />
        </div>
        <div className={styles.histPair}>
          <div className={styles.hist}>
            <PopulationChart
              distribution={dSpeed}
              value={speed}
              valueLabel={`you ${formatSpeed(speed, { unit: false })}`}
              loLabel="0"
              hiLabel={formatSpeed(dSpeed.length - 1)}
            />
            <div className={styles.legendRow}>
              <FormattedMessage
                id="typingTest.report.fasterThan"
                defaultMessage="faster than {percent} of all other people — the top {top}"
                values={{
                  percent: <b>{formatPercents(pSpeed)}</b>,
                  top: <b>{formatPercents(top(pSpeed))}</b>,
                }}
              />
            </div>
          </div>
          <div className={styles.hist}>
            <PopulationChart
              distribution={dAccuracy}
              value={dAccuracy.scale(accuracy)}
              valueLabel={`you ${formatNumber(accuracy * 100, 1)}%`}
              loLabel="0%"
              hiLabel="100%"
            />
            <div className={styles.legendRow}>
              <FormattedMessage
                id="typingTest.report.moreAccurateThan"
                defaultMessage="more accurate than {percent} of all other people — the top {top}"
                values={{
                  percent: <b>{formatPercents(pAccuracy)}</b>,
                  top: <b>{formatPercents(top(pAccuracy))}</b>,
                }}
              />
            </div>
          </div>
        </div>

        <div className={styles.sect}>
          <FormattedMessage
            id="typingTest.report.replay"
            defaultMessage="Watch the replay"
          />
        </div>
        <div className={styles.replayWrap}>
          <Replay result={result} />
        </div>

        <div className={styles.nextRow}>
          <button type="button" className={styles.nextBtn} onClick={handleNext}>
            <FormattedMessage
              id="typingTest.report.nextTest"
              defaultMessage="Next test"
            />
          </button>
        </div>
        <div className={styles.legendRow}>
          <FormattedMessage
            id="typingTest.report.pressEnter"
            defaultMessage="press {space} or {enter} to go again"
            values={{ space: <Kbd>Space</Kbd>, enter: <Kbd>Enter</Kbd> }}
          />
        </div>
      </div>
    </Screen>
  );
}

function top(value: number) {
  return Math.max(0, 1 - value); // Takes care of negative zero.
}

function modeOf(type: DurationType): TestMode {
  switch (type) {
    case DurationType.Time:
      return "time";
    case DurationType.Length:
      return "passage";
    case DurationType.Words:
      return "words";
    default:
      return "time";
  }
}

function lengthLabelOf(duration: Duration): string {
  const preset = durations.find(
    (item) =>
      item.duration.type === duration.type &&
      item.duration.value === duration.value,
  );
  if (preset != null) {
    return preset.label;
  }
  switch (duration.type) {
    case DurationType.Time:
      return `${Math.round(duration.value / 1000)}s`;
    case DurationType.Length:
      return `${duration.value} chars`;
    case DurationType.Words:
      return `${duration.value} words`;
    default:
      return "";
  }
}

// ---- data-derived insight --------------------------------------------------

type Insight =
  | { readonly kind: "speedUp"; readonly percent: number }
  | { readonly kind: "slowDown"; readonly percent: number }
  | { readonly kind: "slowKeys"; readonly keys: readonly string[] }
  | { readonly kind: "steady" };

// One calm, data-derived sentence: prefer a first-half-vs-second-half speed
// comparison when there is enough signal, otherwise name the slowest keys,
// otherwise fall back to a steady, non-judgemental note.
function computeInsight(steps: readonly Step[]): Insight {
  if (steps.length >= 12) {
    const mid = Math.floor(steps.length / 2);
    const t0 = steps[0].timeStamp;
    const tMid = steps[mid].timeStamp;
    const tEnd = steps[steps.length - 1].timeStamp;
    const speed1 = computeSpeed(mid, tMid - t0);
    const speed2 = computeSpeed(steps.length - 1 - mid, tEnd - tMid);
    if (speed1 > 0 && speed2 > 0) {
      const change = ((speed2 - speed1) / speed1) * 100;
      if (Math.abs(change) >= 6) {
        return change > 0
          ? { kind: "speedUp", percent: Math.round(change) }
          : { kind: "slowDown", percent: Math.round(-change) };
      }
    }
  }

  const totals = new Map<number, { sum: number; count: number }>();
  for (const { codePoint, timeToType, typo } of steps) {
    if (timeToType > 0 && !typo && codePoint !== 0x20) {
      const entry = totals.get(codePoint) ?? { sum: 0, count: 0 };
      entry.sum += timeToType;
      entry.count += 1;
      totals.set(codePoint, entry);
    }
  }
  const withEnough = [...totals.entries()].filter(([, v]) => v.count >= 2);
  if (withEnough.length >= 2) {
    withEnough.sort((a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count);
    const keys = withEnough
      .slice(0, 2)
      .map(([codePoint]) => String.fromCodePoint(codePoint));
    return { kind: "slowKeys", keys };
  }

  return { kind: "steady" };
}

// A real, if simple, 0..1 consistency figure: one minus the coefficient of
// variation of the rolling speed samples (the same samples the "speed over
// the test" chart uses), clamped. Omitted when there isn't enough signal.
function computeConsistency(steps: readonly Step[]): number | null {
  const window = 10;
  if (steps.length <= window) {
    return null;
  }
  const speeds: number[] = [];
  for (let i = window; i < steps.length; i++) {
    const dt = steps[i].timeStamp - steps[i - window].timeStamp;
    if (dt > 0) {
      speeds.push((window / dt) * 60000);
    }
  }
  if (speeds.length < 3) {
    return null;
  }
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  if (mean <= 0) {
    return null;
  }
  const variance =
    speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(1, 1 - cv));
}
