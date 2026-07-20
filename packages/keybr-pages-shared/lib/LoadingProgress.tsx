import { type CSSProperties, type ReactNode } from "react";
import * as styles from "./LoadingProgress.module.less";

/**
 * The KeyLearn loading state: a faint wireframe of the practice screen with
 * three keycaps typing "K E Y" over it, plus a slim progress track when real
 * progress is known.
 */
export function LoadingProgress({
  total = 0,
  current = 0,
}: {
  readonly total?: number;
  readonly current?: number;
}): ReactNode {
  const pct =
    total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : null;
  return (
    <div className={styles.root}>
      <Wireframe />
      <div className={styles.loader}>
        <div className={styles.keys}>
          <span className={styles.key}>K</span>
          <span className={styles.key}>E</span>
          <span className={styles.key}>Y</span>
        </div>
        {pct != null && (
          <div className={styles.track}>
            <i style={{ inlineSize: `${pct}%` } as CSSProperties} />
          </div>
        )}
      </div>
    </div>
  );
}

/** A ghost outline of the practice screen while it loads. */
function Wireframe(): ReactNode {
  return (
    <div className={styles.wire} aria-hidden={true}>
      <div className={styles.wireJourney}>
        {Array.from({ length: 22 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <div className={styles.wireMetrics}>
        <i />
        <i />
        <i />
      </div>
      <div className={styles.wireText}>
        <i />
        <i style={{ inlineSize: "70%" } as CSSProperties} />
      </div>
      <div className={styles.wireKeyboard}>
        {Array.from({ length: 4 }, (_, row) => (
          <div key={row} className={styles.wireRow}>
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        ))}
        <div className={styles.wireRow}>
          <i className={styles.wireSpace} />
        </div>
      </div>
    </div>
  );
}
