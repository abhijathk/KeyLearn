import { type KeyShape, useKeyboard } from "@keybr/keyboard";
import { type CodePoint } from "@keybr/unicode";
import { clsx } from "clsx";
import { memo, type ReactNode } from "react";
import * as styles from "./HeatmapLayer.module.less";
import { getKeyCenter, Surface } from "./shapes.tsx";

export const HeatmapLayer = memo(function HeatmapLayer({
  histogram,
  modifier,
}: {
  readonly histogram: Iterable<readonly [codePoint: CodePoint, f: number]>;
  readonly modifier: "h" | "m" | "f";
}): ReactNode {
  type Item = [shape: KeyShape, f: number];
  const keyboard = useKeyboard();
  return <Surface>{items().map(draw)}</Surface>;

  function items() {
    const map = new Map<KeyShape, number>();
    for (const [codePoint, f] of histogram) {
      if (f > 0) {
        const shape = getShape(codePoint);
        if (shape != null) {
          map.set(shape, (map.get(shape) ?? 0) + f);
        }
      }
    }
    // A single miss is noise, not a pattern — only repeated misses deserve a
    // warm halo, so a good round doesn't end painted in red.
    const entries =
      modifier === "m" ? [...map].filter(([, f]) => f >= 2) : [...map];
    return normalize(entries);
  }

  function normalize(list: Item[]) {
    const v = list.map((v) => v[1]);
    const a = Math.min(...v);
    const b = Math.max(...v);
    return list
      .map(([shape, f]) => {
        return [shape, b > a ? (f - a) / (b - a) : 0.5] as Item;
      })
      .sort((a, b) => a[1] - b[1]);
  }

  function getShape(codePoint: CodePoint): KeyShape | null {
    if (codePoint !== 0x0020) {
      const combo = keyboard.getCombo(codePoint);
      if (combo != null) {
        const shape = keyboard.getShape(combo.id);
        if (shape != null) {
          return shape;
        }
      }
    }
    return null;
  }

  function draw([shape, f]: Item, index: number): ReactNode {
    // A soft glow halo under the key: green for clean hits, warm for misses.
    // Intensity and size scale with the count — calm, readable, no clutter.
    const { x, y } = getKeyCenter(shape);
    // Success glows soft and generous; a fumble glows a clear, saturated red so
    // it reads on its own against the green.
    const r = modifier === "m" ? 8 + f * 9 : 8 + f * 12;
    const opacity = modifier === "m" ? 0.3 + f * 0.42 : 0.25 + f * 0.4;
    const spot = {
      h: styles.spot_h,
      m: styles.spot_m,
      f: styles.spot_f,
    }[modifier];
    return (
      <circle
        key={index}
        className={clsx(styles.spot, spot)}
        cx={x}
        cy={y}
        r={r}
        opacity={opacity}
      />
    );
  }
});

export function* flatten(
  histogram: Iterable<readonly [{ readonly codePoint: CodePoint }, number]>,
): IterableIterator<[CodePoint, number]> {
  for (const [{ codePoint }, f] of histogram) {
    yield [codePoint, f];
  }
}
