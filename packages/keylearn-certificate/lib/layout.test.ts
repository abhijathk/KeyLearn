import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import { fitName } from "./criteria.ts";
import { CELL, nameCapacity, type SheetName, SHEETS } from "./layout.ts";
import {
  alphabetName,
  BRAILLE_ALPHABET,
  groupNumber,
  printedFields,
} from "./printed.ts";

const SHEET_NAMES: readonly SheetName[] = ["adult", "young", "child"];

test("every field lands on the paper", () => {
  for (const name of SHEET_NAMES) {
    const sheet = SHEETS[name];
    const fields = [
      sheet.name,
      sheet.language,
      sheet.braille.name,
      sheet.braille.language,
      ...sheet.fields,
    ];
    for (const field of fields) {
      isTrue(field.top > 0 && field.top < 96, `${name} top ${field.top}`);
      isTrue(field.left >= 0, `${name} left ${field.left}`);
      isTrue(
        field.left + field.width <= 100,
        `${name} overruns the right edge`,
      );
      isTrue(field.size > 0 && field.size < 8, `${name} size ${field.size}`);
    }
  }
});

test("the three bottom fields never overlap", () => {
  // Only meaningful for the two sheets that centre their values in columns.
  // The grown-up sheet stacks its four on separate ruled lines.
  for (const name of ["young", "child"] as const) {
    const [a, b, c] = SHEETS[name].fields;
    equal(a.top, b.top);
    equal(b.top, c.top);
    isTrue(a.left + a.width <= b.left, `${name}: date runs into the level`);
    isTrue(b.left + b.width <= c.left, `${name}: level runs into the number`);
  }
});

test("the grown-up sheet's four lines are in printed order", () => {
  const [d1, d2, d3, d4] = SHEETS.adult.fields;
  isTrue(d1.top < d2.top && d2.top < d3.top && d3.top < d4.top);
  // Shrink to fit: each starts where its printed label ends.
  for (const field of SHEETS.adult.fields) {
    equal(field.width, 0);
  }
});

test("the braille name is lifted to make room for its cells", () => {
  for (const name of SHEET_NAMES) {
    const sheet = SHEETS[name];
    isTrue(
      sheet.braille.name.top < sheet.name.top,
      `${name}: braille name is not raised`,
    );
    // Cells below the name, language line below the cells, and all of it above
    // whatever the sheet prints next.
    isTrue(sheet.braille.cells.top > sheet.braille.name.top);
    isTrue(sheet.braille.language.top > sheet.braille.cells.top);
    const first = Math.min(...sheet.fields.map((f) => f.top));
    isTrue(
      sheet.braille.language.top < first,
      `${name}: language line collides`,
    );
  }
});

test("the language line sits inside the name box, just under the name", () => {
  for (const name of SHEET_NAMES) {
    const sheet = SHEETS[name];
    for (const [nameField, languageField] of [
      [sheet.name, sheet.language],
      [sheet.braille.name, sheet.braille.language],
    ] as const) {
      equal(languageField.left, nameField.left);
      equal(languageField.width, nameField.width);
      const gap = languageField.top - nameField.top;
      isTrue(gap > 0 && gap < 8, `${name}: language line is ${gap}% away`);
    }
  }
});

test("the cells are drawn at embossing pitch", () => {
  // Dot centres a little over a dot apart, and a clear space between cells:
  // close enough to the standard that an embosser can follow the print.
  isTrue(CELL.gap < CELL.dot);
  isTrue(CELL.advance > CELL.gap);
});

test("the name box holds a plausible number of characters", () => {
  for (const name of SHEET_NAMES) {
    const capacity = nameCapacity(name, "typing");
    // "Abhijath Kottikkal" is 18 and fits on all three; a capacity that let
    // through forty would silently overrun the box instead of shortening.
    isTrue(capacity >= 18 && capacity <= 40, `${name}: capacity ${capacity}`);
  }
});

test("the sheet decides what goes in its fields, not the caller", () => {
  const base = {
    kind: "typing",
    level: "gold",
    name: "Meera Nair",
    languageLine: "English · QWERTY",
    speed: 41.62,
    accuracy: 0.9761,
    number: "H6APEMDP",
    issued: new Date(Date.UTC(2026, 7, 7)),
  } as const;

  // Four values on the grown-up paper: it prints what was actually achieved.
  const adult = printedFields({ ...base, sheet: "adult" });
  equal(adult.values.length, SHEETS.adult.fields.length);
  equal(adult.values[0], "7 August 2026");
  equal(adult.values[1], "41.6 wpm");
  equal(adult.values[2], "97.6%");
  equal(adult.values[3], "H6AP EMDP");

  // Three on a child's, with a level in place of the figures — "Gold" is
  // something a nine-year-old can be pleased about and "41.6 wpm" is not.
  for (const sheet of ["young", "child"] as const) {
    const printed = printedFields({ ...base, sheet });
    equal(printed.values.length, 3);
    equal(printed.values[0], "7 Aug 2026");
    equal(printed.values[1], "Gold");
    isTrue(!printed.values.some((v) => v.includes("wpm")));
  }
});

test("braille prints cells a minute where the speed goes", () => {
  const printed = printedFields({
    sheet: "adult",
    kind: "braille",
    level: "completion",
    name: "Ravi Menon",
    languageLine: "Unified English Braille · grade 1",
    speed: 54.2,
    accuracy: 0.968,
    number: "CS5CEVGH",
    issued: new Date(Date.UTC(2026, 7, 7)),
  });
  equal(printed.values[1], "54 cells/min");
});

test("the number is grouped so it can be read down a phone", () => {
  equal(groupNumber("WM2FRJ2B"), "WM2F RJ2B");
  // Anything that is not the eight-character form is left exactly as it is.
  equal(groupNumber("SHORT"), "SHORT");
});

test("an alphabet is named, not coded", () => {
  // The whole point: en-us, en-gb and en-au are the same twenty-six letters,
  // and a certificate attests letters. Nobody should ever read "en-us".
  for (const key of ["en", "en-us", "en-gb", "en-dvorak", "en-colemak"]) {
    equal(alphabetName(key), "English");
  }
  equal(alphabetName("ru"), "Russian");
  equal(alphabetName(BRAILLE_ALPHABET), "Unified English Braille · grade 1");
});

test("the printed name is decided once, at issue", () => {
  // A certificate is a document, not a view of a profile. Renaming a learner
  // afterwards — or giving them the surname they did not have when they sat
  // it — must not rewrite a sheet somebody may already have printed and hung
  // on a wall. The server stores the fitted name and every reader takes it
  // from the record; this pins the shortening it stores.
  const capacity = nameCapacity("adult", "typing");
  const atIssue = fitName("Abhijath", "Kottikkal", capacity);
  equal(atIssue, "Abhijath Kottikkal");

  // The same learner, renamed. Nothing about the stored string depends on it.
  const printed = printedFields({
    sheet: "adult",
    kind: "typing",
    level: "completion",
    name: atIssue,
    languageLine: "English",
    speed: 51.6,
    accuracy: 0.981,
    number: "WM2FRJ2B",
    issued: new Date(Date.UTC(2026, 7, 7)),
  });
  equal(printed.name, "Abhijath Kottikkal");
});
