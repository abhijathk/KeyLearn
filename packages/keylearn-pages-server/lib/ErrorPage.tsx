import { FavIconAssets, StylesheetAssets } from "@keylearn/assets";
import { getDir } from "@keylearn/intl";
import { ThemePrefs, useTheme } from "@keylearn/themes";
import { StrokeIcon } from "@keylearn/widget";
import { type ReactNode } from "react";
import {
  defineMessage,
  FormattedMessage,
  type IntlShape,
  type MessageDescriptor,
  useIntl,
} from "react-intl";
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

/**
 * The server-rendered error page.
 *
 * It has no script and no page data, so the language comes from the
 * `IntlProvider` the caller renders it in: the server picks the locale from
 * the URL's first segment, the same way the pages themselves do, so a 404
 * under `/ar` reads in Arabic and one under `/` in English.
 */
export function ErrorPage({
  error,
}: {
  readonly error: ErrorDetails;
}): ReactNode {
  const theme = useTheme();
  const intl = useIntl();
  const title = intl.formatMessage(
    {
      id: "errorPage.title",
      defaultMessage: "{status} – {message}",
    },
    // The code as the server sent it, not a localised number.
    { status: String(error.status), message: statusMessage(intl, error) },
  );

  return (
    <html
      lang={intl.locale}
      dir={getDir(intl.locale)}
      {...ThemePrefs.dataAttributes(theme)}
    >
      <head>
        <meta charSet="UTF-8" />
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <StylesheetAssets entrypoint="browser" />
        <FavIconAssets links={favIcons} />
      </head>
      <body className={styles.body}>
        <div className={styles.center}>
          <div className={styles.card}>
            <div className={styles.brand} dir="ltr">
              <StrokeIcon className={styles.glyph} name="keyboard" />
              <FormattedMessage
                id="errorPage.brand"
                defaultMessage="<key>Key</key><learn>Learn</learn>"
                values={{
                  key: (chunks) => (
                    <span className={styles.mark}>{chunks}</span>
                  ),
                  learn: (chunks) => (
                    <span className={styles.markAlt}>{chunks}</span>
                  ),
                }}
              />
            </div>
            <StatusIcon status={error.status} />
            {/* Same type scale as the in-app crash screen, so the two error
                surfaces read as one voice. */}
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.description}>{getDescription(intl, error)}</p>
            <a className={styles.action} href="/">
              <FormattedMessage
                id="errorPage.startOver"
                defaultMessage="Start over"
              />
            </a>
            {/* Plain details/summary: works server-rendered, no script. */}
            <details className={styles.details}>
              <summary className={styles.summary}>
                <FormattedMessage
                  id="errorPage.technicalDetails"
                  defaultMessage="Technical details"
                />
              </summary>
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

/**
 * The standard reason phrases, translated. `english` is what the server
 * puts in `error.message` for that status; only an exact match is
 * translated, so a message somebody wrote on purpose is shown as written.
 * (It is kept apart from the descriptor because the build strips default
 * messages out of the bundle.)
 */
const statusMessages: Readonly<
  Record<
    number,
    { readonly english: string; readonly label: MessageDescriptor }
  >
> = {
  400: {
    english: "Bad Request",
    label: defineMessage({
      id: "errorPage.status.400",
      defaultMessage: "Bad Request",
    }),
  },
  403: {
    english: "Forbidden",
    label: defineMessage({
      id: "errorPage.status.403",
      defaultMessage: "Forbidden",
    }),
  },
  404: {
    english: "Not Found",
    label: defineMessage({
      id: "errorPage.status.404",
      defaultMessage: "Not Found",
    }),
  },
  500: {
    english: "Internal Server Error",
    label: defineMessage({
      id: "errorPage.status.500",
      defaultMessage: "Internal Server Error",
    }),
  },
  503: {
    english: "Service Unavailable",
    label: defineMessage({
      id: "errorPage.status.503",
      defaultMessage: "Service Unavailable",
    }),
  },
};

function statusMessage(intl: IntlShape, error: ErrorDetails): string {
  const known = statusMessages[error.status];
  if (known != null && known.english === error.message) {
    return intl.formatMessage(known.label);
  }
  return error.message;
}

function getDescription(intl: IntlShape, error: ErrorDetails): ReactNode {
  const { status, message, description } = error;
  if (description) {
    return description;
  }
  switch (status) {
    case 400:
      return intl.formatMessage({
        id: "errorPage.description.400",
        defaultMessage: "Request contained invalid data or parameters.",
      });
    case 403:
      return intl.formatMessage({
        id: "errorPage.description.403",
        defaultMessage: "You cannot access this page.",
      });
    case 404:
      return intl.formatMessage({
        id: "errorPage.description.404",
        defaultMessage: "The page you are looking for does not exist.",
      });
    case 500:
      return intl.formatMessage({
        id: "errorPage.description.500",
        defaultMessage:
          "Something is wrong with our server. Please try again later.",
      });
  }
  return statusMessage(intl, error);
}
