import { useIntlNumbers } from "@keylearn/intl";
import { useFormatter } from "@keylearn/lesson-ui";
import { AnimationFrames, formatDuration } from "@keylearn/widget";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { type ReplayState } from "../session/index.ts";
import * as styles from "./road.module.less";

export function ReplayProgress({ stepper }: { stepper: ReplayState }) {
  const { formatInteger } = useIntlNumbers();
  const { formatSpeed } = useFormatter();
  const {
    progress: { progress, length, speed },
    time,
  } = useReplayProgress(stepper);
  return (
    <div className={`${styles.whisper} ${styles.whisperCenter}`}>
      <span>
        <span className={styles.lab}>
          <FormattedMessage
            id="typingTest.replay.progress"
            defaultMessage="Progress"
          />
        </span>
        {`${formatInteger(progress)}/${formatInteger(length)}`}
      </span>
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
            id="typingTest.progress.speed"
            defaultMessage="Speed"
          />
        </span>
        {formatSpeed(speed)}
      </span>
    </div>
  );
}

function useReplayProgress(stepper: ReplayState) {
  const { state, progress } = stepper;
  const [time, setTime] = useState(0);
  useEffect(() => {
    setTime(0);
    const frames = new AnimationFrames();
    frames.start(() => {
      if (state === "running" || state === "finished") {
        setTime(progress.time);
      }
    });
    return () => {
      frames.cancel();
    };
  }, [state, progress]);
  return { progress, time };
}
