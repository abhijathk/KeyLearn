import { type CSSProperties, type ReactNode } from "react";
import * as styles from "./LoadingProgress.module.less";

/**
 * The KeyLearn loading state: three keycaps typing "K E Y", coloured from the
 * keyboard's finger-zone palette, plus a slim progress track when real
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
      <div className={styles.loader}>
        <div className={styles.keys}>
          <span className={`${styles.key} ${styles.k1}`}>K</span>
          <span className={`${styles.key} ${styles.k2}`}>E</span>
          <span className={`${styles.key} ${styles.k3}`}>Y</span>
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
