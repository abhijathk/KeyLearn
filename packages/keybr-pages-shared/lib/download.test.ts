import { test } from "node:test";
import { equal } from "rich-assert";
import { exportFilename } from "./download.ts";

// A fixed stamp, as `useIntlDates().formatStamp` would produce it for a
// reader in Australia — the caller decides the order, so these assertions do
// not depend on the machine's locale or zone.
const at = "02-08-2026-1432";

test("names an export for what it is, whose it is, and when", () => {
  equal(
    exportFilename("typing-data", "Ada", "json", at),
    "keylearn-typing-data-ada-02-08-2026-1432.json",
  );
  equal(
    exportFilename("recovery-codes", "Ada", "txt", at),
    "keylearn-recovery-codes-ada-02-08-2026-1432.txt",
  );
});

test("reduces a name to what a filename can hold", () => {
  equal(
    exportFilename("typing-data", "Ada Lovelace", "json", at),
    "keylearn-typing-data-ada-lovelace-02-08-2026-1432.json",
  );
  // Runs of punctuation collapse rather than producing a row of dashes.
  equal(
    exportFilename("typing-data", "  Ada / Lovelace!  ", "json", at),
    "keylearn-typing-data-ada-lovelace-02-08-2026-1432.json",
  );
});

test("keeps a name that is not written in Latin", () => {
  // Stripping to ASCII would erase these entirely, leaving an export that
  // says nothing about whose it is.
  equal(
    exportFilename("typing-data", "李雷", "json", at),
    "keylearn-typing-data-李雷-02-08-2026-1432.json",
  );
  equal(
    exportFilename("typing-data", "Émilie", "json", at),
    "keylearn-typing-data-émilie-02-08-2026-1432.json",
  );
});

test("drops the name rather than leaving an empty gap", () => {
  const expected = "keylearn-typing-data-02-08-2026-1432.json";
  equal(exportFilename("typing-data", null, "json", at), expected);
  equal(exportFilename("typing-data", undefined, "json", at), expected);
  equal(exportFilename("typing-data", "", "json", at), expected);
  // A name of nothing but punctuation reduces to nothing.
  equal(exportFilename("typing-data", "!!!", "json", at), expected);
});

test("takes the stamp exactly as the caller formatted it", () => {
  // The order is the reader's locale's, decided by useIntlDates, so this is
  // pass-through rather than anything this function reformats.
  equal(
    exportFilename("typing-data", "Ada", "json", "2026-01-05-0907"),
    "keylearn-typing-data-ada-2026-01-05-0907.json",
  );
});

test("caps a very long name", () => {
  const name = exportFilename("typing-data", "a".repeat(200), "json", at);
  equal(name, `keylearn-typing-data-${"a".repeat(40)}-02-08-2026-1432.json`);
});

test("does not leave a dash hanging when the name is cut", () => {
  // The fortieth character lands on the separator, which used to survive the
  // slice and give "…aaa--02-08-2026-1432.json".
  const name = exportFilename(
    "typing-data",
    `${"a".repeat(39)} bcdef`,
    "json",
    at,
  );
  equal(name, `keylearn-typing-data-${"a".repeat(39)}-02-08-2026-1432.json`);
});
