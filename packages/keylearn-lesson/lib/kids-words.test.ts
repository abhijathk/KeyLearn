import { test } from "node:test";
import { deepEqual, equal, isTrue } from "rich-assert";
import { filterKidsWords, kidsLetterOrder } from "./kids-words.ts";

test("keeps only kid-friendly words, preserving order", () => {
  deepEqual(
    filterKidsWords([
      "the",
      "mortgage",
      "cat",
      "liability",
      "rainbow",
      "notwithstanding",
      "dog",
    ]),
    ["the", "cat", "rainbow", "dog"],
  );
});

test("covers the early letter sets", () => {
  // Children unlock in the kids order (see kidsLetterOrder), which reaches
  // these letters early precisely so real words like these are available.
  const early = filterKidsWords(["rain", "line", "near", "nail", "lane"]);
  isTrue(early.length >= 4);
});

const letters = (s: string) =>
  [...s].map((c) => ({ codePoint: c.codePointAt(0)! }));

test("children meet the letters that spell things first", () => {
  // Frequency order opens with e, n, i, r — between them they spell almost
  // nothing a child would recognise, and the opening weeks are the ones that
  // decide whether any of this is worth doing.
  const ordered = kidsLetterOrder(letters("abcdefghijklmnopqrstuvwxyz"));
  const first = ordered
    .slice(0, 4)
    .map(({ codePoint }) => String.fromCodePoint(codePoint))
    .join("");
  equal(first, "aeto", "toe, tea, eat, ate, at, too");
});

test("the order carries every letter exactly once", () => {
  const src = letters("abcdefghijklmnopqrstuvwxyz");
  const ordered = kidsLetterOrder(src);
  equal(ordered.length, src.length);
  equal(new Set(ordered.map((l) => l.codePoint)).size, src.length);
});

test("letters the order does not mention keep their place at the end", () => {
  // Other languages bring accented letters the kids order says nothing about.
  // They must survive, and in a stable order.
  const src = letters("aeäöt");
  const ordered = kidsLetterOrder(src).map(({ codePoint }) =>
    String.fromCodePoint(codePoint),
  );
  equal(ordered.slice(0, 3).join(""), "aet");
  equal(ordered.slice(3).join(""), "äö", "unmentioned letters, original order");
});
