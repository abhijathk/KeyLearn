import { FavIconAssets, StylesheetAssets } from "@keylearn/assets";
import { ThemePrefs, useTheme } from "@keylearn/themes";
import { StrokeIcon } from "@keylearn/widget";
import { type ReactNode } from "react";
import * as styles from "./ErrorPage.module.less";
import { favIcons } from "./meta.tsx";

export type ErrorDetails = {
  readonly status: number;
  readonly message: string;
  readonly expose: boolean;
  readonly description?: string | null;
};

export function inspectError(err: Error): ErrorDetails | null {
  if (err != null && typeof err === "object" && "message" in err) {
    const {
      message,
      status = 500,
      expose = false,
      description = null,
    } = err as any;
    return {
      status,
      message,
      expose,
      description,
    };
  }
  return null;
}

export function ErrorPage({
  error,
}: {
  readonly error: ErrorDetails;
}): ReactNode {
  const theme = useTheme();

  return (
    <html lang="en" {...ThemePrefs.dataAttributes(theme)}>
      <head>
        <meta charSet="UTF-8" />
        <title>{`${error.status} - ${error.message}`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <StylesheetAssets entrypoint="browser" />
        <FavIconAssets links={favIcons} />
      </head>
      <body className={styles.body}>
        <div className={styles.center}>
          <div className={styles.card}>
            <div className={styles.brand} dir="ltr">
              <StrokeIcon className={styles.glyph} name="keyboard" />
              <span className={styles.mark}>Key</span>
              <span className={styles.markAlt}>Learn</span>
            </div>
            <StatusIcon status={error.status} />
            {/* Same type scale as the in-app crash screen, so the two error
                surfaces read as one voice. */}
            <h1 className={styles.title}>
              {error.status} - {error.message}
            </h1>
            <p className={styles.description}>{getDescription(error)}</p>
            <a className={styles.action} href="/">
              Start over
            </a>
            {/* Plain details/summary: works server-rendered, no script. */}
            <details className={styles.details}>
              <summary className={styles.summary}>Technical details</summary>
              <pre className={styles.report}>
                {`status: ${error.status}\nmessage: ${error.message}` +
                  (error.description
                    ? `\ndescription: ${error.description}`
                    : "")}
              </pre>
            </details>
          </div>
        </div>
      </body>
    </html>
  );
}

/**
 * The mood-face language, matched to what actually happened: a 404 is the
 * keycap glancing around for the page that isn't there, a 5xx is the stuck
 * key jamming, and the other client errors get the caution triangle's
 * heartbeat. Pure CSS animation — this page renders server-side with no
 * script of its own.
 */
function StatusIcon({ status }: { readonly status: number }): ReactNode {
  if (status === 404) {
    return (
      <div className={styles.face} aria-hidden={true}>
        <svg viewBox="0 0 48 48">
          <rect x="6" y="10" width="36" height="30" rx="6" />
          <path d="M6 33h36" />
          <g className={styles.lookEyes}>
            <circle className={styles.eye} cx="18" cy="21" r="1.7" />
            <circle className={styles.eye} cx="30" cy="21" r="1.7" />
          </g>
          {/* A flat, nonplussed mouth: lost, but not hurt. */}
          <path d="M20.5 27.5h7" />
        </svg>
      </div>
    );
  }
  if (status >= 500) {
    return (
      <div className={`${styles.face} ${styles.errTone}`} aria-hidden={true}>
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
    );
  }
  return (
    <div className={`${styles.face} ${styles.errTone}`} aria-hidden={true}>
      <svg viewBox="0 0 24 24">
        <circle className={styles.warnGlow} cx="12" cy="13.5" r="10.5" />
        <path className={styles.warnTri} d="M12 3.5 21.5 20h-19z" />
        <line className={styles.warnBang} x1="12" y1="9.5" x2="12" y2="14.5" />
        <circle className={styles.warnDot} cx="12" cy="17.3" r="1" />
      </svg>
    </div>
  );
}

function getDescription(error: ErrorDetails): ReactNode {
  const { status, message, description } = error;
  if (description) {
    return description;
  }
  switch (status) {
    case 400:
      return `Request contained invalid data or parameters.`;
    case 403:
      return `You cannot access this page.`;
    case 404:
      return `The page you are looking for does not exist.`;
    case 500:
      return `Something is wrong with our server. Please try again later.`;
  }
  return message;
}
