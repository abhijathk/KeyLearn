import { test } from "node:test";
import { deepEqual, equal, isNotNull, isTrue } from "rich-assert";
import { CAPITAL_SIGN, LETTERS, NUMBER_SIGN, PUNCTUATION } from "./cell.ts";
import { generateLine } from "./generate.ts";
import {
  defaultTarget,
  keyOfCell,
  LETTER_CELLS,
  Progress,
  STARTING_CELLS,
  TEACHING_ORDER,
} from "./progress.ts";

const settle = (p: Progress, letters: readonly string[], ms = 400) => {
  for (const l of letters) {
    for (let i = 0; i < 4; i++) p.hit(l, ms);
  }
};

/** A deterministic stand-in for a learner's luck. */
const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

/** Practises a cell at a given accuracy, the way a person actually would. */
const practise = (
  p: Progress,
  letter: string,
  { entries, accuracy, ms }: { entries: number; accuracy: number; ms: number },
  rnd = rng(7),
) => {
  for (let i = 0; i < entries; i++) {
    if (rnd() < accuracy) p.hit(letter, ms);
    else p.miss(letter);
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

// ---- the gate has to be passable -----------------------------------------

test("one mistake does not bar a cell for ever", () => {
  // The whole curriculum used to hang on this. Accuracy was the lifetime
  // ratio and settling demanded a perfect one, so a single wrong chord in the
  // first minute barred that cell permanently — and one unsettled cell holds
  // every cell behind it.
  const p = new Progress();
  p.miss("a");
  // Not instantly — the window has to fill — but within a line or two of
  // ordinary practice rather than never.
  practise(p, "a", { entries: 12, accuracy: 1, ms: 400 });
  equal(p.isSettled("a"), true, "a miss must be recoverable");
});

test("a good learner reaches the end of the alphabet", () => {
  // Measured against a real profile that had done four hundred correct cells
  // across two days, at 95% accuracy and comfortably inside the target pace,
  // and had never once been given a sixth cell.
  const p = new Progress();
  const rnd = rng(11);
  for (let entry = 0; entry < 6000; entry += 1) {
    const inPlay = p.unlocked();
    const letter = inPlay[Math.floor(rnd() * inPlay.length)];
    if (rnd() < 0.05) p.miss(letter);
    else p.hit(letter, 600);
  }
  equal(
    p.unlocked().length >= LETTER_CELLS.length,
    true,
    `95% accurate at 600ms and stuck on ${p.unlocked().length} cells`,
  );
});

test("the curriculum carries on past the alphabet", () => {
  // It used to stop at w: punctuation, the capital sign and the digits were in
  // the tables, tested, and in no lesson anybody would ever see.
  isTrue(TEACHING_ORDER.length > LETTER_CELLS.length);
  for (const key of [".", ",", "A", "1", "?"]) {
    isTrue(TEACHING_ORDER.includes(key), `${key} is never taught`);
  }
});

test("cells are never taken away once given", () => {
  // unlocked() reads how the cells are going *now*, and now moves both ways —
  // so without a high-water mark a bad line shrinks the alphabet mid-session
  // and letters taught last week vanish from the practice lines.
  const p = new Progress();
  const rnd = rng(3);
  for (let e = 0; e < 3000; e++) {
    const inPlay = p.unlocked();
    p.hit(inPlay[Math.floor(rnd() * inPlay.length)], 500);
  }
  const peak = p.unlocked().length;
  isTrue(peak > STARTING_CELLS, "should have grown at all");
  for (const key of p.unlocked()) {
    for (let i = 0; i < 25; i++) p.miss(key);
  }
  equal(p.unlocked().length, peak, "a bad day must not confiscate cells");
});

test("the high-water mark survives a round trip", () => {
  const p = new Progress();
  const rnd = rng(5);
  for (let e = 0; e < 2000; e++) {
    const inPlay = p.unlocked();
    p.hit(inPlay[Math.floor(rnd() * inPlay.length)], 500);
  }
  const reached = p.unlocked().length;
  const back = Progress.fromJSON(JSON.parse(JSON.stringify(p)));
  equal(back.unlocked().length, reached);
});

test("signs are scored against a cell, not thrown away", () => {
  // keyOfCell returned null for every one of them, so practising a full stop
  // or a capital sign taught the engine nothing and neither could ever settle.
  equal(keyOfCell(PUNCTUATION.get(".")!), ".");
  equal(keyOfCell(CAPITAL_SIGN), "A");
  equal(keyOfCell(NUMBER_SIGN), "1");
  equal(keyOfCell(LETTERS.get("q")!), "q");
});

test("a cell being guessed at still does not settle", () => {
  const p = new Progress();
  practise(p, "a", { entries: 40, accuracy: 0.5, ms: 300 });
  equal(p.isSettled("a"), false, "fast and half wrong is not learned");
});

test("nor does one that is accurate but far too slow", () => {
  const p = new Progress();
  practise(p, "a", { entries: 20, accuracy: 1, ms: 5000 });
  equal(p.isSettled("a"), false, "accurate but nowhere near the pace");
});

test("accuracy is judged on recent attempts, not on a lifetime", () => {
  const p = new Progress();
  practise(p, "a", { entries: 60, accuracy: 0.5, ms: 400 });
  const duringSlump = p.accuracy("a");
  practise(p, "a", { entries: 25, accuracy: 1, ms: 400 });
  isTrue(
    p.accuracy("a") > duringSlump + 0.3,
    `recovered from ${duringSlump.toFixed(2)} to ${p.accuracy("a").toFixed(2)}`,
  );
  equal(p.isSettled("a"), true, "and the cell can settle again");
});

test("a cell that stops going well stops being settled", () => {
  const p = new Progress();
  settle(p, ["a"], 400);
  equal(p.isSettled("a"), true);
  for (let i = 0; i < 20; i++) p.miss("a");
  equal(p.isSettled("a"), false, "the window has to work in both directions");
});

test("progress saved before accuracy was windowed still loads", () => {
  // No `recent` field, because it did not exist. It must not read as zero
  // attempts and it must not throw.
  const back = Progress.fromJSON({
    a: { hits: 40, misses: 2, bestMs: 300, recentMs: [400, 420] },
  });
  equal(back.statOf("a").hits, 40);
  equal(back.accuracy("a"), 0, "no recent attempts recorded yet");
  // And it recovers as soon as the learner does anything at all.
  settle(back, ["a"], 400);
  equal(back.isSettled("a"), true);
});

test("a line never contains a sign the learner has not been given", () => {
  const p = new Progress();
  const allowed = new Set(p.unlocked());
  for (let i = 0; i < 60; i++) {
    for (const ch of generateLine(p)) {
      if (ch === " ") continue;
      // Capitals and digits are keyed by an example of what they introduce.
      const key = /[0-9]/.test(ch) ? "1" : ch !== ch.toLowerCase() ? "A" : ch;
      equal(allowed.has(key), true, `"${ch}" is not unlocked`);
    }
  }
});

test("once a sign is unlocked it turns up in the lessons", () => {
  const p = new Progress();
  const rnd = rng(9);
  // Practise until the whole curriculum is in play.
  while (p.unlocked().length < TEACHING_ORDER.length) {
    for (const k of p.unlocked()) for (let i = 0; i < 4; i++) p.hit(k, 400);
  }
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    for (const ch of generateLine(p, { words: 8, rnd })) {
      seen.add(/[0-9]/.test(ch) ? "1" : ch !== ch.toLowerCase() ? "A" : ch);
    }
  }
  for (const key of TEACHING_ORDER) {
    equal(seen.has(key), true, `${key} is taught but never appears in a line`);
  }
});
