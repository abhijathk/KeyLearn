import { useSettings } from "@keybr/settings";
import { clsx } from "clsx";
import { type ReactNode, useState } from "react";
import { FormattedMessage } from "react-intl";
import {
  type Duration,
  DurationType,
  timeDuration,
  timeDurations,
  wordDurations,
  wordsDuration,
} from "../../session/index.ts";
import { TestStyle, typingTestProps } from "../../settings.ts";
import * as styles from "../settings.module.less";

/**
 * The Test tab of the settings modal: the test style (how much shows while you
 * type) and the test length (time or word count). Both apply to every style.
 */
export function TestModeSettings(): ReactNode {
  const { settings, updateSettings } = useSettings();
  const style = settings.get(typingTestProps.testStyle);
  const durType = settings.get(typingTestProps.duration.type);
  const durVal = settings.get(typingTestProps.duration.value);
  const isDur = (d: Duration) => d.type === durType && d.value === durVal;
  const isCustomTime =
    durType === DurationType.Time &&
    !timeDurations.some(({ duration }) => isDur(duration));
  const isCustomWords =
    durType === DurationType.Words &&
    !wordDurations.some(({ duration }) => isDur(duration));
  // Custom inputs keep their own text so typing "100" isn't interrupted when
  // the value momentarily passes a preset (10/25/50, 30s…).
  const [timeInput, setTimeInput] = useState(
    isCustomTime ? String(Math.round(durVal / 1000)) : "",
  );
  const [wordsInput, setWordsInput] = useState(
    isCustomWords ? String(durVal) : "",
  );
  const setDur = (d: Duration) =>
    updateSettings(
      settings
        .set(typingTestProps.duration.type, d.type)
        .set(typingTestProps.duration.value, d.value),
    );
  const pickTime = (d: Duration) => {
    setTimeInput("");
    setDur(d);
  };
  const pickWords = (d: Duration) => {
    setWordsInput("");
    setDur(d);
  };
  const setStyle = (s: TestStyle) =>
    updateSettings(settings.set(typingTestProps.testStyle, s));

  return (
    <div className={styles.modePanel}>
      <div className={styles.field}>
        <div className={styles.fieldLabel}>
          <FormattedMessage
            id="typingTest.settings.testStyle"
            defaultMessage="Test style"
          />
        </div>
        <div className={styles.styleRow}>
          <button
            type="button"
            className={clsx(
              styles.styleCard,
              style === TestStyle.Zen && styles.styleCardOn,
            )}
            onClick={() => setStyle(TestStyle.Zen)}
          >
            <span className={styles.styleName}>
              <FormattedMessage
                id="typingTest.style.zen"
                defaultMessage="Zen"
              />
            </span>
            <span className={styles.styleDesc}>
              <FormattedMessage
                id="typingTest.style.zen.desc"
                defaultMessage="Just the words — no live stats."
              />
            </span>
          </button>
          <button
            type="button"
            className={clsx(
              styles.styleCard,
              style === TestStyle.Coach && styles.styleCardOn,
            )}
            onClick={() => setStyle(TestStyle.Coach)}
          >
            <span className={styles.styleName}>
              <FormattedMessage
                id="typingTest.style.coach"
                defaultMessage="Coach"
              />
            </span>
            <span className={styles.styleDesc}>
              <FormattedMessage
                id="typingTest.style.coach.desc"
                defaultMessage="A pace cue and your best as a target."
              />
            </span>
          </button>
          <button
            type="button"
            className={clsx(
              styles.styleCard,
              style === TestStyle.Arcade && styles.styleCardOn,
            )}
            onClick={() => setStyle(TestStyle.Arcade)}
          >
            <span className={styles.styleName}>
              <FormattedMessage
                id="typingTest.style.arcade"
                defaultMessage="Arcade"
              />
            </span>
            <span className={styles.styleDesc}>
              <FormattedMessage
                id="typingTest.style.arcade.desc"
                defaultMessage="Live speed while you type."
              />
            </span>
          </button>
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>
          <FormattedMessage
            id="typingTest.settings.time"
            defaultMessage="Time"
          />
        </div>
        <span className={styles.lengthRow}>
          <span className={styles.seg}>
            {timeDurations.map(({ duration, label }) => (
              <button
                key={label}
                type="button"
                className={clsx(styles.segItem, isDur(duration) && styles.segOn)}
                onClick={() => pickTime(duration)}
              >
                {label}
              </button>
            ))}
          </span>
          <input
            className={clsx(styles.customInput, isCustomTime && styles.customOn)}
            type="text"
            inputMode="numeric"
            placeholder="custom s"
            value={timeInput}
            onChange={(ev) => {
              const digits = ev.target.value.replace(/\D/g, "");
              setTimeInput(digits);
              const n = parseInt(digits, 10);
              if (Number.isFinite(n) && n > 0) {
                setDur(timeDuration(n * 1000));
              }
            }}
          />
        </span>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>
          <FormattedMessage
            id="typingTest.settings.words"
            defaultMessage="Words"
          />
        </div>
        <span className={styles.lengthRow}>
          <span className={styles.seg}>
            {wordDurations.map(({ duration, label }) => (
              <button
                key={label}
                type="button"
                className={clsx(styles.segItem, isDur(duration) && styles.segOn)}
                onClick={() => pickWords(duration)}
              >
                {label}
              </button>
            ))}
          </span>
          <input
            className={clsx(styles.customInput, isCustomWords && styles.customOn)}
            type="text"
            inputMode="numeric"
            placeholder="custom"
            value={wordsInput}
            onChange={(ev) => {
              const digits = ev.target.value.replace(/\D/g, "");
              setWordsInput(digits);
              const n = parseInt(digits, 10);
              if (Number.isFinite(n) && n > 0) {
                setDur(wordsDuration(n));
              }
            }}
          />
        </span>
      </div>
    </div>
  );
}
