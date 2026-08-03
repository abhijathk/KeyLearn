import { test } from "node:test";
import { deepEqual, isTrue } from "rich-assert";
import { filterKidsWords } from "./kids-words.ts";

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
  // The guided lesson starts with the most frequent letters; the kids list
  // must offer real words for them.
  const early = filterKidsWords(["rain", "line", "near", "nail", "lane"]);
  isTrue(early.length >= 4);
});
