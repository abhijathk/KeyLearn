import { loadNgramStats } from "@keybr/pages-shared";
import { type KeyStatsMap } from "@keybr/result";
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
  // Select the most problematic pairs by weakness (slowness + errors), but
  // display them slowest-first so the bars read as a clean descending chart.
  const rows = useMemo(
    () =>
      loadNgramStats()
        .topWeak(2, 8)
        .sort((a, b) => b.time - a.time),
    [],
  );

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

  const max = Math.max(...rows.map(({ time }) => time), 1);

  return (
    <>
      <div className={road.sect}>
        <FormattedMessage
          id="profile.road.transitions"
          defaultMessage="Slowest transitions — the key-pairs holding you back"
        />
      </div>
      <div className={road.whisper}>
        <span>
          <FormattedMessage
            id="profile.chart.transitions.description"
            defaultMessage="Two keys can each be quick alone yet slow as a pair — awkward rolls and same-finger jumps. These are the transitions your practice is quietly drilling."
          />
        </span>
      </div>
      <div className={styles.list}>
        {rows.map(({ seq, time, errors }, index) => {
          const [from, to] = seq;
          const width = Math.max(6, Math.round((time / max) * 100));
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
                <span
                  className={styles.fill}
                  style={{ inlineSize: `${width}%` }}
                />
              </span>
              <span className={styles.val}>
                {time}
                <em>ms</em>
                {errors > 0 && (
                  <i className={styles.typos}>
                    <FormattedMessage
                      id="profile.road.transitions.typos"
                      defaultMessage="· {errors} typo{errors, plural, one {} other {s}}"
                      values={{ errors }}
                    />
                  </i>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
