import { LocalDate, type Result } from "@keylearn/result";
import { type Settings } from "@keylearn/settings";
import { lessonProps } from "./settings.ts";

export type DailyGoal = {
  /** Daily goal in minutes. */
  readonly goal: number;
  /** Progress in range [0, 1]. */
  readonly value: number;
};

/**
 * Minutes practised today, against the goal.
 *
 * Time is banked per day and "today" is resolved when the value is *read*,
 * rather than a single running total measured against a day captured when the
 * object was built. It used to be the latter, and the progress object is only
 * rebuilt when a setting changes — so anyone still practising after midnight
 * had every further lesson land outside yesterday's window, and the ring
 * simply stopped counting. Practising late is exactly when somebody is most
 * likely to be watching it.
 */
export class MutableDailyGoal implements DailyGoal {
  readonly #goal: number;
  /** Local date → milliseconds typed on it. */
  readonly #byDay = new Map<string, number>();
  readonly #now: () => number;

  constructor(settings: Settings, now: () => number = Date.now) {
    this.#goal = settings.get(lessonProps.dailyGoal);
    this.#now = now;
  }

  get goal(): number {
    return this.#goal;
  }

  get value(): number {
    return this.measure(this.#byDay.get(this.#today()) ?? 0);
  }

  #today(): string {
    return new LocalDate(this.#now()).value;
  }

  append(result: Result) {
    const day = new LocalDate(result.timeStamp).value;
    this.#byDay.set(day, (this.#byDay.get(day) ?? 0) + result.time);
  }

  measure(time: number): number {
    return this.#goal > 0 ? time / 1000 / 60 / this.#goal : 0;
  }

  copy(): DailyGoal {
    return { goal: this.#goal, value: this.value };
  }
}
