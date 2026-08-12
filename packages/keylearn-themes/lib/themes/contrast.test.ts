import { test } from "node:test";
import { contrastRatio, parseColor } from "@keylearn/color";
import { equal, isTrue } from "rich-assert";
import { applyContrastLevel } from "./contrast.ts";

// A stand-in for the document's inline style plus its computed values.
function fakeStyle(theme: Record<string, string>) {
  const inline: Record<string, string> = {};
  const style = {
    setProperty: (k: string, v: string) => void (inline[k] = v),
    removeProperty: (k: string) => void delete inline[k],
  } as unknown as CSSStyleDeclaration;
  const read = () =>
    ({
      getPropertyValue: (k: string) => inline[k] ?? theme[k] ?? "",
    }) as CSSStyleDeclaration;
  return { style, read, inline };
}

const NIGHT = {
  "--background-color": "#141620",
  "--text-color": "#e6e8ee",
  "--text-color-f1": "#8b90a0",
  "--text-color-f2": "#6b7080",
};

test("the default level leaves the theme alone", () => {
  const { style, read, inline } = fakeStyle(NIGHT);
  applyContrastLevel("default", style, read);
  equal(Object.keys(inline).length, 0);
});

// The point of the feature, stated as a number rather than a feeling.
test("clearer reaches the level written for low vision", () => {
  const { style, read, inline } = fakeStyle(NIGHT);
  applyContrastLevel("clearer", style, read);
  const bg = parseColor(NIGHT["--background-color"]);
  isTrue(contrastRatio(parseColor(inline["--text-color"]), bg) >= 7);
  // The faded text is where contrast actually fails, so it is raised too.
  isTrue(contrastRatio(parseColor(inline["--text-color-f1"]), bg) >= 4.5);
  isTrue(contrastRatio(parseColor(inline["--text-color-f2"]), bg) >= 4.5);
});

test("strongest goes past the standard", () => {
  const { style, read, inline } = fakeStyle(NIGHT);
  applyContrastLevel("strongest", style, read);
  const bg = parseColor(NIGHT["--background-color"]);
  isTrue(contrastRatio(parseColor(inline["--text-color"]), bg) >= 11);
  isTrue(contrastRatio(parseColor(inline["--text-color-f2"]), bg) >= 7);
});

// A theme should become more legible, never inverted.
test("light-on-dark stays light and dark-on-light stays dark", () => {
  const night = fakeStyle(NIGHT);
  applyContrastLevel("strongest", night.style, night.read);
  isTrue(
    parseColor(night.inline["--text-color-f2"]).toRgb().r >
      parseColor(NIGHT["--text-color-f2"]).toRgb().r,
  );

  const DAY = {
    "--background-color": "#f5f6fa",
    "--text-color": "#20242e",
    "--text-color-f1": "#767c8a",
    "--text-color-f2": "#8e94a2",
  };
  const day = fakeStyle(DAY);
  applyContrastLevel("strongest", day.style, day.read);
  isTrue(
    parseColor(day.inline["--text-color-f2"]).toRgb().r <
      parseColor(DAY["--text-color-f2"]).toRgb().r,
  );
});

// Text that already clears the bar is left exactly as the designer set it.
test("a colour that already passes is not touched", () => {
  const { style, read, inline } = fakeStyle({
    "--background-color": "#000000",
    "--text-color": "#ffffff",
    "--text-color-f1": "#ffffff",
    "--text-color-f2": "#ffffff",
  });
  applyContrastLevel("clearer", style, read);
  equal(inline["--text-color"], "#ffffff");
});

// A theme whose body text already sits near 15:1 has nothing to gain in its
// text, and a preset that touched only text looked broken on exactly the page
// somebody would try it on. What fails there is every line drawn between two
// things.
const CHROME = {
  ...NIGHT,
  "--separator-color": "#242732",
  "--Chart-frame__color": "#1e2130",
  "--textinput--hit__color": "#5a5d68",
};

test("the lines are raised too, not only the words", () => {
  const { style, read, inline } = fakeStyle(CHROME);
  applyContrastLevel("clearer", style, read);
  const bg = parseColor(CHROME["--background-color"]);
  // Non-text has its own bar — WCAG asks 3:1 of it, not the 7:1 asked of body
  // text. A rule between two rows raised to reading contrast is not a rule any
  // more, it is a wall.
  const line = parseColor(inline["--separator-color"]);
  isTrue(contrastRatio(line, bg) >= 3);
  isTrue(contrastRatio(line, bg) < 7);
  isTrue(contrastRatio(parseColor(inline["--Chart-frame__color"]), bg) >= 3);
});

test("what has been typed becomes readable without becoming the loudest thing", () => {
  const { style, read, inline } = fakeStyle(CHROME);
  applyContrastLevel("clearer", style, read);
  const bg = parseColor(CHROME["--background-color"]);
  const hit = contrastRatio(parseColor(inline["--textinput--hit__color"]), bg);
  isTrue(hit >= 4.5);
  // Still quieter than the words still to come: the dimming carries the
  // meaning "you have dealt with this", and that meaning survives.
  isTrue(hit < contrastRatio(parseColor(inline["--text-color"]), bg));
});
