import { defineMessages, type MessageDescriptor } from "react-intl";

// Comprehensive copy pools for the goal-report window. One line is picked at
// random each time the window opens, so it never feels canned. All lines are
// translatable; the quotes are kept in the original language on purpose.

const roll = defineMessages({
  m1: {
    id: "goalReport.roll.1",
    defaultMessage: "You’re on a roll — one more while your hands are warm?",
  },
  m2: {
    id: "goalReport.roll.2",
    defaultMessage: "Nice momentum. Perfect moment for one more.",
  },
  m3: {
    id: "goalReport.roll.3",
    defaultMessage: "That felt smooth. Ride it — go again?",
  },
  m4: {
    id: "goalReport.roll.4",
    defaultMessage: "Your fingers are dialled in right now.",
  },
  m5: {
    id: "goalReport.roll.5",
    defaultMessage: "Great rhythm today. One more won’t hurt.",
  },
  m6: {
    id: "goalReport.roll.6",
    defaultMessage: "You’re in the zone — the best time for another.",
  },
  m7: {
    id: "goalReport.roll.7",
    defaultMessage: "Muscle memory is forming. Lock it in with one more.",
  },
  m8: {
    id: "goalReport.roll.8",
    defaultMessage: "Warmed up and flying. Keep it rolling?",
  },
  m9: {
    id: "goalReport.roll.9",
    defaultMessage: "Every extra rep sharpens the edge.",
  },
  m10: {
    id: "goalReport.roll.10",
    defaultMessage: "Your best runs often come right after the goal.",
  },
  m11: {
    id: "goalReport.roll.11",
    defaultMessage: "The keys are cooperating today. Press on?",
  },
  m12: {
    id: "goalReport.roll.12",
    defaultMessage: "Goal met — now the fun part. One more?",
  },
  m13: {
    id: "goalReport.roll.13",
    defaultMessage: "You’ve got the touch today. Another round?",
  },
  m14: {
    id: "goalReport.roll.14",
    defaultMessage: "Feeling good beats feeling done. Keep going?",
  },
});

const restMain = defineMessages({
  m1: {
    id: "goalReport.rest.main.1",
    defaultMessage:
      "Over an hour today — nicely done. Time to rest your hands.",
  },
  m2: {
    id: "goalReport.rest.main.2",
    defaultMessage: "That’s a solid session. Your hands have earned a break.",
  },
  m3: {
    id: "goalReport.rest.main.3",
    defaultMessage: "Big session today. Rest now so tomorrow feels fresh.",
  },
  m4: {
    id: "goalReport.rest.main.4",
    defaultMessage: "You’ve put in real work — give those fingers a breather.",
  },
  m5: {
    id: "goalReport.rest.main.5",
    defaultMessage: "Plenty done. The best typists rest, too.",
  },
  m6: {
    id: "goalReport.rest.main.6",
    defaultMessage: "Step away while it still feels good — you’ve done plenty.",
  },
  m7: {
    id: "goalReport.rest.main.7",
    defaultMessage: "Great grind. Let your hands recover for tomorrow.",
  },
  m8: {
    id: "goalReport.rest.main.8",
    defaultMessage: "You’ve more than hit the mark — time to unwind.",
  },
  m9: {
    id: "goalReport.rest.main.9",
    defaultMessage: "Long session! Rest is what makes it stick.",
  },
  m10: {
    id: "goalReport.rest.main.10",
    defaultMessage: "That’s enough for one day — and it was a good one.",
  },
});

const restSub = defineMessages({
  m1: {
    id: "goalReport.rest.sub.1",
    defaultMessage: "Come back fresh tomorrow — you’ll be quicker for it.",
  },
  m2: {
    id: "goalReport.rest.sub.2",
    defaultMessage: "Sleep on it; memory settles while you rest.",
  },
  m3: {
    id: "goalReport.rest.sub.3",
    defaultMessage: "Short breaks beat long strains. See you tomorrow.",
  },
  m4: {
    id: "goalReport.rest.sub.4",
    defaultMessage: "Rest is part of training, not a break from it.",
  },
  m5: {
    id: "goalReport.rest.sub.5",
    defaultMessage: "Your progress will be right here waiting.",
  },
  m6: {
    id: "goalReport.rest.sub.6",
    defaultMessage: "Stretch your fingers and call it a win.",
  },
});

export const ROLL_LINES: MessageDescriptor[] = Object.values(roll);
export const REST_MAIN_LINES: MessageDescriptor[] = Object.values(restMain);
export const REST_SUB_LINES: MessageDescriptor[] = Object.values(restSub);

// Motivational quotes — kept in the original language, with attribution.
export const QUOTES: ReadonlyArray<{ text: string; who: string }> = [
  { text: "Small strokes fell great oaks.", who: "Benjamin Franklin" },
  {
    text: "It does not matter how slowly you go as long as you do not stop.",
    who: "Confucius",
  },
  {
    text: "Practice isn't the thing you do once you're good. It's the thing that makes you good.",
    who: "Malcolm Gladwell",
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    who: "Will Durant",
  },
  {
    text: "The secret of getting ahead is getting started.",
    who: "Mark Twain",
  },
  { text: "Little by little, one travels far.", who: "J. R. R. Tolkien" },
  {
    text: "Success is the sum of small efforts repeated day in and day out.",
    who: "Robert Collier",
  },
  { text: "Repetition is the mother of skill.", who: "Tony Robbins" },
  {
    text: "Continuous improvement is better than delayed perfection.",
    who: "Mark Twain",
  },
  {
    text: "You don't have to be great to start, but you have to start to be great.",
    who: "Zig Ziglar",
  },
  { text: "Slow is smooth, and smooth is fast.", who: "Proverb" },
  {
    text: "Fall in love with the process, and the results will come.",
    who: "Eric Thomas",
  },
  { text: "The expert in anything was once a beginner.", who: "Helen Hayes" },
];

export function pickRandom<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}
