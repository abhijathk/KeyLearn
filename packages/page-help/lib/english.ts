import { Letter } from "@keybr/phonetic-model";

// Relative letter frequencies taken from KeyLearn's actual English phonetic
// model, so the help-page illustrations unlock letters in the same order the
// real lessons do (E N I A R L T O S U D Y …).
export const alphabet = {
  a: new Letter(0x0061, 0.0729338723315534, "A"),
  b: new Letter(0x0062, 0.011741744176618442, "B"),
  c: new Letter(0x0063, 0.025710910080733902, "C"),
  d: new Letter(0x0064, 0.037666940798999224, "D"),
  e: new Letter(0x0065, 0.16572921130969617, "E"),
  f: new Letter(0x0066, 0.010444441870431932, "F"),
  g: new Letter(0x0067, 0.024724033683527737, "G"),
  h: new Letter(0x0068, 0.022461862787115008, "H"),
  i: new Letter(0x0069, 0.07806400796914274, "I"),
  j: new Letter(0x006a, 0.00044131444522951823, "J"),
  k: new Letter(0x006b, 0.01626724427507442, "K"),
  l: new Letter(0x006c, 0.06501685334692411, "L"),
  m: new Letter(0x006d, 0.01950470851238808, "M"),
  n: new Letter(0x006e, 0.07943428353005225, "N"),
  o: new Letter(0x006f, 0.062406032455723764, "O"),
  p: new Letter(0x0070, 0.019871891397264082, "P"),
  q: new Letter(0x0071, 0.0013899667566284039, "Q"),
  r: new Letter(0x0072, 0.0660975525002027, "R"),
  s: new Letter(0x0073, 0.04978513430553786, "S"),
  t: new Letter(0x0074, 0.06497399603859474, "T"),
  u: new Letter(0x0075, 0.04708164896389561, "U"),
  v: new Letter(0x0076, 0.0070320734829092, "V"),
  w: new Letter(0x0077, 0.010627454160054672, "W"),
  x: new Letter(0x0078, 0.0022320549500191122, "X"),
  y: new Letter(0x0079, 0.03002791516569562, "Y"),
  z: new Letter(0x007a, 0.008332850705987282, "Z"),
} as const;

export const letters: readonly Letter[] = [...Object.values(alphabet)];
