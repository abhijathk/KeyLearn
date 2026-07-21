import { LetterJourney } from "@keybr/lesson-ui";
import { type ReactNode } from "react";
import { makeExampleLesson } from "./examples.ts";

export function KeySetIllustration({
  confidences,
}: {
  readonly confidences: readonly (number | null)[];
}): ReactNode {
  return <LetterJourney lessonKeys={makeExampleLesson(confidences)} />;
}
