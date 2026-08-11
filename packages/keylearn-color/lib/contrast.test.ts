import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import { contrastRatio, contrastVerdict, relativeLuminance } from "./contrast.ts";
import { parseColor } from "./parse.ts";

const c = (v: string) => parseColor(v);
const round = (v: number) => Math.round(v * 100) / 100;

// The two anchors of the scale, straight from the WCAG definition.
test("black on white is the whole range", () => {
  equal(round(contrastRatio(c("#000000"), c("#ffffff"))), 21);
  equal(round(contrastRatio(c("#ffffff"), c("#ffffff"))), 1);
});

test("luminance is linearised, not raw sRGB", () => {
  equal(round(relativeLuminance(c("#ffffff"))), 1);
  equal(round(relativeLuminance(c("#000000"))), 0);
  // Mid grey is ~0.216 once the gamma is undone, not 0.5. Reading the sRGB
  // value directly gives the latter, which is what makes the difference
  // between a pass and a fail on real colours.
  equal(round(relativeLuminance(c("#808080"))), 0.22);
});

test("the order of the pair does not change the answer", () => {
  equal(round(contrastRatio(c("#37c871"), c("#141620"))), round(contrastRatio(c("#141620"), c("#37c871"))));
});

// The thresholds WCAG 2.2 actually sets.
test("judge a pairing the way WCAG does", () => {
  equal(contrastVerdict(c("#000000"), c("#ffffff")), "body");
  equal(contrastVerdict(c("#ffffff"), c("#ffffff")), "fail");
  // Mid grey on white is 3.95:1 — fine for large text, not for body copy.
  const grey = contrastRatio(c("#767676"), c("#ffffff"));
  isTrue(grey >= 4.5);
  const lighter = contrastRatio(c("#949494"), c("#ffffff"));
  isTrue(lighter < 4.5 && lighter >= 3);
  equal(contrastVerdict(c("#949494"), c("#ffffff")), "large");
});

// The app's own default accent, so a regression in the palette is visible.
test("the signature mint carries body text on the dark ground", () => {
  isTrue(contrastRatio(c("#8fd9b6"), c("#141620")) >= 4.5);
});
