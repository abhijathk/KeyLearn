import { clsx } from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import * as styles from "./AdBar.module.less";
import { WhyThisAd } from "./WhyThisAd.tsx";

/**
 * The paid line above the header.
 *
 * The shape of this component is decided by four commitments made when the
 * slot was sold, and each of them shows up in the code rather than in a
 * policy document somewhere:
 *
 *  - **It says "Ad".** The label is rendered before anything the advertiser
 *    wrote and cannot be styled away, so no campaign can dress itself up as
 *    a message from us.
 *  - **Nothing of theirs runs here.** There is no script tag, no iframe and
 *    no third-party image: a logo is served from our own path, and the rest
 *    is text and colours we place ourselves.
 *  - **It never speaks over the page.** The bar is not a live region, so a
 *    rotation does not interrupt a screen reader mid-sentence, and it holds
 *    still while a pointer or the keyboard is on it.
 *  - **A click leaves by our own door.** Every destination goes through
 *    `/go/ad/{id}/{screen}`, which is what makes counting possible without
 *    the advertiser ever seeing the reader.
 */

export type AdScreenView = {
  readonly template: string;
  readonly headline: string;
  readonly support?: string;
  readonly button?: string;
  readonly code?: string;
  readonly href: string;
  readonly goal?: number;
  readonly raised?: number;
};

export type AdPaletteView = {
  readonly bar?: string;
  readonly text?: string;
  readonly button?: string;
  readonly buttonInk?: string;
  readonly barDark?: string;
  readonly accent?: string;
  readonly treatment?: "solid" | "flag" | "gradient" | "accent";
};

export type AdView = {
  readonly id: number;
  readonly advertiser: string;
  readonly screens: readonly AdScreenView[];
  readonly palette: AdPaletteView;
  readonly hasLogo: boolean;
  readonly dismissible: boolean;
};

/** How long the line is on screen before its dismiss control appears. */
const CLOSE_AFTER_MS = 5000;

/**
 * How one screen gives way to the next.
 *
 * Four of them, picked at random and never the same twice running, so a bar
 * that rotates all day does not develop a tic. Every one is a fade with at
 * most six pixels of travel: this sits directly above the practice text, and
 * anything that slides a real distance up there pulls the eye off the work.
 * The point is that the line changed, not that it performed.
 */
const TRANSITIONS = ["fade", "rise", "settle", "drift"] as const;
type Transition = (typeof TRANSITIONS)[number];

/** Long enough to read as deliberate, short enough not to be a wait. */
const SWAP_MS = 260;

/** A colour is only ever a hex literal; anything else falls back to ours. */
function colour(value: string | undefined, fallback: string): string {
  return value != null && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

function prefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Who the reader is told paid for the line.
 *
 * The name when there is one; otherwise the host the click lands on. An
 * advertiser may run on their logo alone, but "paid for by" is a promise
 * and it never gets to be blank.
 */
function payerOf(ad: AdView, href: string): string {
  if (ad.advertiser.trim() !== "") {
    return ad.advertiser;
  }
  return hostOf(href) ?? "an advertiser";
}

/** The host a click lands on, so the window can say where it goes. */
function hostOf(href: string): string | null {
  try {
    return new URL(href).host;
  } catch {
    return null;
  }
}

function background(palette: AdPaletteView, dark: boolean): string {
  const base = colour(
    dark ? (palette.barDark ?? palette.bar) : palette.bar,
    dark ? "#16202b" : "#0b2b3f",
  );
  const accent = colour(palette.accent, base);
  switch (palette.treatment) {
    case "gradient":
      return `linear-gradient(90deg, ${base}, ${accent})`;
    case "flag":
      return `linear-gradient(90deg, ${base} 0 60%, ${accent} 60% 100%)`;
    default:
      return base;
  }
}

export function AdBar({
  ads,
  dwellSeconds,
  onView,
  onDismiss,
}: {
  readonly ads: readonly AdView[];
  readonly dwellSeconds: number;
  readonly onView?: (id: number, screen: number) => void;
  readonly onDismiss?: () => void;
}): ReactNode {
  // One flat list of (campaign, screen) pairs. Rotation does not care
  // whether the next line belongs to the same advertiser, which is what
  // lets one advertiser buy three screens and three advertisers buy one
  // each without two different pieces of code.
  const slides = ads.flatMap((ad) =>
    ad.screens.map((screen, index) => ({ ad, screen, index })),
  );
  const [at, setAt] = useState(0);
  // "out" while the old screen leaves, "in" for the single frame the new one
  // is placed before it settles — that frame is what gives it something to
  // animate from.
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const [motion, setMotion] = useState<Transition>("fade");
  const [held, setHeld] = useState(false);
  const [dark, setDark] = useState(prefersDark);
  const [whyOpen, setWhyOpen] = useState(false);
  /**
   * The cross appears five seconds in (owner, 4 Sep 2026).
   *
   * A dismiss control under the pointer the instant the page paints gets
   * clicked reflexively, before the line has been read — which is a worse
   * deal for the advertiser than no cross at all, and no better for the
   * reader, who dismissed something they never saw. Five seconds is about
   * one read of a headline at the dwell the bar rotates on.
   *
   * Its space is held from the start, so nothing on the line moves when it
   * arrives, and `visibility` rather than `display` keeps it out of the tab
   * order until it is really there.
   */
  const [canClose, setCanClose] = useState(false);
  const reduced = useRef(prefersReducedMotion());
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const id = window.setTimeout(() => setCanClose(true), CLOSE_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    let media: MediaQueryList;
    try {
      media = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = () => setDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Rotation. A reader who has reduced motion switched on is shown the
  // first line and left alone: a bar that changes under them is motion
  // whether or not it animates on the way.
  useEffect(() => {
    if (slides.length <= 1 || held || reduced.current) {
      return;
    }
    const dwell = Math.max(4, dwellSeconds) * 1000;
    let swap = 0;
    const id = window.setTimeout(() => {
      setMotion((last) => {
        const others = TRANSITIONS.filter((t) => t !== last);
        return others[Math.floor(Math.random() * others.length)]!;
      });
      setPhase("out");
      swap = window.setTimeout(() => {
        setAt((n) => (n + 1) % slides.length);
        setPhase("in");
      }, SWAP_MS);
    }, dwell);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(swap);
    };
  }, [at, held, slides.length, dwellSeconds]);

  /**
   * Release the incoming screen from its entry position, one frame later.
   *
   * This owns the reset rather than the rotation effect, and that is the
   * whole point: changing `at` re-runs the rotation effect, so a cleanup
   * there cancelled the very frame that was going to make the new screen
   * visible again — which left the line sitting at opacity zero, blank
   * beside its own "Ad" tag until the next rotation. Keyed on the phase, it
   * cannot be cancelled by the thing that set it.
   *
   * The timeout behind it is a guarantee, not a fallback: whatever happens
   * to the frames, the line becomes visible again. An advertisement nobody
   * can see is worse than one that does not animate.
   */
  useEffect(() => {
    if (phase !== "in") {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setPhase("idle"));
    });
    const guarantee = window.setTimeout(() => setPhase("idle"), SWAP_MS * 2);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(guarantee);
    };
  }, [phase]);

  // A view is counted once per campaign screen per page, and the server
  // counts it once per reader per day on top of that.
  const current = slides[at % slides.length];
  useEffect(() => {
    if (current == null || onView == null) {
      return;
    }
    const key = `${current.ad.id}:${current.index}`;
    if (seen.current.has(key)) {
      return;
    }
    seen.current.add(key);
    onView(current.ad.id, current.index);
  }, [current, onView]);

  if (current == null) {
    return null;
  }
  const { ad, screen, index } = current;
  const ink = colour(ad.palette.text, dark ? "#e9f2f8" : "#eaf4fa");
  const button = colour(ad.palette.button, "#f4b53f");
  const buttonInk = colour(ad.palette.buttonInk, "#231a08");
  const href = `/go/ad/${ad.id}/${index}`;
  const progress =
    screen.template === "cause" && screen.goal != null && screen.goal > 0
      ? Math.min(100, Math.round(((screen.raised ?? 0) / screen.goal) * 100))
      : null;
  return (
    <div
      className={styles.bar}
      style={{ background: background(ad.palette, dark), color: ink }}
      // Held while a pointer or the keyboard is on the bar, so nothing
      // moves out from under somebody who is reading or about to click.
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span className={styles.tag}>Ad</span>
      {ad.hasLogo && (
        <img
          className={styles.logo}
          src={`/_/ads/logo/${ad.id}`}
          alt=""
          width={22}
          height={22}
        />
      )}
      <div
        className={clsx(
          styles.screenWrap,
          phase !== "idle" && styles[motion],
          phase === "out" && styles.out,
          phase === "in" && styles.in,
        )}
      >
        {/* One ladder, heaviest first: who is paying, then what they are
            saying, then the detail. The advertiser's name carries the weight
            because the reader's first question is whose line this is. */}
        <span className={styles.text}>
          {ad.advertiser.trim() !== "" && (
            <>
              <span className={styles.who}>{ad.advertiser}</span>{" "}
            </>
          )}
          <span className={styles.headline}>{screen.headline}</span>
          {screen.support != null && screen.support !== "" && (
            <span className={styles.support}> {screen.support}</span>
          )}
        </span>
        {progress != null && (
          <span className={styles.meter}>
            <i
              className={styles.meterFill}
              style={{ inlineSize: `${progress}%`, background: button }}
            />
          </span>
        )}
        {screen.code != null && screen.code !== "" && (
          <span className={styles.code}>{screen.code}</span>
        )}
        {screen.button != null && screen.button !== "" && (
          <a
            className={styles.cta}
            style={{ background: button, color: buttonInk }}
            href={href}
            rel="nofollow sponsored noopener"
          >
            {screen.button}
          </a>
        )}
      </div>
      {slides.length > 1 && (
        <span className={styles.dots} aria-hidden="true">
          {slides.map((_, n) => (
            <i key={n} className={clsx(styles.dot, n === at && styles.dotOn)} />
          ))}
        </span>
      )}
      {/* A window, not a page: somebody asking one question mid-lesson
          should not lose their place to get it answered. The page still
          exists for a shared link and for a reader without JavaScript. */}
      <button
        type="button"
        className={styles.why}
        onClick={() => setWhyOpen(true)}
      >
        Why this ad?
      </button>
      {whyOpen && (
        <WhyThisAd
          advertiser={payerOf(ad, screen.href)}
          destination={hostOf(screen.href)}
          onClose={() => setWhyOpen(false)}
        />
      )}
      {ad.dismissible && onDismiss != null && (
        <button
          type="button"
          className={clsx(styles.close, !canClose && styles.closeWaiting)}
          onClick={onDismiss}
          aria-hidden={!canClose}
          tabIndex={canClose ? undefined : -1}
          aria-label="Hide this advertisement for now"
        >
          &times;
        </button>
      )}
    </div>
  );
}
