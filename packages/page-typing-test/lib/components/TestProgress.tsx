import { useIntlNumbers } from "@keybr/intl";
import { useFormatter } from "@keybr/lesson-ui";
import { formatDuration, withDeferred } from "@keybr/widget";
import { memo } from "react";
import { FormattedMessage } from "react-intl";
import { type Progress } from "../session/index.ts";
import * as styles from "./road.module.less";

export const TestProgress0 = memo(function TestProgress({
  progress: { length, time, progress, speed },
}: {
  progress: Progress;
}) {
  const { formatInteger, formatPercents } = useIntlNumbers();
  const { formatSpeed } = useFormatter();
  const percent = Math.max(0, Math.min(1, progress));
  return (
    <div>
      <div className={styles.proad}>
        <div
          className={styles.pdone}
          style={{ inlineSize: `${percent * 100}%` }}
        />
        <div
          className={styles.pdot}
          style={{ insetInlineStart: `${percent * 100}%` }}
        />
      </div>
      <div className={`${styles.whisper} ${styles.whisperCenter}`}>
        <span>
          <span className={styles.lab}>
            <FormattedMessage
              id="typingTest.progress.time"
              defaultMessage="Time"
            />
          </span>
          {formatDuration(time, { showMillis: true })}
        </span>
        <span>
          <span className={styles.lab}>
            <FormattedMessage
              id="typingTest.progress.chars"
              defaultMessage="Chars"
            />
          </span>
          {formatInteger(length)}
        </span>
        <span>
          <span className={styles.lab}>
            <FormattedMessage
              id="typingTest.progress.done"
              defaultMessage="Done"
            />
          </span>
          {formatPercents(percent, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </span>
        <span>
          <span className={styles.lab}>
            <FormattedMessage
              id="typingTest.progress.speed"
              defaultMessage="Speed"
            />
          </span>
          {formatSpeed(speed)}
        </span>
      </div>
    </div>
  );
});

export const TestProgress = withDeferred(TestProgress0);
