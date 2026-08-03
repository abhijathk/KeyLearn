import { useIntlNumbers } from "@keylearn/intl";
import { useFormatter, useKeyStyles } from "@keylearn/lesson-ui";
import { type KeyStatsMap, timeToSpeed } from "@keylearn/result";
import { clsx } from "clsx";
import { type ReactNode, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./road.module.less";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

type KeyFacts = {
  readonly label: string;
  readonly hits: number;
  readonly misses: number;
  readonly speed: number | null;
  readonly confidence: number | null;
};

function useKeyFacts(
  keyStatsMap: KeyStatsMap,
  confidenceOf: (timeToType: number | null) => number | null,
): ReadonlyMap<string, KeyFacts> {
  return useMemo(() => {
    const map = new Map<string, KeyFacts>();
    for (const letter of keyStatsMap.letters) {
      const stats = keyStatsMap.get(letter);
      let hits = 0;
      let misses = 0;
      for (const { hitCount, missCount } of stats.samples) {
        hits += hitCount;
        misses += missCount;
      }
      const label = String.fromCodePoint(letter.codePoint).toLowerCase();
      map.set(label, {
        label,
        hits,
        misses,
        speed: stats.timeToType != null ? timeToSpeed(stats.timeToType) : null,
        confidence: confidenceOf(stats.timeToType),
      });
    }
    return map;
  }, [keyStatsMap, confidenceOf]);
}

/**
 * Your keys, three views in one segmented home: the heatmap keyboard, the
 * per-key speed bars, and the frequency breakdown (hits, misses, ratio).
 */
export function KeysViews({
  keyStatsMap,
  confidenceOf,
}: {
  readonly keyStatsMap: KeyStatsMap;
  readonly confidenceOf: (timeToType: number | null) => number | null;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [view, setView] = useState(0);
  const facts = useKeyFacts(keyStatsMap, confidenceOf);
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
      {view === 0 && <HeatKeyboard facts={facts} />}
      {view === 1 && <SpeedBars facts={facts} />}
      {view === 2 && <FreqBars facts={facts} />}
    </>
  );
}

function HeatKeyboard({
  facts,
}: {
  readonly facts: ReadonlyMap<string, KeyFacts>;
}): ReactNode {
  const maxHits = Math.max(1, ...[...facts.values()].map(({ hits }) => hits));
  const maxMisses = Math.max(
    1,
    ...[...facts.values()].map(({ misses }) => misses),
  );
  return (
    <>
      <div className={styles.kbwrap}>
        <div className={styles.kb}>
          {ROWS.map((row) => (
            <div key={row} className={styles.krow}>
              {row.split("").map((ch) => {
                const f = facts.get(ch);
                const hitSize =
                  f != null && f.hits > 0 ? 8 + (f.hits / maxHits) * 22 : 0;
                const missSize =
                  f != null && f.misses > 0
                    ? 6 + (f.misses / maxMisses) * 16
                    : 0;
                return (
                  <div
                    key={ch}
                    className={styles.keyc}
                    title={
                      f != null
                        ? `${ch.toUpperCase()} — ${f.hits} hits · ${f.misses} misses`
                        : ch.toUpperCase()
                    }
                  >
                    {hitSize > 0 && (
                      <span
                        className={styles.hitdot}
                        style={{
                          inlineSize: `${hitSize}px`,
                          blockSize: `${hitSize}px`,
                        }}
                      />
                    )}
                    {missSize > 0 && (
                      <span
                        className={styles.missdot}
                        style={{
                          inlineSize: `${missSize}px`,
                          blockSize: `${missSize}px`,
                        }}
                      />
                    )}
                    <span className={styles.keycLabel}>{ch.toUpperCase()}</span>
                  </div>
                );
              })}
            </div>
          ))}
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
  facts,
}: {
  readonly facts: ReadonlyMap<string, KeyFacts>;
}): ReactNode {
  const { confidenceColor } = useKeyStyles();
  const { formatSpeed } = useFormatter();
  const list = "abcdefghijklmnopqrstuvwxyz".split("");
  const speeds = [...facts.values()]
    .map(({ speed }) => speed)
    .filter((s): s is number => s != null);
  const hi = Math.max(1, ...speeds) * 1.15;
  const W = 1000;
  const H = 170;
  return (
    <>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ blockSize: "10rem", marginBlockStart: "1rem" }}
      >
        {list.map((ch, i) => {
          const f = facts.get(ch);
          if (f == null || f.speed == null) {
            return null;
          }
          const h = (f.speed / hi) * (H - 40);
          const color = String(
            confidenceColor(Math.max(0, Math.min(1, f.confidence ?? 0))),
          );
          return (
            <g key={ch}>
              <rect
                x={i * 38.5 + 6}
                y={H - 16 - h}
                width="24"
                height={h}
                rx="3"
                fill={color}
              />
              <text
                x={i * 38.5 + 18}
                y={H - 22 - h}
                fill="var(--text-color-f1)"
                fontSize="10"
                textAnchor="middle"
                style={{ fontFamily: "inherit" }}
              >
                {formatSpeed(f.speed, { unit: false })}
              </text>
            </g>
          );
        })}
        {list.map((ch, i) => (
          <text
            key={`l${ch}`}
            x={i * 38.5 + 18}
            y={H - 2}
            fill="var(--text-color-f2)"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            style={{ fontFamily: "inherit" }}
          >
            {ch.toUpperCase()}
          </text>
        ))}
      </svg>
      <div className={styles.legendRow}>
        <FormattedMessage
          id="profile.keys.speedLegend"
          defaultMessage="average speed per key — coloured red (slow) to green (fast)"
        />
      </div>
    </>
  );
}

function FreqBars({
  facts,
}: {
  readonly facts: ReadonlyMap<string, KeyFacts>;
}): ReactNode {
  const { formatPercents } = useIntlNumbers();
  const list = "abcdefghijklmnopqrstuvwxyz".split("");
  const maxHits = Math.max(1, ...[...facts.values()].map(({ hits }) => hits));
  const maxMisses = Math.max(
    1,
    ...[...facts.values()].map(({ misses }) => misses),
  );
  const W = 1000;
  const H = 190;
  const AXIS = 120;
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
        {list.map((ch, i) => {
          const f = facts.get(ch);
          if (f == null || (f.hits === 0 && f.misses === 0)) {
            return null;
          }
          const hh = (f.hits / maxHits) * (AXIS - 24);
          const mh = (f.misses / maxMisses) * 40;
          const ratio = f.hits > 0 ? f.misses / f.hits : 0;
          return (
            <g key={ch}>
              <rect
                x={i * 38.5 + 6}
                y={AXIS - hh}
                width="24"
                height={Math.max(2, hh)}
                rx="3"
                fill="var(--accent)"
              />
              <rect
                x={i * 38.5 + 6}
                y={AXIS + 4}
                width="24"
                height={Math.max(2, mh)}
                rx="3"
                fill="var(--slow-key-color)"
              />
              <text
                x={i * 38.5 + 18}
                y={AXIS - hh - 6}
                fill="var(--text-color-f2)"
                fontSize="9"
                textAnchor="middle"
                style={{ fontFamily: "inherit" }}
              >
                {formatPercents(ratio, 0)}
              </text>
            </g>
          );
        })}
        {list.map((ch, i) => (
          <text
            key={`l${ch}`}
            x={i * 38.5 + 18}
            y={H - 4}
            fill="var(--text-color-f2)"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            style={{ fontFamily: "inherit" }}
          >
            {ch.toUpperCase()}
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
