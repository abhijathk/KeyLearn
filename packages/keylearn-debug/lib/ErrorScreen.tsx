import { useEffect } from "react";
import { ErrorReport } from "./ErrorReport.tsx";
import * as styles from "./ErrorScreen.module.less";

/**
 * The friendly crash screen: plain words, one obvious way out, and the
 * technical details folded away for anyone who wants them.
 *
 * One mount point, three dialects. The handler that shows this screen wraps
 * the whole app, so the screen itself decides how to speak from where the
 * crash happened: the kids world gets a tumble that bounces back, the braille
 * page gets an announcement that leads and an icon that merely keeps time,
 * and everywhere else gets the stuck key. Deliberately dependency-light and
 * hard-coded English, like the rest of this package — the crash path must
 * not depend on the loaders that may be the thing that crashed.
 */
export function ErrorScreen({ report }: { readonly report: string }) {
  const path = window.location.pathname;
  if (/\/braille\/?$/.test(path)) {
    return <BrailleErrorScreen report={report} />;
  }
  if (/\/kids\/?$/.test(path)) {
    return <KidsErrorScreen report={report} />;
  }
  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.face} aria-hidden={true}>
          <svg viewBox="0 0 48 48">
            <g className={styles.stuckFace}>
              <rect x="6" y="10" width="36" height="30" rx="6" />
              <path d="M6 33h36" />
              <g className={styles.stuckBrow}>
                <circle className={styles.eye} cx="18" cy="21" r="1.7" />
                <circle className={styles.eye} cx="30" cy="21" r="1.7" />
              </g>
              <path d="M19.5 27.5 Q24 24.5 28.5 27.5" />
            </g>
          </svg>
        </div>
        <h1 className={styles.title}>Well, that key stuck.</h1>
        <p className={styles.body}>
          Something unexpected interrupted the app. Your progress is safe —
          reloading the page almost always fixes this.
        </p>
        <button
          type="button"
          className={styles.reload}
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload the page
        </button>
        <Details report={report} />
      </div>
    </div>
  );
}

/**
 * The same news, told gently: a keycap that took a tumble and is already
 * bouncing back. No red, no jargon, one big friendly button.
 */
function KidsErrorScreen({ report }: { readonly report: string }) {
  return (
    <div className={`${styles.screen} ${styles.kidsScreen}`}>
      <div className={`${styles.card} ${styles.kidsCard}`}>
        <div className={styles.kidsStage} aria-hidden={true}>
          <svg viewBox="0 0 48 48">
            <ellipse
              className={styles.kidsShadow}
              cx="24"
              cy="43.5"
              rx="11"
              ry="1.8"
            />
            <g className={styles.kidsCap}>
              <rect
                className={styles.kidsCapBody}
                x="10"
                y="12"
                width="28"
                height="26"
                rx="7"
              />
              <path className={styles.kidsInk} d="M10 31h28" />
              <g className={styles.kidsBlink}>
                <circle className={styles.kidsEye} cx="19" cy="22" r="1.9" />
                <circle className={styles.kidsEye} cx="29" cy="22" r="1.9" />
              </g>
              {/* A worried little frown — something did just happen. */}
              <path
                className={styles.kidsInk}
                d="M20.5 28.5 Q24 25.5 27.5 28.5"
              />
            </g>
            <path
              className={`${styles.kidsStar} ${styles.kidsStarCoral}`}
              d="M8 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"
            />
            <path
              className={`${styles.kidsStar} ${styles.kidsStarBlue}`}
              d="M40 20l0.8 1.6 1.6 0.8-1.6 0.8-0.8 1.6-0.8-1.6-1.6-0.8 1.6-0.8z"
            />
          </svg>
        </div>
        <h1 className={`${styles.title} ${styles.kidsTitle}`}>
          Oops! The game took a little tumble.
        </h1>
        <p className={`${styles.body} ${styles.kidsBody}`}>
          Nothing is lost — your trail, your stickers, and your score are all
          safe. Press the big button to jump back in!
        </p>
        <button
          type="button"
          className={`${styles.reload} ${styles.kidsReload}`}
          onClick={() => {
            window.location.reload();
          }}
        >
          Jump back in
        </button>
        <Details report={report} />
      </div>
    </div>
  );
}

const BRAILLE_ANNOUNCEMENT =
  "Something went wrong. Press Enter to reload and try again — " +
  "nothing you typed is lost.";

/**
 * On the braille page the error IS the announcement: it comes first in the
 * document as an alert, Enter reloads without hunting for a button, and the
 * browser voice reads it aloud in case the crash took the page's own voice
 * down with it. The speaking-cell icon exists for sighted household members
 * looking over a shoulder, and is hidden from the screen reader.
 */
function BrailleErrorScreen({ report }: { readonly report: string }) {
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Enter") {
        window.location.reload();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    // Best effort, straight to the browser: the page's own speech stack may
    // be part of what just crashed.
    try {
      window.speechSynthesis?.speak(
        new window.SpeechSynthesisUtterance(BRAILLE_ANNOUNCEMENT),
      );
    } catch {
      // A silent crash screen is still a working crash screen.
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // Ignored for the same reason.
      }
    };
  }, []);
  return (
    <div className={styles.screen}>
      <p role="alert" className={styles.sr}>
        {BRAILLE_ANNOUNCEMENT}
      </p>
      <div className={styles.card}>
        <div className={styles.voiceStage} aria-hidden={true}>
          <svg viewBox="0 0 24 24">
            <circle className={styles.cellDot} cx="7" cy="8" r="1.7" />
            <circle className={styles.cellDot} cx="7" cy="13" r="1.7" />
            <circle
              className={`${styles.cellDot} ${styles.cellDotDim}`}
              cx="7"
              cy="18"
              r="1.7"
            />
            <path className={styles.voiceArc} d="M12.5 9 a5.5 5.5 0 0 1 0 8" />
            <path
              className={`${styles.voiceArc} ${styles.voiceArc2}`}
              d="M15 7 a8.5 8.5 0 0 1 0 12"
            />
            <path
              className={`${styles.voiceArc} ${styles.voiceArc3}`}
              d="M17.5 5 a11.5 11.5 0 0 1 0 16"
            />
          </svg>
        </div>
        <h1 className={styles.title}>Something went wrong.</h1>
        <p className={styles.body}>
          Press <strong>Enter</strong> to reload and try again — nothing you
          typed is lost.
        </p>
        <button
          type="button"
          className={styles.reload}
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload the page
        </button>
        <Details report={report} />
      </div>
    </div>
  );
}

function Details({ report }: { readonly report: string }) {
  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden={true}>
          <path d="M5 6l3 3 3-3" />
        </svg>
        Technical details
      </summary>
      <ErrorReport report={report} />
    </details>
  );
}
