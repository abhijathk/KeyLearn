import { test } from "node:test";
import { equal, isNull } from "rich-assert";
import {
  poolAssignment,
  ZONE_ORDER,
  ZONE_POOLS,
  zonesFromPool,
} from "./zones.ts";

test("both pools carry one colour per finger", () => {
  equal(ZONE_POOLS.adult.length, ZONE_ORDER.length);
  equal(ZONE_POOLS.kid.length, ZONE_ORDER.length);
});

test("an assignment is a rearrangement of the pool, not a free choice", () => {
  // The zones are the instruction the keyboard teaches with. Six colours
  // chosen freely will sooner or later contain two nobody can tell apart, and
  // then the colour is teaching nothing.
  const [a, b, c, d, e, f] = ZONE_POOLS.adult;
  equal(poolAssignment([c, b, a, d, e, f], ZONE_POOLS.adult)?.length, 6);
  // A colour from outside the pool: refused whole.
  isNull(poolAssignment([a, b, c, d, e, "#ff00ff"], ZONE_POOLS.adult));
  // The same colour twice: refused, because that is two fingers nobody can
  // tell apart, which is the thing this exists to prevent.
  isNull(poolAssignment([a, a, c, d, e, f], ZONE_POOLS.adult));
  // The wrong pool: a kids arrangement is not a grown-up one.
  isNull(poolAssignment(ZONE_POOLS.kid, ZONE_POOLS.adult));
  // Nonsense in storage.
  isNull(poolAssignment(null, ZONE_POOLS.adult));
  isNull(poolAssignment([a, b, c], ZONE_POOLS.adult));
});

test("the arrangement lands on the fingers in the order it was made", () => {
  const palette = zonesFromPool(ZONE_POOLS.adult);
  equal(palette.pinky, ZONE_POOLS.adult[0]);
  equal(palette.thumb, ZONE_POOLS.adult[5]);
});
