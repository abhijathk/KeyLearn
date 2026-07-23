// The kids keyboard is a hand-drawn map, not a live layout: fixed QWERTY rows,
// colour zones per finger, and the traced-hands fingertip positions.

export type FingerId =
  | "l4"
  | "l3"
  | "l2"
  | "l1"
  | "lt"
  | "rt"
  | "r1"
  | "r2"
  | "r3"
  | "r4";

export const FINGER_OF: Readonly<Record<string, FingerId>> = {
  "q": "l4",
  "a": "l4",
  "z": "l4",
  "w": "l3",
  "s": "l3",
  "x": "l3",
  "e": "l2",
  "d": "l2",
  "c": "l2",
  "r": "l1",
  "f": "l1",
  "v": "l1",
  "t": "l1",
  "g": "l1",
  "b": "l1",
  "y": "r1",
  "h": "r1",
  "n": "r1",
  "u": "r1",
  "j": "r1",
  "m": "r1",
  "i": "r2",
  "k": "r2",
  "o": "r3",
  "l": "r3",
  "p": "r4",
  " ": "rt",
};

export const FINGER_NAMES: Readonly<Record<FingerId, string>> = {
  l4: "left pinky",
  l3: "left ring finger",
  l2: "left middle finger",
  l1: "left pointer",
  lt: "thumb",
  rt: "thumb",
  r1: "right pointer",
  r2: "right middle finger",
  r3: "right ring finger",
  r4: "right pinky",
};

/** Fingertip anchors on the traced hands image, in percent of the artwork. */
export const FINGER_DOTS: ReadonlyArray<{
  readonly id: FingerId;
  readonly left: number;
  readonly top: number;
}> = [
  { id: "l4", left: 2.6, top: 25.7 },
  { id: "l3", left: 9.3, top: 8.1 },
  { id: "l2", left: 16.9, top: 4.4 },
  { id: "l1", left: 26.4, top: 7.8 },
  { id: "lt", left: 43.2, top: 54.1 },
  { id: "rt", left: 56.8, top: 54.1 },
  { id: "r1", left: 73.6, top: 7.8 },
  { id: "r2", left: 83.1, top: 4.4 },
  { id: "r3", left: 90.7, top: 8.1 },
  { id: "r4", left: 97.4, top: 25.7 },
];

export type ZoneId = "rose" | "sage" | "sand" | "seafoam" | "terra" | "clay";

export const ZONE_OF: Readonly<Record<string, ZoneId>> = {
  q: "rose",
  a: "rose",
  z: "rose",
  p: "rose",
  w: "sage",
  s: "sage",
  x: "sage",
  o: "sage",
  l: "sage",
  e: "sand",
  d: "sand",
  c: "sand",
  i: "sand",
  k: "sand",
  r: "seafoam",
  f: "seafoam",
  v: "seafoam",
  t: "seafoam",
  g: "seafoam",
  b: "seafoam",
  y: "terra",
  h: "terra",
  n: "terra",
  u: "terra",
  j: "terra",
  m: "terra",
};

export type KeyDef = {
  /** Lowercase character this key types, if it is a letter/space key. */
  readonly char?: string;
  readonly label: string;
  /** Shifted legend on a dual key. */
  readonly shift?: string;
  /** Modifier key width class: "", "w15", "w2", "w25". */
  readonly width?: "w15" | "w2" | "w25";
  readonly mod?: boolean;
  readonly bump?: boolean;
};

const letters = (chars: string): KeyDef[] =>
  [...chars].map((ch) => ({
    char: ch,
    label: ch.toUpperCase(),
    bump: ch === "f" || ch === "j",
  }));

export const SIMPLE_ROWS: readonly (readonly KeyDef[])[] = [
  letters("qwertyuiop"),
  letters("asdfghjkl"),
  letters("zxcvbnm"),
];

export const FULL_ROWS: readonly (readonly KeyDef[])[] = [
  [
    { label: "`", shift: "~", mod: true },
    ...[..."1234567890"].map((d, i) => ({
      label: d,
      shift: "!@#$%^&*()"[i],
      mod: true,
    })),
    { label: "-", shift: "_", mod: true },
    { label: "=", shift: "+", mod: true },
    { label: "back", mod: true, width: "w2" as const },
  ],
  [
    { label: "tab", mod: true, width: "w15" as const },
    ...letters("qwertyuiop"),
    { label: "[", shift: "{", mod: true },
    { label: "]", shift: "}", mod: true },
    { label: "\\", shift: "|", mod: true },
  ],
  [
    { label: "caps", mod: true, width: "w2" as const },
    ...letters("asdfghjkl"),
    { label: ";", shift: ":", mod: true },
    { label: "'", shift: '"', mod: true },
    { label: "enter", mod: true, width: "w2" as const },
  ],
  [
    { label: "shift", mod: true, width: "w25" as const },
    ...letters("zxcvbnm"),
    { label: ",", shift: "<", mod: true },
    { label: ".", shift: ">", mod: true },
    { label: "/", shift: "?", mod: true },
    { label: "shift", mod: true, width: "w25" as const },
  ],
];
