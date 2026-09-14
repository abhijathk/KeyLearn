import { loadWordList } from "@keylearn/content-words";
import { catchError } from "@keylearn/debug";
import { KeyboardOptions, useKeyboard } from "@keylearn/keyboard";
import { type Lesson } from "@keylearn/lesson";
import { type PhoneticModel } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import { useSettings } from "@keylearn/settings";
import { type ReactNode, useEffect, useState } from "react";
import { KidsLesson } from "./kids-lesson.ts";

/**
 * The kids' own loader.
 *
 * `LessonLoader` builds a `GuidedLesson` for `LessonType.GUIDED` and there is
 * no seam in it to hand back anything else — so rather than open one in shared
 * code, this loads the two things a guided lesson needs and builds the kids
 * class directly. Guided is the only lesson type this app offers, so the whole
 * switch the shared loader carries collapses to nothing here.
 */
export function KidsLessonLoader({
  children,
  fallback,
}: {
  readonly children: (lesson: Lesson) => ReactNode;
  readonly fallback?: ReactNode;
}): ReactNode {
  const { language } = KeyboardOptions.from(useSettings().settings);
  return (
    <PhoneticModelLoader language={language}>
      {(model) => (
        <KidsLoader model={model} fallback={fallback}>
          {children}
        </KidsLoader>
      )}
    </PhoneticModelLoader>
  );
}

function KidsLoader({
  model,
  children,
  fallback,
}: {
  readonly model: PhoneticModel;
  readonly children: (lesson: Lesson) => ReactNode;
  readonly fallback?: ReactNode;
}): ReactNode {
  const { settings } = useSettings();
  const keyboard = useKeyboard();
  const [lesson, setLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { language } = KeyboardOptions.from(settings);
    loadWordList(language)
      .then((wordList) => {
        if (!cancelled) {
          setLesson(new KidsLesson(settings, keyboard, model, wordList));
        }
      })
      .catch(catchError);
    return () => {
      cancelled = true;
    };
  }, [settings, keyboard, model]);

  return lesson == null ? fallback : children(lesson);
}
