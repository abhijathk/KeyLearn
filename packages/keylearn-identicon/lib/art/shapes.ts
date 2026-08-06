// The twelve generators.
//
// Every one draws into a 100×100 box with fills only — a hairline disappears
// at 28px and aliases at 36px, and 28px is the size these actually live at in
// the drawer. Complexity comes from overlap and from the texture laid over the
// top, never from small marks: a mark under about a twelfth of the tile is
// gone at 28px, and a picture built out of them turns to grey mud.

import { type ArtPalette } from "./art.ts";

/** One shape, as data, so the renderer stays free of markup concerns. */
export type Shape =
  | {
      readonly kind: "rect";
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly rx?: number;
      readonly fill: string;
      readonly opacity: number;
      readonly transform?: string;
    }
  | {
      readonly kind: "circle";
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
      readonly fill: string;
      readonly opacity: number;
    }
  | {
      readonly kind: "path";
      readonly d: string;
      readonly fill: string;
      readonly opacity: number;
      readonly transform?: string;
      readonly evenOdd?: boolean;
    };

/** A gradient the shapes can point at, so a fill can carry depth. */
export type Gradient = {
  readonly id: string;
  readonly radial: boolean;
  readonly from: string;
  readonly to: string;
};

export type Composition = {
  readonly gradients: readonly Gradient[];
  readonly shapes: readonly Shape[];
};

type Rng = () => number;

type Draw = (r: Rng, p: ArtPalette, id: string) => Composition;

const plain = (shapes: readonly Shape[]): Composition => ({
  gradients: [],
  shapes,
});

// ── grown-ups ───────────────────────────────────────────────────────────────

const grid: Draw = (r, p) => {
  // Two cuts each way rather than one, so the tile carries nine cells and
  // four or five of them take colour. Busier, and still nothing small.
  const xs = [0, 24 + r() * 22, 58 + r() * 20, 100];
  const ys = [0, 24 + r() * 22, 58 + r() * 20, 100];
  const shapes: Shape[] = [];
  let k = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      k++;
      if (r() < 0.44) {
        continue;
      }
      shapes.push({
        kind: "rect",
        x: xs[i],
        y: ys[j],
        w: xs[i + 1] - xs[i],
        h: ys[j + 1] - ys[j],
        fill: p.wash[k % 3],
        opacity: 0.55 + r() * 0.35,
      });
    }
  }
  return plain(shapes);
};

const flow: Draw = (r, p, id) => {
  // Marbled ribbons: wide bands that bend right across the tile, layered so
  // the picture comes from where they cross. Each carries a gradient rather
  // than a flat fill — depth without the cost of a blur filter, which would be
  // paid on every avatar in a list.
  const gradients: Gradient[] = [];
  const shapes: Shape[] = [];
  for (let i = 0; i < 5; i++) {
    const y0 = -10 + r() * 50;
    const y1 = -20 + r() * 140;
    const y2 = -20 + r() * 140;
    const y3 = 60 + r() * 50;
    const t = 26 + r() * 26;
    const g = `${id}g${i}`;
    gradients.push({
      id: g,
      radial: false,
      from: p.wash[i % 3],
      to: p.wash[(i + 2) % 3],
    });
    shapes.push({
      kind: "path",
      d:
        `M -20 ${y0} C 20 ${y1}, 70 ${y2}, 120 ${y3}` +
        ` L 120 ${y3 + t} C 70 ${y2 + t}, 20 ${y1 + t}, -20 ${y0 + t} Z`,
      fill: `url(#${g})`,
      opacity: 0.5 + r() * 0.18,
      transform: `rotate(${-25 + r() * 50} 50 50)`,
    });
  }
  return { gradients, shapes };
};

const arc: Draw = (r, p) => {
  const cx = r() < 0.5 ? 0 : 100;
  const cy = r() < 0.5 ? 0 : 100;
  const shapes: Shape[] = [];
  let rad = 108 + r() * 20;
  for (let i = 0; i < 5; i++) {
    shapes.push({
      kind: "circle",
      cx,
      cy,
      r: rad,
      fill: p.wash[i % 3],
      opacity: 0.55 - i * 0.06,
    });
    rad *= 0.62 + r() * 0.12;
  }
  return plain(shapes);
};

const bars: Draw = (r, p) => {
  const shapes: Shape[] = [];
  for (let i = 0; i < 5; i++) {
    const w = 10 + r() * 15;
    shapes.push({
      kind: "rect",
      x: r() * 90,
      y: -20 + r() * 40,
      w,
      h: 140,
      fill: p.wash[i % 3],
      opacity: 0.5 + r() * 0.2,
      transform: `rotate(${-30 + r() * 60} 50 50)`,
    });
  }
  return plain(shapes);
};

const coil: Draw = (r, p, id) => {
  // A tapering spiral drawn as one closed path: the outer edge coils inwards
  // and the inner edge returns, so the whole thing is a single mass however
  // many turns it makes.
  const cx = 40 + r() * 20;
  const cy = 40 + r() * 20;
  const band = (
    turns: number,
    start: number,
    thick: number,
    spin: number,
    dir: number,
  ) => {
    const steps = 90;
    const outer: string[] = [];
    const inner: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = spin + dir * t * turns * Math.PI * 2;
      const rad = start * (1 - t * 0.82);
      const w = thick * (1 - t * 0.72);
      outer.push(
        `${cx + Math.cos(a) * (rad + w)} ${cy + Math.sin(a) * (rad + w)}`,
      );
      inner.push(
        `${cx + Math.cos(a) * (rad - w)} ${cy + Math.sin(a) * (rad - w)}`,
      );
    }
    return `M ${outer.join(" L ")} L ${inner.reverse().join(" L ")} Z`;
  };
  const gradients: Gradient[] = [];
  const shapes: Shape[] = [];
  const coils = [
    {
      turns: 2.2 + r() * 1.1,
      start: 46 + r() * 8,
      thick: 9 + r() * 4,
      op: 0.5,
      w: 0,
      dir: 1,
    },
    {
      turns: 1.8 + r() * 0.9,
      start: 36 + r() * 8,
      thick: 7 + r() * 4,
      op: 0.44,
      w: 1,
      dir: -1,
    },
    {
      turns: 1.4 + r() * 0.8,
      start: 25 + r() * 7,
      thick: 6 + r() * 3,
      op: 0.4,
      w: 2,
      dir: 1,
    },
  ];
  coils.forEach((c, k) => {
    const g = `${id}c${k}`;
    gradients.push({
      id: g,
      radial: false,
      from: p.wash[c.w],
      to: p.wash[(c.w + 2) % 3],
    });
    shapes.push({
      kind: "path",
      d: band(c.turns, c.start, c.thick, r() * 6.28, c.dir),
      fill: `url(#${g})`,
      opacity: c.op,
    });
  });
  return { gradients, shapes };
};

const bloom: Draw = (r, p, id) => {
  // Rings of lobes turned against each other. Many paths, but one shape — a
  // flower reads as a single mass at 28px, which is the test that matters.
  const cx = 42 + r() * 16;
  const cy = 42 + r() * 16;
  const petal = (len: number, wid: number) =>
    `M 0 0 C ${-wid} ${-len * 0.34}, ${-wid * 0.62} ${-len}, 0 ${-len}` +
    ` C ${wid * 0.62} ${-len}, ${wid} ${-len * 0.34}, 0 0 Z`;
  const gradients: Gradient[] = [];
  const shapes: Shape[] = [];
  const rings = [
    {
      n: 6 + ((r() * 4) | 0),
      len: 46 + r() * 10,
      wid: 24 + r() * 10,
      op: 0.4,
      w: 0,
    },
    {
      n: 6 + ((r() * 4) | 0),
      len: 33 + r() * 9,
      wid: 19 + r() * 8,
      op: 0.44,
      w: 1,
    },
    {
      n: 5 + ((r() * 3) | 0),
      len: 20 + r() * 8,
      wid: 13 + r() * 6,
      op: 0.5,
      w: 2,
    },
  ];
  rings.forEach((ring, k) => {
    const g = `${id}p${k}`;
    gradients.push({
      id: g,
      radial: true,
      from: p.wash[(ring.w + 2) % 3],
      to: p.wash[ring.w],
    });
    const spin = r() * 360;
    const d = petal(ring.len, ring.wid);
    for (let i = 0; i < ring.n; i++) {
      shapes.push({
        kind: "path",
        d,
        fill: `url(#${g})`,
        opacity: ring.op,
        transform: `translate(${cx} ${cy}) rotate(${spin + (360 / ring.n) * i})`,
      });
    }
  });
  shapes.push({
    kind: "circle",
    cx,
    cy,
    r: 7 + r() * 5,
    fill: p.ink,
    opacity: 0.28,
  });
  return { gradients, shapes };
};

// ── kids ────────────────────────────────────────────────────────────────────

const bubbles: Draw = (r, p) => {
  const shapes: Shape[] = [];
  const n = 5 + ((r() * 3) | 0);
  for (let i = 0; i < n; i++) {
    shapes.push({
      kind: "circle",
      cx: 12 + r() * 76,
      cy: 12 + r() * 76,
      r: 18 + r() * 26,
      fill: p.wash[i % 3],
      opacity: 0.6 + r() * 0.24,
    });
  }
  return plain(shapes);
};

const splat: Draw = (r, p) => {
  // A closed loop through points at wandering radius, smoothed — a blob with
  // personality rather than a circle.
  const blob = (cx: number, cy: number, base: number) => {
    const n = 7;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const rad = base * (0.68 + r() * 0.55);
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    let d = `M ${(pts[0][0] + pts[n - 1][0]) / 2} ${(pts[0][1] + pts[n - 1][1]) / 2}`;
    for (let i = 0; i < n; i++) {
      const cur = pts[i];
      const nxt = pts[(i + 1) % n];
      d += ` Q ${cur[0]} ${cur[1]}, ${(cur[0] + nxt[0]) / 2} ${(cur[1] + nxt[1]) / 2}`;
    }
    return `${d} Z`;
  };
  const shapes: Shape[] = [];
  for (let i = 0; i < 3; i++) {
    shapes.push({
      kind: "path",
      d: blob(28 + r() * 44, 28 + r() * 44, 26 + r() * 16),
      fill: p.wash[i % 3],
      opacity: 0.66 + r() * 0.18,
    });
  }
  return plain(shapes);
};

const zigzag: Draw = (r, p) => {
  const rot = -20 + r() * 40;
  const step = 26 + r() * 12;
  const shapes: Shape[] = [];
  for (let i = 0; i < 5; i++) {
    const y = -40 + i * step + r() * 8;
    const amp = 14 + r() * 12;
    shapes.push({
      kind: "path",
      d:
        `M -30 ${y} L 20 ${y - amp} L 70 ${y} L 130 ${y - amp}` +
        ` L 130 ${y - amp + step * 0.72} L 70 ${y + step * 0.72}` +
        ` L 20 ${y - amp + step * 0.72} L -30 ${y + step * 0.72} Z`,
      fill: p.wash[i % 3],
      opacity: 0.68 + r() * 0.16,
      transform: `rotate(${rot} 50 50)`,
    });
  }
  return plain(shapes);
};

const swirl: Draw = (r, p) => {
  // A fat two-turn twist, the shape of a lollipop rather than a galaxy — the
  // grown-ups' Coil is the thin, many-turned version of the same idea.
  const cx = 50;
  const cy = 50;
  const spin = r() * 6.28;
  const dir = r() < 0.5 ? 1 : -1;
  const arm = (offset: number) => {
    const steps = 60;
    const outer: string[] = [];
    const inner: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = spin + offset + dir * t * 2.1 * Math.PI;
      const rad = 52 * (1 - t * 0.86);
      const w = 17 * (1 - t * 0.55);
      outer.push(
        `${cx + Math.cos(a) * (rad + w)} ${cy + Math.sin(a) * (rad + w)}`,
      );
      inner.push(
        `${cx + Math.cos(a) * (rad - w)} ${cy + Math.sin(a) * (rad - w)}`,
      );
    }
    return `M ${outer.join(" L ")} L ${inner.reverse().join(" L ")} Z`;
  };
  return plain([
    { kind: "path", d: arm(0), fill: p.wash[0], opacity: 0.82 },
    { kind: "path", d: arm(2.09), fill: p.wash[1], opacity: 0.74 },
    { kind: "path", d: arm(4.19), fill: p.wash[2], opacity: 0.68 },
  ]);
};

const ripple: Draw = (r, p) => {
  // A stone dropped in a pond: thick concentric bands whose radius wobbles, so
  // the rings read as water rather than as a target.
  const cx = 34 + r() * 32;
  const cy = 34 + r() * 32;
  const lobes = 3 + ((r() * 3) | 0);
  const phase = r() * 6.28;
  const ring = (rad: number, w: number, wob: number) => {
    const steps = 64;
    const outer: string[] = [];
    const inner: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (Math.PI * 2 * i) / steps;
      const k = rad + Math.sin(a * lobes + phase) * wob;
      outer.push(`${cx + Math.cos(a) * (k + w)} ${cy + Math.sin(a) * (k + w)}`);
      inner.push(`${cx + Math.cos(a) * (k - w)} ${cy + Math.sin(a) * (k - w)}`);
    }
    return `M ${outer.join(" L ")} Z M ${inner.reverse().join(" L ")} Z`;
  };
  const shapes: Shape[] = [];
  let rad = 54 + r() * 10;
  for (let i = 0; i < 4; i++) {
    shapes.push({
      kind: "path",
      d: ring(rad, 7 + r() * 4, 5 + r() * 6),
      fill: p.wash[i % 3],
      opacity: 0.78 - i * 0.04,
      evenOdd: true,
    });
    rad -= 13 + r() * 5;
  }
  return plain(shapes);
};

const stars: Draw = (r, p) => {
  // Rounded five-point stars. The corners are smoothed with quadratics rather
  // than left as spikes — a sharp point is the first thing to go when the tile
  // shrinks to 28px.
  const star = (
    cx: number,
    cy: number,
    outer: number,
    inner: number,
    spin: number,
  ) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = spin + (Math.PI * i) / 5;
      const rad = i % 2 === 0 ? outer : inner;
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    let d = `M ${(pts[0][0] + pts[9][0]) / 2} ${(pts[0][1] + pts[9][1]) / 2}`;
    for (let i = 0; i < 10; i++) {
      const cur = pts[i];
      const nxt = pts[(i + 1) % 10];
      d += ` Q ${cur[0]} ${cur[1]}, ${(cur[0] + nxt[0]) / 2} ${(cur[1] + nxt[1]) / 2}`;
    }
    return `${d} Z`;
  };
  const shapes: Shape[] = [];
  for (let i = 0; i < 3; i++) {
    const outer = 24 + r() * 22;
    shapes.push({
      kind: "path",
      d: star(22 + r() * 56, 22 + r() * 56, outer, outer * 0.5, r() * 6.28),
      fill: p.wash[i % 3],
      opacity: 0.7 + r() * 0.2,
    });
  }
  return plain(shapes);
};

export const ART_SHAPES: Readonly<Record<string, Draw>> = {
  grid,
  flow,
  arc,
  bars,
  coil,
  bloom,
  bubbles,
  splat,
  zigzag,
  swirl,
  ripple,
  stars,
};

/**
 * The texture laid over every composition. Five tiles, chosen by the seed:
 * at 72px it reads as hatching, a dot screen or a weave, and at 28px it
 * collapses to a slight shift in tone — which is exactly what it should do.
 */
export type Texture = {
  readonly id: string;
  readonly which: number;
  readonly tint: string;
  readonly opacity: number;
};

export const TEXTURE_COUNT = 5;

export function artTexture(
  r: Rng,
  p: ArtPalette,
  id: string,
  kind: "adult" | "kid",
): Texture {
  return {
    id: `${id}t`,
    which: (r() * TEXTURE_COUNT) | 0,
    tint: p.wash[(r() * 3) | 0],
    // Half of what looked right at full strength: it should read at 72px and
    // all but vanish at 28px.
    opacity: kind === "kid" ? 0.1 : 0.065,
  };
}
