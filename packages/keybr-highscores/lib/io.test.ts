import { test } from "node:test";
import { Layout } from "@keybr/keyboard";
import { deepEqual } from "rich-assert";
import { HighScores, type HighScoresRow } from "./highscores.ts";
import { reviver } from "./io.ts";

test("stringify and parse", () => {
  const row: HighScoresRow = {
    user: 123,
    profile: null,
    layout: Layout.EN_US,
    timeStamp: new Date("2001-02-03T04:05:06Z"),
    time: 20000,
    length: 100,
    errors: 9,
    complexity: 26,
    speed: 100,
    score: 10000,
  };
  // A round trip through the on-disk form must preserve the ranking, including
  // the Date and Layout instances the reviver restores.
  const a = new HighScores({ best: [row], recent: [row] });
  const b = new HighScores(JSON.parse(JSON.stringify(a), reviver));
  deepEqual(a.ranking("overall"), [row]);
  deepEqual(b.ranking("overall"), [row]);
});
