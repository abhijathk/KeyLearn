import { loadNgramStats } from "@keylearn/pages-shared";
import { type KeyStatsMap, useResults } from "@keylearn/result";
import { Explainer } from "@keylearn/widget";
import { type ReactNode, useMemo } from "react";
import { FormattedMessage } from "react-intl";
import * as road from "./road.module.less";
import * as styles from "./SlowTransitions.module.less";

/**
 * "Slowest transitions": a ranked bar chart of the learner's weakest key-pairs,
 * read from the persisted n-gram statistics. Two keys can each be quick alone
 * yet slow as a pair — these are exactly the transitions the bottleneck drill
 * targets, made visible. Renders nothing until there is enough data, and is
 * only shown on the learner's own profile (the stats live in local storage).
 */
export function SlowTransitions({
  keyStatsMap,
}: {
  readonly keyStatsMap: KeyStatsMap;
}): ReactNode {
  // Read the *displayed* profile's stats — the one the charts are scoped to,
  // not merely the globally-active profile — so each learner tab shows (and
  // clears) its own transitions.
  const { namespace } = useResults();
  // Select the most problematic pairs by weakness (slowness + errors), but
  // display them slowest-first so the bars read as a clean descending chart.
  const { rows, median } = useMemo(() => {
    const stats = loadNgramStats(namespace);
    return {
      rows: stats.topWeak(2, 8).sort((a, b) => b.time - a.time),
      median: stats.medianTime(2),
    };
    // Re-read the store when the results change, so "Clear statistics"
    // empties this chart immediately instead of showing stale pairs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStatsMap, namespace]);

  const labelOf = useMemo(() => {
    const map = new Map<number, string>();
    for (const letter of keyStatsMap.letters) {
      map.set(letter.codePoint, letter.label);
    }
    return (codePoint: number): string => {
      const label = map.get(codePoint);
      if (label != null) {
        return label;
      }
      if (codePoint === 0x20) {
        return "␣";
      }
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return "?";
      }
    };
  }, [keyStatsMap]);

  if (rows.length === 0) {
    return null;
  }

  // Measure the overspill past the learner's own typical pair rather than the
  // total. "300 ms" is a number nobody can act on; "twice as long as you
  // usually take" is, and it tightens as they improve. A learner with too few
  // well-sampled pairs to have a median falls back to their own fastest of
  // these eight, which is the same idea with a coarser floor.
  const floor =
    median != null && median > 0
      ? median
      : Math.min(...rows.map(({ time }) => time));
  const widest = Math.max(...rows.map(({ time }) => time - floor), 1);

  return (
    <>
      <div className={road.sect}>
        <FormattedMessage
          id="profile.road.transitions"
          defaultMessage="Slowest transitions — the key-pairs holding you back"
        />
      </div>
      <Explainer>
        <div className={road.whisper}>
          <span>
            <FormattedMessage
              id="profile.chart.transitions.description"
              defaultMessage="Two keys can each be quick alone yet slow as a pair — awkward rolls and same-finger jumps. These are the transitions your practice is quietly drilling."
            />
          </span>
        </div>
      </Explainer>
      <p className={styles.basis}>
        <FormattedMessage
          id="profile.road.transitions.basis"
          defaultMessage="The bar is how much longer these take than your usual pair, which runs at {floor} ms."
          values={{ floor }}
        />
      </p>
      <div className={styles.head} aria-hidden={true}>
        <span>
          <FormattedMessage
            id="profile.road.transitions.pair"
            defaultMessage="Pair"
          />
        </span>
        <span>
          <FormattedMessage
            id="profile.road.transitions.overspill"
            defaultMessage="Overspill"
          />
        </span>
        <span className={styles.end}>
          <FormattedMessage
            id="profile.road.transitions.time"
            defaultMessage="Time"
          />
        </span>
        <span className={styles.end}>
          <FormattedMessage
            id="profile.road.transitions.vs"
            defaultMessage="vs your usual"
          />
        </span>
        <span className={styles.end}>
          <FormattedMessage
            id="profile.road.transitions.typoCol"
            defaultMessage="Typos"
          />
        </span>
      </div>
      <div className={styles.list}>
        {rows.map(({ seq, time, errors }, index) => {
          const [from, to] = seq;
          const over = Math.max(0, time - floor);
          return (
            <div className={styles.row} key={index}>
              <span className={styles.pair}>
                <b className={styles.cap}>{labelOf(from)}</b>
                <i className={styles.arrow} aria-hidden={true}>
                  →
                </i>
                <b className={styles.cap}>{labelOf(to)}</b>
              </span>
              <span className={styles.track}>
                <span className={styles.origin} />
                <span
                  className={styles.fill}
                  style={{
                    inlineSize: `${Math.max(4, (over / widest) * 100)}%`,
                  }}
                />
              </span>
              <span className={styles.val}>
                {time}
                <em>ms</em>
              </span>
              <span className={styles.times}>
                <FormattedMessage
                  id="profile.road.transitions.slower"
                  defaultMessage="{n}× slower"
                  values={{ n: (time / floor).toFixed(1) }}
                />
              </span>
              <span className={styles.typos}>{errors}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
