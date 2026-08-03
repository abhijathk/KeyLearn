import { ErrorReport } from "./ErrorReport.tsx";
import * as styles from "./ErrorScreen.module.less";

/**
 * The friendly crash screen: plain words, one obvious way out, and the
 * technical details folded away for anyone who wants them.
 */
export function ErrorScreen({ report }: { readonly report: string }) {
  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.face} aria-hidden={true}>
          <svg viewBox="0 0 48 48">
            <rect x="6" y="10" width="36" height="30" rx="6" />
            <path d="M6 33h36" />
            <circle className={styles.eye} cx="18" cy="21" r="1.7" />
            <circle className={styles.eye} cx="30" cy="21" r="1.7" />
            <path d="M19.5 27.5 Q24 24.5 28.5 27.5" />
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
        <details className={styles.details}>
          <summary className={styles.summary}>
            <svg
              className={styles.chevron}
              viewBox="0 0 16 16"
              aria-hidden={true}
            >
              <path d="M5 6l3 3 3-3" />
            </svg>
            Technical details
          </summary>
          <ErrorReport report={report} />
        </details>
      </div>
    </div>
  );
}
