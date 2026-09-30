import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import * as styles from "./scoreboard.module.less";
import { useFlash } from "./use-flash.ts";

/**
 * THE SCOREBOARD for Hero Trail and Dino Run.
 *
 * One plaque, a ribbon across the top and a row each for Score, Combo, the
 * growth stage and Best, where there used to be five white pills. Time
 * Keepers does not use it; it has its own printed notice. Only the skin
 * differs between the two worlds (`data-world`): the markup, the spacing and
 * the size are the same, so a child who moves between them finds the figures
 * in the same place. See scoreboard.module.less for how it is built.
 *
 * It reads exactly the figures the pills read and owns no game state. Its one
 * piece of behaviour of its own is the fade while a child types, below.
 */

/**
 * How long after the last key the board stays faded.
 *
 * The CSS carries only the fade itself; this is the "has stopped" half. Long
 * enough to span the gap between two words, short enough that a child who has
 * paused to think can read their score again.
 */
export const TYPING_HOLD_MS = 1200;

/**
 * Fades the board while keys are going down, and brings it back after.
 *
 * ON THE ELEMENT, NOT IN STATE, for the reason `useFlash` gives: a key is
 * pressed many times a second and each one would be a render of the whole
 * game just to flip an attribute. `bump` is called from the page's own
 * keystroke handler — the one that already stamps `lastKeyAtRef` — so there
 * is no second listener to disagree with it about what counts as a key.
 *
 * The JSX always renders `data-state="idle"`; because that never changes,
 * React never writes over what this sets.
 */
export function useTypingFade() {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bump = useCallback(() => {
    const node = ref.current;
    if (node == null) {
      return;
    }
    node.dataset.state = "typing";
    if (timer.current != null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      if (ref.current != null) {
        ref.current.dataset.state = "idle";
      }
    }, TYPING_HOLD_MS);
  }, []);
  useEffect(
    () => () => {
      if (timer.current != null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );
  return { ref, bump };
}

/** The clock, when the grown-up has the session timer switched on. */
export type ScoreboardTimer = {
  secs: number;
  total: number;
  /** Nothing typed for a while, so the clock is held. */
  waiting: boolean;
  /** The last minute. */
  low: boolean;
};

export type ScoreboardProps = {
  world: "hero" | "dino";
  /** Keys on the trail, shown in the ribbon. */
  keys: number;
  score: number;
  combo: number;
  best: number;
  /** "Hero level" / "Dino stage". */
  stageLabel: string;
  stage: string;
  timer: ScoreboardTimer | null;
  /** From `useTypingFade`. */
  boardRef: RefObject<HTMLDivElement | null>;
};

export function Scoreboard({
  world,
  keys,
  score,
  combo,
  best,
  stageLabel,
  stage,
  timer,
  boardRef,
}: ScoreboardProps) {
  // Which row just moved. See `useFlash`; the pop itself is in the stylesheet
  // and is taken out under prefers-reduced-motion.
  const flashScore = useFlash<HTMLLIElement>(score, styles.flash);
  const flashCombo = useFlash<HTMLLIElement>(combo, styles.flash);
  const flashStage = useFlash<HTMLLIElement>(stage, styles.flash);
  const flashBest = useFlash<HTMLLIElement>(best, styles.flash);
  const icons = ICONS[world];
  return (
    // A group with a name, deliberately NOT a live region: a score announced
    // per keystroke was rejected for the scene description and is no better
    // here. The figures are read on demand, label then value.
    <div
      ref={boardRef}
      className={styles.board}
      data-world={world}
      data-state="idle"
      role="group"
      aria-label="Score board"
    >
      <span className={styles.plate} aria-hidden="true" />
      <div className={styles.head}>
        <span className={styles.ribbon} aria-hidden="true" />
        {world === "dino" && <LeafMark />}
        <span className={styles.rtxt}>
          <b>{keys}</b> keys<span className={styles.long}> on your trail</span>
        </span>
      </div>
      <ul className={styles.rows}>
        {timer != null && (
          <Row
            icon={<TimerRing secs={timer.secs} total={timer.total} />}
            label={timer.waiting ? "Waiting…" : "Timer"}
            valueClass={
              timer.low ? styles.low : timer.waiting ? styles.held : undefined
            }
          >
            {Math.floor(timer.secs / 60)}:
            {String(timer.secs % 60).padStart(2, "0")}
          </Row>
        )}
        <Row rowRef={flashScore} icon={icons.star} label="Score">
          {score}
        </Row>
        <Row rowRef={flashCombo} icon={icons.flame} label="Combo">
          ×{combo}
        </Row>
        <Row
          rowRef={flashStage}
          icon={icons.level}
          label={stageLabel}
          valueClass={styles.name}
        >
          {stage}
        </Row>
        <Row rowRef={flashBest} icon={icons.trophy} label="Best">
          {best}
        </Row>
      </ul>
    </div>
  );
}

function Row({
  icon,
  label,
  valueClass,
  rowRef,
  children,
}: {
  icon: ReactNode;
  label: string;
  valueClass?: string;
  rowRef?: RefObject<HTMLLIElement | null>;
  children: ReactNode;
}) {
  return (
    <li ref={rowRef} className={styles.row}>
      <span className={styles.ic} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.txt}>
        {/* Hidden by the stylesheet on a phone, never removed: the label is
            what tells a screen reader which number is which. */}
        <span className={styles.lab}>{label}</span>
        <span
          className={valueClass ? `${styles.val} ${valueClass}` : styles.val}
        >
          {children}
        </span>
      </span>
    </li>
  );
}

/**
 * The session clock as a ring that empties. `pathLength` of 100 lets the
 * dash be a plain percentage, the same number the old pill fed its conic
 * gradient.
 */
function TimerRing({ secs, total }: { secs: number; total: number }) {
  const pct = Math.round((secs / Math.max(1, total)) * 100);
  return (
    <svg className={styles.ring} viewBox="0 0 24 24" aria-hidden="true">
      <circle className={styles.ringTrack} cx="12" cy="12" r="8" />
      <circle
        className={styles.ringArc}
        cx="12"
        cy="12"
        r="8"
        pathLength="100"
        style={{ ["--tp" as never]: pct }}
      />
    </svg>
  );
}

/** The leaf on the moss ribbon, echoing the "Run" lettering on the logo. */
function LeafMark() {
  return (
    <svg className={styles.leaf} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 20C4 9 10 4 20 4c0 10-5 16-16 16z"
        fill="#b6e072"
        stroke="#1f4a08"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M4 20L16 8"
        stroke="#1f4a08"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── the icons ────────────────────────────────────────────────────────────
//
// Hand-drawn in the sticker style the logos use: a flat fill, a dark outline
// and one light highlight stroke, on a 24-unit grid. Not the app's
// single-colour glyphs — those vanish against a blue badge or a grey pebble.
// Star, flame and trophy share their outlines between the worlds and only
// change ink; the growth-stage icon is the one each world draws for itself
// (a helm for the hero, a spotted egg for the dino).

const ROUND = { strokeLinejoin: "round", strokeLinecap: "round" } as const;

type Ink = {
  fill: string;
  line: string;
  flameFill: string;
  flameLine: string;
  base: string;
  shine: string;
};

const HERO_INK: Ink = {
  fill: "#ffc83a",
  line: "#5c3405",
  flameFill: "#ff7a2b",
  flameLine: "#5c1604",
  base: "#e2a422",
  shine: "#fff6bd",
};
const DINO_INK: Ink = {
  fill: "#ffb52e",
  line: "#3d2205",
  flameFill: "#ff6a2a",
  flameLine: "#3d1204",
  base: "#d68a1c",
  shine: "#fff0b0",
};

function iconSet(ink: Ink, level: ReactNode) {
  return {
    star: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2.6l2.75 5.7 6.15.85-4.55 4.25 1.15 6.1L12 16.5l-5.5 3 1.15-6.1L3.1 9.15l6.15-.85z"
          fill={ink.fill}
          stroke={ink.line}
          strokeWidth="1.3"
          {...ROUND}
        />
        <path
          d="M12 6.2l1.2 2.7"
          stroke={ink.shine}
          strokeWidth="1.3"
          fill="none"
          {...ROUND}
        />
      </svg>
    ),
    flame: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12.2 2.4c1 3.2-1.2 5-2.7 6.8C8 10.9 7.1 12.5 7.1 14.5a5 5 0 0 0 9.9.2c0-1.6-.5-2.9-1.2-4-.9 1.1-2 1.4-2.9.9.9-2.5.1-5.8-.7-9.2z"
          fill={ink.flameFill}
          stroke={ink.flameLine}
          strokeWidth="1.3"
          {...ROUND}
        />
        <path
          d="M12 19.3a2.7 2.7 0 0 1-2.7-2.8c0-1.3.9-2.2 1.8-3.1.5 1 1.3 1.3 2 1 .5.7 1.6 1.4 1.6 2.4a2.7 2.7 0 0 1-2.7 2.5z"
          fill="#ffd93d"
        />
      </svg>
    ),
    level,
    trophy: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 3.8h10v5.6a5 5 0 0 1-10 0z"
          fill={ink.fill}
          stroke={ink.line}
          strokeWidth="1.3"
          {...ROUND}
        />
        <path
          d="M7 5.4H4.5c-.3 2.3 1 4 3 4.3M17 5.4h2.5c.3 2.3-1 4-3 4.3"
          fill="none"
          stroke={ink.line}
          strokeWidth="1.3"
          {...ROUND}
        />
        <path
          d="M12 14.4v3M8.5 20.6h7l-.7-3.2H9.2z"
          fill={ink.base}
          stroke={ink.line}
          strokeWidth="1.3"
          {...ROUND}
        />
        <path
          d="M9.3 6v3.2"
          stroke={ink.shine}
          strokeWidth="1.3"
          fill="none"
          {...ROUND}
        />
      </svg>
    ),
  };
}

/** A knight's helm with a red plume. A sword was too fine at 16px. */
const HELM = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12.5 3.2c2.4-1.3 5.1-.7 6.6 1.2-2-.2-3.6.3-5.2 1.3z"
      fill="#e5483a"
      stroke="#5a0f0b"
      strokeWidth="1.1"
      {...ROUND}
    />
    <path
      d="M12 6c-4 0-6.6 2.8-6.6 6.5V18.5h13.2V12.5C18.6 8.8 16 6 12 6z"
      fill="#d9e2f0"
      stroke="#15234a"
      strokeWidth="1.3"
      {...ROUND}
    />
    <path
      d="M8 12.2h8v3.4a1.1 1.1 0 0 1-1.1 1.1H9.1A1.1 1.1 0 0 1 8 15.6z"
      fill="#15234a"
    />
    <path d="M12 12.2v4.5" stroke="#d9e2f0" strokeWidth="1.2" />
    <path
      d="M8.2 8.6c.9-.9 2-1.4 3-1.5"
      stroke="#ffffff"
      strokeWidth="1.2"
      fill="none"
      {...ROUND}
    />
  </svg>
);

/** A spotted egg with a crack across it. */
const EGG = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2.8c4 0 6.6 5.8 6.6 10a6.6 6.6 0 0 1-13.2 0c0-4.2 2.6-10 6.6-10z"
      fill="#f7efd2"
      stroke="#3a2a0e"
      strokeWidth="1.3"
      {...ROUND}
    />
    <path
      d="M5.6 12.6l2.4 1.7 2-2 2.2 2 2.2-2 2.2 1.9 2.2-1.6"
      fill="none"
      stroke="#3a2a0e"
      strokeWidth="1.2"
      {...ROUND}
    />
    <circle cx="9.3" cy="7.8" r="1.1" fill="#7dbb3a" />
    <circle cx="14.3" cy="8.6" r=".9" fill="#7dbb3a" />
    <circle cx="11.5" cy="17" r="1" fill="#7dbb3a" />
    <circle cx="15.5" cy="17.4" r=".75" fill="#7dbb3a" />
  </svg>
);

const ICONS = {
  hero: iconSet(HERO_INK, HELM),
  dino: iconSet(DINO_INK, EGG),
};
