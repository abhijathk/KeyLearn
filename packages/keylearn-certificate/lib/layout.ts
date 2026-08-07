// Where every printed field sits on every sheet.
//
// These numbers were not reasoned about, they were measured: a grid was laid
// over each template and the ruled lines, boxes and printed labels were read
// off it. Several rounds of estimating positions from what the artwork looked
// like produced nothing but near misses, so nothing here should be nudged by
// eye — re-measure the template instead.
//
// One table, three consumers: the on-screen sheet, the PNG exporter and the
// PDF exporter. A layout duplicated per renderer drifts the first time one of
// them is corrected.

import { type CertificateKind } from "./types.ts";

/** Which of the three papers a learner receives — see `certificateTemplate`. */
export type SheetName = "adult" | "young" | "child";

/**
 * A typeface role rather than a font stack.
 *
 * The two formal sheets are engraved documents, so their fields are set in a
 * serif; a grotesque on them reads as a form somebody filled in. The
 * under-nine sheet letters its own title in a rounded face, so its fields
 * follow it rather than fight it. The certificate number is monospaced on all
 * three, because it exists to be read aloud and typed back.
 */
export type Face = "serif" | "round" | "mono";

/**
 * One printed field.
 *
 * `top`, `left` and `width` are percentages of the sheet's own width and
 * height, so the same table drives a 300px preview and a 1103px export.
 * `size` is a percentage of the sheet **width** in both axes — that is what
 * keeps type proportional when the sheets have three different aspect ratios.
 */
export type Field = {
  readonly top: number;
  readonly left: number;
  /** Zero means "shrink to fit": the field is set from `left`, not centred. */
  readonly width: number;
  readonly size: number;
  readonly face: Face;
  /** Letter-spacing, in em. */
  readonly tracking: number;
  readonly colour: string;
  readonly upper?: boolean;
};

export type SheetLayout = {
  /** Pixel size of the artwork, so an exporter can render at native scale. */
  readonly art: { readonly width: number; readonly height: number };
  /** The learner's name. */
  readonly name: Field;
  /** Language and layout, or the braille code — set just under the name. */
  readonly language: Field;
  /**
   * The same three, in the sheet's own order. Which value goes in which is a
   * property of the sheet, not of this table: the grown-up paper has four
   * ruled lines and prints a raw speed, the two children's papers have three
   * and print a level.
   */
  readonly fields: readonly Field[];
  /**
   * A braille learner's sheet, which is the same paper with the name repeated
   * in grade 1 underneath. Everything above the ruled lines shifts up to make
   * room, so those three fields are re-stated rather than offset.
   */
  readonly braille: {
    readonly name: Field;
    readonly cells: { readonly top: number; readonly left: number };
    readonly language: Field;
  };
};

const SERIF_INK = "#23303a";
const NAME_INK = "#1d3a2c";
const LANGUAGE_INK = "#7a6a45";
const CHILD_INK = "#4a5a3c";
const CHILD_NAME_INK = "#5f7a4e";

/** The name box is inset the same on both sides on every sheet. */
const NAME_BOX = { left: 12, width: 76 } as const;

const language = (top: number, size = 1.35): Field => ({
  top,
  ...NAME_BOX,
  size,
  face: "mono",
  tracking: 0.18,
  colour: LANGUAGE_INK,
  upper: true,
});

/** The braille code line is longer than "English · QWERTY", so it is set smaller. */
const brailleLanguage = (top: number): Field => language(top, 1.15);

export const SHEETS: Readonly<Record<SheetName, SheetLayout>> = {
  // Fourteen and over. Four ruled lines, each with its label printed to the
  // left of it, so these four fields are set from a left edge rather than
  // centred in a box.
  adult: {
    art: { width: 1103, height: 1426 },
    name: {
      top: 56.81,
      ...NAME_BOX,
      size: 4.1,
      face: "serif",
      tracking: 0,
      colour: NAME_INK,
    },
    language: language(60.7),
    fields: [
      {
        top: 81.4,
        left: 18.6,
        width: 0,
        size: 1.75,
        face: "serif",
        tracking: 0,
        colour: SERIF_INK,
      },
      {
        top: 84.35,
        left: 26.6,
        width: 0,
        size: 1.75,
        face: "serif",
        tracking: 0,
        colour: SERIF_INK,
      },
      {
        top: 87.3,
        left: 23.2,
        width: 0,
        size: 1.75,
        face: "serif",
        tracking: 0,
        colour: SERIF_INK,
      },
      {
        top: 90.25,
        left: 32.2,
        width: 0,
        size: 1.6,
        face: "mono",
        tracking: 0.13,
        colour: SERIF_INK,
      },
    ],
    braille: {
      name: {
        top: 55.55,
        ...NAME_BOX,
        size: 4.1,
        face: "serif",
        tracking: 0,
        colour: NAME_INK,
      },
      cells: { top: 58.91, left: 14 },
      language: brailleLanguage(62.69),
    },
  },

  // Nine to thirteen. Three ruled lines side by side, each with its label
  // centred beneath it, so these three are centred in their own columns.
  young: {
    art: { width: 1122, height: 1402 },
    name: {
      top: 53.9,
      ...NAME_BOX,
      size: 3.9,
      face: "serif",
      tracking: 0,
      colour: NAME_INK,
    },
    language: language(57.6),
    fields: [
      {
        top: 92.4,
        left: 12.3,
        width: 20.4,
        size: 1.6,
        face: "serif",
        tracking: 0,
        colour: SERIF_INK,
      },
      {
        top: 92.4,
        left: 40.3,
        width: 19.2,
        size: 1.6,
        face: "serif",
        tracking: 0,
        colour: SERIF_INK,
      },
      {
        top: 92.4,
        left: 66.8,
        width: 18.9,
        size: 1.4,
        face: "mono",
        tracking: 0.1,
        colour: SERIF_INK,
      },
    ],
    braille: {
      name: {
        top: 52.59,
        ...NAME_BOX,
        size: 3.9,
        face: "serif",
        tracking: 0,
        colour: NAME_INK,
      },
      cells: { top: 56.08, left: 14 },
      language: brailleLanguage(60.0),
    },
  },

  // Under nine. Three ruled lines again, but the sheet prints "LEVEL:" above
  // the middle rule rather than below it, so the level sits to the right of
  // its own label instead of centred on the rule.
  child: {
    art: { width: 1086, height: 1448 },
    name: {
      top: 47.88,
      ...NAME_BOX,
      size: 4.3,
      face: "round",
      tracking: 0,
      colour: CHILD_NAME_INK,
    },
    language: language(51.96),
    fields: [
      {
        top: 88.15,
        left: 11.5,
        width: 18.5,
        size: 1.45,
        face: "round",
        tracking: 0,
        colour: CHILD_INK,
      },
      {
        top: 88.15,
        left: 53.5,
        width: 8,
        size: 1.45,
        face: "round",
        tracking: 0,
        colour: CHILD_INK,
      },
      {
        top: 88.15,
        left: 69,
        width: 19,
        size: 1.3,
        face: "mono",
        tracking: 0.08,
        colour: CHILD_INK,
      },
    ],
    braille: {
      name: {
        top: 46.58,
        ...NAME_BOX,
        size: 4.3,
        face: "round",
        tracking: 0,
        colour: CHILD_NAME_INK,
      },
      cells: { top: 50.04, left: 14 },
      language: brailleLanguage(53.92),
    },
  },
};

/**
 * Braille dot geometry, as a percentage of the sheet width.
 *
 * Sized so that at the sheets' printed width the dots land at roughly the
 * standard cell pitch, which is what lets a parent with an embosser raise
 * them — see `BRAILLE_MM`.
 */
export const CELL = {
  dot: 0.62,
  /** Between dot centres within a cell. */
  gap: 0.41,
  /** Between one cell and the next. */
  advance: 0.91,
} as const;

/** Ink for the dots — the under-nine sheet is greener than the other two. */
export function cellInk(sheet: SheetName): string {
  return sheet === "child" ? CHILD_NAME_INK : "#3a3226";
}

/**
 * How many characters fit on the name line before it has to give way.
 *
 * Derived from the box and the type size rather than guessed: the name box is
 * 76% of the sheet wide and the name is set at `size`% of that same width, and
 * a serif at this size averages a little over half its point size per
 * character. Feeding this to `fitName` is what decides between a full name, a
 * surname initial, and a first name standing alone.
 */
export function nameCapacity(sheet: SheetName, kind: CertificateKind): number {
  const layout = SHEETS[sheet];
  const field = kind === "braille" ? layout.braille.name : layout.name;
  return Math.floor(field.width / (field.size * 0.52));
}
