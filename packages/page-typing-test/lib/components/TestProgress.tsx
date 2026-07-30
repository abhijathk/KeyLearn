import { useFormatter } from "@keybr/lesson-ui";
import { formatDuration, withDeferred } from "@keybr/widget";
import { clsx } from "clsx";
import { memo } from "react";
import { FormattedMessage } from "react-intl";
import { type Duration, DurationType, type Progress } from "../session/index.ts";
import { TestStyle } from "../settings.ts";
import * as styles from "./road.module.less";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export const TestProgress0 = memo(function TestProgress({
  progress,
  duration,
  testStyle,
  bestCpm,
}: {
  progress: Progress;
  duration: Duration;
  testStyle: TestStyle;
  bestCpm: number;
}) {
  const { length, time, progress: raw, speed } = progress;
  const { formatSpeed } = useFormatter();
  const pct = clamp01(raw);

  // ── Zen — a single hairline filling. Nothing to read, nothing to chase. ──
  if (testStyle === TestStyle.Zen) {
    return (
      <div className={styles.zenTrack}>
        <div className={styles.zenFill} style={{ inlineSize: `${pct * 100}%` }} />
      </div>
    );
  }

  const timeMode = duration.type === DurationType.Time;
  const timeLeft = timeMode ? Math.max(0, duration.value - time) : time;
  const wordsTarget = duration.type === DurationType.Words ? duration.value : 0;
  const wordsDone = Math.round(pct * wordsTarget);

  const count = timeMode ? (
    <span>
      <span className={styles.lab}>
        <FormattedMessage
          id="typingTest.progress.timeLeft"
          defaultMessage="Left"
        />
      </span>
      {formatDuration(timeLeft, { showMillis: false })}
    </span>
  ) : duration.type === DurationType.Words ? (
    <span>
      <span className={styles.lab}>
        <FormattedMessage
          id="typingTest.progress.words"
          defaultMessage="Words"
        />
      </span>
      {wordsDone}/{wordsTarget}
    </span>
  ) : (
    <span>
      <span className={styles.lab}>
        <FormattedMessage
          id="typingTest.progress.passage"
          defaultMessage="Passage"
        />
      </span>
      {Math.round(pct * 100)}%
    </span>
  );

  const road = (
    <div className={styles.proad}>
      <div className={styles.pdone} style={{ inlineSize: `${pct * 100}%` }} />
      <div className={styles.pdot} style={{ insetInlineStart: `${pct * 100}%` }} />
    </div>
  );

  // ── Arcade — the live speed sits at the top; here we keep the road, the
  // count, and a best reference to race against. ──
  if (testStyle === TestStyle.Arcade) {
    return (
      <div>
        {road}
        <div className={`${styles.whisper} ${styles.whisperCenter}`}>
          {count}
          {bestCpm > 0 && (
            <span className={styles.pbRef}>
              <span className={styles.lab}>
                <FormattedMessage
                  id="typingTest.progress.best"
                  defaultMessage="Best"
                />
              </span>
              {formatSpeed(bestCpm)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Coach — no raw speed (avoids choking); a qualitative pace cue instead. ──
  const ahead = bestCpm > 0 && speed >= bestCpm * 0.98;
  const close = bestCpm > 0 && speed >= bestCpm * 0.88;
  return (
    <div>
      {road}
      <div className={`${styles.whisper} ${styles.whisperCenter}`}>
        {count}
        {bestCpm > 0 && length > 0 && (
          <span className={clsx(styles.paceCue, ahead && styles.paceAhead)}>
            {ahead ? (
              <FormattedMessage
                id="typingTest.pace.ahead"
                defaultMessage="on your best pace"
              />
            ) : close ? (
              <FormattedMessage
                id="typingTest.pace.close"
                defaultMessage="closing in on your best"
              />
            ) : (
              <FormattedMessage
                id="typingTest.pace.behind"
                defaultMessage="finding your rhythm"
              />
            )}
          </span>
        )}
      </div>
    </div>
  );
});

export const TestProgress = withDeferred(TestProgress0);
