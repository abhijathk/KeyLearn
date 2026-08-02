import { dotsOf } from "@keybr/braille";
import { useIntlNumbers } from "@keybr/intl";
import { clsx } from "clsx";
import { type ReactNode, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as braille from "./BrailleProfile.module.less";
import * as styles from "./road/road.module.less";

/**
 * The six keys, in the three views the typing profile gives its twenty-six.
 *
 * Same segmented switch, same charts, same legends — a braille learner should
 * get the report their sighted sibling gets, over the keys they actually
 * press. The heatmap draws the practice page's own key caps, S D F under the
 * left hand and J K L under the right with the space bar beneath, so somebody
 * arriving from a session is looking at the keyboard they just used.
 *
 * The figures are aggregated from the cells a dot appears in, because that is
 * what is recorded: a miss is counted against the cell that was wanted, not
 * against whichever dot went astray. So this answers "how are the cells that
 * use dot 3 going" rather than "how accurate is dot 3" — a real question, and
 * the one the data can actually support.
 */
export function DotHeat({
  cells,
}: {
  readonly cells: readonly {
    readonly cell: number;
    readonly stat: {
      readonly hits: number;
      readonly misses: number;
      readonly bestMs: number | null;
      readonly recentMs: readonly number[];
    };
  }[];
}): ReactNode {
  const { formatMessage } = useIntl();
  const [view, setView] = useState(0);
  const dots = useDotFacts(cells);
  return (
    <>
      <div className={styles.centered}>
        <span className={styles.seg}>
          {[
            formatMessage({
              id: "profile.keys.heatmap",
              defaultMessage: "Heatmap",
            }),
            formatMessage({
              id: "profile.keys.speed",
              defaultMessage: "Speed",
            }),
            formatMessage({
              id: "profile.keys.frequency",
              defaultMessage: "Frequency",
            }),
          ].map((name, index) => (
            <button
              key={name}
              type="button"
              className={clsx(styles.segItem, view === index && styles.segOn)}
              onClick={() => {
                setView(index);
              }}
            >
              {name}
            </button>
          ))}
        </span>
      </div>
      {view === 0 && <HeatKeys dots={dots} />}
      {view === 1 && <SpeedBars dots={dots} />}
      {view === 2 && <FreqBars dots={dots} />}
      <p className={styles.prose}>
        <FormattedMessage
          id="braille.profile.dots.note"
          defaultMessage="Each dot is scored from the cells that use it — a miss is recorded against the cell, not against whichever dot went astray."
        />
      </p>
    </>
  );
}

type DotFacts = {
  readonly dot: number;
  readonly key: string;
  readonly hits: number;
  readonly misses: number;
  /** Cells a minute, from the median join time. */
  readonly speed: number | null;
};

/** The Perkins layout: dots 1 2 3 under the left hand, 4 5 6 under the right. */
const KEYS = ["F", "D", "S", "J", "K", "L"] as const;

/** Left hand reads outward from the index finger, where dot 1 sits. */
const HANDS = [
  [2, 1, 0],
  [3, 4, 5],
] as const;

const W = 1000;

function useDotFacts(
  cells: readonly {
    readonly cell: number;
    readonly stat: {
      readonly hits: number;
      readonly misses: number;
      readonly recentMs: readonly number[];
    };
  }[],
): readonly DotFacts[] {
  return useMemo(() => {
    const acc = Array.from({ length: 6 }, (_, i) => ({
      dot: i + 1,
      key: String(KEYS[i]),
      hits: 0,
      misses: 0,
      samples: [] as number[],
    }));
    for (const { cell, stat } of cells) {
      for (const dot of dotsOf(cell)) {
        const at = acc[dot - 1];
        if (at == null) {
          continue;
        }
        at.hits += stat.hits;
        at.misses += stat.misses;
        at.samples.push(...stat.recentMs);
      }
    }
    return acc.map(({ samples, ...rest }) => {
      // The median rather than the mean: one long pause while a learner thinks
      // would drag an average somewhere it does not belong.
      const sorted = [...samples].sort((a, b) => a - b);
      const ms =
        sorted.length === 0 ? null : sorted[Math.floor(sorted.length / 2)];
      return { ...rest, speed: ms == null ? null : 60000 / ms };
    });
  }, [cells]);
}

/**
 * The practice keyboard, wearing the hit and miss circles the typing profile
 * puts on its own keys.
 */
function HeatKeys({ dots }: { readonly dots: readonly DotFacts[] }): ReactNode {
  const maxHits = Math.max(1, ...dots.map(({ hits }) => hits));
  const maxMisses = Math.max(1, ...dots.map(({ misses }) => misses));
  return (
    <>
      <div className={braille.keyboard}>
        <div className={braille.keyRow}>
          {/*
            The cell itself, to the left of the keys that make it — the same
            pairing the practice page shows, so the mapping from dot number to
            finger is read off rather than remembered.
          */}
          <div className={braille.dotCell} aria-hidden={true}>
            {[0, 3].map((offset) => (
              <div key={offset} className={braille.dotCol}>
                {dots.slice(offset, offset + 3).map((d) => (
                  <span
                    key={d.dot}
                    className={braille.dotPip}
                    style={
                      d.hits > 0
                        ? {
                            borderColor: `color-mix(in srgb, var(--accent) ${Math.round(
                              25 + (d.hits / maxHits) * 75,
                            )}%, var(--primary-d2))`,
                          }
                        : undefined
                    }
                  >
                    {d.dot}
                  </span>
                ))}
              </div>
            ))}
          </div>
          {HANDS.map((hand, i) => (
            <div key={i} className={braille.hand}>
              {hand.map((index) => {
                const d = dots[index];
                const hit = d.hits > 0 ? 16 + (d.hits / maxHits) * 40 : 0;
                const miss =
                  d.misses > 0 ? 12 + (d.misses / maxMisses) * 28 : 0;
                return (
                  <div
                    key={d.dot}
                    className={braille.key}
                    title={`${d.key} — dot ${d.dot} · ${d.hits} hits · ${d.misses} misses`}
                  >
                    {hit > 0 && (
                      <span
                        className={styles.hitdot}
                        style={{ inlineSize: hit, blockSize: hit }}
                      />
                    )}
                    {miss > 0 && (
                      <span
                        className={styles.missdot}
                        style={{ inlineSize: miss, blockSize: miss }}
                      />
                    )}
                    <span className={braille.keyCode}>{d.key}</span>
                    <span className={braille.keyDot}>{d.dot}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/*
          Drawn because the keyboard would be wrong without it, and carrying no
          figures because there are none: a blank cell is entered by pressing
          nothing, so there is no dot to score.
        */}
        <div className={braille.space}>
          <FormattedMessage id="braille.spacebar" defaultMessage="Space" />
        </div>
      </div>
      <div className={styles.legendRow}>
        <i style={{ backgroundColor: "var(--fast-key-color)" }} />
        <FormattedMessage id="profile.keys.hitsLegend" defaultMessage="hits" />
        <i style={{ backgroundColor: "var(--slow-key-color)" }} />
        <FormattedMessage
          id="profile.keys.missesLegend"
          defaultMessage="misses — circle size = how often"
        />
      </div>
    </>
  );
}

function SpeedBars({
  dots,
}: {
  readonly dots: readonly DotFacts[];
}): ReactNode {
  const { formatNumber } = useIntlNumbers();
  const speeds = dots
    .map(({ speed }) => speed)
    .filter((s): s is number => s != null);
  const hi = Math.max(1, ...speeds) * 1.15;
  const H = 170;
  const step = W / dots.length;
  return (
    <>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ blockSize: "10rem", marginBlockStart: "1rem" }}
      >
        {dots.map((d, i) => {
          if (d.speed == null) {
            return null;
          }
          const h = (d.speed / hi) * (H - 40);
          // Green at the top of the range, amber at the bottom — the same
          // reading the typing profile's bars give.
          const level = Math.max(0, Math.min(1, d.speed / hi));
          return (
            <g key={d.dot}>
              <rect
                x={i * step + step / 2 - 26}
                y={H - 16 - h}
                width="52"
                height={h}
                rx="3"
                fill={`color-mix(in oklab, var(--fast-key-color) ${Math.round(
                  35 + level * 65,
                )}%, var(--slow-key-color))`}
              />
              <text
                x={i * step + step / 2}
                y={H - 22 - h}
                fill="var(--text-color-f1)"
                fontSize="11"
                textAnchor="middle"
                style={{ fontFamily: "inherit" }}
              >
                {formatNumber(d.speed, 1)}
              </text>
            </g>
          );
        })}
        {dots.map((d, i) => (
          <text
            key={`l${d.dot}`}
            x={i * step + step / 2}
            y={H - 2}
            fill="var(--text-color-f2)"
            fontSize="11"
            fontWeight="700"
            textAnchor="middle"
            style={{ fontFamily: "inherit" }}
          >
            {d.key} · {d.dot}
          </text>
        ))}
      </svg>
      <div className={styles.legendRow}>
        <FormattedMessage
          id="braille.profile.dots.speedLegend"
          defaultMessage="average cells a minute for the cells using each dot — coloured red (slow) to green (fast)"
        />
      </div>
    </>
  );
}

function FreqBars({ dots }: { readonly dots: readonly DotFacts[] }): ReactNode {
  const { formatPercents } = useIntlNumbers();
  const maxHits = Math.max(1, ...dots.map(({ hits }) => hits));
  const maxMisses = Math.max(1, ...dots.map(({ misses }) => misses));
  const H = 190;
  const AXIS = 120;
  const step = W / dots.length;
  return (
    <>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ blockSize: "11rem", marginBlockStart: "1rem" }}
      >
        <line
          x1="0"
          y1={AXIS}
          x2={W}
          y2={AXIS}
          stroke="var(--primary-d2)"
          strokeWidth="1"
        />
        {dots.map((d, i) => {
          if (d.hits === 0 && d.misses === 0) {
            return null;
          }
          const hh = (d.hits / maxHits) * (AXIS - 24);
          const mh = (d.misses / maxMisses) * 40;
          return (
            <g key={d.dot}>
              <rect
                x={i * step + step / 2 - 26}
                y={AXIS - hh}
                width="52"
                height={Math.max(2, hh)}
                rx="3"
                fill="var(--accent)"
              />
              <rect
                x={i * step + step / 2 - 26}
                y={AXIS + 4}
                width="52"
                height={Math.max(2, mh)}
                rx="3"
                fill="var(--slow-key-color)"
              />
              <text
                x={i * step + step / 2}
                y={AXIS - hh - 6}
                fill="var(--text-color-f2)"
                fontSize="10"
                textAnchor="middle"
                style={{ fontFamily: "inherit" }}
              >
                {formatPercents(d.hits > 0 ? d.misses / d.hits : 0, 0)}
              </text>
            </g>
          );
        })}
        {dots.map((d, i) => (
          <text
            key={`l${d.dot}`}
            x={i * step + step / 2}
            y={H - 4}
            fill="var(--text-color-f2)"
            fontSize="11"
            fontWeight="700"
            textAnchor="middle"
            style={{ fontFamily: "inherit" }}
          >
            {d.key} · {d.dot}
          </text>
        ))}
      </svg>
      <div className={styles.legendRow}>
        <i style={{ backgroundColor: "var(--accent)" }} />
        <FormattedMessage id="profile.keys.hitsLegend" defaultMessage="hits" />
        <i style={{ backgroundColor: "var(--slow-key-color)" }} />
        <FormattedMessage
          id="profile.keys.missesLegend2"
          defaultMessage="misses"
        />
        <FormattedMessage
          id="profile.keys.ratioLegend"
          defaultMessage="— the number above each bar is the miss-to-hit ratio"
        />
      </div>
    </>
  );
}
