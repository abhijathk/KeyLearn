import { usePageData } from "@keylearn/pages-shared";
import { uiProps } from "@keylearn/result";
import { useSettings } from "@keylearn/settings";
import { useTheme } from "@keylearn/themes";
import { type ReactNode, useEffect, useRef } from "react";
import * as styles from "./CursorFog.module.less";

/**
 * A slow curl of fog trailing the mouse pointer.
 *
 * Pure decoration, and treated as such: it is off by default, it stops itself
 * the moment anybody starts typing, and there are four separate conditions
 * that switch it off regardless of what the setting says. An effect that
 * cannot be got rid of is not a feature.
 *
 * ## When it does not run
 *
 * - **Signed out.** The control lives in account settings, so a visitor with
 *   no account would have no way to turn it off. Shipping motion somebody
 *   cannot stop is the version of this feature worth refusing to build.
 * - **`prefers-reduced-motion`.** This app has learners who ask their system
 *   for stilled motion, and drifting fog beside a line of text is exactly
 *   what they are asking about. The media query wins over the setting; it is
 *   not a default the setting overrides.
 * - **No fine pointer.** On a touch screen there is no cursor to trail. The
 *   effect would be invisible and still cost a frame loop and a battery.
 * - **While typing.** See below.
 *
 * ## How it works
 *
 * Fog is shed from a lagging chain of nodes, each chasing the one ahead
 * rather than the pointer, which is what keeps the trail flowing for a moment
 * after the mouse stops. Each puff is carried by a divergence-free velocity
 * field — the curl of a moving scalar potential, `v = (dψ/dy, -dψ/dx)`. A
 * field built that way cannot compress or pile up anywhere, so the fog folds
 * into vortices rather than sliding in straight lines, which is most of why
 * real smoke looks the way it does.
 */

/** How the puffs move, how many there are, and how long they last. */
const CFG = {
  nodes: 20,
  ease: 0.34,
  spread: 12,
  /** Most puffs a single frame may emit. */
  burst: 4,
  life: 3400,
  r0: 3,
  rVary: 6,
  grow: 0.08,
  growVary: 0.07,
} as const;

/**
 * A hard ceiling on live puffs.
 *
 * Travel-based emission already makes a stationary pointer cost nothing, but
 * somebody swinging the mouse across a wide monitor for a whole minute is
 * bounded only by the lifetime. This is the backstop, and dropping the oldest
 * is right: the oldest are the faintest, so the cap is invisible until it is
 * doing something useful.
 */
const MAX_PUFFS = 420;

/**
 * How many of them are sparks.
 *
 * Small on purpose. The accent is the app's meaning colour, and the value of
 * putting it in here at all is that it is *rare* — at twenty per cent it stops
 * being a mote catching the light and becomes fog that is the wrong colour.
 */
const SPARK_SHARE = 0.05;

type Puff = {
  x: number;
  y: number;
  born: number;
  r: number;
  grow: number;
  vx: number;
  vy: number;
  seedX: number;
  /** A few per cent are accent-coloured motes rather than fog. */
  spark: boolean;
  /** Phase of this spark's twinkle, so they do not pulse in unison. */
  phase: number;
};

/** Velocity as the curl of a moving scalar potential — divergence free. */
function curlField(
  x: number,
  y: number,
  t: number,
  scale: number,
  strength: number,
): { vx: number; vy: number } {
  const k1 = 0.011 * scale;
  const k2 = 0.014 * scale;
  const a = x * k1 + t * 0.00042;
  const b = y * k2 - t * 0.00031;
  return {
    vx: -k2 * Math.sin(a) * Math.sin(b) * strength,
    vy: -k1 * Math.cos(a) * Math.cos(b) * strength,
  };
}

/**
 * One soft blob, pre-rendered.
 *
 * The stops are not a linear ramp: a straight fade to transparent leaves a
 * visible rim where the falloff meets zero, and weighting the middle down
 * lets the edge disappear into nothing, which is what lets a stack of these
 * read as continuous.
 *
 * Pre-rendered because building a `createRadialGradient` per puff per frame
 * is around two orders of magnitude slower, and with a few hundred alive that
 * is the difference between this running and this stuttering.
 */
function makeSprite(rgb: string): HTMLCanvasElement {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const x = c.getContext("2d")!;
  const grad = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, `rgba(${rgb},0.42)`);
  grad.addColorStop(0.25, `rgba(${rgb},0.20)`);
  grad.addColorStop(0.55, `rgba(${rgb},0.06)`);
  grad.addColorStop(1.0, `rgba(${rgb},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, size, size);
  return c;
}

/**
 * A spark: the same idea as a fog puff, drawn much tighter.
 *
 * The falloff is squeezed toward the centre so it reads as a point of light
 * with a small halo rather than as a coloured puff. That distinction is the
 * whole feature — a handful of accent-tinted *fog* just looks like the fog is
 * the wrong colour in places, whereas a handful of accent *dots* reads as
 * something catching the light.
 */
function makeSpark(rgb: string): HTMLCanvasElement {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const x = c.getContext("2d")!;
  const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, `rgba(${rgb},1)`);
  grad.addColorStop(0.14, `rgba(${rgb},0.75)`);
  grad.addColorStop(0.4, `rgba(${rgb},0.14)`);
  grad.addColorStop(1.0, `rgba(${rgb},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, size, size);
  return c;
}

/** A CSS colour of any form, resolved to `[r, g, b]`. */
function parseColor(raw: string): [number, number, number] | null {
  if (raw === "") {
    return null;
  }
  // Painting it once and reading the pixel back is the only parse that handles
  // every form a theme might supply — hex, `rgb()`, `color-mix()`, a named
  // colour — without this file growing a colour library.
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    const ctx = probe.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = raw;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  } catch {
    return null;
  }
}

/**
 * What colour the fog is, and how it is composited.
 *
 * **Not the accent, deliberately.** The accent is this app's meaning colour —
 * it marks the text cursor, correct keys, the active state. Painting a
 * full-viewport decoration in it spends the one colour that is supposed to
 * mean "look here", and a learner can pick their own accent, so somebody with
 * a hot pink one would get a hot pink wash over every page. Real fog has no
 * colour of its own either; it scatters whatever light is around, which is
 * why neutral reads as atmosphere and a tint reads as an effect.
 *
 * **It has to follow the theme's lightness, or it is invisible.** Additive
 * blending on a dark ground makes pale fog glow, and on the day theme the
 * same code composites white onto near-white and produces nothing at all —
 * a setting that appears to do nothing for every learner who prefers a light
 * screen. So: light fog added on a dark ground, dark fog laid over a light
 * one.
 */
function fogStyle(): {
  rgb: string;
  blend: GlobalCompositeOperation;
  gain: number;
  sparkBlend: GlobalCompositeOperation;
} {
  const bg =
    parseColor(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim(),
    ) ?? parseColor(getComputedStyle(document.body).backgroundColor);
  // Rec. 601 luma is enough to answer "is this a dark screen or a light one".
  const luma =
    bg == null ? 0 : (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255;

  if (luma > 0.5) {
    // `multiply`, not `source-over` — and that is the whole reason the first
    // light-theme attempt was invisible rather than merely faint.
    //
    // On the dark theme `lighter` ADDS, so a dozen overlapping puffs build to
    // something you can see. `source-over` does not accumulate at all: twenty
    // puffs at 20% over the same pixel look exactly like one, so the trail
    // never gained density no matter how much of it there was. `multiply` is
    // the mirror operation — each puff darkens what is under it, overlaps
    // compound, and the fog thickens where it is thick.
    //
    // The colour is a mid slate rather than near-black, because multiply
    // deepens fast: a dark colour reaches muddy well before the trail reads
    // as fog. The gain makes up for a light page tolerating less contrast
    // than a dark one flatters.
    // Sparks are drawn normally here, not multiplied: multiplying a bright
    // accent against a pale page produces a muddy smudge, and the point of a
    // spark is that it is the one crisp thing in a soft trail.
    return {
      rgb: "72, 84, 108",
      blend: "multiply",
      gain: 1.5,
      sparkBlend: "source-over",
    };
  }
  return {
    rgb: "226, 232, 240",
    blend: "lighter",
    gain: 1,
    sparkBlend: "lighter",
  };
}

/**
 * The learner's own accent, for the sparks only.
 *
 * Safe to use here in a way it is not for the fog itself: a few dozen small
 * dots carry the theme without the accent becoming the colour of the whole
 * screen, and they stay a decoration rather than competing with the accent's
 * real job of marking where you are in the text.
 */
function accentRgb(): string {
  const c = parseColor(
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim(),
  );
  return c == null ? "143, 217, 182" : `${c[0]}, ${c[1]}, ${c[2]}`;
}

export function CursorFog(): ReactNode {
  const { user } = usePageData();
  const { settings } = useSettings();
  // The fog's colour and blending are chosen from how light the page is, and
  // that is read once when the loop starts. Without this the effect kept
  // whichever it had at mount and only corrected itself on a reload — so
  // switching Light/Dark left pale fog on a pale page, invisible.
  const { color, accent } = useTheme();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Signed out is decided here rather than inside the effect so the canvas is
  // not in the document at all for a visitor — nothing to inspect, nothing to
  // paint, no listener.
  const enabled = user != null && settings.get(uiProps.cursorEffect);
  const intensity = settings.get(uiProps.cursorEffectIntensity);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }

    const stillMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const schemeMq = window.matchMedia("(prefers-color-scheme: dark)");
    const fineMq = window.matchMedia("(hover: hover) and (pointer: fine)");

    const ctx = canvas.getContext("2d");
    if (ctx == null) {
      return;
    }
    /**
     * The palette, re-read lazily on the next frame rather than now.
     *
     * This component is a child of the theme provider, and React runs child
     * effects BEFORE parent effects — so re-running this effect on a theme
     * change reads the custom properties before the provider has applied the
     * new ones, and the fog keeps the old theme’s colours until something
     * else forces a rebuild. That is the "needs a refresh" bug exactly.
     *
     * Deferring the read to the first animation frame sidesteps the ordering
     * question entirely: by then the class is on the element and the computed
     * styles are the ones being painted. It also means a change of accent or
     * of colour scheme only has to null this out, rather than each one having
     * to be plumbed into a dependency array that will eventually miss one.
     */
    let palette: ReturnType<typeof fogStyle> | null = null;
    let sprite: HTMLCanvasElement | null = null;
    let spark: HTMLCanvasElement | null = null;

    // One slider moving four numbers together. Density, opacity and both
    // turbulence octaves are what read as "more"; moving any one of them
    // alone looks wrong — denser fog at unchanged opacity turns into a smear
    // rather than into more fog.
    const t = Math.max(0, Math.min(1, intensity / 100));
    const baseAlpha = 0.12 + t * 0.38;
    const tuned = {
      alpha: baseAlpha,
      every: 13 - t * 8,
      broad: 0.8 + t * 1.4,
      fine: 0.15 + t * 0.4,
    };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;

    const size = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      // Assigning width/height clears the canvas; the next frame repaints.
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    const nodes = Array.from({ length: CFG.nodes }, () => ({ x: 0, y: 0 }));
    const puffs: Puff[] = [];
    // Reused between frames; a fresh array per frame at sixty frames a second
    // is garbage the collector has to come back for.
    const sparks: Puff[] = [];
    const sparkFade: number[] = [];
    let seeded = false;
    let head: { x: number; y: number } | null = null;
    let lastHead: { x: number; y: number } | null = null;
    let travel = 0;
    let raf = 0;
    let typing = false;
    let seed = 7;
    const rand = () =>
      (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    /** Emission is allowed; existing fog always finishes dispersing. */
    const emitting = () => head != null && !typing && !stillMq.matches;

    const frame = () => {
      raf = 0;
      if (palette == null) {
        palette = fogStyle();
        sprite = makeSprite(palette.rgb);
        spark = makeSpark(accentRgb());
        tuned.alpha = baseAlpha * palette.gain;
      }
      const { blend, sparkBlend } = palette;
      const now = performance.now();
      ctx.clearRect(0, 0, W, H);

      if (head != null && !seeded) {
        for (const n of nodes) {
          n.x = head.x;
          n.y = head.y;
        }
        seeded = true;
      }
      if (head != null) {
        nodes[0].x += (head.x - nodes[0].x) * 0.42;
        nodes[0].y += (head.y - nodes[0].y) * 0.42;
      }
      let flowing = false;
      for (let i = 1; i < nodes.length; i++) {
        const dx = nodes[i - 1].x - nodes[i].x;
        const dy = nodes[i - 1].y - nodes[i].y;
        nodes[i].x += dx * CFG.ease;
        nodes[i].y += dy * CFG.ease;
        if (Math.abs(dx) + Math.abs(dy) > 0.4) {
          flowing = true;
        }
      }

      // Emission is charged per pixel travelled, not per frame. Per-frame
      // emission sheds sixty puffs a second into one spot while the pointer
      // rests on a menu, and they stack into a bright ball — fog that grows
      // while nobody moves.
      if (head != null) {
        if (lastHead != null) {
          travel += Math.hypot(head.x - lastHead.x, head.y - lastHead.y);
        }
        lastHead = { x: head.x, y: head.y };
      } else {
        lastHead = null;
      }
      travel = Math.min(travel, tuned.every * CFG.burst);

      if (seeded && emitting() && travel >= tuned.every) {
        const count = Math.floor(travel / tuned.every);
        travel -= count * tuned.every;
        for (let i = 0; i < count; i++) {
          const n = nodes[Math.floor(rand() * nodes.length)];
          const isSpark = rand() < SPARK_SHARE;
          puffs.push({
            x: n.x + (rand() - 0.5) * CFG.spread,
            y: n.y + (rand() - 0.5) * CFG.spread,
            born: now,
            // Sparks start small and barely grow. A mote that bloats to the
            // size of a puff is just coloured fog again, and the contrast
            // between the soft trail and the sharp points is the effect.
            r: isSpark ? 1.4 + rand() * 1.6 : CFG.r0 + rand() * CFG.rVary,
            grow: isSpark ? 0.006 : CFG.grow + rand() * CFG.growVary,
            vx: 0,
            vy: 0,
            // Offsets each puff into a different part of the field, so two
            // born in the same place do not travel as one.
            seedX: rand() * 600,
            spark: isSpark,
            phase: rand() * Math.PI * 2,
          });
        }
        if (puffs.length > MAX_PUFFS) {
          puffs.splice(0, puffs.length - MAX_PUFFS);
        }
      }

      // Two passes rather than one, so the composite mode is set twice per
      // frame instead of switching on every few particles. Sparks composite
      // differently from fog — additively on a dark page, normally on a light
      // one — and a canvas state change per draw is the expensive way to get
      // that. Physics happens in the first pass; the second only draws.
      sparks.length = 0;
      ctx.globalCompositeOperation = blend;
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        const age = (now - p.born) / CFG.life;
        if (age >= 1) {
          puffs.splice(i, 1);
          continue;
        }
        // Two octaves: a broad one carrying whole regions around, and a
        // finer, weaker one breaking up the edges. One octave alone reads as
        // a conveyor belt.
        const a = curlField(p.x + p.seedX, p.y, now, 0.7, tuned.broad);
        const b = curlField(p.x * 2.4, p.y * 2.4, now * 1.6, 2.1, tuned.fine);
        p.vx = p.vx * 0.9 + a.vx + b.vx;
        p.vy = p.vy * 0.9 + a.vy + b.vy;
        p.x += p.vx;
        p.y += p.vy;
        // Expands as it dies, because dispersing means the same material
        // occupying more space at lower density. A puff that fades at a fixed
        // radius reads as a light being turned down, not as smoke going away.
        p.r += p.grow;
        // Rises quickly, falls away slowly — fog appears faster than it
        // clears, and a symmetric curve reads as a pulse.
        const fade = age < 0.09 ? age / 0.09 : (1 - (age - 0.09) / 0.91) ** 2;
        if (p.spark) {
          // Held back for the second pass, with its fade already computed.
          sparks.push(p);
          sparkFade.push(fade);
          continue;
        }
        ctx.globalAlpha = fade * tuned.alpha;
        ctx.drawImage(sprite!, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }

      ctx.globalCompositeOperation = sparkBlend;
      for (let i = 0; i < sparks.length; i++) {
        const p = sparks[i];
        // A slow twinkle, out of phase per spark. Without it a mote is a dot
        // that fades, and the thing that makes something look like it is
        // catching the light is that the light keeps changing.
        const twinkle = 0.6 + 0.4 * Math.sin(now * 0.004 + p.phase);
        ctx.globalAlpha = Math.min(1, sparkFade[i] * twinkle * 0.85);
        const r = p.r * 2.6;
        ctx.drawImage(spark!, p.x - r, p.y - r, r * 2, r * 2);
      }
      sparkFade.length = 0;

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // Nothing to draw and nothing to move: return without scheduling, so
      // the cleared canvas is what remains and the loop costs nothing until
      // the pointer moves again. Drawing on the last active frame and then
      // stopping would freeze those pixels on screen for good.
      const busy = puffs.length > 0 || (flowing && seeded);
      if (!busy && !emitting()) {
        seeded = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (raf === 0) {
        raf = requestAnimationFrame(frame);
      }
    };

    /**
     * Throw the palette away; the next frame reads the new one.
     *
     * Declared after `wake` rather than beside the palette it clears, because
     * it calls it — a `const` referenced before its initialiser is a temporal
     * dead zone waiting for the one caller that fires early.
     */
    const repalette = () => {
      palette = null;
      wake();
    };

    const onMove = (event: PointerEvent) => {
      if (!fineMq.matches) {
        return;
      }
      head = { x: event.clientX, y: event.clientY };
      wake();
    };
    // The pointer leaving the window, not an element — `head` going null is
    // what stops emission and lets the trail disperse where it was left.
    const onOut = (event: PointerEvent) => {
      if (event.relatedTarget == null) {
        head = null;
        wake();
      }
    };
    /**
     * Keys are landing: stop shedding.
     *
     * Existing fog is deliberately left to disperse on its own rather than
     * cleared. The point is to get out of the way of somebody concentrating,
     * and a trail vanishing the instant they touch a key is a flicker at the
     * edge of vision — which is more distracting than the thing it removed.
     * Practice already fires this on the first keystroke and again after five
     * quiet seconds; the site notice steps aside on the same signal.
     */
    const onTyping = (ev: Event) => {
      typing = Boolean((ev as CustomEvent<boolean>).detail);
      if (typing) {
        travel = 0;
      } else {
        wake();
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("keylearn:typing", onTyping);
    window.addEventListener("resize", size);
    // Turning reduced motion on mid-session must take effect at once, not at
    // the next reload — somebody switching it on is asking for the movement to
    // stop now.
    stillMq.addEventListener("change", wake);
    // Changing the OS between light and dark while "Auto" is selected moves
    // the real theme without `color` changing, so that has to be watched too.
    schemeMq.addEventListener("change", repalette);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
      window.removeEventListener("keylearn:typing", onTyping);
      window.removeEventListener("resize", size);
      stillMq.removeEventListener("change", wake);
      schemeMq.removeEventListener("change", repalette);
      cancelAnimationFrame(raf);
    };

    // Everything in this list rebuilds the loop with fresh numbers, which
    // costs one sprite and one array — cheap enough to prefer over threading
    // live values through the frame.
    // `color` and `accent` are here so a theme change re-runs this and clears
    // the palette; the frame then reads the new custom properties after the
    // provider has written them. `intensity` rebuilds the tuned numbers.
  }, [enabled, intensity, color, accent]);

  if (!enabled) {
    return null;
  }
  return <canvas ref={canvasRef} className={styles.fog} aria-hidden="true" />;
}
