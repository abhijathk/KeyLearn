import { test } from "node:test";
import { Layout } from "@keylearn/keyboard";
import { type Result } from "@keylearn/result";
import { equal, isTrue } from "rich-assert";
import { resultsToCsv } from "./csv.ts";

const at = Date.parse("2026-08-06T09:15:30Z");

const result = (over: Partial<Result> = {}) =>
  ({
    timeStamp: at,
    layout: Layout.EN_US,
    length: 150,
    time: 30_000,
    errors: 3,
    speed: 175,
    accuracy: 0.98,
    ...over,
  }) as Result;

test("writes a header and one row per lesson", () => {
  const lines = resultsToCsv([result(), result()]).trimEnd().split("\r\n");
  equal(lines.length, 3);
  isTrue(lines[0].startsWith("date,time,timestamp,"));
});

test("gives both speed units", () => {
  // The app shows words per minute and stores characters per minute. A reader
  // doing their own arithmetic should not discover that by being wrong by a
  // factor of five.
  const row = resultsToCsv([result({ speed: 175 })])
    .split("\r\n")[1]
    .split(",");
  const head = resultsToCsv([]).split("\r\n")[0].split(",");
  equal(row[head.indexOf("wpm")], "35");
  equal(row[head.indexOf("cpm")], "175");
});

test("writes accuracy as a percentage, not a fraction", () => {
  const head = resultsToCsv([]).split("\r\n")[0].split(",");
  const row = resultsToCsv([result({ accuracy: 0.9765 })])
    .split("\r\n")[1]
    .split(",");
  equal(row[head.indexOf("accuracy")], "97.65");
});

test("sorts oldest first", () => {
  const csv = resultsToCsv([
    result({ timeStamp: at + 60_000 }),
    result({ timeStamp: at }),
  ]);
  const rows = csv.trimEnd().split("\r\n").slice(1);
  isTrue(Number(rows[0].split(",")[2]) < Number(rows[1].split(",")[2]));
});

test("escapes a field that would otherwise shift every column after it", () => {
  // Not hypothetical: a layout or mode name carrying a comma silently moves
  // accuracy into the date column, and nobody notices until they act on it.
  const csv = resultsToCsv([result()], { mode: 'guided, "classic"' });
  const row = csv.split("\r\n")[1];
  isTrue(row.includes('"guided, ""classic"""'), row);
  // The row still has exactly as many fields as the header.
  equal(splitCsv(row).length, splitCsv(csv.split("\r\n")[0]).length);
});

test("ends with a newline", () => {
  isTrue(resultsToCsv([result()]).endsWith("\r\n"));
});

/** A minimal RFC 4180 reader, so the test does not trust the writer's rules. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
