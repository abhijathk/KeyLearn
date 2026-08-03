import { useSettings } from "@keylearn/settings";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  type Duration,
  duration_25_words,
  duration_30_seconds,
  duration_60_seconds,
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
 * A number field with +/- buttons and a fixed unit suffix (e.g. "45 s"), so
 * picking a custom length never requires guessing what unit the number is
 * in or what format to type — you can always just tap the buttons.
 */
function Stepper({
  value,
  step,
  min,
  max,
  unit,
  onChange,
}: {
  value: number;
  step: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}): ReactNode {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const commit = (n: number) => {
    const c = clamp(n);
    setText(String(c));
    onChange(c);
  };
  const current = () => {
    const n = parseInt(text, 10);
    return Number.isFinite(n) ? n : value;
  };
  return (
    <span className={styles.stepper}>
      <button
        type="button"
        className={styles.stepBtn}
        aria-label="Decrease"
        onClick={() => commit(current() - step)}
      >
        −
      </button>
      <span className={styles.stepField}>
        <input
          className={styles.stepInput}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(ev) => {
            setText(ev.target.value.replace(/\D/g, ""));
          }}
          onBlur={() => commit(current())}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.currentTarget.blur();
            }
          }}
        />
        <span className={styles.stepUnit}>{unit}</span>
      </span>
      <button
        type="button"
        className={styles.stepBtn}
        aria-label="Increase"
        onClick={() => commit(current() + step)}
      >
        +
      </button>
    </span>
  );
}

/**
 * The Test tab of the settings modal: the test style (how much shows while
 * you type) and the test mode (what ends the test — time, a word target, or
 * a fixed passage). Each mode card expands in place, once selected, to show
 * its own length presets and a custom stepper — so the length setting always
 * reads as part of the mode you picked it for, not a separate control.
 */
export function TestModeSettings(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const style = settings.get(typingTestProps.testStyle);
  const durType = settings.get(typingTestProps.duration.type);
  const durVal = settings.get(typingTestProps.duration.value);
  const isDur = (d: Duration) => d.type === durType && d.value === durVal;
  const setDur = (d: Duration) =>
    updateSettings(
      settings
        .set(typingTestProps.duration.type, d.type)
        .set(typingTestProps.duration.value, d.value),
    );
  // Each style has the test mode that best suits it: Zen is an uninterrupted
  // flow session (a longer stretch of time), Coach chases a concrete word
  // target, and Arcade is a quick, punchy sprint. Picking a style opens that
  // mode's card with its sensible defaults already filled in.
  const setStyle = (s: TestStyle) => {
    const styleDefault =
      s === TestStyle.Zen
        ? duration_60_seconds
        : s === TestStyle.Coach
          ? duration_25_words
          : duration_30_seconds;
    updateSettings(
      settings
        .set(typingTestProps.testStyle, s)
        .set(typingTestProps.duration.type, styleDefault.type)
        .set(typingTestProps.duration.value, styleDefault.value),
    );
  };
  // Switching mode cards jumps to that mode's default preset.
  const pickMode = (type: DurationType) => {
    if (type === durType) {
      return;
    }
    switch (type) {
      case DurationType.Time:
        setDur(duration_30_seconds);
        break;
      case DurationType.Words:
        setDur(duration_25_words);
        break;
      case DurationType.Length:
        setDur(duration_500_chars);
        break;
    }
  };
  const secondsUnit = formatMessage({
    id: "typingTest.unit.seconds",
    defaultMessage: "s",
  });
  const wordsUnit = formatMessage({
    id: "typingTest.unit.words",
    defaultMessage: "words",
  });
  const charsUnit = formatMessage({
    id: "typingTest.unit.chars",
    defaultMessage: "chars",
  });

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
        <div className={clsx(styles.styleRow, styles.modeRow)}>
          <div
            className={clsx(
              styles.styleCard,
              durType === DurationType.Time && styles.styleCardOn,
            )}
          >
            <button
              type="button"
              className={styles.modeHead}
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
                <span
                  className={styles.miniFill}
                  style={{ inlineSize: "63%" }}
                />
              </span>
              <span className={styles.miniMeta}>
                <span>0:19 left</span>
                <span>30s</span>
              </span>
            </button>
            {durType === DurationType.Time && (
              <div className={styles.modeExpand}>
                <span className={styles.seg}>
                  {timeDurations.map(({ duration, label }) => (
                    <button
                      key={label}
                      type="button"
                      className={clsx(
                        styles.segItem,
                        isDur(duration) && styles.segOn,
                      )}
                      onClick={() => setDur(duration)}
                    >
                      {label}
                    </button>
                  ))}
                </span>
                <Stepper
                  value={Math.round(durVal / 1000)}
                  step={5}
                  min={5}
                  max={1800}
                  unit={secondsUnit}
                  onChange={(seconds) => setDur(timeDuration(seconds * 1000))}
                />
              </div>
            )}
          </div>

          <div
            className={clsx(
              styles.styleCard,
              durType === DurationType.Words && styles.styleCardOn,
            )}
          >
            <button
              type="button"
              className={styles.modeHead}
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
                <span
                  className={styles.miniFill}
                  style={{ inlineSize: "48%" }}
                />
              </span>
              <span className={styles.miniMeta}>
                <span>12 of 25 words</span>
                <span>0:14</span>
              </span>
            </button>
            {durType === DurationType.Words && (
              <div className={styles.modeExpand}>
                <span className={styles.seg}>
                  {wordDurations.map(({ duration, label }) => (
                    <button
                      key={label}
                      type="button"
                      className={clsx(
                        styles.segItem,
                        isDur(duration) && styles.segOn,
                      )}
                      onClick={() => setDur(duration)}
                    >
                      {label}
                    </button>
                  ))}
                </span>
                <Stepper
                  value={durVal}
                  step={5}
                  min={5}
                  max={1000}
                  unit={wordsUnit}
                  onChange={(words) => setDur(wordsDuration(words))}
                />
              </div>
            )}
          </div>

          <div
            className={clsx(
              styles.styleCard,
              durType === DurationType.Length && styles.styleCardOn,
            )}
          >
            <button
              type="button"
              className={styles.modeHead}
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
                <span
                  className={styles.miniFill}
                  style={{ inlineSize: "73%" }}
                />
              </span>
              <span className={styles.miniMeta}>
                <span>73% of passage</span>
                <span>0:28</span>
              </span>
            </button>
            {durType === DurationType.Length && (
              <div className={styles.modeExpand}>
                <span className={styles.seg}>
                  {lengthDurations.map(({ duration, label }) => (
                    <button
                      key={label}
                      type="button"
                      className={clsx(
                        styles.segItem,
                        isDur(duration) && styles.segOn,
                      )}
                      onClick={() => setDur(duration)}
                    >
                      {label}
                    </button>
                  ))}
                </span>
                <Stepper
                  value={durVal}
                  step={50}
                  min={50}
                  max={10000}
                  unit={charsUnit}
                  onChange={(chars) => setDur(lengthDuration(chars))}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
