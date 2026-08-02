import {
  brailleStats,
  type CellStat,
  clearProgress,
  dailyStats,
  dayStats,
  defaultTarget,
  dotsOf,
  LETTERS,
  loadProgress,
  practiceDays,
  TEACHING_ORDER,
  toUnicode,
} from "@keybr/braille";
import { useIntlDates, useIntlNumbers } from "@keybr/intl";
import { downloadBlob, exportFilename } from "@keybr/pages-shared";
import { formatDuration } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as braille from "./BrailleProfile.module.less";
import { DotHeat } from "./DotHeat.tsx";
import { CalendarHeat } from "./road/CalendarHeat.tsx";
import * as styles from "./road/road.module.less";

/**
 * The profile page for a learner who is on braille and audio.
 *
 * Deliberately the same page as everyone else's: the same identity band, the
 * same hero and road, the same lifetime grid, the same journey strip, the same
 * practice calendar, the same two actions at the foot. A braille learner
 * produces no typing results, so the typing charts would every one read zero —
 * but that is a reason to change what the sections contain, not to invent a
 * second design.
 *
 * The one structural difference is that the sections a sighted profile fills
 * with charts are filled with sentences. A chart is not a thing that can be
 * heard, and this page is heard: read aloud, in order. So reading order is
 * importance order, and each section says something whole rather than labelling
 * a number and leaving the listener to assemble it.
 */
export function BrailleProfile({
  profileId,
  name,
  avatar,
}: {
  readonly profileId: string | null;
  readonly name: string;
  /** The learner's avatar, already rendered — see BrailleProfileScreen. */
  readonly avatar?: ReactNode;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatInteger, formatNumber } = useIntlNumbers();
  const { formatStamp } = useIntlDates();
  const [generation, setGeneration] = useState(0);

  const view = useMemo(() => {
    void generation; // re-read after a clear
    const progress = loadProgress(profileId);
    const unlocked = new Set(progress.unlocked());
    const cells = TEACHING_ORDER.map((letter) => ({
      letter,
      cell: LETTERS.get(letter) ?? 0,
      stat: progress.statOf(letter),
      unlocked: unlocked.has(letter),
      settled: progress.isSettled(letter),
    }));
    return {
      stats: brailleStats(profileId),
      cells,
      days: new Set(practiceDays(profileId)),
      daily: dailyStats(profileId),
      today: dayStats(profileId),
      weakest: progress.weakest(),
    };
  }, [profileId, generation]);

  const { stats, cells, days, daily, today, weakest } = view;
  const samples = cells.flatMap((c) => [...c.stat.recentMs]);
  const typicalMs = median(samples);
  const bestMs = Math.min(
    ...cells.map((c) => c.stat.bestMs ?? Infinity),
    Infinity,
  );
  const attempts = cells.reduce((n, c) => n + c.stat.hits + c.stat.misses, 0);
  const accuracy = attempts === 0 ? 0 : (stats.hits / attempts) * 100;
  const working = cells.filter((c) => c.unlocked && !c.settled);
  const quickest = pick(cells, (c) => c.stat.bestMs ?? Infinity);
  const lifetimeMs = [...daily.values()].reduce((n, d) => n + d.totalMs, 0);
  const todayPaceMs = today.timed === 0 ? null : today.totalMs / today.timed;
  const todayAttempts = today.hits + today.misses;
  const startedToday = todayAttempts > 0;
  const todayAccuracy =
    todayAttempts === 0 ? 0 : (today.hits / todayAttempts) * 100;
  const slowest = pick(cells, (c) => -(c.stat.bestMs ?? 0));
  // The engine's own answer to which cell is holding the learner back, so the
  // profile names the same one the lesson is drilling. It weighs accuracy as
  // well as speed, which the slowest best-time alone does not.
  const holdingUp = cells.find((c) => c.letter === weakest) ?? slowest;

  return (
    <div className={styles.col}>
      <div className={styles.id}>
        {avatar != null ? (
          <span className={styles.avatarPhoto}>{avatar}</span>
        ) : (
          <span className={styles.avatar} aria-hidden={true}>
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="9" r="3.4" />
              <path d="M5.5 19c1.2-3 3.6-4.5 6.5-4.5s5.3 1.5 6.5 4.5" />
              <circle cx="12" cy="12" r="10.2" />
            </svg>
          </span>
        )}
        <span className={styles.who}>
          <b>{name}</b>
          <i>
            <FormattedMessage
              id="braille.profile.subline"
              defaultMessage="{cells} cells entered · {learned} of {total} letters · {streak} day streak"
              values={{
                cells: formatInteger(stats.hits),
                learned: stats.learned,
                total: stats.totalCells,
                streak: formatInteger(stats.streakDays),
              }}
            />
          </i>
        </span>
      </div>

      <div className={styles.liferoad}>
        <div className={styles.hero}>
          {typicalMs == null ? "—" : formatNumber(60000 / typicalMs, 1)}
          <i>
            <FormattedMessage
              id="braille.profile.cpm"
              defaultMessage="cells/min"
            />
          </i>
          <em>
            <FormattedMessage
              id="braille.profile.typicalPace"
              defaultMessage="typical pace"
            />
          </em>
        </div>
        <div className={styles.road} aria-hidden={true}>
          <div
            className={styles.rdone}
            style={{
              inlineSize: `${percent(stats.learned, stats.totalCells)}%`,
            }}
          />
          <div className={styles.rdot} />
          <div className={styles.rahead} />
        </div>
        <div className={styles.goal}>
          {Number.isFinite(bestMs) ? formatNumber(60000 / bestMs, 1) : "—"}
          <em>
            <FormattedMessage
              id="braille.profile.personalBest"
              defaultMessage="personal best"
            />
          </em>
        </div>
      </div>

      <div className={styles.statBlock}>
        <div className={styles.statTitle}>
          <FormattedMessage
            id="braille.profile.lifetime"
            defaultMessage="Lifetime stats"
          />
        </div>
        <div className={braille.statGrid}>
          <Stat
            value={formatDuration(lifetimeMs)}
            label={formatMessage({
              id: "braille.profile.stat.time",
              defaultMessage: "time spent",
            })}
          />
          <Stat
            value={formatInteger(stats.hits)}
            label={formatMessage({
              id: "braille.profile.stat.cells",
              defaultMessage: "cells entered",
            })}
          />
          <Stat
            value={`${stats.learned} / ${stats.totalCells}`}
            label={formatMessage({
              id: "braille.profile.stat.letters",
              defaultMessage: "letters known",
            })}
          />
          <Stat
            value={
              Number.isFinite(bestMs) ? formatNumber(60000 / bestMs, 1) : "—"
            }
            label={formatMessage({
              id: "braille.profile.stat.bestPace",
              defaultMessage: "best pace",
            })}
          />
          <Stat
            value={typicalMs == null ? "—" : formatNumber(60000 / typicalMs, 1)}
            label={formatMessage({
              id: "braille.profile.stat.typicalPace",
              defaultMessage: "typical pace",
            })}
          />
          <Stat
            value={`${formatNumber(accuracy, 1)}%`}
            label={formatMessage({
              id: "braille.profile.stat.accuracy",
              defaultMessage: "accuracy",
            })}
          />
        </div>
      </div>

      <div className={styles.statBlock}>
        <div className={styles.statTitle}>
          <FormattedMessage
            id="braille.profile.today"
            defaultMessage="Today’s stats"
          />
        </div>
        <div className={braille.statGrid}>
          <Stat
            value={formatDuration(today.totalMs)}
            label={formatMessage({
              id: "braille.profile.stat.time",
              defaultMessage: "time spent",
            })}
          />
          <Stat
            value={formatInteger(today.hits)}
            label={formatMessage({
              id: "braille.profile.stat.cells",
              defaultMessage: "cells entered",
            })}
          />
          <Stat
            value={formatInteger(today.misses)}
            label={formatMessage({
              id: "braille.profile.stat.mistakes",
              defaultMessage: "mistakes",
            })}
          />
          <Stat
            value={
              today.bestMs == null ? "—" : formatNumber(60000 / today.bestMs, 1)
            }
            label={formatMessage({
              id: "braille.profile.stat.bestPace",
              defaultMessage: "best pace",
            })}
          />
          <Stat
            value={
              todayPaceMs == null ? "—" : formatNumber(60000 / todayPaceMs, 1)
            }
            // Against the lifetime pace, so the delta says whether today is
            // going better than usual rather than merely stating a number.
            delta={
              startedToday && todayPaceMs != null && typicalMs != null
                ? 60000 / todayPaceMs - 60000 / typicalMs
                : null
            }
            label={formatMessage({
              id: "braille.profile.stat.typicalPace",
              defaultMessage: "typical pace",
            })}
          />
          <Stat
            value={`${formatNumber(todayAccuracy, 1)}%`}
            delta={startedToday ? todayAccuracy - accuracy : null}
            label={formatMessage({
              id: "braille.profile.stat.accuracy",
              defaultMessage: "accuracy",
            })}
          />
        </div>
      </div>

      <h2 className={styles.sect}>
        <FormattedMessage
          id="braille.profile.journey"
          defaultMessage="The journey — {learned} of {total} cells unlocked"
          values={{ learned: stats.learned, total: stats.totalCells }}
        />
      </h2>
      <ol className={braille.journey} aria-hidden={true}>
        {cells.map(({ letter, unlocked, settled }) => (
          <li
            key={letter}
            className={clsx(
              braille.jstep,
              unlocked && settled && braille.done,
              unlocked && !settled && braille.now,
            )}
          >
            <i className={braille.jdot} />
            <span className={braille.jltr}>{letter}</span>
          </li>
        ))}
      </ol>

      <h2 className={styles.sect}>
        <FormattedMessage
          id="braille.profile.whereYouAre"
          defaultMessage="Where you are"
        />
      </h2>
      <p className={styles.prose}>
        <FormattedMessage
          id="braille.profile.summary"
          defaultMessage="You know {learned, plural, one {# braille letter} other {# braille letters}} of {total}."
          values={{ learned: stats.learned, total: stats.totalCells }}
        />{" "}
        {working.length > 0 && (
          <FormattedMessage
            id="braille.profile.working"
            defaultMessage="You are working on {letters} now."
            values={{ letters: working.map((c) => c.letter).join(", ") }}
          />
        )}{" "}
        {stats.streakDays > 0 && (
          <FormattedMessage
            id="braille.profile.streak"
            defaultMessage="You have practised {days, plural, one {# day} other {# days}} in a row."
            values={{ days: stats.streakDays }}
          />
        )}
      </p>

      {quickest?.stat.bestMs != null && (
        <>
          <h2 className={styles.sect}>
            <FormattedMessage
              id="braille.profile.pace"
              defaultMessage="Pace — the cells holding you back"
            />
          </h2>
          <p className={styles.prose}>
            <FormattedMessage
              id="braille.profile.paceText"
              defaultMessage="Your quickest cell is {fast}, at {fastMs} seconds. The one holding you up is {slow}, at {slowMs} seconds — it needs to reach {target} seconds before a new letter is added."
              values={{
                fast: quickest.letter,
                fastMs: secs(quickest.stat.bestMs),
                slow: holdingUp?.letter ?? "",
                slowMs: secs(holdingUp?.stat.bestMs),
                target: secs(defaultTarget.msPerCell),
              }}
            />
          </p>
        </>
      )}

      <h2 className={styles.sect}>
        <FormattedMessage
          id="braille.profile.yourCells"
          defaultMessage="Your cells — the alphabet in its decades"
        />
      </h2>
      {DECADES.map(({ from, to, note }) => (
        <div key={from} className={braille.decade}>
          <p className={styles.prose}>{note}</p>
          <ul className={braille.cellRow}>
            {cells
              .slice(from, to)
              .map(({ letter, cell, stat, unlocked, settled }) => (
                <li
                  key={letter}
                  className={clsx(
                    braille.cellItem,
                    unlocked && settled && braille.on,
                    unlocked && !settled && braille.nowCell,
                  )}
                >
                  {/*
                    The dots are decorative here — the label beneath carries the
                    letter, and the full reading is on the item itself, so a
                    screen reader says "q, dots 1 2 3 4 5, working on it" rather
                    than reading a braille glyph it may not have a name for.
                  */}
                  <span className={braille.cellDots} aria-hidden={true}>
                    {toUnicode(cell)}
                  </span>
                  <span className={braille.cellLtr}>{letter}</span>
                  <span className={styles.srOnly}>
                    <FormattedMessage
                      id="braille.profile.cellReading"
                      defaultMessage="{letter}, dots {dots}, {state}"
                      values={{
                        letter,
                        dots: dotsOf(cell).join(" "),
                        state: stateOf(formatMessage, unlocked, settled),
                      }}
                    />
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}

      <h2 className={styles.sect}>
        <FormattedMessage
          id="braille.profile.yourDots"
          defaultMessage="Your dots — the six keys"
        />
      </h2>
      <DotHeat cells={cells} />

      <h2 className={styles.sect}>
        <FormattedMessage
          id="braille.profile.calendar"
          defaultMessage="Practice calendar — last year"
        />
      </h2>
      <CalendarHeat brailleDays={daily} />

      <div className={styles.footActions}>
        <button
          type="button"
          className={styles.footAction}
          onClick={() => {
            const blob = new Blob(
              [
                JSON.stringify(
                  {
                    profile: name,
                    ...stats,
                    days: [...days],
                    cells: cells.map(({ letter, stat }) => ({
                      letter,
                      ...stat,
                    })),
                  },
                  null,
                  2,
                ),
              ],
              { type: "application/json" },
            );
            downloadBlob(
              blob,
              exportFilename(
                "braille-data",
                name,
                "json",
                formatStamp(Date.now()),
              ),
            );
          }}
        >
          {"⬇ "}
          <FormattedMessage
            id="t_Download_data"
            defaultMessage="Export your data"
          />
        </button>
        <button
          type="button"
          className={styles.footActionDanger}
          onClick={() => {
            if (
              window.confirm(
                formatMessage({
                  id: "profile.reset.message",
                  defaultMessage:
                    "Do you really want to erase all your data and reset your profile? " +
                    "This can't be undone once you confirm!",
                }),
              )
            ) {
              clearProgress(profileId);
              setGeneration((n) => n + 1);
            }
          }}
        >
          {"⌫ "}
          <FormattedMessage
            id="t_Reset_statistics"
            defaultMessage="Clear statistics"
          />
        </button>
      </div>
    </div>
  );
}

/**
 * The three braille decades, which is how the alphabet is actually taught: ten
 * base patterns, the same ten with dot 3, then with dots 3 and 6. Showing the
 * structure is most of the teaching — a learner who sees it never has to
 * memorise k separately from a.
 */
const DECADES = [
  { from: 0, to: 10, note: "First decade, a–j: the base pattern." },
  { from: 10, to: 20, note: "Second decade, k–t: the same ten, plus dot 3." },
  { from: 20, to: 26, note: "Third decade, u–z: plus dots 3 and 6." },
] as const;

function Stat({
  value,
  label,
  delta = null,
}: {
  readonly value: string;
  readonly label: string;
  /** Today against the lifetime figure; omitted where there is nothing to compare. */
  readonly delta?: number | null;
}): ReactNode {
  const moved =
    delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.1;
  return (
    <div className={styles.statCell}>
      <span className={styles.statVal}>
        {value}
        {moved && (
          <span
            className={clsx(
              styles.statDelta,
              delta > 0 ? styles.up : styles.down,
            )}
          >
            {delta > 0 ? "+" : "−"}
            {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </span>
      <span className={styles.statLab}>{label}</span>
    </div>
  );
}

function stateOf(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  unlocked: boolean,
  settled: boolean,
): string {
  if (unlocked && settled) {
    return formatMessage({
      id: "braille.profile.state.known",
      defaultMessage: "known",
    });
  }
  if (unlocked) {
    return formatMessage({
      id: "braille.profile.state.working",
      defaultMessage: "working on it",
    });
  }
  return formatMessage({
    id: "braille.profile.state.locked",
    defaultMessage: "not yet introduced",
  });
}

function pick<T>(items: readonly T[], rank: (item: T) => number): T | null {
  let winner: T | null = null;
  let score = Infinity;
  for (const item of items) {
    const value = rank(item);
    if (Number.isFinite(value) && value < score) {
      score = value;
      winner = item;
    }
  }
  return winner;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

function secs(ms: number | null | undefined): string {
  return ms == null ? "—" : (ms / 1000).toFixed(1);
}

export type { CellStat };
