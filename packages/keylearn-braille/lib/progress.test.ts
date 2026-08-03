import { test } from "node:test";
import { deepEqual, equal, isNotNull, isNull } from "rich-assert";
import { generateLine } from "./generate.ts";
import {
  defaultTarget,
  Progress,
  STARTING_CELLS,
  TEACHING_ORDER,
} from "./progress.ts";

const settle = (p: Progress, letters: readonly string[], ms = 400) => {
  for (const l of letters) {
    for (let i = 0; i < 4; i++) p.hit(l, ms);
  }
};

test("starts with a handful of cells, in teaching order", () => {
  const p = new Progress();
  deepEqual(p.unlocked(), TEACHING_ORDER.slice(0, STARTING_CELLS));
});

test("a cell is not settled on speed alone", () => {
  const p = new Progress();
  // Fast, but wrong as often as right.
  for (let i = 0; i < 4; i++) {
    p.hit("a", 200);
    p.miss("a");
  }
  equal(p.isSettled("a"), false, "half-wrong cannot count as learned");
});

test("nor on a single lucky entry", () => {
  const p = new Progress();
  p.hit("a", 100);
  equal(p.isSettled("a"), false, "one clean entry is luck, not learning");
});

test("a new cell arrives only once every current cell has settled", () => {
  const p = new Progress();
  const first = p.unlocked();
  settle(p, first.slice(0, -1));
  deepEqual(p.unlocked(), first, "one unsettled cell holds the rest back");
  settle(p, [first[first.length - 1]]);
  equal(p.unlocked().length, first.length + 1);
});

test("the weakest cell is the one the learner has not met", () => {
  const p = new Progress();
  const [a, b] = p.unlocked();
  settle(p, [a]);
  p.hit(b, 3000); // slow, but attempted
  // Cells never attempted at all outrank a slow one.
  const weak = p.weakest();
  isNotNull(weak);
  equal(p.statOf(weak!).hits, 0);
});

test("among attempted cells the slowest wins", () => {
  const p = new Progress();
  const inPlay = p.unlocked();
  settle(p, inPlay, 300);
  for (let i = 0; i < 4; i++) p.hit(inPlay[2], 4000);
  equal(p.weakest(), inPlay[2]);
});

test("progress survives a round trip", () => {
  const p = new Progress();
  settle(p, ["a", "b"], 350);
  p.miss("c");
  const back = Progress.fromJSON(JSON.parse(JSON.stringify(p)));
  equal(back.statOf("a").hits, 4);
  equal(back.statOf("c").misses, 1);
  equal(back.confidence("a"), p.confidence("a"));
});

test("rubbish in storage does not become a cell", () => {
  const back = Progress.fromJSON({ "€": { hits: 9 }, "a": null });
  equal(back.statOf("€").hits, 0);
  equal(back.statOf("a").hits, 0);
});

test("generated lines only use cells the learner has", () => {
  const p = new Progress();
  const allowed = new Set(p.unlocked());
  for (let i = 0; i < 40; i++) {
    for (const ch of generateLine(p).replace(/ /g, "")) {
      equal(allowed.has(ch), true, `"${ch}" was not unlocked`);
    }
  }
});

test("the weak cell comes round often", () => {
  const p = new Progress();
  const inPlay = p.unlocked();
  settle(p, inPlay, 300);
  for (let i = 0; i < 4; i++) p.hit(inPlay[1], 5000);
  const weak = p.weakest()!;
  let withWeak = 0;
  const rounds = 60;
  for (let i = 0; i < rounds; i++) {
    if (generateLine(p, { words: 6 }).includes(weak)) withWeak += 1;
  }
  equal(
    withWeak > rounds * 0.7,
    true,
    `weak cell appeared in ${withWeak}/${rounds} lines`,
  );
});

test("a line is always writable and never empty", () => {
  const p = new Progress();
  const line = generateLine(p, { words: 5 });
  equal(line.split(" ").length, 5);
  equal(line.trim().length > 0, true);
});
