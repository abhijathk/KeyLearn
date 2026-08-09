import { keyboardProps, type KeyId } from "@keylearn/keyboard";
import {
  type DailyGoal,
  GuidedLesson,
  Lesson,
  type LessonKeys,
  lessonProps,
} from "@keylearn/lesson";
import {
  type KeyStatsMap,
  Result,
  type StreakList,
  type SummaryStats,
} from "@keylearn/result";
import { type Settings } from "@keylearn/settings";
import {
  type Feedback,
  type LineList,
  makeStats,
  type StyledText,
  type TextDisplaySettings,
  TextInput,
  type TextInputSettings,
  toTextDisplaySettings,
  toTextInputSettings,
} from "@keylearn/textinput";
import { type IInputEvent } from "@keylearn/textinput-events";
import { type CodePoint } from "@keylearn/unicode";
import { type LastLesson } from "./last-lesson.ts";
import { type Progress } from "./progress.ts";

export class LessonState {
  readonly #onResult: (result: Result, textInput: TextInput) => void;
  readonly settings: Settings;
  readonly lesson: Lesson;
  readonly textInputSettings: TextInputSettings;
  readonly textDisplaySettings: TextDisplaySettings;
  readonly keyStatsMap: KeyStatsMap;
  readonly summaryStats: SummaryStats;
  readonly streakList: StreakList;
  readonly dailyGoal: DailyGoal;
  readonly lessonKeys: LessonKeys;
  /** The previous run's ghost timeline captured before this round, if any. */
  readonly lastRunMarks: readonly number[] | null;
  /**
   * The slow key-pair this round is steering toward, if any.
   *
   * Kept rather than discarded because it is the one thing a plateaued learner
   * most needs told: past the first weeks the drag is almost never a letter,
   * it is a join between two of them. The tracker computed it, used it to aim
   * the lesson, and then threw it away — so the insight existed and only the
   * profile page ever showed it.
   */
  // Set during construction, alongside the focus it drives.
  bottleneck: { readonly from: number; readonly to: number } | null = null;

  lastLesson: LastLesson | null = null;

  textInput!: TextInput; // Mutable.
  lines!: LineList; // Mutable.
  suffix!: readonly CodePoint[]; // Mutable.
  depressedKeys: readonly KeyId[] = []; // Mutable.

  constructor(
    progress: Progress,
    onResult: (result: Result, textInput: TextInput) => void,
  ) {
    this.#onResult = onResult;
    this.settings = progress.settings;
    this.lesson = progress.lesson;
    this.textInputSettings = toTextInputSettings(this.settings);
    this.textDisplaySettings = toTextDisplaySettings(this.settings);
    this.keyStatsMap = progress.keyStatsMap.copy();
    this.summaryStats = progress.summaryStats.copy();
    this.streakList = progress.streakList.copy();
    this.dailyGoal = progress.dailyGoal.copy();
    this.lastRunMarks = progress.lastRun?.marks ?? null;
    this.lessonKeys = this.lesson.update(this.keyStatsMap);
    this.#applyBottleneckFocus(progress);
    this.#reset(this.lesson.generate(this.lessonKeys, Lesson.rng));
  }

  // Transition-aware targeting: when a slow key-pair (bigram bottleneck) is
  // found among the included keys, focus the pair's destination key so the
  // generated words feature it in context — drilling the awkward transition.
  #applyBottleneckFocus(progress: Progress) {
    if (
      !(this.lesson instanceof GuidedLesson) ||
      !this.settings.get(lessonProps.guided.bottleneckDrill)
    ) {
      return;
    }
    const included = this.lessonKeys.findIncludedKeys();
    const among = new Set(included.map(({ letter }) => letter.codePoint));
    const worst = progress.bigrams.worst(among);
    if (worst != null) {
      this.bottleneck = { from: worst.from, to: worst.to };
      const target = included.find(
        ({ letter }) => letter.codePoint === worst.to,
      );
      if (target != null) {
        this.lessonKeys.focus(target.letter);
      }
    }
  }

  resetLesson() {
    this.#reset(this.textInput.text);
  }

  skipLesson() {
    this.#reset(this.lesson.generate(this.lessonKeys, Lesson.rng));
  }

  onInput(event: IInputEvent): Feedback {
    const feedback = this.textInput.onInput(event);
    this.lines = this.textInput.lines;
    this.suffix = this.textInput.remaining.map(({ codePoint }) => codePoint);
    if (this.textInput.completed) {
      this.#onResult(this.#makeResult(), this.textInput);
    }
    return feedback;
  }

  #reset(fragment: StyledText) {
    this.textInput = new TextInput(fragment, this.textInputSettings);
    this.lines = this.textInput.lines;
    this.suffix = this.textInput.remaining.map(({ codePoint }) => codePoint);
  }

  /**
   * The lesson as it stands, unfinished.
   *
   * Built exactly the way the completed one is, so a timed run that stops
   * mid-line is scored by the same rules as every other line — including
   * `validate`, which is what rejects a handful of keystrokes as too little to
   * draw a speed from.
   */
  partialResult(): Result | null {
    return this.textInput.steps.length > 0 ? this.#makeResult() : null;
  }

  #makeResult(timeStamp = Date.now()) {
    return Result.fromStats(
      this.settings.get(keyboardProps.layout),
      this.settings.get(lessonProps.type).textType,
      timeStamp,
      makeStats(this.textInput.steps),
    );
  }
}
