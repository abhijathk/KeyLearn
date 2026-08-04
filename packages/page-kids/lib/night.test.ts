import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import { deviceTier, nightPlan, resolveNightStyle } from "./night.ts";

test("a five-year-old's night has no Lost Travellers, ever", () => {
  // The youngest band gets the quiet night — moon, stars, fireflies — and no
  // override-free path reaches a skeleton. A child who gets frightened by a
  // typing app does not say so; they just stop opening it.
  equal(resolveNightStyle("5-6"), "quiet");
  const plan = nightPlan("quiet", "high");
  equal(plan.travellers, 0);
  equal(plan.eyePairs, 0);
  isTrue(plan.fireflies > 0, "and it is not a lesser night");
});

test("the night grows up with the child", () => {
  equal(resolveNightStyle("7-8"), "mild");
  equal(resolveNightStyle("9-10"), "full");
  equal(resolveNightStyle("11+"), "full");
});

test("a grown-up's override wins over the band", () => {
  equal(resolveNightStyle("7-8", "full"), "full");
  equal(resolveNightStyle("11+", "quiet"), "quiet");
  equal(resolveNightStyle("7-8", "auto"), "mild");
});

test("no path reaches the full night at five, override or not", () => {
  // The settings row does not offer it for this band; the resolver refuses it
  // anyway, so a stale stored preference cannot smuggle it back in.
  equal(resolveNightStyle("5-6", "full"), "mild");
  equal(resolveNightStyle("5-6", "mild"), "mild", "spooky is the ceiling");
  equal(resolveNightStyle("5-6", "quiet"), "quiet");
});

test("the Travellers keep their distance, and more so for younger eyes", () => {
  // They are watched, never met. The mild night holds them further off the
  // trail than the full one, and the quiet night holds them off entirely.
  const mild = nightPlan("mild", "high");
  const full = nightPlan("full", "high");
  isTrue(mild.keepDistance > full.keepDistance);
  equal(nightPlan("quiet", "high").keepDistance, Infinity);
});

test("a weak machine loses numbers, not the night itself", () => {
  // The mist and the eyes carry the atmosphere and are the cheapest things in
  // the scene; the Traveller count is the dial. The story reads the same with
  // two as with nine.
  const low = nightPlan("full", "low");
  const high = nightPlan("full", "high");
  isTrue(low.travellers < high.travellers);
  isTrue(low.travellers >= 3, "but never so few the watch disappears");
  equal(low.mist, high.mist, "the mist is not what gets cut");
  isTrue(low.eyePairs >= 4);
});

test("unknown hardware counts against the machine, not for it", () => {
  // Safari and Firefox admit nothing about memory. This page runs on school
  // Chromebooks; a dropped frame costs more than a missing skeleton.
  equal(deviceTier({}), "mid");
  equal(deviceTier({ memoryGb: 2, cores: 8 }), "low");
  equal(deviceTier({ memoryGb: 8, cores: 2 }), "low");
  equal(deviceTier({ memoryGb: 8, cores: 8, dpr: 2 }), "high");
  equal(deviceTier({ memoryGb: 8, cores: 8, dpr: 1 }), "mid");
});

test("the skeleton forest thickens with the style, never on a quiet night", () => {
  const quiet = nightPlan("quiet", "high");
  const mild = nightPlan("mild", "high");
  const full = nightPlan("full", "high");
  equal(
    quiet.deadGroves,
    0,
    "a bare trunk or two is winter; a grove is spooky",
  );
  isTrue(mild.deadGroves >= 1);
  isTrue(full.deadGroves > mild.deadGroves);
  isTrue(
    full.treeThin > mild.treeThin,
    "and more of the leafy forest goes dark",
  );
});

test("a weak machine keeps its groves, just smaller", () => {
  const low = nightPlan("full", "low");
  isTrue(low.deadGroves >= 2, "the dense stretches are the feature itself");
  isTrue(low.deadScatter >= 4);
});

test("by night the villagers themselves are the Travellers", () => {
  // The change happens in place — same figure's spot, a matched skeleton —
  // and how many turn is the style's decision, never the quiet night's.
  equal(nightPlan("quiet", "high").transformShare, 0);
  equal(nightPlan("mild", "high").transformShare, 1);
  equal(nightPlan("full", "high").transformShare, 1);
});
