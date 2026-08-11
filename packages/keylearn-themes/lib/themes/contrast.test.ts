import { test } from "node:test";
import { contrastRatio, parseColor } from "@keylearn/color";
import { equal,isTrue } from "rich-assert";
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
