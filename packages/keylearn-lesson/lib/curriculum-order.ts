import { type Keyboard } from "@keylearn/keyboard";
import { type Letter } from "@keylearn/phonetic-model";

// The classic touch-typing progression, but derived from the keyboard's own
// finger and row geometry rather than a hand-authored, per-language lesson
// list — so the same proven order (home row first, working out to the pinkies,
// then the top row, then the bottom) is produced for every layout and language
// for free. Ties within a stage are broken by how common the letter is, so the
// most useful keys of each group come first.

const ROW_RANK: Record<string, number> = {
  home: 0,
  top: 1,
  bottom: 2,
  digit: 3,
};

function fingerRank(finger: string | null, homing: boolean): number {
  switch (finger) {
    case "leftIndex":
    case "rightIndex":
      // The index "homing" keys (F/J) lead the whole curriculum; the index
      // *reaches* (G/H, and the reaches on other rows) are awkward and come
      // last within their row.
      return homing ? 0 : 3.5;
    case "middle":
      return 1;
    case "ring":
      return 2;
    case "pinky":
      return 3;
    default:
      return 5;
  }
}

/**
 * Orders the alphabet as a finger-by-finger touch-typing curriculum, computed
 * from the live keyboard geometry. Home row first (F/J → middle → ring → pinky
 * → the index reaches), then the top row, then the bottom row.
 */
export function orderForCurriculum(
  keyboard: Keyboard,
  letters: readonly Letter[],
): readonly Letter[] {
  const rankOf = (letter: Letter) => {
    const combo = keyboard.getCombo(letter.codePoint);
    const shape = combo != null ? keyboard.getShape(combo.id) : null;
    const row = (shape?.row ?? null) as string | null;
    const rowR = row != null && row in ROW_RANK ? ROW_RANK[row] : 4;
    const fingerR = fingerRank(
      (shape?.finger ?? null) as string | null,
      shape?.homing ?? false,
    );
    return { rowR, fingerR };
  };
  return [...letters].sort((a, b) => {
    const ra = rankOf(a);
    const rb = rankOf(b);
    if (ra.rowR !== rb.rowR) {
      return ra.rowR - rb.rowR;
    }
    if (ra.fingerR !== rb.fingerR) {
      return ra.fingerR - rb.fingerR;
    }
    return b.f - a.f;
  });
}
