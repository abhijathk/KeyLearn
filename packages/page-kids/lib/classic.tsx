import { type LessonKeys } from "@keylearn/lesson";
import { Slide, Tour } from "@keylearn/widget";
import { clsx } from "clsx";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import * as styles from "./classic.module.less";

/**
 * Classic: the grown-up practice screen, in the kids world's own hand.
 *
 * The oldest band gets a game made for somebody smaller. Rather than build a
 * second engine for them, this is the same lesson, the same unlock rules and
 * the same saved progress as the dino trail — only re-dressed with the adult
 * page's anatomy: a telemetry island, the text, the board, and the letter
 * journey. A child can move between the two faces and lose nothing.
 *
 * The board itself is passed in rather than rebuilt, so it is literally the
 * same keyboard the trail draws; this only recolours its finger zones to
 * quieter pastels so the one glowing key stays the loudest thing on screen.
 */
export function ClassicScreen({
  lessonKeys,
  included,
  passage,
  pos,
  bigLetters,
  say,
  wpm,
  wpmDelta,
  speeds,
  accuracy,
  score,
  best,
  streakDays,
  minutesDone,
  minutesGoal,
  target,
  keyboard,
  textScale,
  boardShown,
  missed,
  armed,
  typing,
  resetNotice,
  helpLevel,
  onArm,
  onRestart,
  onSkip,
  onToggleBoard,
  onTextScale,
}: {
  readonly lessonKeys: LessonKeys;
  readonly included: number;
  readonly passage: string;
  readonly pos: number;
  readonly bigLetters: boolean;
  readonly say: string;
  /** Live words per minute this passage, 0 before there is enough to say. */
  readonly wpm: number;
  /** Change against the last finished passage, or null when there isn't one. */
  readonly wpmDelta: number | null;
  /** Recent finished-passage speeds, oldest first, for the spark. */
  readonly speeds: readonly number[];
  readonly accuracy: number | null;
  readonly score: number;
  readonly best: number;
  readonly streakDays: number;
  readonly minutesDone: number;
  readonly minutesGoal: number;
  /** The speed that unlocks the next key, in words per minute. */
  readonly target: number;
  readonly keyboard: ReactNode;
  /** Practice-text scale, 0.75–1.5, driven by the rail's Aa slider. */
  readonly textScale: number;
  readonly boardShown: boolean;
  /** True for a moment after a wrong key, to colour the caret. */
  readonly missed: boolean;
  /** False until Enter starts the lesson; shows the gate over the text. */
  readonly armed: boolean;
  /** True while keys are landing, so the chrome can step back. */
  readonly typing: boolean;
  /** Said out loud after a long pause put the line back to the start. */
  readonly resetNotice: boolean;
  /**
   * How stuck the learner is on this key: 0 none, 1 a nudge, 2 the key
   * insists, 3 the resting hands come back to show the finger.
   */
  readonly helpLevel: number;
  readonly onArm: () => void;
  readonly onRestart: () => void;
  readonly onSkip: () => void;
  readonly onToggleBoard: () => void;
  readonly onTextScale: (scale: number) => void;
}): ReactNode {
  const [toolsOpen, setToolsOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const keys = [...lessonKeys];
  const total = keys.length;
  const focused = keys.find((key) => key.isFocused);
  const frac = target > 0 ? Math.min(1, Math.max(0, wpm / target)) : 0;
  const pct = Math.round(frac * 100);
  return (
    <div className={clsx(styles.classic, typing && styles.typing)}>
      <div className={styles.island} data-tour="island">
        <div className={styles.hero}>
          <Spark speeds={speeds} />
          <div className={styles.speed}>
            <span className={styles.speedVal}>{wpm > 0 ? wpm : "—"}</span>
            <span className={styles.speedUnit}>wpm</span>
            {wpmDelta != null && wpmDelta !== 0 && (
              <span
                className={clsx(styles.delta, wpmDelta < 0 && styles.deltaDown)}
              >
                {wpmDelta > 0 ? "▲" : "▼"} {wpmDelta > 0 ? "+" : ""}
                {wpmDelta}
              </span>
            )}
          </div>
          <div className={styles.journey}>
            <div className={styles.journeyHead}>
              <span className={styles.journeyTarget}>
                <FlagIcon />
                {target} wpm
                {focused != null &&
                  ` · ${up(focused.letter.label)} joins your trail`}
              </span>
              <span className={styles.journeyPct}>{pct}% of the way</span>
            </div>
            <div className={styles.journeyTrack}>
              <div
                className={styles.journeyFill}
                style={{ inlineSize: `${pct}%` }}
              />
              <div
                className={styles.journeyDot}
                style={{ insetInlineStart: `${pct}%` }}
              />
            </div>
          </div>
        </div>
        <div className={styles.sub}>
          <Sub
            label="On target"
            value={accuracy != null ? `${accuracy}%` : "—"}
          />
          <Sub label="Stars" value={String(score)} />
          <Sub label="Best" value={String(best)} />
          <Sub
            label="Streak"
            value={streakDays}
            unit={streakDays === 1 ? " day" : " days"}
          />
          <Sub
            label="Session"
            value={minutesDone}
            unit={` / ${minutesGoal} min`}
          />
        </div>
        {/* Last in the band, so the tools sit at the far right and their
            panel can open back across the island rather than off the edge. */}
        <div className={styles.toolsAnchor}>
          <button
            type="button"
            className={clsx(styles.tuneBtn, toolsOpen && styles.tuneBtnOn)}
            data-tour="tools"
            title={toolsOpen ? "Close the tools" : "Open the tools"}
            aria-label={toolsOpen ? "Close the tools" : "Open the tools"}
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen((open) => !open)}
          >
            <svg
              className={styles.railIc}
              viewBox="0 0 24 24"
              aria-hidden={true}
            >
              <path d="M5 6h14M5 12h14M5 18h14" />
              <circle cx="9" cy="6" r="2.2" />
              <circle cx="15" cy="12" r="2.2" />
              <circle cx="8" cy="18" r="2.2" />
            </svg>
          </button>
          {toolsOpen && (
            <Tools
              boardShown={boardShown}
              textScale={textScale}
              onRestart={onRestart}
              onSkip={onSkip}
              onToggleBoard={onToggleBoard}
              onTextScale={onTextScale}
            />
          )}
        </div>
      </div>

      <div
        className={clsx(styles.textCard, !armed && styles.textCardGated)}
        data-tour="text"
        data-practice={true}
      >
        <Text
          passage={passage}
          pos={pos}
          bigLetters={bigLetters}
          textScale={textScale}
          missed={missed}
        />
        {/* Sits on the card's lower edge, floating clear of the layout so
            nothing shifts when the lesson starts — and out of the way of the
            numbers above. The key presses itself, so what to do is obvious
            without reading the sentence. */}
        {!armed && (
          <button type="button" className={styles.gate} onClick={onArm}>
            <span className={styles.gateKey}>
              <svg
                className={styles.railIc}
                viewBox="0 0 24 24"
                aria-hidden={true}
              >
                <path d="M20 6v5.5a2 2 0 0 1-2 2H5" />
                <path d="M8.5 10 5 13.5 8.5 17" />
              </svg>
            </span>
            Press Enter to start typing
          </button>
        )}
      </div>

      {resetNotice && (
        <div className={styles.notice} role="status">
          Let&rsquo;s start that line again — you took a break!
        </div>
      )}

      {/* The trail board, recoloured: quiet pastels so the next key leads,
          with the resting hands laid over it the way the grown-up page does. */}
      <div className={styles.board} data-practice={true} data-tour="board">
        {boardShown && (
          <div className={styles.boardInner} ref={boardRef}>
            {keyboard}
            {/* The hands show where to rest while the lesson waits, then get
                out of the way once it starts — they are a starting position,
                not something to watch while typing. They come back on their
                own for somebody properly stuck, which is the one moment
                looking down is the right answer. */}
            {(!armed || helpLevel >= 3) && <Hands boardRef={boardRef} />}
          </div>
        )}
        {/* The coach speaks from under the board, where a learner's eyes
            already are — and keeps its card when the board is put away. */}
        <div className={styles.coach}>{say}</div>
      </div>

      <div className={styles.trailCard}>
        <span className={styles.trailNote}>
          {included} of {total} keys on your trail
        </span>
        <span className={styles.trail}>
          {keys.map((key) => (
            <span
              key={key.letter.codePoint}
              className={clsx(
                styles.tkey,
                key.isIncluded && styles.tkeyOn,
                key.isFocused && styles.tkeyNow,
              )}
            >
              {up(key.letter.label)}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/**
 * The passage, with a caret that travels to the next letter rather than
 * blinking out of one and into the next.
 *
 * The highlight is one absolutely-positioned block behind the text, moved by
 * transform — so the browser animates it along the line, and a learner's eye
 * is led to the next key instead of having to re-find it.
 */
function Text({
  passage,
  pos,
  bigLetters,
  textScale,
  missed,
}: {
  readonly passage: string;
  readonly pos: number;
  readonly bigLetters: boolean;
  readonly textScale: number;
  readonly missed: boolean;
}): ReactNode {
  const boxRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current;
      const cur = box?.querySelector<HTMLElement>("[data-cur]");
      if (box == null || cur == null) {
        setCaret(null);
        return;
      }
      setCaret({
        x: cur.offsetLeft,
        y: cur.offsetTop,
        w: cur.offsetWidth,
        h: cur.offsetHeight,
      });
    };
    measure();
    // The page's own rounded face loads after the first paint, and every
    // letter changes width when it arrives — a caret measured before that
    // lands beside its letter rather than on it. So it is measured again
    // once the fonts are ready, and whenever the line re-wraps.
    let cancelled = false;
    document.fonts?.ready
      .then(() => {
        if (!cancelled) {
          measure();
        }
      })
      .catch(() => {});
    const box = boxRef.current;
    const observer = box != null ? new ResizeObserver(measure) : null;
    if (box != null && observer != null) {
      observer.observe(box);
    }
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [passage, pos, bigLetters, textScale]);
  return (
    <div
      ref={boxRef}
      className={clsx(styles.text, bigLetters && styles.textBig)}
      style={{ ["--tscale" as never]: textScale }}
    >
      {caret != null && (
        <span
          className={clsx(styles.caret, missed && styles.caretMiss)}
          aria-hidden={true}
          style={{
            transform: `translate(${caret.x}px, ${caret.y}px)`,
            inlineSize: `${caret.w}px`,
            blockSize: `${caret.h}px`,
          }}
        />
      )}
      {[...passage].map((ch, at) => (
        <span
          key={at}
          data-cur={at === pos ? "" : undefined}
          className={clsx(
            styles.ch,
            at < pos && styles.done,
            at === pos && styles.cur,
          )}
        >
          {ch === " " ? " " : bigLetters ? ch.toUpperCase() : ch}
        </span>
      ))}
    </div>
  );
}

function Sub({
  label,
  value,
  unit,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly unit?: string;
}): ReactNode {
  return (
    <span className={styles.subItem}>
      <span className={styles.subLabel}>{label}</span>
      <span className={styles.subVal}>
        {value}
        {unit != null && <small>{unit}</small>}
      </span>
    </span>
  );
}

/**
 * The last few finished passages as a line, the newest end picked out.
 *
 * Same shape as the grown-up island's spark: it is there to say "the trend",
 * not to be read off, so it carries no axes and no numbers.
 */
function Spark({ speeds }: { readonly speeds: readonly number[] }): ReactNode {
  if (speeds.length < 2) {
    return <span className={styles.sparkGap} />;
  }
  const w = 74;
  const h = 26;
  const pad = 3;
  const lo = Math.min(...speeds);
  const hi = Math.max(...speeds);
  const span = hi - lo || 1;
  const px = (i: number) =>
    pad + (i * (w - 2 * pad)) / Math.max(1, speeds.length - 1);
  const py = (v: number) => h - pad - ((v - lo) * (h - 2 * pad)) / span;
  const points = speeds.map((v, i) => `${px(i)} ${py(v)}`).join(" ");
  const last = speeds.length - 1;
  return (
    <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} aria-hidden={true}>
      <polyline points={points} />
      <circle
        className={styles.sparkDot}
        cx={px(last)}
        cy={py(speeds[last])}
        r={2.4}
      />
    </svg>
  );
}

/**
 * The tools: start this one again, move on, hide the board, resize the words.
 *
 * The same four the grown-up page keeps beside its text, folded behind one
 * button so the screen stays quiet until they are wanted — and laid out in a
 * row here rather than a rail, because they live inside the island's panel
 * where a column would stretch it out of shape.
 */
function Tools({
  boardShown,
  textScale,
  onRestart,
  onSkip,
  onToggleBoard,
  onTextScale,
}: {
  readonly boardShown: boolean;
  readonly textScale: number;
  readonly onRestart: () => void;
  readonly onSkip: () => void;
  readonly onToggleBoard: () => void;
  readonly onTextScale: (scale: number) => void;
}): ReactNode {
  return (
    <div className={styles.tools}>
      <button
        type="button"
        className={styles.toolBtn}
        title="Type this one again"
        onClick={onRestart}
      >
        <svg className={styles.railIc} viewBox="0 0 24 24" aria-hidden={true}>
          <path d="M20 11.5a8 8 0 1 1-2.3-5.4" />
          <path d="M20 4v4h-4" />
        </svg>
        Again
      </button>
      <button
        type="button"
        className={styles.toolBtn}
        title="Skip to the next words"
        onClick={onSkip}
      >
        <svg className={styles.railIc} viewBox="0 0 24 24" aria-hidden={true}>
          <path d="M7 6l6 6-6 6" />
          <path d="M16 6v12" />
        </svg>
        Skip
      </button>
      <button
        type="button"
        className={styles.toolBtn}
        title={boardShown ? "Hide the keyboard" : "Show the keyboard"}
        aria-pressed={!boardShown}
        onClick={onToggleBoard}
      >
        <svg className={styles.railIc} viewBox="0 0 24 24" aria-hidden={true}>
          <rect x="3" y="6" width="18" height="12" rx="2.5" />
          {boardShown ? (
            <path d="M7 10h0M11 10h0M15 10h0M7 13.5h10" />
          ) : (
            <>
              <path d="M7 10h0M15 10h0M7 13.5h6" />
              <path d="M4 4l16 16" />
            </>
          )}
        </svg>
        {boardShown ? "Hide board" : "Show board"}
      </button>
      <label className={styles.sizer} title="How big the words are">
        <span className={styles.sizerIcon}>Aa</span>
        <input
          type="range"
          min={0.8}
          max={2}
          step={0.05}
          value={textScale}
          aria-label="How big the words are"
          onChange={(ev) => onTextScale(Number(ev.target.value))}
        />
      </label>
    </div>
  );
}

/**
 * The resting hands, anchored to the board rather than laid over it by eye.
 *
 * The artwork is one drawing of both hands, so it is cropped in half and each
 * hand placed on its own — a single image scaled to fit cannot put ten
 * fingers on ten keys, because the gap the artist drew between the hands is
 * not the gap between F and J on this board.
 *
 * Each hand is then anchored the way the grown-up page anchors its own:
 * horizontally by the index fingertip over its home key, vertically by the
 * thumb over the space bar, and scaled so the little-to-index reach spans
 * exactly three key pitches. Nothing is eyeballed; when the board resizes,
 * the hands are measured again.
 *
 * The image is white line-work on black, so it travels as a mask: the shape
 * survives as opacity while the colour comes from the theme, which is what
 * lets one drawing sit on the day ground and the night one.
 */

// Landmarks as fractions of each half of the 1536 x 1024 drawing.
const HANDS = {
  left: {
    // The left half of the artwork.
    crop: { x: 0, width: 768 },
    // Index fingertip, across the crop.
    tipX: 0.749,
    // Index fingertip and thumb tip, down the crop.
    tipY: 0.171,
    thumbY: 0.459,
    // Little fingertip to index fingertip — three key pitches apart.
    reach: 0.397,
    home: "f",
    watch: true,
  },
  right: {
    crop: { x: 768, width: 768 },
    tipX: 0.25,
    tipY: 0.171,
    thumbY: 0.459,
    reach: 0.397,
    home: "j",
    watch: false,
  },
} as const;

function Hands({
  boardRef,
}: {
  readonly boardRef: React.RefObject<HTMLDivElement | null>;
}): ReactNode {
  const [box, setBox] = useState<{
    pitch: number;
    fx: number;
    jx: number;
    homeY: number;
    spaceY: number;
  } | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    let tries = 0;
    let observer: ResizeObserver | null = null;
    // Returns false until the board is both mounted and laid out. This runs
    // inside a child of the element the ref belongs to, and React attaches a
    // parent's ref only after its children's layout effects have run — so on
    // the first pass `boardRef.current` is still null, and a measurement that
    // gave up there would never be taken at all.
    const measure = (): boolean => {
      const board = boardRef.current;
      if (board == null) {
        return false;
      }
      const find = (ch: string) =>
        board.querySelector<HTMLElement>(`[data-key="${ch}"]`);
      const f = find("f");
      const j = find("j");
      const g = find("g");
      const space = find(" ");
      if (f == null || j == null || g == null || space == null) {
        return false;
      }
      const root = board.getBoundingClientRect();
      const rect = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return {
          cx: r.left - root.left + r.width / 2,
          cy: r.top - root.top + r.height / 2,
        };
      };
      const fr = rect(f);
      const gr = rect(g);
      // One key pitch, measured from the board itself rather than assumed.
      const pitch = Math.abs(gr.cx - fr.cx);
      if (!(pitch > 1)) {
        return false;
      }
      setBox({
        pitch,
        fx: fr.cx,
        jx: rect(j).cx,
        homeY: fr.cy,
        spaceY: rect(space).cy,
      });
      return true;
    };
    // Keep looking for a few frames: the ref arrives after this effect, and
    // the keycap metrics settle once the page's web fonts land.
    const tick = () => {
      measure();
      const board = boardRef.current;
      if (observer == null && board != null) {
        observer = new ResizeObserver(() => measure());
        observer.observe(board);
      }
      if (++tries < 20) {
        frame = requestAnimationFrame(tick);
      }
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [boardRef]);
  if (box == null) {
    return null;
  }
  return (
    <>
      {(["left", "right"] as const).map((side) => (
        <Hand key={side} side={side} box={box} />
      ))}
    </>
  );
}

function Hand({
  side,
  box,
}: {
  readonly side: keyof typeof HANDS;
  readonly box: {
    pitch: number;
    fx: number;
    jx: number;
    homeY: number;
    spaceY: number;
  };
}): ReactNode {
  const hand = HANDS[side];
  // Three key pitches from little finger to index fixes the scale.
  const width = (3 * box.pitch) / hand.reach;
  const height = width * (1024 / hand.crop.width);
  const homeX = side === "left" ? box.fx : box.jx;
  const left = homeX - hand.tipX * width;
  // Vertically by the fingertips on the home row. The grown-up page anchors
  // by the thumb instead, because its artwork's reach happens to match its
  // board's row spacing; this drawing has longer fingers, and anchoring it
  // the same way lifted the fingertips a whole row above the keys they are
  // meant to be resting on. Fingers on the right keys is the thing this
  // picture is for, so that is what is pinned.
  const top = box.homeY - hand.tipY * height;
  const id = `kids-classic-hand-${side}`;
  // The whole drawing is loaded and the viewBox shows this hand's half of it.
  // Painted through the artwork as a mask, so the colour comes from the theme
  // and one drawing serves both the day ground and the night one.
  return (
    <svg
      className={styles.hand}
      style={{
        inlineSize: `${width}px`,
        blockSize: `${height}px`,
        transform: `translate(${left}px, ${top}px)`,
      }}
      viewBox={`${hand.crop.x} 0 ${hand.crop.width} 1024`}
      aria-hidden={true}
    >
      <defs>
        <mask
          id={id}
          maskUnits="userSpaceOnUse"
          x={hand.crop.x}
          y={0}
          width={hand.crop.width}
          height={1024}
        >
          <image
            href="/kids-assets/classic-hands.png"
            x={0}
            y={0}
            width={1536}
            height={1024}
            preserveAspectRatio="none"
          />
        </mask>
      </defs>
      <rect
        className={styles.handInk}
        x={hand.crop.x}
        y={0}
        width={hand.crop.width}
        height={1024}
        mask={`url(#${id})`}
      />
      {hand.watch && <Watch />}
    </svg>
  );
}

/**
 * The time, on the watch the artwork is already wearing.
 *
 * Placed in the drawing's own coordinates and carried round to the grown-up
 * page's reading angle, so it is read along the arm rather than square to the
 * world. Hours and minutes only — the seconds are the one thing a watch face
 * has that somebody practising does not need to watch.
 */
// A seven-segment digit, drawn rather than set in a typeface.
//
// The watch wants the squared-off look of a real LCD, and no font on a
// learner's machine can be relied on for it — so the segments are shapes.
// Seven bars in a 60 x 104 cell, and the classic slight forward lean.
const SEGMENTS: Readonly<Record<string, string>> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

/** x, y, width, height of each bar in the cell. */
const BARS: Readonly<
  Record<string, readonly [number, number, number, number]>
> = {
  a: [13, 1, 36, 14],
  b: [47, 12, 14, 34],
  c: [47, 58, 14, 34],
  d: [13, 89, 36, 14],
  e: [1, 58, 14, 34],
  f: [1, 12, 14, 34],
  g: [13, 45, 36, 14],
};

/**
 * One bar's weight, for anything that wants to match the digits.
 *
 * Deliberately heavy for the size: the case this sits in is only about two
 * keycaps wide on screen, and thinner segments grey out at that scale rather
 * than reading as digits.
 */
const BAR = 14;

/** Cell size, so callers can lay digits out without guessing. */
const CELL_W = 60;
const CELL_H = 104;

function Digit({
  value,
  x,
  y,
  scale,
}: {
  readonly value: string;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}): ReactNode {
  const lit = SEGMENTS[value] ?? "";
  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) skewX(-6)`}>
      {Object.entries(BARS).map(([id, [bx, by, bw, bh]]) => (
        <rect
          key={id}
          className={styles.seg}
          x={bx}
          y={by}
          width={bw}
          height={bh}
          rx={2}
          // Unlit segments stay faintly visible, the way a real LCD shows the
          // whole grid behind the digit.
          opacity={lit.includes(id) ? 1 : 0.07}
        />
      ))}
    </g>
  );
}

/**
 * The time, on the watch the artwork is already wearing.
 *
 * Hours over minutes rather than side by side, because the case is a small
 * square and two rows fill it the way a real digital watch does. The bar
 * between them is the seconds.
 */
function Watch(): ReactNode {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const hours = String(now.getHours() % 12 || 12).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  // The face, measured off the artwork in its own 1536 x 1024 coordinates.
  const cx = 0.1255 * 1536;
  const cy = 0.6835 * 1024;
  const scale = 0.38;
  const w = CELL_W * scale;
  const h = CELL_H * scale;
  const gap = 2;
  // Two digits, centred on the face.
  const row = (text: string, top: number) =>
    [...text].map((ch, i) => (
      <Digit
        key={i}
        value={ch}
        x={cx - w - gap / 2 + i * (w + gap)}
        y={top}
        scale={scale}
      />
    ));
  return (
    <g transform={`rotate(-72 ${cx} ${cy})`}>
      {row(hours, cy - h - 2)}
      {/* The seconds: a bar of exactly the digits' own weight, blinking. */}
      <rect
        className={styles.watchTick}
        x={cx - (BAR * scale * 2.2) / 2}
        y={cy - (BAR * scale) / 2}
        width={BAR * scale * 2.2}
        height={BAR * scale}
        rx={2}
      />
      {row(minutes, cy + 2)}
    </g>
  );
}

// A little pennant for the unlock target — the kids stroke hand, no emoji.
function FlagIcon(): ReactNode {
  return (
    <svg className={styles.ic} viewBox="0 0 24 24" aria-hidden={true}>
      <path d="M6 21V4" />
      <path d="M6 5h9.5l-2.2 3 2.2 3H6" />
    </svg>
  );
}

/** Letters read as capitals on the board and the trail; spaces stay spaces. */
function up(label: string): string {
  return label.toUpperCase();
}

/**
 * The unlock moment, in Classic's own voice.
 *
 * A new key joining the trail is the proudest thing that happens in the loop,
 * and the trail games mark it well — but they mark it with "tap it three times
 * to wake it up" and a row of stars, which is pitched at a six-year-old. On a
 * screen deliberately shaped like the grown-up page, that is the one moment it
 * would stop feeling like the grown-up page.
 *
 * Same trigger and the same spoken line; a keycap the size the moment deserves,
 * the finger that reaches it, and one press instead of three.
 */
export function ClassicUnlock({
  letter,
  finger,
}: {
  readonly letter: string;
  readonly finger: string | null;
}): ReactNode {
  const up = letter.toUpperCase();
  return (
    <div className={styles.unlockScrim} role="alertdialog" aria-modal={true}>
      <div className={styles.unlockCard}>
        <div className={styles.unlockEyebrow}>New key</div>
        <div className={styles.unlockKey} aria-hidden={true}>
          {up}
        </div>
        <p className={styles.unlockLine}>
          {finger != null ? (
            <>
              <b>{up}</b> is yours now — your <b>{finger}</b> reaches it.
            </>
          ) : (
            <>
              <b>{up}</b> is yours now.
            </>
          )}
        </p>
        <div className={styles.unlockHint}>Press {up} to carry on</div>
      </div>
    </div>
  );
}

/**
 * The first look at Classic.
 *
 * A learner arriving from the trail games meets a keyboard, an island of
 * numbers, a progress track and a tools rail, with nothing to say what any of
 * it is. The grown-up page has a twelve-slide walkthrough explaining the
 * teaching algorithm; that is the right depth for somebody who chose a typing
 * tutor and the wrong one for an eleven-year-old who was moved to a new screen.
 *
 * Four slides, each pinned to the thing it names, in the fewest words that will
 * do. Shown once.
 */
export function ClassicTour({
  onClose,
}: {
  readonly onClose: () => void;
}): ReactNode {
  return (
    <Tour onClose={onClose}>
      <Slide size="small" anchor="[data-tour='text']" position="block-end">
        <h1>This is your line</h1>
        <p>
          Type what you see. The cursor slides along as you go, and a letter
          turns red if it was not the one.
        </p>
      </Slide>
      <Slide size="small" anchor="[data-tour='board']" position="block-start">
        <h1>The glowing key is next</h1>
        <p>
          Each colour is a finger. Keep your fingers resting on the home row and
          let the nearest one reach — that is what makes you fast later.
        </p>
      </Slide>
      <Slide size="small" anchor="[data-tour='island']" position="block-end">
        <h1>How it is going</h1>
        <p>
          Your speed, and the bar showing how close the next key is to joining
          your trail. Reach the flag and it is yours.
        </p>
      </Slide>
      <Slide size="small" anchor="[data-tour='tools']" position="block-end">
        <h1>Everything else lives here</h1>
        <p>
          Bigger text, sound, the timer, and the way back to the trail game.
          Nothing you change here can lose your progress.
        </p>
      </Slide>
    </Tour>
  );
}
