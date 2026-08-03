import { type KeyShape, useKeyboard } from "@keylearn/keyboard";
import { type CodePoint } from "@keylearn/unicode";
import { memo, type ReactNode } from "react";
import { getKeyCenter, Surface } from "./shapes.tsx";
import * as styles from "./TransitionsLayer.module.less";

// How many of the strongest (most-typed) transitions to highlight, plus a few
// of the weakest (rarest) present pairs for contrast.
const STRONG = 6;
const WEAK = 3;

type Pair = { a: CodePoint; b: CodePoint; f: number };

export const TransitionsLayer = memo(function TransitionsLayer({
  histogram,
}: {
  readonly histogram: Iterable<readonly [CodePoint, CodePoint, number]>;
  /** @deprecated no longer used; kept for backwards-compat with callers. */
  readonly modifier?: "h" | "m" | "f";
}): ReactNode {
  const keyboard = useKeyboard();

  // Fold directed bigrams into undirected pairs (a↔b) by summing counts.
  const map = new Map<string, Pair>();
  for (const [c0, c1, f] of histogram) {
    if (f <= 0 || c0 === c1 || c0 === 0x0020 || c1 === 0x0020) {
      continue;
    }
    const a = Math.min(c0, c1);
    const b = Math.max(c0, c1);
    const key = `${a},${b}`;
    const prev = map.get(key);
    if (prev == null) {
      map.set(key, { a, b, f });
    } else {
      prev.f += f;
    }
  }
  const pairs = [...map.values()].sort((x, y) => y.f - x.f);
  const strong = pairs.slice(0, STRONG);
  const weak = pairs.slice(STRONG).slice(-WEAK);

  const fmax = strong.length > 0 ? strong[0].f : 1;

  function getShape(codePoint: CodePoint): KeyShape | null {
    const combo = keyboard.getCombo(codePoint);
    if (combo != null) {
      const shape = keyboard.getShape(combo.id);
      if (shape != null) {
        return shape;
      }
    }
    return null;
  }

  // Curved arc between two key centres, bowed above the chord.
  function arcOf(a: CodePoint, b: CodePoint) {
    const s0 = getShape(a);
    const s1 = getShape(b);
    if (s0 == null || s1 == null) {
      return null;
    }
    const { x: x0, y: y0 } = getKeyCenter(s0);
    const { x: x1, y: y1 } = getKeyCenter(s1);
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    // Perpendicular offset, always bowed upward (screen -y).
    let ox = (y1 - y0) / l;
    let oy = -(x1 - x0) / l;
    if (oy > 0) {
      ox = -ox;
      oy = -oy;
    }
    const raise = l * 0.22;
    const mx = (x0 + x1) / 2 + ox * raise;
    const my = (y0 + y1) / 2 + oy * raise;
    return { x0, y0, x1, y1, d: `M ${x0} ${y0} Q ${mx} ${my} ${x1} ${y1}` };
  }

  let gid = 0;
  const defs: ReactNode[] = [];
  const shadows: ReactNode[] = [];
  const lines: ReactNode[] = [];

  const draw = (p: Pair, kind: "strong" | "weak") => {
    const g = arcOf(p.a, p.b);
    if (g == null) {
      return;
    }
    const width = kind === "strong" ? 2 + (p.f / fmax) * 3.5 : 1.6;
    const id = `tl-sh-${gid++}`;
    // Cast shadow: grounded at the endpoints, fading to nearly transparent
    // under the arc's apex.
    defs.push(
      <linearGradient
        key={id}
        id={id}
        gradientUnits="userSpaceOnUse"
        x1={g.x0}
        y1={g.y0}
        x2={g.x1}
        y2={g.y1}
      >
        <stop offset="0%" stopColor="#0a0c12" stopOpacity={0.22} />
        <stop offset="50%" stopColor="#0a0c12" stopOpacity={0.02} />
        <stop offset="100%" stopColor="#0a0c12" stopOpacity={0.22} />
      </linearGradient>,
    );
    shadows.push(
      <path
        key={id}
        d={g.d}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={width + 2}
        strokeLinecap="round"
        transform="translate(0 2)"
        filter="url(#tl-shadow-blur)"
      />,
    );
    lines.push(
      <path
        key={id}
        className={kind === "strong" ? styles.strong : styles.weak}
        d={g.d}
        style={{ strokeWidth: width }}
        opacity={kind === "strong" ? 0.5 : 0.4}
      />,
    );
  };

  for (const p of strong) draw(p, "strong");
  for (const p of weak) draw(p, "weak");

  return (
    <Surface>
      <defs>
        <filter
          id="tl-shadow-blur"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        {defs}
      </defs>
      {shadows}
      {lines}
    </Surface>
  );
});
