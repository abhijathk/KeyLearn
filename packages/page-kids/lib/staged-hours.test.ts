import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import { daylightWindow, stagedHours } from "./world.ts";

const at = (h: number, m = 0) => {
  const d = new Date(2026, 8, 14, h, m);
  return stagedHours(d);
};

test("the hours the user gave are staged exactly as they asked", () => {
  // "if user time is 10 am … the day time is 10 am and night time is 10 pm"
  equal(at(10).day, 10);
  equal(at(10).night, 22);
  // "if user time is 8 pm … then day time is 8 am and night time is 8pm"
  equal(at(20).day, 8);
  equal(at(20).night, 20);
});

test("the afternoon is not staged as the small hours", () => {
  // The whole reason the fold cannot simply take the AM reading for day: two
  // in the afternoon is one of the commonest times a child plays, and a
  // clock-face fold would have lit the road as two in the MORNING.
  equal(at(14).day, 14);
  equal(at(14).night, 2);
  equal(at(17).day, 17);
  equal(at(17).night, 5);
});

test("the small hours are not staged as an afternoon night", () => {
  // And the same rule from the other end: a child up at three gets a real
  // three in the morning after dark, not a three o'clock afternoon.
  equal(at(3).night, 3);
  equal(at(3).day, 15);
});

test("day is always daylight and night is always dark, at every hour", () => {
  // The one property the whole fold exists to guarantee. Anything staged
  // outside these windows is a sky that could not happen.
  for (let h = 0; h < 24; h++) {
    const { day, night } = at(h);
    isTrue(day >= 6 && day <= 18, `${h}:00 staged day as ${day}`);
    isTrue(night >= 18 || night <= 6, `${h}:00 staged night as ${night}`);
  }
});

test("noon and midnight are each other's twin", () => {
  // Both sit at twelve on the face, so they stage as the same pair from
  // either end of the clock: the brightest hour of the day and the darkest
  // of the night.
  equal(at(12).day, 12); // noon
  equal(at(12).night, 0); // midnight
  equal(at(0).day, 12);
  equal(at(0).night, 0);
});

test("half past reads between the hours rather than snapping", () => {
  equal(at(9, 30).day, 9.5);
  equal(at(9, 30).night, 21.5);
});

test("Kerala's daylight barely moves across the year", () => {
  // The tropics' signature. At 10.5 degrees north the sun rises within about
  // twenty minutes of quarter past six every day of the year — a temperate
  // latitude swings by four hours. If this ever starts swinging, the latitude
  // has been changed or the declination has the wrong sign.
  const rises: number[] = [];
  const sets: number[] = [];
  for (const month of [0, 3, 5, 8, 11]) {
    const { rise, set } = daylightWindow(new Date(2026, month, 15));
    rises.push(rise);
    sets.push(set);
  }
  const swing = Math.max(...rises) - Math.min(...rises);
  isTrue(swing < 0.75, `sunrise swings ${swing.toFixed(2)}h across the year`);
  isTrue(Math.min(...rises) > 5.5, "sunrise before half past five");
  isTrue(Math.max(...sets) < 18.6, "sunset after twenty to seven");
});

test("but the noon sun swings a very long way in height", () => {
  // The other half of the same signature: little movement in the clock, a lot
  // in the sky. Kerala is inside the tropic, so the sun passes overhead twice
  // a year and is still 56 degrees up at midwinter.
  const noonUp = (month: number, day: number) => {
    const at = new Date(2026, month, day);
    const { rise, set } = daylightWindow(at);
    // Solar noon is the midpoint of the day, by construction.
    return (rise + set) / 2;
  };
  // Solar noon is twelve all year in this model — the interesting swing is the
  // elevation, which the sun vector carries; this only guards the symmetry.
  equal(Math.round(noonUp(0, 15) * 100) / 100, 12);
  equal(Math.round(noonUp(5, 21) * 100) / 100, 12);
});
