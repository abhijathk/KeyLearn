import { type LessonKey, type LessonKeys } from "@keybr/lesson";
import { type Result, type StreakList, type SummaryStats } from "@keybr/result";
import { defineMessages, type MessageDescriptor } from "react-intl";

/**
 * The practice coach: from the learner's live stats it picks the single most
 * useful of six insights and returns a phrasing to show in the session panel.
 *
 * Each rule owns ~20 interchangeable phrasings (defined with `defineMessages`
 * so they're extracted for translation). Selection is deterministic per lesson
 * — the phrasing advances with the lesson count — so the line changes as you
 * practise without ever flickering mid-render. The chosen rule fills in the
 * learner's real keys and numbers through the returned `values`.
 */

export type CoachTip = {
  readonly message: MessageDescriptor;
  readonly values: Record<string, string | number>;
};

const NEAR_RECORD_CPM = 15; // ~3 wpm from the all-time best
const GOAL_WINDOW_MIN = 8; // "almost at today's goal" window
const UNLOCK_CONFIDENCE = 0.85; // a key this confident is close to unlocking
const WEAK_MARGIN = 0.03; // a key this far below your accuracy reads as weak
const MIN_KEY_SAMPLES = 8; // ignore keys you've barely typed

// ---- the phrasing bench: 6 rules × 20 -----------------------------------

const weak = defineMessages({
  m01: {
    id: "coach.weak.01",
    defaultMessage:
      "Your accuracy dips on {k1} and {k2} — ease off the throttle when they appear.",
  },
  m02: {
    id: "coach.weak.02",
    defaultMessage:
      "{k1} and {k2} are tripping you up — slow down just for those two.",
  },
  m03: {
    id: "coach.weak.03",
    defaultMessage: "Two keys are costing you: {k1} and {k2}. Aim, don’t rush.",
  },
  m04: {
    id: "coach.weak.04",
    defaultMessage:
      "Watch {k1} and {k2} — a beat slower on each, and you’re cleaner overall.",
  },
  m05: {
    id: "coach.weak.05",
    defaultMessage:
      "{k1} and {k2} miss most often. Give them a moment before you strike.",
  },
  m06: {
    id: "coach.weak.06",
    defaultMessage:
      "Your fingers hesitate on {k1} and {k2} — steady beats fast here.",
  },
  m07: {
    id: "coach.weak.07",
    defaultMessage:
      "Most of your slips are {k1} and {k2}. Precision first, speed follows.",
  },
  m08: {
    id: "coach.weak.08",
    defaultMessage:
      "{k1} and {k2} are your leaky keys today — patch them and the score lifts.",
  },
  m09: {
    id: "coach.weak.09",
    defaultMessage:
      "Ease into {k1} and {k2}; the rest of your typing is solid.",
  },
  m10: {
    id: "coach.weak.10",
    defaultMessage:
      "{k1} and {k2} keep sneaking errors in — deliberate taps win.",
  },
  m11: {
    id: "coach.weak.11",
    defaultMessage: "Slow is smooth on {k1} and {k2}, and smooth is fast.",
  },
  m12: {
    id: "coach.weak.12",
    defaultMessage:
      "Trouble spots today: {k1} and {k2}. Nail those and accuracy jumps.",
  },
  m13: {
    id: "coach.weak.13",
    defaultMessage:
      "{k1} and {k2} need a lighter touch — you’re overshooting them.",
  },
  m14: {
    id: "coach.weak.14",
    defaultMessage:
      "Give {k1} and {k2} a half-beat more; your accuracy will thank you.",
  },
  m15: {
    id: "coach.weak.15",
    defaultMessage:
      "Your weakest pair right now is {k1} and {k2}. Focus lands them.",
  },
  m16: {
    id: "coach.weak.16",
    defaultMessage:
      "Errors cluster on {k1} and {k2} — type them like you mean it.",
  },
  m17: {
    id: "coach.weak.17",
    defaultMessage:
      "{k1} and {k2} are the difference between good and clean today.",
  },
  m18: {
    id: "coach.weak.18",
    defaultMessage:
      "A touch more care on {k1} and {k2} and you’re near-flawless.",
  },
  m19: {
    id: "coach.weak.19",
    defaultMessage:
      "{k1} and {k2} are dragging your accuracy — reclaim them one tap at a time.",
  },
  m20: {
    id: "coach.weak.20",
    defaultMessage:
      "Keep an eye on {k1} and {k2}; everything else is dialed in.",
  },
});

const recordTip = defineMessages({
  m01: {
    id: "coach.record.01",
    defaultMessage: "You’re {n} wpm from your record. One clean run does it.",
  },
  m02: {
    id: "coach.record.02",
    defaultMessage: "Your best is only {n} wpm away — go get it.",
  },
  m03: {
    id: "coach.record.03",
    defaultMessage: "{n} wpm stands between you and a new personal best.",
  },
  m04: {
    id: "coach.record.04",
    defaultMessage: "So close: {n} wpm from your fastest ever.",
  },
  m05: {
    id: "coach.record.05",
    defaultMessage:
      "A single strong lesson and that record falls — {n} wpm to go.",
  },
  m06: {
    id: "coach.record.06",
    defaultMessage: "Your record’s in reach — just {n} wpm more.",
  },
  m07: {
    id: "coach.record.07",
    defaultMessage: "{n} wpm. That’s all that’s left to beat your best.",
  },
  m08: {
    id: "coach.record.08",
    defaultMessage: "You’ve never been this close — {n} wpm from the top.",
  },
  m09: {
    id: "coach.record.09",
    defaultMessage: "One focused burst clears the last {n} wpm to your record.",
  },
  m10: {
    id: "coach.record.10",
    defaultMessage: "Your personal best is within sight: {n} wpm away.",
  },
  m11: {
    id: "coach.record.11",
    defaultMessage: "Push a little — {n} wpm and the record is yours.",
  },
  m12: {
    id: "coach.record.12",
    defaultMessage: "{n} wpm separates today from your best day ever.",
  },
  m13: {
    id: "coach.record.13",
    defaultMessage: "The record is right there, {n} wpm out. Reach for it.",
  },
  m14: {
    id: "coach.record.14",
    defaultMessage: "Almost a personal best — {n} wpm short.",
  },
  m15: {
    id: "coach.record.15",
    defaultMessage: "Close the gap: {n} wpm to a new record.",
  },
  m16: {
    id: "coach.record.16",
    defaultMessage: "Your fastest self is {n} wpm ahead. Catch up.",
  },
  m17: {
    id: "coach.record.17",
    defaultMessage: "{n} wpm from a milestone — one clean lesson.",
  },
  m18: {
    id: "coach.record.18",
    defaultMessage: "You’re knocking on your record’s door: {n} wpm.",
  },
  m19: {
    id: "coach.record.19",
    defaultMessage: "Nearly there — {n} wpm from your all-time best.",
  },
  m20: {
    id: "coach.record.20",
    defaultMessage: "Beat yourself today: {n} wpm to the record.",
  },
});

const unlock = defineMessages({
  m01: {
    id: "coach.unlock.01",
    defaultMessage:
      "{n} keys are close to unlocking — one focused session clears them.",
  },
  m02: {
    id: "coach.unlock.02",
    defaultMessage: "You’re on the edge of unlocking {n} keys. Keep pushing.",
  },
  m03: {
    id: "coach.unlock.03",
    defaultMessage: "{n} new keys are almost yours — finish the job.",
  },
  m04: {
    id: "coach.unlock.04",
    defaultMessage: "So near: {n} keys are about to open up.",
  },
  m05: {
    id: "coach.unlock.05",
    defaultMessage: "A little more and {n} keys join your alphabet.",
  },
  m06: {
    id: "coach.unlock.06",
    defaultMessage:
      "{n} keys are ripening — a few clean lessons and they’re unlocked.",
  },
  m07: {
    id: "coach.unlock.07",
    defaultMessage: "Your next {n} keys are within reach. Don’t stop now.",
  },
  m08: {
    id: "coach.unlock.08",
    defaultMessage: "{n} keys are hovering at the threshold — nudge them over.",
  },
  m09: {
    id: "coach.unlock.09",
    defaultMessage:
      "Keep going — {n} keys are one good stretch from unlocking.",
  },
  m10: {
    id: "coach.unlock.10",
    defaultMessage: "{n} keys are almost ready to join the fold.",
  },
  m11: {
    id: "coach.unlock.11",
    defaultMessage: "You’re about to grow your alphabet by {n}. Push through.",
  },
  m12: {
    id: "coach.unlock.12",
    defaultMessage:
      "{n} keys are queued to unlock — clear them in one sitting.",
  },
  m13: {
    id: "coach.unlock.13",
    defaultMessage: "The next {n} keys are close enough to taste.",
  },
  m14: {
    id: "coach.unlock.14",
    defaultMessage: "Almost there: {n} keys stand ready to open.",
  },
  m15: {
    id: "coach.unlock.15",
    defaultMessage: "{n} keys are on the verge — a focused run sets them free.",
  },
  m16: {
    id: "coach.unlock.16",
    defaultMessage: "Unlock momentum: {n} keys are nearly there.",
  },
  m17: {
    id: "coach.unlock.17",
    defaultMessage: "{n} keys are warming up to join you. Keep at it.",
  },
  m18: {
    id: "coach.unlock.18",
    defaultMessage: "So close to {n} more keys — finish strong.",
  },
  m19: {
    id: "coach.unlock.19",
    defaultMessage: "{n} keys are one confident session from unlocking.",
  },
  m20: {
    id: "coach.unlock.20",
    defaultMessage: "Your alphabet’s about to grow by {n}. Go claim them.",
  },
});

const accuracy = defineMessages({
  m01: {
    id: "coach.accuracy.01",
    defaultMessage:
      "Accuracy beats speed here — slowing 10% would lift your score.",
  },
  m02: {
    id: "coach.accuracy.02",
    defaultMessage: "You’re racing past your accuracy. Ease up and score more.",
  },
  m03: {
    id: "coach.accuracy.03",
    defaultMessage: "Clean is worth more than quick right now — steady wins.",
  },
  m04: {
    id: "coach.accuracy.04",
    defaultMessage:
      "Your errors are costing more than your slow keys. Aim first.",
  },
  m05: {
    id: "coach.accuracy.05",
    defaultMessage:
      "Trade a little speed for precision and watch the score climb.",
  },
  m06: {
    id: "coach.accuracy.06",
    defaultMessage: "Slow down 10% — you’ll finish cleaner and score higher.",
  },
  m07: {
    id: "coach.accuracy.07",
    defaultMessage:
      "Speed’s fine; it’s the misses hurting you. Type deliberately.",
  },
  m08: {
    id: "coach.accuracy.08",
    defaultMessage: "Precision pays better than pace today. Take your time.",
  },
  m09: {
    id: "coach.accuracy.09",
    defaultMessage:
      "Fewer errors, higher score — back off the throttle a touch.",
  },
  m10: {
    id: "coach.accuracy.10",
    defaultMessage: "You’ve got the speed. Now spend it on accuracy.",
  },
  m11: {
    id: "coach.accuracy.11",
    defaultMessage: "The mistakes are the leak, not the tempo. Patch them.",
  },
  m12: {
    id: "coach.accuracy.12",
    defaultMessage: "Ease off and let accuracy do the scoring for you.",
  },
  m13: {
    id: "coach.accuracy.13",
    defaultMessage: "Right now, careful outscores fast. Choose careful.",
  },
  m14: {
    id: "coach.accuracy.14",
    defaultMessage:
      "Your score is bleeding from errors — slow, clean strokes fix it.",
  },
  m15: {
    id: "coach.accuracy.15",
    defaultMessage:
      "Don’t outrun your accuracy. Match your speed to your control.",
  },
  m16: {
    id: "coach.accuracy.16",
    defaultMessage: "A calmer pace here means a cleaner sheet and more points.",
  },
  m17: {
    id: "coach.accuracy.17",
    defaultMessage: "Score more by missing less — ease the speed a notch.",
  },
  m18: {
    id: "coach.accuracy.18",
    defaultMessage:
      "Accuracy is your cheapest win today. Slow just enough to take it.",
  },
  m19: {
    id: "coach.accuracy.19",
    defaultMessage: "Let precision lead; speed will catch up on its own.",
  },
  m20: {
    id: "coach.accuracy.20",
    defaultMessage:
      "You’re leaving points on the table with rushed keys. Steady up.",
  },
});

const goal = defineMessages({
  m01: {
    id: "coach.goal.01",
    defaultMessage: "{n} more minutes hits today’s goal.",
  },
  m02: {
    id: "coach.goal.02",
    defaultMessage: "Just {n} minutes of typing and today’s done.",
  },
  m03: {
    id: "coach.goal.03",
    defaultMessage: "You’re {n} minutes from closing today’s ring.",
  },
  m04: {
    id: "coach.goal.04",
    defaultMessage: "Nearly there — {n} minutes to your daily goal.",
  },
  m05: {
    id: "coach.goal.05",
    defaultMessage: "{n} minutes left to finish today strong.",
  },
  m06: {
    id: "coach.goal.06",
    defaultMessage: "Round out the day: {n} more minutes.",
  },
  m07: {
    id: "coach.goal.07",
    defaultMessage: "{n} minutes stands between you and today’s goal.",
  },
  m08: {
    id: "coach.goal.08",
    defaultMessage: "Almost done for today — {n} minutes to go.",
  },
  m09: {
    id: "coach.goal.09",
    defaultMessage: "Give it {n} more minutes and the day is complete.",
  },
  m10: {
    id: "coach.goal.10",
    defaultMessage: "{n} minutes from a full day’s practice.",
  },
  m11: {
    id: "coach.goal.11",
    defaultMessage: "Close today out — only {n} minutes remain.",
  },
  m12: {
    id: "coach.goal.12",
    defaultMessage: "You’re within {n} minutes of your goal. Keep typing.",
  },
  m13: {
    id: "coach.goal.13",
    defaultMessage: "A short {n} minutes and today’s target is met.",
  },
  m14: {
    id: "coach.goal.14",
    defaultMessage: "{n} minutes more and you’ve kept the habit alive.",
  },
  m15: {
    id: "coach.goal.15",
    defaultMessage: "Finish the day: {n} minutes to your goal.",
  },
  m16: {
    id: "coach.goal.16",
    defaultMessage: "So close to today’s goal — {n} minutes.",
  },
  m17: {
    id: "coach.goal.17",
    defaultMessage: "{n} minutes left. One more lesson likely does it.",
  },
  m18: {
    id: "coach.goal.18",
    defaultMessage: "Seal today with {n} more minutes at the keys.",
  },
  m19: {
    id: "coach.goal.19",
    defaultMessage: "Today’s goal is {n} minutes away. Go get it.",
  },
  m20: {
    id: "coach.goal.20",
    defaultMessage: "{n} minutes to go — don’t leave today unfinished.",
  },
});

const streak = defineMessages({
  m01: {
    id: "coach.streak.01",
    defaultMessage: "One accurate lesson extends your {n}-streak.",
  },
  m02: {
    id: "coach.streak.02",
    defaultMessage: "Keep the streak alive — a clean lesson builds on {n}.",
  },
  m03: {
    id: "coach.streak.03",
    defaultMessage: "Your {n}-lesson streak is on the line. Protect it.",
  },
  m04: {
    id: "coach.streak.04",
    defaultMessage: "Don’t break the chain — {n} clean lessons and counting.",
  },
  m05: {
    id: "coach.streak.05",
    defaultMessage: "{n} in a row. Type one more to keep it going.",
  },
  m06: {
    id: "coach.streak.06",
    defaultMessage: "Your streak’s at {n} — one more accurate run holds it.",
  },
  m07: {
    id: "coach.streak.07",
    defaultMessage: "Guard your {n}-streak with a single clean lesson.",
  },
  m08: {
    id: "coach.streak.08",
    defaultMessage: "{n} accurate lessons strong. Make it one more.",
  },
  m09: {
    id: "coach.streak.09",
    defaultMessage: "A streak of {n} is worth defending — go again.",
  },
  m10: {
    id: "coach.streak.10",
    defaultMessage: "You’re at {n} clean lessons — one more grows the run.",
  },
  m11: {
    id: "coach.streak.11",
    defaultMessage: "Keep the fire lit: {n} and climbing.",
  },
  m12: {
    id: "coach.streak.12",
    defaultMessage: "Your {n}-run is alive — feed it one more lesson.",
  },
  m13: {
    id: "coach.streak.13",
    defaultMessage: "Don’t let {n} slip — a clean lesson secures it.",
  },
  m14: {
    id: "coach.streak.14",
    defaultMessage: "{n} lessons without breaking. Keep the run rolling.",
  },
  m15: {
    id: "coach.streak.15",
    defaultMessage: "Extend the streak past {n} with one focused lesson.",
  },
  m16: {
    id: "coach.streak.16",
    defaultMessage: "Your chain reads {n}. Add a link.",
  },
  m17: {
    id: "coach.streak.17",
    defaultMessage: "A single accurate lesson and the streak grows past {n}.",
  },
  m18: {
    id: "coach.streak.18",
    defaultMessage: "{n} deep and holding — one more keeps it.",
  },
  m19: {
    id: "coach.streak.19",
    defaultMessage: "Protect the {n}-streak; you’ve earned it.",
  },
  m20: {
    id: "coach.streak.20",
    defaultMessage: "Stay unbroken — {n} lessons and one more to go.",
  },
});

function pool(group: Record<string, MessageDescriptor>): MessageDescriptor[] {
  return Object.values(group);
}

// ---- rule evaluation -----------------------------------------------------

/**
 * The two keys with the lowest accuracy that sit meaningfully below the
 * learner's overall accuracy (and have enough samples to trust). Recency is
 * approximated by using each key's whole sample set — the guided lesson keeps
 * only a rolling window anyway.
 */
function weakestKeys(
  lessonKeys: LessonKeys,
  overallAccuracy: number,
): LessonKey[] {
  const scored: { key: LessonKey; acc: number }[] = [];
  for (const key of lessonKeys) {
    if (!key.isIncluded) {
      continue;
    }
    let hit = 0;
    let miss = 0;
    for (const s of key.samples) {
      hit += s.hitCount;
      miss += s.missCount;
    }
    const n = hit + miss;
    if (n < MIN_KEY_SAMPLES) {
      continue;
    }
    const acc = hit / n;
    if (acc <= overallAccuracy - WEAK_MARGIN) {
      scored.push({ key, acc });
    }
  }
  scored.sort((a, b) => a.acc - b.acc);
  return scored.slice(0, 2).map(({ key }) => key);
}

function nearUnlockCount(lessonKeys: LessonKeys): number {
  let n = 0;
  for (const key of lessonKeys) {
    if (
      key.isIncluded &&
      key.confidence != null &&
      key.confidence >= UNLOCK_CONFIDENCE &&
      key.confidence < 1
    ) {
      n += 1;
    }
  }
  return n;
}

function bestStreakRun(streakList: StreakList): number {
  let best = 0;
  for (const { results } of streakList) {
    if (results.length > best) {
      best = results.length;
    }
  }
  return best;
}

export type CoachInput = {
  readonly results: readonly Result[];
  readonly summaryStats: SummaryStats;
  readonly lessonKeys: LessonKeys;
  readonly streakList: StreakList;
  readonly sessionStartMs: number;
  /** minutes still needed to hit today's goal, or null when there's no goal. */
  readonly goalMinutesLeft: number | null;
  /** all-time best speed and recent-average speed, in the display's cpm base. */
  readonly formatWpmDelta: (cpm: number) => number;
};

/**
 * Evaluate the rules in priority order and return the first that fires, with a
 * phrasing chosen deterministically from that rule's bench. Priority favours
 * timely, proximal wins (finish today's goal, break a record) over general
 * coaching, and always falls back to an accuracy nudge so the strip is never
 * empty.
 */
export function pickCoachTip(input: CoachInput): CoachTip {
  const {
    results,
    summaryStats,
    lessonKeys,
    streakList,
    sessionStartMs,
    goalMinutesLeft,
    formatWpmDelta,
  } = input;

  // The phrasing index advances with the lesson count, so the wording shifts
  // as you practise but stays stable within a single render.
  const spin = results.length;
  const pick = (
    group: Record<string, MessageDescriptor>,
  ): MessageDescriptor => {
    const p = pool(group);
    return p[spin % p.length];
  };

  const recent = results.slice(-20);
  const recentAccuracy =
    recent.length > 0
      ? recent.reduce((s, r) => s + r.accuracy, 0) / recent.length
      : 1;

  // 1 · Today's goal is a few minutes away — timely and satisfying to close.
  if (
    goalMinutesLeft != null &&
    goalMinutesLeft > 0 &&
    goalMinutesLeft <= GOAL_WINDOW_MIN
  ) {
    return { message: pick(goal), values: { n: goalMinutesLeft } };
  }

  // 2 · A personal best is within a hair — the most exciting proximal goal.
  const session = results.filter((r) => r.timeStamp >= sessionStartMs);
  const sessionBest = session.reduce((m, r) => Math.max(m, r.speed), 0);
  const recordCpm = summaryStats.speed.max;
  if (
    sessionBest > 0 &&
    recordCpm > sessionBest &&
    recordCpm - sessionBest <= NEAR_RECORD_CPM
  ) {
    const wpm = Math.max(
      1,
      Math.round(formatWpmDelta(recordCpm - sessionBest)),
    );
    return { message: pick(recordTip), values: { n: wpm } };
  }

  // 3 · A cluster of keys is close to unlocking — visible forward progress.
  const nearby = nearUnlockCount(lessonKeys);
  if (nearby >= 2) {
    return { message: pick(unlock), values: { n: nearby } };
  }

  // 4 · Accuracy is soft — the cheapest points on the table right now.
  if (recent.length >= 3 && recentAccuracy < 0.95) {
    return { message: pick(accuracy), values: {} };
  }

  // 5 · A meaningful accuracy streak worth protecting.
  const run = bestStreakRun(streakList);
  if (run >= 3) {
    return { message: pick(streak), values: { n: run } };
  }

  // 6 · Two identifiable weak keys to work on.
  const weakKeys = weakestKeys(lessonKeys, summaryStats.accuracy.avg || 1);
  if (weakKeys.length === 2) {
    return {
      message: pick(weak),
      values: {
        k1: String(weakKeys[0].letter.label),
        k2: String(weakKeys[1].letter.label),
      },
    };
  }

  // Fallback — a gentle accuracy nudge, always available so the strip is
  // never empty.
  return { message: pick(accuracy), values: {} };
}
