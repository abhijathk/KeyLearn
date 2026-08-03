import * as styles from "./Meter.module.less";

export function Meter({
  length,
  slideIndex,
}: {
  readonly length: number;
  readonly slideIndex: number;
}) {
  const percent = length > 1 ? slideIndex / (length - 1) : 1;
  return (
    <div className={styles.root}>
      <div
        className={styles.done}
        style={{ inlineSize: `${percent * 100}%` }}
      />
      <div
        className={styles.dot}
        style={{ insetInlineStart: `${percent * 100}%` }}
      />
    </div>
  );
}
