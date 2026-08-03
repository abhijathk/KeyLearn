import { test } from "node:test";
import { equal } from "rich-assert";
import {
  currentStrikes,
  DECAY_MS,
  escalate,
  MUTE_MS,
  type Standing,
} from "./strikes.ts";

const NOW = 1_700_000_000_000;
const clean: Standing = { strikes: 0, lastStrikeAt: 0, blocks: 0 };

test("a clean message changes nothing", () => {
  equal(escalate(clean, 0, "clean", NOW).kind, "none");
});

test("the ladder is warn, mute, block", () => {
  equal(escalate(clean, 1, "severe", NOW).kind, "warn");

  const once: Standing = { strikes: 1, lastStrikeAt: NOW, blocks: 0 };
  const second = escalate(once, 1, "severe", NOW);
  equal(second.kind, "mute");
  equal(second.kind === "mute" ? second.untilMs : 0, NOW + MUTE_MS);

  const twice: Standing = { strikes: 2, lastStrikeAt: NOW, blocks: 0 };
  equal(escalate(twice, 1, "severe", NOW).kind, "block");
});

test("a slur counts double, so it reaches the mute in one step", () => {
  equal(escalate(clean, 2, "slur", NOW).kind, "mute");
});

test("contact details skip the ladder entirely", () => {
  // Same response on a first message as on a third: the reason for it has
  // nothing to do with whether this person has been warned about swearing.
  const first = escalate(clean, 3, "contact", NOW);
  equal(first.kind, "block");
  equal(first.kind === "block" ? first.untilMs : 0, NOW + 24 * 3_600_000);
});

test("a second block lasts longer than the first", () => {
  const served: Standing = { strikes: 0, lastStrikeAt: 0, blocks: 1 };
  const again = escalate(served, 3, "contact", NOW);
  equal(again.kind === "block" ? again.untilMs : 0, NOW + 7 * 24 * 3_600_000);
});

test("strikes decay, one per clean period", () => {
  const two: Standing = { strikes: 2, lastStrikeAt: NOW, blocks: 0 };
  equal(currentStrikes(two, NOW), 2);
  equal(currentStrikes(two, NOW + DECAY_MS), 1, "one forgiven");
  equal(currentStrikes(two, NOW + 2 * DECAY_MS), 0, "both forgiven");
  equal(currentStrikes(two, NOW + 9 * DECAY_MS), 0, "never negative");
});

test("somebody who slipped long ago starts again at a warning", () => {
  const old: Standing = { strikes: 2, lastStrikeAt: NOW, blocks: 0 };
  // Two clean months later, a slip is a first offence again — not one word
  // from a block.
  equal(escalate(old, 1, "severe", NOW + 2 * DECAY_MS).kind, "warn");
});
