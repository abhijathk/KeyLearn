import { codeThemeFor, codeThemeVars } from "@keybr/content-snippets";
import { type Lesson, lessonProps, LessonType } from "@keybr/lesson";
import { CurrentKeyRow, LetterJourney } from "@keybr/lesson-ui";
import { LCG } from "@keybr/rand";
import { makeKeyStatsMap, useResults } from "@keybr/result";
import { type Settings, useSettings } from "@keybr/settings";
import {
  TextInput,
  toTextDisplaySettings,
  toTextInputSettings,
} from "@keybr/textinput";
import { StaticText } from "@keybr/textinput-ui";
import { FieldSet } from "@keybr/widget";
import { clsx } from "clsx";
import { type CSSProperties, type ReactNode, useMemo } from "react";
import { useIntl } from "react-intl";
import * as styles from "./LessonPreview.module.less";

function isCode(settings: Settings): boolean {
  return settings.get(lessonProps.type) === LessonType.CODE;
}

function themed(settings: Settings): boolean {
  return (
    settings.get(lessonProps.type) === LessonType.CODE &&
    settings.get(lessonProps.code.themeBackground) &&
    codeThemeFor(settings.get(lessonProps.code.theme)) != null
  );
}

/** The chosen editor palette, or nothing when the lesson is not code. */
function themeStyle(settings: Settings): CSSProperties {
  if (settings.get(lessonProps.type) !== LessonType.CODE) {
    return {};
  }
  const theme = codeThemeFor(settings.get(lessonProps.code.theme));
  return theme != null ? (codeThemeVars(theme) as CSSProperties) : {};
}

export function LessonPreview({
  lesson,
}: {
  readonly lesson: Lesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { settings } = useSettings();
  const { results } = useResults();
  const { lessonKeys, textInput } = useMemo(() => {
    const lessonKeys = lesson.update(
      makeKeyStatsMap(lesson.letters, lesson.filter(results)),
    );
    const textInput = new TextInput(
      lesson.generate(lessonKeys, LCG(123)),
      toTextInputSettings(settings),
    );
    return { lessonKeys, textInput };
  }, [settings, lesson, results]);
  // Code and number lessons put every key in play from the start, so the
  // alphabet journey and the current-key row have nothing to report — they just
  // draw a full bar and "32/32" under every lesson. The preview is worth more
  // showing only the text.
  const growsAnAlphabet =
    lessonKeys.findIncludedKeys().length < lessonKeys.letters.length;
  return (
    <FieldSet
      legend={formatMessage({
        id: "t_Lesson_preview:",
        defaultMessage: "Preview of your lesson",
      })}
    >
      <div className={styles.root}>
        {growsAnAlphabet && (
          <>
            <LetterJourney lessonKeys={lessonKeys} />
            <CurrentKeyRow lessonKeys={lessonKeys} />
          </>
        )}
        {/* The palette applies here too. Choosing a colour scheme you cannot
            see until you close the panel is not choosing. */}
        <div
          className={clsx(
            styles.text,
            isCode(settings) && styles.codeText,
            themed(settings) && styles.themedText,
          )}
          style={themeStyle(settings)}
        >
          <StaticText
            settings={toTextDisplaySettings(settings)}
            lines={textInput.lines}
            lineNumbers={isCode(settings)}
          />
        </div>
      </div>
    </FieldSet>
  );
}
