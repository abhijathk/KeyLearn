// The lessons, as a spreadsheet.
//
// Unglamorous, and the honest answer to "let me do my own thing with this".
// A PDF is a view somebody else chose; a CSV is the data, and it is what stops
// a household's practice history being locked inside this app's idea of what
// is worth showing.

import { type Result } from "@keylearn/result";

/**
 * Escape a field for RFC 4180.
 *
 * A learner's own name can contain a comma, and a name with a comma in it will
 * silently shift every column after it — the failure is invisible until
 * somebody notices their accuracy in the date column.
 */
function field(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

const HEADER = [
  "date",
  "time",
  "timestamp",
  "layout",
  "mode",
  "wpm",
  "cpm",
  "accuracy",
  "seconds",
  "characters",
  "errors",
] as const;

/**
 * One row per lesson, newest last.
 *
 * Both speed units are given. The app shows words per minute and stores
 * characters per minute, and a reader doing their own arithmetic should not
 * have to discover that conversion by being wrong by a factor of five.
 */
export function resultsToCsv(
  results: readonly Result[],
  { mode = "course" }: { readonly mode?: string } = {},
): string {
  const rows: string[] = [HEADER.join(",")];
  const iso = (at: number) => new Date(at).toISOString();
  for (const r of [...results].sort((a, b) => a.timeStamp - b.timeStamp)) {
    const stamp = iso(r.timeStamp);
    rows.push(
      [
        stamp.slice(0, 10),
        stamp.slice(11, 19),
        r.timeStamp,
        String(r.layout),
        mode,
        Math.round((r.speed / 5) * 10) / 10,
        Math.round(r.speed),
        Math.round(r.accuracy * 10000) / 100,
        Math.round(r.time / 100) / 10,
        r.length,
        r.errors,
      ]
        .map(field)
        .join(","),
    );
  }
  // A trailing newline: without one, some tools treat the last row as
  // truncated and drop it.
  return `${rows.join("\r\n")}\r\n`;
}

/**
 * A byte-order mark, so a spreadsheet opens this as UTF-8.
 *
 * Not decoration: without it Excel on Windows reads the file in the system
 * codepage, and every learner whose name is not plain ASCII opens their own
 * export to find it mangled.
 */
export function csvBlob(text: string): Blob {
  return new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" });
}
