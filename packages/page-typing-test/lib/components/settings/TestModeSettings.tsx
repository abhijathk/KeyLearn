import { useSettings } from "@keybr/settings";
import { clsx } from "clsx";
import { type ReactNode, useState } from "react";
import { FormattedMessage } from "react-intl";
import {
  type Duration,
  duration_25_words,
  duration_30_seconds,
  duration_500_chars,
  DurationType,
  lengthDuration,
  lengthDurations,
  timeDuration,
  timeDurations,
  wordDurations,
  wordsDuration,
} from "../../session/index.ts";
import { TestStyle, typingTestProps } from "../../settings.ts";
import * as styles from "../settings.module.less";

/**
 * The Test tab of the settings modal: the test style (how much shows while
 * you type), the test mode (what ends the test — time, a word target, or a
 * fixed passage) and the length presets for the chosen mode.
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
  const isCustomChars =
    durType === DurationType.Length &&
    !lengthDurations.some(({ duration }) => isDur(duration));
  // Custom inputs keep their own text so typing "100" isn't interrupted when
  // the value momentarily passes a preset (10/25/50, 30s…).
  const [timeInput, setTimeInput] = useState(
    isCustomTime ? String(Math.round(durVal / 1000)) : "",
  );
  const [wordsInput, setWordsInput] = useState(
    isCustomWords ? String(durVal) : "",
  );
  const [charsInput, setCharsInput] = useState(
    isCustomChars ? String(durVal) : "",
  );
  const setDur = (d: Duration) =>
    updateSettings(
      settings
        .set(typingTestProps.duration.type, d.type)
        .set(typingTestProps.duration.value, d.value),
    );
  const pickPreset = (d: Duration) => {
    setTimeInput("");
    setWordsInput("");
    setCharsInput("");
    setDur(d);
  };
  const setStyle = (s: TestStyle) =>
    updateSettings(settings.set(typingTestProps.testStyle, s));
  // Switching mode cards jumps to that mode's default preset.
  const pickMode = (type: DurationType) => {
    if (type === durType) {
      return;
    }
    switch (type) {
      case DurationType.Time:
        pickPreset(duration_30_seconds);
        break;
      case DurationType.Words:
        pickPreset(duration_25_words);
        break;
      case DurationType.Length:
        pickPreset(duration_500_chars);
        break;
    }
  };

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
            id="typingTest.settings.testMode"
            defaultMessage="Test mode"
          />
        </div>
        <div className={styles.styleRow}>
          <button
            type="button"
            className={clsx(
              styles.styleCard,
              durType === DurationType.Time && styles.styleCardOn,
            )}
            onClick={() => pickMode(DurationType.Time)}
          >
            <span className={styles.styleName}>
              <FormattedMessage
                id="typingTest.mode.time"
                defaultMessage="Time mode"
              />
            </span>
            <span className={styles.styleDesc}>
              <FormattedMessage
                id="typingTest.mode.time.desc"
                defaultMessage="Clock counts down from your pick. Ends at 0. The bar depletes."
              />
            </span>
            <span className={styles.miniBar}>
              <span className={styles.miniFill} style={{ inlineSize: "63%" }} />
            </span>
            <span className={styles.miniMeta}>
              <span>0:19 left</span>
              <span>30s</span>
            </span>
          </button>
          <button
            type="button"
            className={clsx(
              styles.styleCard,
              durType === DurationType.Words && styles.styleCardOn,
            )}
            onClick={() => pickMode(DurationType.Words)}
          >
            <span className={styles.styleName}>
              <FormattedMessage
                id="typingTest.mode.words"
                defaultMessage="Words mode"
              />
            </span>
            <span className={styles.styleDesc}>
              <FormattedMessage
                id="typingTest.mode.words.desc"
                defaultMessage="Clock counts up. Ends when you hit the target. The bar fills."
              />
            </span>
            <span className={styles.miniBar}>
              <span className={styles.miniFill} style={{ inlineSize: "48%" }} />
            </span>
            <span className={styles.miniMeta}>
              <span>12 of 25 words</span>
              <span>0:14</span>
            </span>
          </button>
          <button
            type="button"
            className={clsx(
              styles.styleCard,
              durType === DurationType.Length && styles.styleCardOn,
            )}
            onClick={() => pickMode(DurationType.Length)}
          >
            <span className={styles.styleName}>
              <FormattedMessage
                id="typingTest.mode.passage"
                defaultMessage="Passage mode"
              />
            </span>
            <span className={styles.styleDesc}>
              <FormattedMessage
                id="typingTest.mode.passage.desc"
                defaultMessage="A fixed length of text. Ends when you finish it. The bar shows % done."
              />
            </span>
            <span className={styles.miniBar}>
              <span className={styles.miniFill} style={{ inlineSize: "73%" }} />
            </span>
            <span className={styles.miniMeta}>
              <span>73% of passage</span>
              <span>0:28</span>
            </span>
          </button>
        </div>
      </div>

      {durType === DurationType.Time && (
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
                  className={clsx(
                    styles.segItem,
                    isDur(duration) && styles.segOn,
                  )}
                  onClick={() => pickPreset(duration)}
                >
                  {label}
                </button>
              ))}
            </span>
            <input
              className={clsx(
                styles.customInput,
                isCustomTime && styles.customOn,
              )}
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
      )}

      {durType === DurationType.Words && (
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
                  className={clsx(
                    styles.segItem,
                    isDur(duration) && styles.segOn,
                  )}
                  onClick={() => pickPreset(duration)}
                >
                  {label}
                </button>
              ))}
            </span>
            <input
              className={clsx(
                styles.customInput,
                isCustomWords && styles.customOn,
              )}
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
      )}

      {durType === DurationType.Length && (
        <div className={styles.field}>
          <div className={styles.fieldLabel}>
            <FormattedMessage
              id="typingTest.settings.passage"
              defaultMessage="Passage length"
            />
          </div>
          <span className={styles.lengthRow}>
            <span className={styles.seg}>
              {lengthDurations.map(({ duration, label }) => (
                <button
                  key={label}
                  type="button"
                  className={clsx(
                    styles.segItem,
                    isDur(duration) && styles.segOn,
                  )}
                  onClick={() => pickPreset(duration)}
                >
                  {label}
                </button>
              ))}
            </span>
            <input
              className={clsx(
                styles.customInput,
                isCustomChars && styles.customOn,
              )}
              type="text"
              inputMode="numeric"
              placeholder="custom chars"
              value={charsInput}
              onChange={(ev) => {
                const digits = ev.target.value.replace(/\D/g, "");
                setCharsInput(digits);
                const n = parseInt(digits, 10);
                if (Number.isFinite(n) && n > 0) {
                  setDur(lengthDuration(n));
                }
              }}
            />
          </span>
        </div>
      )}
    </div>
  );
}
