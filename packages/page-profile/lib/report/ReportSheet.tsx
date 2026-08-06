import { type KeyStatsMap } from "@keylearn/result";
import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as styles from "./report.module.less";
import { type Period, type ReportData, smooth } from "./report-data.ts";

export type ReportVoice = "parent" | "teacher" | "numbers";

export type ReportPaper = "a4" | "letter" | "grey";

export type ReportOptions = {
  readonly period: Period;
  /**
   * Who the prose is written for. It changes the words and nothing else: a
   * teacher's copy names the curriculum stage and drops the encouragement,
   * and "just the numbers" drops the prose entirely. Every figure on the page
   * is the same in all three.
   */
  readonly voice: ReportVoice;
  readonly speedChart: boolean;
  readonly accuracyChart: boolean;
  readonly keys: boolean;
  readonly calendar: boolean;
  readonly transitions: boolean;
  /** One row per session. Long, and rarely what anybody wants. */
  readonly lessons: boolean;
  readonly paper: ReportPaper;
};

/**
 * The printed document.
 *
 * Rendered into the page but hidden on screen; the print stylesheet hides
 * everything else and shows only this. That is what makes "Save PDF" work with
 * no library at all — the browser's own print pipeline produces a paginated
 * PDF with selectable text, which is better than anything a canvas could.
 */
export function ReportSheet({
  name,
  data,
  options,
  keyStatsMap,
  transitions,
  floor,
  generatedAt,
  formatDate,
}: {
  readonly name: string;
  readonly data: ReportData;
  readonly options: ReportOptions;
  readonly keyStatsMap: KeyStatsMap;
  readonly transitions: readonly {
    readonly from: string;
    readonly to: string;
    readonly time: number;
    readonly errors: number;
  }[];
  readonly floor: number;
  readonly generatedAt: number;
  readonly formatDate: (at: number) => string;
}): ReactNode {
  const avg = smooth(data.points);
  // Results are stored in characters per minute; a word is five characters by
  // the usual convention, which is the figure the rest of the app shows and
  // the only one a reader can compare with anything else.
  const wpm = (n: number) => Math.round((n / 5) * 10) / 10;
  const tiers = [...keyStatsMap].map((k) => keyTier(k.timeToType));
  const secure = tiers.filter((t) => t === "keySecure").length;
  const steady = tiers.filter(
    (t) => t === "keySteady" || t === "keyNew",
  ).length;
  const detail = options.keys || options.calendar || options.transitions;
  const pages = 1 + (detail ? 1 : 0) + (options.lessons ? 1 : 0);
  const head = (page: number, sub?: string) => (
    <div className={styles.head}>
      <div>
        <div className={styles.title}>{name} — typing progress</div>
        <div className={styles.sub}>
          {sub ??
            `${formatDate(data.from)} to ${formatDate(data.to)} · ${data.count} lessons · ${Math.floor(data.minutes / 60)} h ${data.minutes % 60} m at the keyboard`}
        </div>
      </div>
      <div className={styles.meta}>
        <span className={styles.brand}>
          <KeyGlyph />
          <b>
            Key<em>Learn</em>
          </b>
        </span>
        Generated {formatDate(generatedAt)}
        <br />
        Page {page} of {pages}
      </div>
    </div>
  );

  return createPortal(
    <div
      data-print-sheet={true}
      className={
        options.paper === "grey"
          ? `${styles.sheet} ${styles.grey}`
          : styles.sheet
      }
      data-paper={options.paper}
    >
      <section className={styles.page}>
        {head(1)}

        <div className={styles.stats}>
          <Stat
            label="wpm typical"
            value={wpm(data.typicalSpeed)}
            delta={data.speedGain != null ? data.speedGain / 5 : null}
          />
          <Stat label="wpm best" value={wpm(data.bestSpeed)} />
          <Stat
            label="accuracy"
            value={`${(data.accuracy * 100).toFixed(1)}%`}
            delta={data.accuracyGain != null ? data.accuracyGain * 100 : null}
          />
          <Stat
            label="keys unlocked"
            value={`${[...keyStatsMap].filter((k) => k.timeToType != null).length} / ${keyStatsMap.letters.length}`}
          />
        </div>

        {options.voice === "parent" && (
          <>
            <div className={styles.sect}>How it is going</div>
            <p className={styles.p}>
              Over this period {name} practised on {data.daysPractised} of{" "}
              {data.daysInPeriod} days and typed{" "}
              {data.minutes >= 60
                ? `just over ${Math.floor(data.minutes / 60)} hours`
                : `${data.minutes} minutes`}{" "}
              in total. Typical speed is now {wpm(data.typicalSpeed)} words per
              minute
              {data.speedGain != null && data.speedGain > 0
                ? `, up ${wpm(data.speedGain)} over the period`
                : ""}
              , and the best single lesson reached {wpm(data.bestSpeed)}.
              Accuracy sits at {(data.accuracy * 100).toFixed(1)}%
              {data.accuracyGain != null && data.accuracyGain > 0
                ? `, improved by ${(data.accuracyGain * 100).toFixed(1)} points`
                : ""}
              .
            </p>
            {data.longestGap != null && data.longestGap.days >= 5 && (
              <p className={styles.p}>
                The longest break was {data.longestGap.days} days, from{" "}
                {formatDate(data.longestGap.at)}. A gap of that length usually
                costs a week of progress on the way back, which is worth knowing
                before reading a dip in the chart as a loss of ability.
              </p>
            )}
            <p className={styles.p}>
              There is nothing to do with this beyond noticing it. Practice
              already chooses what to work on next from the same figures, so the
              useful response to a slow week is another week rather than a
              change of plan.
            </p>
          </>
        )}

        {options.voice === "teacher" && (
          <>
            <div className={styles.sect}>For whoever is teaching</div>
            <p className={styles.p}>
              {name} has {secure} of {keyStatsMap.letters.length} letters secure
              and {steady} more in progress, over {data.count} lessons and{" "}
              {Math.floor(data.minutes / 60)} h {data.minutes % 60} m of
              keyboard time. Typical speed is {wpm(data.typicalSpeed)} wpm at{" "}
              {(data.accuracy * 100).toFixed(1)}% accuracy.
            </p>
            <p className={styles.p}>
              Lessons are generated adaptively rather than following a fixed
              sequence: the next letters are chosen from this learner&rsquo;s
              own error and latency data. The figures below therefore describe a
              moving target, and the letters not yet introduced are pending
              rather than failed.
            </p>
            <p className={styles.p}>
              <b>Practice pattern.</b> {data.daysPractised} days of{" "}
              {data.daysInPeriod}
              {data.longestGap != null && data.longestGap.days >= 3
                ? `, with a longest break of ${data.longestGap.days} days`
                : ", with no notable break"}
              . Short daily sessions beat long infrequent ones at this stage,
              and the calendar overleaf is the quickest way to see which of the
              two is happening.
            </p>
          </>
        )}

        {options.speedChart && (
          <>
            <div className={styles.sect}>Speed over the period</div>
            <SpeedChart points={data.points} avg={avg} />
            <div className={styles.legend}>
              Each dot is one lesson. The line is a seven-lesson average, which
              is what to read — single lessons swing widely and mean little on
              their own.
            </div>
          </>
        )}

        {options.accuracyChart && (
          <>
            <div className={styles.sect}>Accuracy across lessons</div>
            <div className={styles.split}>
              <div>
                <Histogram buckets={data.accuracyBuckets} />
                <div className={styles.legend}>
                  Lessons grouped by accuracy, 90% on the left to 100% on the
                  right.
                </div>
              </div>
              <p className={styles.p}>
                Most lessons land in the right-hand half. A short tail to the
                left is worth a glance rather than a worry: those are usually
                the first lesson after a break, or a session on newly-unlocked
                letters, where a dip is expected and temporary.
              </p>
            </div>
          </>
        )}

        <div className={styles.foot}>
          <span>
            {name} — {formatDate(data.from)} to {formatDate(data.to)}
          </span>
          <span>Page 1 of {pages}</span>
        </div>
      </section>

      {detail && (
        <section className={styles.page}>
          {head(2, "Detail")}

          {options.keys && (
            <>
              <div className={styles.sect}>Keys learned</div>
              <div className={styles.keys}>
                {[...keyStatsMap].map(({ letter, timeToType }) => (
                  <i
                    key={letter.codePoint}
                    className={styles[keyTier(timeToType)]}
                  >
                    {letter.label}
                  </i>
                ))}
              </div>
              <div className={styles.keyLegend}>
                <span>
                  <i className={styles.keySecure} /> Secure, under 350 ms
                </span>
                <span>
                  <i className={styles.keySteady} /> Steady, 350&ndash;500 ms
                </span>
                <span>
                  <i className={styles.keyNew} /> Still new, over 500 ms
                </span>
                <span>
                  <i className={styles.keyOff} /> Not introduced yet
                </span>
              </div>
            </>
          )}

          {options.calendar && (
            <>
              <div className={styles.sect}>Practice calendar</div>
              <Calendar points={data.points} from={data.from} to={data.to} />
              <div className={styles.legend}>
                One square per day across the period. Darker is more lessons.
              </div>
            </>
          )}

          {options.transitions && transitions.length > 0 && (
            <>
              <div className={styles.sect}>Next to work on</div>
              <p className={styles.p}>
                These key-pairs run slowest against {name}&rsquo;s own usual
                pace of {floor} ms. Practice already targets them automatically;
                they are listed so a tutor can see what the app is working on.
              </p>
              <table className={styles.table}>
                <tbody>
                  <tr>
                    <th>Pair</th>
                    <th>Time</th>
                    <th>vs usual</th>
                    <th>Typos</th>
                  </tr>
                  {transitions.map((t, i) => (
                    <tr key={i}>
                      <td>
                        {t.from} → {t.to}
                      </td>
                      <td>{t.time} ms</td>
                      <td>{(t.time / floor).toFixed(1)}× slower</td>
                      <td>{t.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className={styles.sect}>How to read this</div>
          <p className={styles.p}>
            <b>Words per minute</b> counts a word as five characters including
            spaces, which is the standard convention, so it can be compared with
            figures from anywhere else. <b>Typical</b> is the median of lessons
            in the period rather than the average, so one exceptional lesson
            does not move it. <b>Accuracy</b> counts a keystroke as correct only
            the first time: a corrected mistake still counts as a mistake,
            because the aim is to stop making it rather than to fix it quickly.
          </p>

          <div className={styles.foot}>
            <span>
              Generated by KeyLearn on this device — nothing was uploaded
            </span>
            <span>Page 2 of {pages}</span>
          </div>
        </section>
      )}

      {options.lessons && (
        <section className={styles.page}>
          {head(pages, "Every lesson")}
          <div className={styles.sect}>Every lesson, listed</div>
          <p className={styles.p}>
            One row per session, newest first. This is here because a school
            sometimes has to evidence the hours rather than the progress.
          </p>
          <table className={styles.table}>
            <tbody>
              <tr>
                <th>When</th>
                <th>Speed</th>
              </tr>
              {[...data.points]
                .reverse()
                .slice(0, 240)
                .map((p, i) => (
                  <tr key={i}>
                    <td>{formatDate(p.at)}</td>
                    <td>{wpm(p.speed)} wpm</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className={styles.foot}>
            <span>
              Generated by KeyLearn on this device — nothing was uploaded
            </span>
            <span>
              Page {pages} of {pages}
            </span>
          </div>
        </section>
      )}
    </div>,
    document.body,
  );
}

/**
 * The mark, drawn rather than loaded. An <img> would not survive a printer
 * with images turned off, and a colour logo would go to mud in greyscale —
 * this is an outline and the word, both of which print at any setting.
 */
function KeyGlyph(): ReactNode {
  return (
    <svg viewBox="0 0 24 16" className={styles.brandGlyph} aria-hidden={true}>
      <rect
        x={0.7}
        y={0.7}
        width={22.6}
        height={14.6}
        rx={2.6}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
      />
      <g fill="currentColor">
        <rect x={4} y={4} width={3} height={3} rx={0.7} />
        <rect x={8.5} y={4} width={3} height={3} rx={0.7} />
        <rect x={13} y={4} width={3} height={3} rx={0.7} />
        <rect x={17} y={4} width={3} height={3} rx={0.7} />
        <rect x={6.5} y={9.5} width={11} height={2.5} rx={0.7} />
      </g>
    </svg>
  );
}

function Stat({
  label,
  value,
  delta,
}: {
  readonly label: string;
  readonly value: number | string;
  readonly delta?: number | null;
}): ReactNode {
  return (
    <div className={styles.stat}>
      <b>
        {value}
        {delta != null && delta > 0.05 && (
          <i className={styles.delta}>+{Math.round(delta * 10) / 10}</i>
        )}
      </b>
      <span>{label}</span>
    </div>
  );
}

function SpeedChart({
  points,
  avg,
}: {
  readonly points: readonly { readonly speed: number }[];
  readonly avg: readonly number[];
}): ReactNode {
  const W = 640;
  const H = 130;
  // The axis is in the same unit as the figures above it, or a reader compares
  // a chart peaking at 240 with a headline saying 33 and concludes that one of
  // them is broken.
  const speeds = points.map((p) => p.speed / 5);
  const lo = Math.max(0, Math.min(...speeds) - 4);
  const hi = Math.max(...speeds) + 4;
  const x = (i: number) => 28 + (i / Math.max(1, points.length - 1)) * (W - 40);
  const y = (v: number) =>
    H - 18 - ((v - lo) / Math.max(1, hi - lo)) * (H - 34);
  const ticks = [lo, (lo + hi) / 2, hi].map((t) => Math.round(t));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart}>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={28}
            y1={y(t)}
            x2={W - 12}
            y2={y(t)}
            className={styles.grid}
          />
          <text x={4} y={y(t) + 3} className={styles.tick}>
            {t}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(p.speed / 5)}
          r={1.5}
          className={styles.dot}
        />
      ))}
      <path
        d={avg.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${y(v / 5)}`).join(" ")}
        className={styles.line}
      />
    </svg>
  );
}

function Histogram({
  buckets,
}: {
  readonly buckets: readonly number[];
}): ReactNode {
  const max = Math.max(...buckets, 1);
  return (
    <>
      <div className={styles.hist}>
        {buckets.map((b, i) => (
          <span key={i}>
            <b>{b > 0 ? b : ""}</b>
            <i style={{ blockSize: `${(b / max) * 100}%` }} />
          </span>
        ))}
      </div>
      <div className={styles.histAxis}>
        <span>90%</span>
        <span>100%</span>
      </div>
    </>
  );
}

/**
 * Three bands rather than a gradient. The reader is being told whether a key
 * is dependable, not how many milliseconds it takes — and bands survive a
 * greyscale printer, where a continuous shade turns to mud.
 */
function keyTier(
  timeToType: number | null,
): "keySecure" | "keySteady" | "keyNew" | "keyOff" {
  if (timeToType == null) {
    return "keyOff";
  }
  if (timeToType < 350) {
    return "keySecure";
  }
  return timeToType < 500 ? "keySteady" : "keyNew";
}

function Calendar({
  points,
  from,
  to,
}: {
  readonly points: readonly { readonly at: number }[];
  readonly from: number;
  readonly to: number;
}): ReactNode {
  const DAY = 24 * 60 * 60 * 1000;
  const counts = new Map<number, number>();
  for (const p of points) {
    const key = Math.floor(p.at / DAY);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Only the period being reported on. A year of empty squares to make room
  // for three weeks of practice reads as failure rather than as a short
  // report, which is the opposite of what a summary is for.
  const end = Math.floor(to / DAY);
  const span = Math.max(13, Math.min(371, end - Math.floor(from / DAY)));
  const months: ReactNode[] = [];
  const cells: ReactNode[] = [];
  let lastMonth = -1;
  for (let i = span; i >= 0; i--) {
    const day = end - i;
    const date = new Date(day * DAY);
    if (date.getMonth() !== lastMonth) {
      lastMonth = date.getMonth();
      months.push(
        <span
          key={day}
          style={{ gridColumnStart: Math.floor((span - i) / 7) + 1 }}
        >
          {date.toLocaleDateString(undefined, { month: "short" })}
        </span>,
      );
    }
    const n = counts.get(day) ?? 0;
    cells.push(
      <i
        key={day}
        className={n > 0 ? styles.calOn : styles.calOff}
        style={
          n > 0 ? { opacity: 0.35 + Math.min(1, n / 5) * 0.65 } : undefined
        }
      />,
    );
  }
  return (
    <>
      <div className={styles.calMonths}>{months}</div>
      <div className={styles.cal}>{cells}</div>
    </>
  );
}
