import { type LessonKey } from "@keybr/lesson";
import { type Result } from "@keybr/result";

export type NewLetterEvent = {
  readonly type: "new-letter";
  readonly lessonKey: LessonKey;
};

export type TopSpeedEvent = {
  readonly type: "top-speed";
  readonly speed: number;
  readonly previous: number;
};

export type TopScoreEvent = {
  readonly type: "top-score";
  readonly score: number;
  readonly previous: number;
};

export type TopConsistencyEvent = {
  readonly type: "top-consistency";
  readonly consistency: number;
  readonly previous: number;
};

export type TopAccuracyEvent = {
  readonly type: "top-accuracy";
  readonly accuracy: number;
  readonly previous: number;
};

export type BeatLastRunEvent = {
  readonly type: "beat-last-run";
  readonly score: number;
  readonly previous: number;
};

export type NearLastRunEvent = {
  readonly type: "near-last-run";
  /** How far behind the last run's score, as a whole-number percentage. */
  readonly gap: number;
};

export type DailyGoalEvent = {
  readonly type: "daily-goal";
};

export type LessonEvent =
  | NewLetterEvent
  | TopSpeedEvent
  | TopScoreEvent
  | TopConsistencyEvent
  | TopAccuracyEvent
  | BeatLastRunEvent
  | NearLastRunEvent
  | DailyGoalEvent;

export type LessonEventListener = (event: LessonEvent) => void;

export type LessonEventSource = {
  append(result: Result, listener: LessonEventListener): void;
};
