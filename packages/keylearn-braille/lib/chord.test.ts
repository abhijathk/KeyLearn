import { test } from "node:test";
import { deepEqual, equal, isNull } from "rich-assert";
import { dots } from "./cell.ts";
import { ChordReader, REQUIRED_ROLLOVER, RolloverProbe } from "./chord.ts";

const press = (r: ChordReader, ...codes: string[]) =>
  codes.map((c) => r.keyDown(c));
const release = (r: ChordReader, ...codes: string[]) =>
  codes.map((c) => r.keyUp(c));

test("a chord commits when the last dot is released", () => {
  const r = new ChordReader();
  press(r, "KeyF", "KeyD"); // dots 1 and 2 => b
  equal(r.held, dots(1, 2));
  // Releasing one of two only narrows what is held; nothing is scored yet.
  deepEqual(r.keyUp("KeyF"), { type: "update", held: dots(2) });
  deepEqual(r.keyUp("KeyD"), { type: "commit", cell: dots(1, 2) });
});

test("dot order does not change the cell", () => {
  const forwards = new ChordReader();
  press(forwards, "KeyF", "KeyD", "KeyJ");
  release(forwards, "KeyF", "KeyD");
  const a = forwards.keyUp("KeyJ");

  const backwards = new ChordReader();
  press(backwards, "KeyJ", "KeyD", "KeyF");
  release(backwards, "KeyJ", "KeyF");
  const b = backwards.keyUp("KeyD");

  deepEqual(a, b);
});

test("a finger added late still counts", () => {
  // Someone learning builds the cell one finger at a time; nothing may commit
  // until they have finished.
  const second = new ChordReader();
  second.keyDown("KeyF");
  second.keyDown("KeyD");
  second.keyDown("KeyS");
  deepEqual(second.pending, dots(1, 2, 3));
  release(second, "KeyF", "KeyD");
  deepEqual(second.keyUp("KeyS"), { type: "commit", cell: dots(1, 2, 3) });
});

test("auto-repeat does not disturb the chord", () => {
  const r = new ChordReader();
  r.keyDown("KeyF");
  isNull(r.keyDown("KeyF"));
  deepEqual(r.keyUp("KeyF"), { type: "commit", cell: dots(1) });
});

test("space writes the blank cell on its own", () => {
  const r = new ChordReader();
  deepEqual(r.keyDown("Space"), { type: "commit", cell: 0 });
});

test("space does not interrupt a chord in progress", () => {
  const r = new ChordReader();
  r.keyDown("KeyF");
  isNull(r.keyDown("Space"));
  deepEqual(r.keyUp("KeyF"), { type: "commit", cell: dots(1) });
});

test("keys that are not dots are ignored", () => {
  const r = new ChordReader();
  isNull(r.keyDown("KeyQ"));
  isNull(r.keyUp("KeyQ"));
});

test("reset abandons a half-typed cell", () => {
  const r = new ChordReader();
  press(r, "KeyF", "KeyD");
  r.reset();
  equal(r.held, 0);
  equal(r.pending, 0);
});

test("the rollover probe records the deepest simultaneous press", () => {
  const p = new RolloverProbe();
  for (const c of ["KeyF", "KeyD", "KeyS"]) p.keyDown(c);
  equal(p.best, 3);
  p.keyUp("KeyS");
  p.keyDown("KeyJ");
  equal(p.best, 3, "a later shallower press must not lower the best");
  for (const c of ["KeyK", "KeyL", "KeyS"]) p.keyDown(c);
  equal(p.best, REQUIRED_ROLLOVER);
});

test("the rollover probe counts keys held together, not keys pressed", () => {
  const probe = new RolloverProbe();
  // Six presses one after another is not six-key rollover.
  for (const code of ["KeyF", "KeyD", "KeyS", "KeyJ", "KeyK", "KeyL"]) {
    probe.keyDown(code);
    probe.keyUp(code);
  }
  equal(probe.best, 1, "one at a time proves nothing about rollover");

  probe.reset();
  for (const code of ["KeyF", "KeyD", "KeyS", "KeyJ"]) probe.keyDown(code);
  equal(probe.best, 4);
  for (const code of ["KeyF", "KeyD", "KeyS", "KeyJ"]) probe.keyUp(code);
  equal(probe.best, 4, "the high-water mark survives the release");
});

test("the probe says when the hand is off the keys", () => {
  // The page unlocks its audio on the first keypress and swallows that chord,
  // which means it needs to know when the chord is actually over. Counting
  // keydowns alone cannot tell it: dots may be released in any order.
  const probe = new RolloverProbe();
  equal(probe.down, 0);
  for (const code of ["KeyF", "KeyD", "KeyS"]) probe.keyDown(code);
  equal(probe.down, 3);
  probe.keyUp("KeyD");
  equal(probe.down, 2, "released out of order, and still counted");
  probe.keyUp("KeyF");
  probe.keyUp("KeyS");
  equal(probe.down, 0);
});

test("the probe ignores keys that are not dots", () => {
  const probe = new RolloverProbe();
  probe.keyDown("KeyF");
  probe.keyDown("Space");
  probe.keyDown("ShiftLeft");
  equal(probe.best, 1);
});
