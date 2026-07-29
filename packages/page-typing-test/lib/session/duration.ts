import { computeSpeed, type Step } from "@keybr/textinput";
import { type Duration, DurationType, type Progress } from "./types.ts";

export function timeDuration(time: number): Duration {
  return { type: DurationType.Time, value: time };
}

export function lengthDuration(length: number): Duration {
  return { type: DurationType.Length, value: length };
}

export function wordsDuration(words: number): Duration {
  return { type: DurationType.Words, value: words };
}

export const duration_15_seconds = timeDuration(15_000);
export const duration_30_seconds = timeDuration(30_000);
export const duration_60_seconds = timeDuration(60_000);
export const duration_120_seconds = timeDuration(120_000);
export const duration_10_words = wordsDuration(10);
export const duration_25_words = wordsDuration(25);
export const duration_50_words = wordsDuration(50);
export const duration_100_chars = lengthDuration(100);
export const duration_500_chars = lengthDuration(500);
export const duration_1000_chars = lengthDuration(1000);

export type NamedDuration = {
  readonly label: string;
  readonly duration: Duration;
};

// Grouped for the settings picker: Time and Words. (Character-count durations
// stay supported for back-compat but are no longer surfaced.)
export const timeDurations: readonly NamedDuration[] = [
  { label: "15s", duration: duration_15_seconds },
  { label: "30s", duration: duration_30_seconds },
  { label: "60s", duration: duration_60_seconds },
  { label: "2m", duration: duration_120_seconds },
];

export const wordDurations: readonly NamedDuration[] = [
  { label: "10 words", duration: duration_10_words },
  { label: "25 words", duration: duration_25_words },
  { label: "50 words", duration: duration_50_words },
];

export const durations: readonly NamedDuration[] = [
  ...timeDurations,
  ...wordDurations,
];

export function computeProgress(
  duration: Duration,
  steps: readonly Step[],
): { progress: Progress; completed: boolean } {
  const { length } = steps;
  let time = 0;
  let progress = 0;
  let speed = 0;
  let completed = false;
  if (length > 0) {
    const head = steps[0];
    const curr = steps[length - 1];
    time = curr.timeStamp - head.timeStamp;
    speed = computeSpeed(length, time);
    switch (duration.type) {
      case DurationType.Time: {
        progress = time / duration.value;
        completed = time >= duration.value;
        break;
      }
      case DurationType.Length: {
        progress = length / duration.value;
        completed = length >= duration.value;
        break;
      }
      case DurationType.Words: {
        // A word completes on each space typed.
        let words = 0;
        for (const step of steps) {
          if (step.codePoint === 0x20) {
            words += 1;
          }
        }
        progress = words / duration.value;
        completed = words >= duration.value;
        break;
      }
    }
  }
  return {
    progress: {
      time,
      length,
      progress,
      speed,
    },
    completed,
  };
}
