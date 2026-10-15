/**
 * FISH IN THE WIDE RIVER (lessons 37-38; owner, 15 Oct 2026: realistic fish,
 * with the movement, the perspective and the underwater look right).
 *
 * Three fish of a Kerala backwater river, at their real sizes:
 *
 * - pearl spot (karimeen), ~16 cm: a deep, flat, banded body; small groups
 *   that hang about the shallows and the mangrove roots, hovering and
 *   darting;
 * - grey mullet, ~36 cm: slim and silver, in schools that cruise just under
 *   the surface with a beat-and-glide stroke;
 * - Asian sea bass (kaalanchi), ~60 cm (young ones): a few big, slow, solitary fish down
 *   in the deeper water.
 *
 * How it is meant to look right:
 *
 * - SWIMMING is a travelling wave down the body, growing toward the tail
 *   (the way a carangiform fish swims), done in the vertex shader. Tail-beat
 *   frequency follows speed (about 1.5 beats per body length), the body
 *   bends into turns, and a fright is a burst.
 * - PERSPECTIVE: the camera is orthographic and the world fakes depth by
 *   scaling with `scaleAt(z)` (see depth-scale.ts); every fish is scaled the
 *   same way as everything else at its distance, so a fish under the far
 *   bank is smaller by exactly the amount a person standing there would be.
 * - UNDER WATER: drawn after the water, as light coming up through it. Each
 *   fish loses colour and contrast with the length of water between it and
 *   the eye (Beer-Lambert, with the green-brown of a backwater river), so a
 *   fish near the surface is clear and a deep one is a shadow. Seen through
 *   the surface it is raised (apparent depth is real depth / 1.33), moved
 *   with the same ripples the water's surface shows, and part of what would
 *   have come through is reflected instead (the Fresnel share at this
 *   camera's grazing angle). Sun-flecks (caustics) play over their backs in
 *   the shallows, and the sun's shadow map puts their shadows on the bed.
 * - People crossing the bridge above frighten the fish under it.
 *
 * Nothing here is drawn into the water's mirror: fish are under the surface.
 */
import * as THREE from "three";

export type FishHost = {
  readonly scene: THREE.Scene;
  /** The water surface, in world units. */
  readonly surfaceY: number;
  /** The river bed's height (the terrain) at a point. */
  readonly bedY: (x: number, z: number) => number;
  /** Open water a fish may be in (not the island, not dry land). */
  readonly isWater: (x: number, z: number) => boolean;
  /** The world's depth scale at z (fake perspective; see depth-scale.ts). */
  readonly scaleAt: (z: number) => number;
  /** World units per metre at the road (scale 1). */
  readonly unitsPerMetre: number;
  /** Where fish live: the visible water round the crossing. */
  readonly bounds: { x0: number; x1: number; z0: number; z1: number };
  /** The water's ripple clock and look, so fish wobble with its surface. */
  readonly waterTime: { value: number };
  readonly rippleScale: THREE.Vector2;
  readonly rippleAmt: number;
  /** The water's own mid-depth colour, so a deep fish fades into the same teal. */
  readonly waterColor: THREE.Color;
  /** The camera's viewing direction (orthographic: one direction). */
  readonly viewDir: THREE.Vector3;
  /** Is there a deck overhead at x, z? No leaping or sipping under it. */
  readonly covered: (x: number, z: number) => boolean;
  /** Start a ring spreading on the surface at x, z (strength ~0.5-2). */
  readonly ring: (x: number, z: number, amp: number) => void;
  /** Is the river on screen? Nothing is stepped or drawn while it is not. */
  readonly onScreen: () => boolean;
  /** Anyone moving on the decks above: x, z and speed in units/s. */
  readonly disturbers: () => readonly { x: number; z: number; speed: number }[];
};

type Species = {
  readonly name: string;
  /** Length in metres. */
  readonly length: number;
  readonly count: number;
  /** Fish per group (schools); 1 is solitary. */
  readonly group: number;
  /** Depth below the surface, metres. */
  readonly depth: readonly [number, number];
  /** Cruising speed, body lengths a second. */
  readonly cruise: number;
  /** Prefers water over a bed shallower than this (metres); 0 = anywhere. */
  readonly shallows: number;
  /** Body: height and width as a fraction of length, at the deepest point. */
  readonly height: number;
  readonly width: number;
  /** Colours: back, flank, belly, fins. */
  readonly back: number;
  readonly flank: number;
  readonly belly: number;
  readonly fin: number;
  /** Dark vertical bands (pearl spot), dark lines along (mullet), spots. */
  readonly bands: number;
  readonly lines: number;
  readonly spots: number;
  /** Fraction of time spent gliding rather than beating. */
  readonly glide: number;
  /** Tail-beat amplitude at the tip, as a fraction of length. */
  readonly amp: number;
};

const SPECIES: readonly Species[] = [
  {
    name: "pearl-spot",
    length: 0.16,
    count: 11,
    group: 4,
    depth: [0.18, 0.55],
    cruise: 0.7,
    shallows: 1.1,
    height: 0.5,
    width: 0.16,
    back: 0x3c4a32,
    flank: 0x8f9a74,
    belly: 0xd8dcc2,
    fin: 0x4e5a44,
    bands: 1,
    lines: 0,
    spots: 1,
    glide: 0.45,
    amp: 0.11,
  },
  {
    name: "mullet",
    length: 0.36,
    count: 12,
    group: 6,
    depth: [0.12, 0.4],
    cruise: 1.1,
    shallows: 0,
    height: 0.22,
    width: 0.17,
    back: 0x3b4b55,
    flank: 0xa9b3b4,
    belly: 0xe6e9e4,
    fin: 0x6d7878,
    bands: 0,
    lines: 1,
    spots: 0,
    glide: 0.35,
    amp: 0.1,
  },
  {
    name: "sea-bass",
    length: 0.6,
    count: 3,
    group: 1,
    depth: [0.45, 1.1],
    cruise: 0.55,
    shallows: 0,
    height: 0.3,
    width: 0.15,
    back: 0x4a5048,
    flank: 0x9ca39a,
    belly: 0xdcdcd2,
    fin: 0x5d625a,
    bands: 0,
    lines: 0,
    spots: 0,
    glide: 0.55,
    amp: 0.09,
  },
];

/** Body outline along the length: 0 at the snout, 1 at the tail tip. */
function bodyShape(
  sp: Species,
  u: number,
): { h: number; w: number; cy: number } {
  // The tail fin starts at 0.8; the body narrows to the peduncle by then.
  const b = Math.min(1, u / 0.8);
  // A fish's outline: blunt nose, deepest about a third back, a slim wrist.
  const deep = sp.name === "pearl-spot" ? 0.38 : 0.32;
  const rise = Math.sin(Math.min(1, b / deep) * Math.PI * 0.5);
  const fall =
    b < deep ? 1 : Math.cos(((b - deep) / (1 - deep)) * Math.PI * 0.5);
  const env = Math.pow(rise, 0.7) * (0.12 + 0.88 * fall);
  const h = Math.max(0.035, sp.height * env);
  const w = Math.max(0.02, sp.width * Math.pow(rise, 0.8) * (0.2 + 0.8 * fall));
  // The pearl spot's back is arched more than its belly.
  const cy = sp.name === "pearl-spot" ? 0.04 * env : 0.01 * env;
  return { h, w, cy };
}

/**
 * One fish, one unit long, head toward +x. Attributes for the shaders:
 * aU (0 snout .. 1 tail tip), aV (-1 belly .. 1 back), aFin (0 body,
 * 1 median fin, 2 pectoral fin).
 */
function fishGeometry(sp: Species): THREE.BufferGeometry {
  const pos: number[] = [];
  const au: number[] = [];
  const av: number[] = [];
  const afin: number[] = [];
  const idx: number[] = [];
  const N = 22;
  const M = 14;
  const X = (u: number) => 0.5 - u;
  // Body: an elliptical tube, closed at the snout.
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * 0.8;
    const s = bodyShape(sp, u);
    for (let j = 0; j < M; j++) {
      const t = (j / M) * Math.PI * 2;
      const sy = Math.sin(t);
      pos.push(X(u), s.cy + (s.h / 2) * sy, (s.w / 2) * Math.cos(t));
      au.push(u);
      av.push(sy);
      afin.push(0);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * M + j;
      const b = i * M + ((j + 1) % M);
      const c = (i + 1) * M + j;
      const d = (i + 1) * M + ((j + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  // Snout cap.
  const tip = pos.length / 3;
  pos.push(X(0) + 0.01, bodyShape(sp, 0).cy, 0);
  au.push(0);
  av.push(0);
  afin.push(0);
  for (let j = 0; j < M; j++) idx.push(tip, j, (j + 1) % M);
  // A flat fin: a fan of points in the body's middle plane.
  const fin = (pts: readonly [number, number][], kind: number) => {
    const base = pos.length / 3;
    for (const [u, y] of pts) {
      pos.push(X(u), y, 0);
      au.push(u);
      av.push(y > 0 ? 1 : -1);
      afin.push(kind);
    }
    for (let k = 1; k < pts.length - 1; k++)
      idx.push(base, base + k, base + k + 1);
  };
  const s8 = bodyShape(sp, 0.8);
  const forked = sp.name !== "pearl-spot";
  const tailH = sp.height * (sp.name === "pearl-spot" ? 0.62 : 0.85);
  // Caudal fin: from the wrist out to two lobes (forked) or a rounded fan.
  fin(
    forked
      ? [
          [0.78, s8.cy],
          [0.8, s8.cy + s8.h / 2],
          [1.0, s8.cy + tailH / 2],
          [0.93, s8.cy + tailH * 0.12],
          [0.9, s8.cy],
          [0.93, s8.cy - tailH * 0.12],
          [1.0, s8.cy - tailH / 2],
          [0.8, s8.cy - s8.h / 2],
        ]
      : [
          [0.78, s8.cy],
          [0.8, s8.cy + s8.h / 2],
          [0.93, s8.cy + tailH * 0.45],
          [1.0, s8.cy + tailH * 0.2],
          [1.0, s8.cy - tailH * 0.2],
          [0.93, s8.cy - tailH * 0.45],
          [0.8, s8.cy - s8.h / 2],
        ],
    1,
  );
  // Dorsal fin along the back.
  {
    const pts: [number, number][] = [];
    const from = sp.name === "pearl-spot" ? 0.22 : 0.3;
    const to = sp.name === "pearl-spot" ? 0.74 : 0.62;
    const tall = sp.name === "pearl-spot" ? 0.16 : 0.09;
    pts.push([(from + to) / 2, bodyShape(sp, (from + to) / 2).cy]);
    for (let k = 0; k <= 8; k++) {
      const u = from + ((to - from) * k) / 8;
      const s = bodyShape(sp, u);
      pts.push([u, s.cy + s.h / 2 - 0.004]);
    }
    for (let k = 8; k >= 0; k--) {
      const u = from + ((to - from) * k) / 8;
      const s = bodyShape(sp, u);
      const lift = Math.sin((k / 8) * Math.PI * 0.85 + 0.15) * tall;
      pts.push([u, s.cy + s.h / 2 + lift]);
    }
    fin(pts, 1);
  }
  // Anal fin under the rear half.
  {
    const pts: [number, number][] = [];
    const from = 0.55;
    const to = 0.74;
    pts.push([(from + to) / 2, bodyShape(sp, 0.64).cy]);
    for (let k = 0; k <= 5; k++) {
      const u = from + ((to - from) * k) / 5;
      const s = bodyShape(sp, u);
      pts.push([u, s.cy - s.h / 2 + 0.004]);
    }
    for (let k = 5; k >= 0; k--) {
      const u = from + ((to - from) * k) / 5;
      const s = bodyShape(sp, u);
      pts.push([
        u,
        s.cy - s.h / 2 - Math.sin((k / 5) * Math.PI) * sp.height * 0.18,
      ]);
    }
    fin(pts, 1);
  }
  // Pectoral fins: a small paddle each side, just behind the gill.
  for (const side of [1, -1]) {
    const s = bodyShape(sp, 0.24);
    const base = pos.length / 3;
    const y0 = s.cy - s.h * 0.12;
    const z0 = (side * s.w) / 2;
    const L = sp.height * 0.32;
    for (const [du, dy, dz] of [
      [0, 0, 0],
      [0.02, s.h * 0.08, 0],
      [0.02 + L, s.h * 0.02, side * L * 0.55],
      [0.02 + L * 0.8, -s.h * 0.08, side * L * 0.6],
    ] as const) {
      pos.push(X(0.24 + du), y0 + dy, z0 + dz);
      au.push(0.24 + du);
      av.push(0);
      afin.push(2);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aU", new THREE.Float32BufferAttribute(au, 1));
  g.setAttribute("aV", new THREE.Float32BufferAttribute(av, 1));
  g.setAttribute("aFin", new THREE.Float32BufferAttribute(afin, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// The water's own ripple height field, ported, so a fish under a ripple is
// moved by the same ripple the surface shows. Must match world.ts wHeight.
const fract = (v: number) => v - Math.floor(v);
const wHash = (x: number, y: number) =>
  fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function wNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = wHash(ix, iy);
  const b = wHash(ix + 1, iy);
  const c = wHash(ix, iy + 1);
  const d = wHash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function wHeight(x: number, z: number, sc: THREE.Vector2, t: number): number {
  const qx = x * sc.x;
  const qz = z * sc.y;
  const tt = t * 0.3;
  return (
    wNoise(qx + tt * 0.25, qz + tt * 0.7) * 0.7 +
    wNoise(qx * 2.1 - tt * 0.4, qz * 2.1 - tt * 1.1) * 0.3
  );
}

type Fish = {
  readonly sp: number;
  readonly slot: number;
  readonly group: number;
  /** Length in world units at the road (scale 1). */
  readonly len: number;
  x_: number;
  z: number;
  /** Depth below the surface, metres. */
  depth: number;
  wantDepth: number;
  heading: number;
  turnRate: number;
  speed: number;
  wantSpeed: number;
  phase: number;
  beatAmp: number;
  gliding: number;
  fright: number;
  wanderX: number;
  wanderZ: number;
  wanderT: number;
  pauseT: number;
  /** A startle's C-start: seconds into it, or -1. */
  cstart: number;
  /** Which way it curls. */
  cside: number;
  /** The spine's curve this frame, smoothed. */
  bend: number;
  /** Nose up or down as it climbs or dives, smoothed (radians). */
  pitch: number;
  /** Seconds until it next rises to sip at the surface. */
  riseIn: number;
  /** Rising: 0 none, 1 going up, 2 at the surface (ringed). */
  rising: number;
  /** Mullet only: seconds until the next leap, and the leap under way. */
  leapIn: number;
  leap: { t: number; vy: number; dur: number } | null;
};

export type RiverFish = {
  update(dt: number, night: number): void;
  dispose(): void;
  /** Review: make the mullet leap within a few seconds. */
  leapSoon(): void;
  /** Review: positions, for checking they stay in the water. */
  readonly fish: () => readonly {
    x: number;
    z: number;
    depth: number;
    sp: string;
  }[];
};

export function createRiverFish(host: FishHost, seed = 3701): RiverFish {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const U = host.unitsPerMetre;
  const B = host.bounds;
  const group = new THREE.Group();
  group.name = "river-fish";
  group.userData.noMirror = true;
  host.scene.add(group);

  const time = { value: 0 };
  const nightU = { value: 0 };
  // Light lost per metre of river water; green-brown, the red going first.
  // A backwater river is murky: a metre of it keeps about a fifth of the
  // green and almost none of the red.
  const sigma = new THREE.Vector3(2.5, 1.6, 1.9);
  const waterTint = host.waterColor.clone();
  // How much of the water a ray through the surface crosses per metre of
  // depth: the refracted ray's slant. Camera ray ~11 degrees below level:
  // sin(i) = cos(11 deg); sin(r) = sin(i) / 1.33.
  const down = Math.min(0.99, Math.max(0.05, -host.viewDir.y));
  const sinI = Math.sqrt(1 - down * down);
  const sinR = Math.min(0.99, sinI / 1.33);
  const pathPerDepth = 1 / Math.sqrt(1 - sinR * sinR);
  // Fresnel (Schlick) at that angle: the share the surface reflects away.
  const cosI = down;
  const F = 0.02 + 0.98 * Math.pow(1 - cosI, 5);
  const transmit = 1 - Math.min(0.85, F);

  const meshes: THREE.InstancedMesh[] = [];
  const depthAttrs: THREE.InstancedBufferAttribute[] = [];
  const swimAttrs: THREE.InstancedBufferAttribute[] = [];
  const fish: Fish[] = [];
  const geoms: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  SPECIES.forEach((sp, si) => {
    const geo = fishGeometry(sp);
    geoms.push(geo);
    const depthA = new THREE.InstancedBufferAttribute(
      new Float32Array(sp.count),
      1,
    );
    const swimA = new THREE.InstancedBufferAttribute(
      new Float32Array(sp.count * 4),
      4,
    );
    depthA.setUsage(THREE.DynamicDrawUsage);
    swimA.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aDepthM", depthA);
    geo.setAttribute("aSwim", swimA);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.08,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.uniforms.uNight = nightU;
      sh.uniforms.uSigma = { value: sigma };
      sh.uniforms.uTint = { value: waterTint };
      sh.uniforms.uPath = { value: pathPerDepth };
      sh.uniforms.uTransmit = { value: transmit };
      sh.uniforms.uBack = { value: new THREE.Color(sp.back) };
      sh.uniforms.uFlank = { value: new THREE.Color(sp.flank) };
      sh.uniforms.uBelly = { value: new THREE.Color(sp.belly) };
      sh.uniforms.uFinC = { value: new THREE.Color(sp.fin) };
      sh.uniforms.uPat = {
        value: new THREE.Vector3(sp.bands, sp.lines, sp.spots),
      };
      sh.vertexShader = sh.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           attribute float aU; attribute float aV; attribute float aFin;
           attribute float aDepthM; attribute vec4 aSwim;
           varying float vU; varying float vV; varying float vFin; varying float vDepthM;
           varying vec3 vWorldP;
           uniform float uTime;
           // THE BODY WAVE of a carangiform fish (Videler's measurements of
           // swimming saithe and mackerel, in body lengths): the head yaws a
           // little, the body is nearly still a quarter of the way back, and
           // the swing grows to about a tenth of the length at the tail; the
           // wave runs tailward a little faster than the fish, about one
           // wavelength to the body. The tail fin lags the body it is on. On
           // top of that the whole spine curves (b): into a turn, or into
           // the C of a startle.
           float swimZ(float u, float p, float a, float b) {
             float env = 0.2 - 0.8 * u + 1.6 * u * u;
             float lag = max(0.0, u - 0.8) * 1.6;
             return a * env * sin(6.2831853 * (u / 0.95) - p - lag) + b * u * u;
           }
           float gSlope; float gZs;`,
        )
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
           {
             // The spine at u and its slope; each cross-section is turned to
             // lie square across the bent spine, so the body BENDS (the inside
             // of a curve closes up, the outside opens) instead of sliding
             // sideways, and the normals turn with it.
             float du = 0.01;
             gZs = swimZ(aU, aSwim.x, aSwim.y, aSwim.z);
             gSlope = (swimZ(aU + du, aSwim.x, aSwim.y, aSwim.z) - gZs) / du;
             float inv = inversesqrt(1.0 + gSlope * gSlope);
             float sa = gSlope * inv; float ca = inv;
             objectNormal = vec3(objectNormal.x * ca + objectNormal.z * sa, objectNormal.y, -objectNormal.x * sa + objectNormal.z * ca);
           }`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vU = aU; vV = aV; vFin = aFin; vDepthM = aDepthM;
           {
             float inv = inversesqrt(1.0 + gSlope * gSlope);
             float zc = transformed.z;
             // Along a bent spine the body keeps its length: the tail comes
             // forward a touch as the spine curves.
             transformed.x += aU * (1.0 - inv) * 0.5 + zc * gSlope * inv;
             transformed.z = gZs + zc * inv;
           }
           // Pectoral fins scull: a quick flutter about their root.
           // Pectoral fins: a slow scull when hanging still, a quick beat when
           // braking or turning (aSwim.w), folded back in a sprint.
           if (aFin > 1.5) transformed.z += sign(transformed.z) * (0.012 + 0.03 * aSwim.w) * sin(uTime * (5.0 + 7.0 * aSwim.w) + aSwim.x);
           // The median fins trail a touch behind the body wave.
           if (aFin > 0.5 && aFin < 1.5) transformed.z += 0.015 * aSwim.y * sin(6.2831853 * 0.85 * aU - aSwim.x - 0.6);
           // Seen through a moving surface an outline wavers: a small, slow
           // shimmer, more for a deeper fish, different along the body.
           {
             vec2 at = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
             float wob = sin(uTime * 2.7 + at.x * 1.3 + aU * 7.0) * 0.6 + sin(uTime * 4.1 - at.y * 1.7 + aU * 11.0) * 0.4;
             transformed.y += wob * 0.018 * (0.4 + aDepthM) * step(0.0, aDepthM);
           }`,
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
           vWorldP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           varying float vU; varying float vV; varying float vFin; varying float vDepthM;
           varying vec3 vWorldP;
           uniform float uTime; uniform float uNight;
           uniform vec3 uSigma; uniform vec3 uTint; uniform float uPath; uniform float uTransmit;
           uniform vec3 uBack; uniform vec3 uFlank; uniform vec3 uBelly; uniform vec3 uFinC;
           uniform vec3 uPat;
           float fHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
           float fNoise(vec2 p) {
             vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
             return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), f.x),
                        mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), f.x), f.y);
           }`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
           {
             // Countershading: dark back, silver flank, pale belly.
             vec3 c = mix(uBelly, uFlank, smoothstep(-0.75, -0.05, vV));
             c = mix(c, uBack, smoothstep(0.25, 0.8, vV));
             // Pearl spot: six dark bars across the flank.
             float bar = smoothstep(0.55, 0.9, sin(vU * 6.0 * 3.14159 / 0.8 + 0.6));
             c *= 1.0 - uPat.x * 0.32 * bar * step(vU, 0.78) * (1.0 - smoothstep(0.7, 1.0, abs(vV)));
             // Mullet: thin dark lines along the upper flank.
             float ln = smoothstep(0.82, 1.0, sin(vV * 26.0));
             c *= 1.0 - uPat.y * 0.16 * ln * smoothstep(-0.1, 0.4, vV);
             // Pearl spot: the pearly flecks it is named for.
             float sp = step(0.86, fNoise(vec2(vU * 70.0, vV * 9.0)));
             c = mix(c, vec3(0.86, 0.92, 0.9), uPat.z * 0.55 * sp * smoothstep(-0.3, 0.2, vV));
             // The eye: dark, with a pale ring.
             float eyeD = length(vec2((vU - 0.075) * 9.0, (vV - 0.25) * 1.4));
             c = mix(c, vec3(0.78, 0.74, 0.5), smoothstep(0.42, 0.3, eyeD));
             c = mix(c, vec3(0.03), smoothstep(0.26, 0.16, eyeD));
             // Fins are thin and darker.
             if (vFin > 0.5) c = uFinC;
             diffuseColor.rgb = c;
           }`,
        )
        .replace(
          "#include <opaque_fragment>",
          `{
             // Under water. The light from the fish crosses depth * slant of
             // water to reach the surface, losing red first; what is lost is
             // replaced by the river's own colour, lit like the water is.
             float path = max(vDepthM, 0.0) * uPath;
             vec3 T = exp(-uSigma * path);
             // Sun-flecks across the back, shallow fish only.
             float caus = smoothstep(0.62, 0.9, fNoise(vWorldP.xz * 1.9 + vec2(uTime * 0.21, uTime * 0.33)))
                        * smoothstep(-0.1, 0.6, vV) * exp(-max(vDepthM, 0.0) * 2.2) * (1.0 - uNight) * step(0.0, vDepthM);
             // Light under the ripples comes and goes across the body too.
             float shim = 0.9 + 0.2 * fNoise(vWorldP.xz * 3.0 + vec2(uTime * 0.5, -uTime * 0.4));
             vec3 lit = outgoingLight * shim * (1.0 + 0.55 * caus);
             vec3 river = uTint * mix(0.62, 0.06, uNight);
             outgoingLight = mix(river, lit, T);
             // How much of the eye's view of this point the fish is: what the
             // surface lets through, less with depth, and fins see-through.
             float vis = vDepthM < 0.0
               ? (vFin > 0.5 ? 0.8 : 1.0) // in the air: seen as it is
               : uTransmit * exp(-0.9 * path) * (vFin > 0.5 ? 0.55 : 1.0);
             // A fish just under the surface is never perfectly sharp.
             diffuseColor.a = clamp(vis, 0.0, 1.0);
           }
           #include <opaque_fragment>`,
        );
    };
    mat.customProgramCacheKey = () => `river-fish-${sp.name}-v4`;
    mats.push(mat);
    const mesh = new THREE.InstancedMesh(geo, mat, sp.count);
    mesh.name = `river-fish-${sp.name}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    // Drawn after the water (renderOrder 0), as light coming up through it.
    mesh.renderOrder = 2;
    mesh.userData.noMirror = true;
    group.add(mesh);
    meshes.push(mesh);
    depthAttrs.push(depthA);
    swimAttrs.push(swimA);

    // Place the fish: groups start together somewhere suitable.
    let made = 0;
    let g = 0;
    while (made < sp.count) {
      const n = Math.min(sp.group, sp.count - made);
      let cx = 0;
      let cz = 0;
      for (let tries = 0; tries < 200; tries++) {
        cx = B.x0 + rnd() * (B.x1 - B.x0);
        cz = B.z0 + rnd() * (B.z1 - B.z0);
        if (suits(sp, cx, cz, sp.depth[1])) break;
      }
      for (let k = 0; k < n; k++) {
        const len = sp.length * U * (0.85 + rnd() * 0.3);
        const f: Fish = {
          sp: si,
          slot: made,
          group: si * 100 + g,
          len,
          x_: cx + (rnd() - 0.5) * len * 4,
          z: cz + (rnd() - 0.5) * len * 4,
          depth: sp.depth[0] + rnd() * (sp.depth[1] - sp.depth[0]),
          wantDepth: sp.depth[0] + rnd() * (sp.depth[1] - sp.depth[0]),
          heading: rnd() * Math.PI * 2,
          turnRate: 0,
          speed: sp.cruise * len * 0.6,
          wantSpeed: sp.cruise * len,
          phase: rnd() * 6.28,
          beatAmp: sp.amp,
          gliding: 0,
          fright: 0,
          wanderX: cx,
          wanderZ: cz,
          wanderT: 0,
          pauseT: 0,
          cstart: -1,
          cside: 1,
          bend: 0,
          pitch: 0,
          riseIn: 20 + rnd() * 70,
          rising: 0,
          leapIn: sp.name === "mullet" ? 25 + rnd() * 150 : Infinity,
          leap: null,
        };
        fish.push(f);
        made++;
      }
      g++;
    }
  });

  /** Is (x, z) water deep enough for this fish at this depth, and its kind of place? */
  function suits(sp: Species, x: number, z: number, depthM: number): boolean {
    if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return false;
    if (!host.isWater(x, z)) return false;
    const water = (host.surfaceY - host.bedY(x, z)) / U;
    if (water < depthM + 0.12) return false;
    if (sp.shallows > 0 && water > sp.shallows * 1.8) return false;
    return true;
  }

  function pickWander(
    f: Fish,
    sp: Species,
    near: { x: number; z: number } | null,
  ) {
    for (let tries = 0; tries < 30; tries++) {
      const r = (near ? 6 : 26) * (0.4 + rnd());
      const a = rnd() * Math.PI * 2;
      const bx = near ? near.x : f.x_;
      const bz = near ? near.z : f.z;
      const x = bx + Math.cos(a) * r;
      const z = bz + Math.sin(a) * r * 0.6;
      if (suits(sp, x, z, f.wantDepth)) {
        f.wanderX = x;
        f.wanderZ = z;
        f.wanderT = 6 + rnd() * 10;
        return;
      }
    }
    f.wanderX = f.x_;
    f.wanderZ = f.z;
    f.wanderT = 2;
  }

  // ── SPLASHES: a leap throws up a little water. Droplets fly on their own
  // arcs and drop back in; a pool, so nothing is made while it plays.
  const DROPS = 72;
  const dropPos = new Float32Array(DROPS * 3).fill(-999);
  const dropVel = new Float32Array(DROPS * 3);
  let dropNext = 0;
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(dropPos, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const dropMat = new THREE.PointsMaterial({
    color: 0xe9f3f1,
    size: 2.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const drops = new THREE.Points(dropGeo, dropMat);
  drops.name = "river-splash";
  drops.frustumCulled = false;
  drops.renderOrder = 3;
  drops.userData.noMirror = true;
  group.add(drops);
  function splash(x: number, z: number, n: number) {
    const k = host.scaleAt(z);
    for (let i = 0; i < n; i++) {
      const j = dropNext++ % DROPS;
      const a = rnd() * Math.PI * 2;
      const out = (0.25 + rnd() * 0.6) * U * k;
      dropPos[j * 3] = x;
      dropPos[j * 3 + 1] = host.surfaceY + 0.02;
      dropPos[j * 3 + 2] = z;
      dropVel[j * 3] = Math.cos(a) * out;
      dropVel[j * 3 + 1] = (1.2 + rnd() * 1.4) * U * k;
      dropVel[j * 3 + 2] = Math.sin(a) * out * 0.6;
    }
  }
  function stepDrops(step: number) {
    let live = false;
    for (let j = 0; j < DROPS; j++) {
      if (dropPos[j * 3 + 1]! < -900) continue;
      live = true;
      dropVel[j * 3 + 1]! -= 9.8 * U * step;
      dropPos[j * 3]! += dropVel[j * 3]! * step;
      dropPos[j * 3 + 1]! += dropVel[j * 3 + 1]! * step;
      dropPos[j * 3 + 2]! += dropVel[j * 3 + 2]! * step;
      if (dropPos[j * 3 + 1]! < host.surfaceY) dropPos[j * 3 + 1] = -999;
    }
    if (live) dropGeo.attributes.position!.needsUpdate = true;
  }

  // ── LEAVES ON THE CURRENT. A few fallen mangrove leaves drift downstream
  // (the way the water's ripple pattern runs, about a quarter of a metre a
  // second), faster mid-channel than by the banks, turning slowly and riding
  // the ripples; at the end of the reach a new one comes in at the top.
  const LEAVES = 9;
  const leafGeo = (() => {
    // A leaf: pointed oval, a touch cupped, lying flat; 1 unit long.
    const pts: number[] = [];
    const ids: number[] = [];
    const N = 10;
    pts.push(0.5, 0.0, 0);
    for (let i = 1; i < N; i++) {
      const u = i / N;
      const x = 0.5 - u;
      const w = 0.21 * Math.sin(u * Math.PI) * (1 - 0.25 * u);
      pts.push(x, 0.03, w, x, 0.0, 0, x, 0.03, -w);
    }
    pts.push(-0.5, 0.0, 0);
    const tipEnd = 1 + (N - 1) * 3;
    for (let i = 0; i < N - 1; i++) {
      const a = i === 0 ? 0 : 1 + (i - 1) * 3;
      const b = 1 + i * 3;
      if (i === 0) {
        ids.push(0, b, b + 1, 0, b + 1, b + 2);
      } else {
        ids.push(
          a,
          b,
          a + 1,
          a + 1,
          b,
          b + 1,
          a + 1,
          b + 1,
          a + 2,
          a + 2,
          b + 1,
          b + 2,
        );
      }
    }
    const last = 1 + (N - 2) * 3;
    ids.push(last, tipEnd, last + 1, last + 1, tipEnd, last + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.setIndex(ids);
    g.computeVertexNormals();
    return g;
  })();
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, LEAVES);
  leaves.name = "river-leaves";
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leaves.frustumCulled = false;
  leaves.userData.noMirror = true;
  group.add(leaves);
  const leafTones = [0x6f7f2e, 0x8a7a2c, 0x9b6a2a, 0x5f6b2a, 0xa88b3a];
  const leaf = Array.from({ length: LEAVES }, (_, i) => ({
    x: 0,
    z: 0,
    yaw: rnd() * Math.PI * 2,
    spin: (rnd() - 0.5) * 0.25,
    len: (0.08 + rnd() * 0.06) * U,
    tone: i % leafTones.length,
  }));
  const tone = new THREE.Color();
  function placeLeaf(l: (typeof leaf)[number], anywhere: boolean) {
    for (let tries = 0; tries < 40; tries++) {
      const x = B.x0 + rnd() * (B.x1 - B.x0);
      const z = anywhere ? B.z0 + rnd() * (B.z1 - B.z0) : B.z1 - rnd() * 3;
      if (host.isWater(x, z)) {
        l.x = x;
        l.z = z;
        return;
      }
    }
  }
  leaf.forEach((l, i) => {
    placeLeaf(l, true);
    leaves.setColorAt(i, tone.set(leafTones[l.tone]!));
  });
  function stepLeaves(step: number, t: number) {
    for (let i = 0; i < LEAVES; i++) {
      const l = leaf[i]!;
      const water = Math.max(0, (host.surfaceY - host.bedY(l.x, l.z)) / U);
      // Slower in the shallows, as a river runs.
      const run = 0.26 * U * (0.35 + 0.65 * Math.min(1, water / 1.2));
      l.z -= run * step;
      l.x += Math.sin(t * 0.13 + i * 2.1) * 0.05 * U * step;
      l.yaw += l.spin * step;
      if (l.z < B.z0 || !host.isWater(l.x, l.z)) placeLeaf(l, false);
      const k = host.scaleAt(l.z);
      const e2 = 0.3;
      const gx =
        (wHeight(l.x + e2, l.z, host.rippleScale, t) -
          wHeight(l.x - e2, l.z, host.rippleScale, t)) /
        (2 * e2);
      const gz =
        (wHeight(l.x, l.z + e2, host.rippleScale, t) -
          wHeight(l.x, l.z - e2, host.rippleScale, t)) /
        (2 * e2);
      p.set(
        l.x,
        host.surfaceY + 0.012 + wHeight(l.x, l.z, host.rippleScale, t) * 0.01,
        l.z,
      );
      e.set(gz * 0.9, l.yaw, -gx * 0.9);
      q.setFromEuler(e);
      sc.set(l.len * k, l.len * k, l.len * k);
      m4.compose(p, q, sc);
      leaves.setMatrixAt(i, m4);
    }
    leaves.instanceMatrix.needsUpdate = true;
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, "YZX");
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let clock = 0;

  function update(dt: number, night: number) {
    if (dt <= 0) return;
    // OFF SCREEN COSTS NOTHING: the river is in view for two lessons of the
    // chapter, and the fish wait where they are until it is.
    const shown = host.onScreen();
    group.visible = shown;
    if (!shown) return;
    const step = Math.min(dt, 0.05);
    clock += step;
    time.value = clock;
    nightU.value = night;
    const people = host.disturbers();
    // Group centres and mean headings, for schooling.
    const centres = new Map<
      number,
      { x: number; z: number; hx: number; hz: number; n: number }
    >();
    for (const f of fish) {
      const c = centres.get(f.group) ?? { x: 0, z: 0, hx: 0, hz: 0, n: 0 };
      c.x += f.x_;
      c.z += f.z;
      c.hx += Math.cos(f.heading);
      c.hz += Math.sin(f.heading);
      c.n++;
      centres.set(f.group, c);
    }
    for (const c of centres.values()) {
      c.x /= c.n;
      c.z /= c.n;
    }
    for (const f of fish) {
      const sp = SPECIES[f.sp]!;
      // ── Fright: people moving on the deck overhead.
      for (const d of people) {
        const dx = f.x_ - d.x;
        const dz = f.z - d.z;
        const r = Math.hypot(dx, dz);
        if (d.speed > 0.4 && r < 7 && f.fright < 0.2) {
          f.fright = 1;
          // The C-start: the body curls away from the threat in a tenth of a
          // second, then the tail snaps back and drives it off.
          const away = Math.atan2(dz, dx);
          let turnTo = away - f.heading;
          turnTo = Math.atan2(Math.sin(turnTo), Math.cos(turnTo));
          f.cside = turnTo >= 0 ? 1 : -1;
          f.cstart = 0;
          f.heading = away + (rnd() - 0.5) * 0.8;
          pickWander(f, sp, {
            x: f.x_ + (dx / (r || 1)) * 10,
            z: f.z + (dz / (r || 1)) * 6,
          });
        }
      }
      f.fright = Math.max(0, f.fright - step * 0.6);
      // ── Where to: the wander point, pulled to the school.
      f.wanderT -= step;
      const toW = Math.hypot(f.wanderX - f.x_, f.wanderZ - f.z);
      if (f.wanderT <= 0 || toW < f.len * 1.5) {
        // Pearl spot and bass stop and hang in the water now and then.
        if (sp.glide > 0.4 && rnd() < 0.35 && f.fright === 0)
          f.pauseT = 1.5 + rnd() * 4;
        const c = centres.get(f.group)!;
        pickWander(f, sp, c.n > 1 && rnd() < 0.5 ? { x: c.x, z: c.z } : null);
      }
      let tx = f.wanderX - f.x_;
      let tz = f.wanderZ - f.z;
      const c = centres.get(f.group)!;
      if (c.n > 1) {
        // Cohesion and alignment, then separation from the nearest mates.
        tx += (c.x - f.x_) * 0.6 + (c.hx / c.n) * f.len * 3;
        tz += (c.z - f.z) * 0.6 + (c.hz / c.n) * f.len * 3;
        for (const o of fish) {
          if (o === f || o.group !== f.group) continue;
          const ox = f.x_ - o.x_;
          const oz = f.z - o.z;
          const d2 = ox * ox + oz * oz;
          const keep = (f.len * 1.6) ** 2;
          if (d2 < keep && d2 > 1e-6) {
            tx += (ox / Math.sqrt(d2)) * f.len * 4;
            tz += (oz / Math.sqrt(d2)) * f.len * 4;
          }
        }
      }
      // Keep off the shore: feel ahead, and turn away if it gets shallow.
      const look = f.len * 3 + f.speed * 1.2;
      const ax = f.x_ + Math.cos(f.heading) * look;
      const az = f.z + Math.sin(f.heading) * look;
      if (!suits(sp, ax, az, f.depth * 0.8)) {
        const l = f.x_ + Math.cos(f.heading + 0.9) * look;
        const lz = f.z + Math.sin(f.heading + 0.9) * look;
        const turn = suits(sp, l, lz, f.depth * 0.8) ? 1 : -1;
        tx = Math.cos(f.heading + turn * 1.6);
        tz = Math.sin(f.heading + turn * 1.6);
      }
      // ── Steer: a fish turns at a limited rate, faster when frightened.
      const want = Math.atan2(tz, tx);
      let dh = want - f.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      // During a C-start the heading swings with the curl (below).
      const maxTurn = (f.cstart >= 0 ? 0 : f.fright > 0 ? 4.5 : 1.3) * step;
      const turn = Math.max(-maxTurn, Math.min(maxTurn, dh * 2.2 * step));
      f.turnRate = turn / step;
      f.heading += turn;
      // ── Speed: cruise, pause, or burst; the stroke follows.
      f.pauseT = Math.max(0, f.pauseT - step);
      const cruise = sp.cruise * f.len;
      f.wantSpeed =
        f.fright > 0
          ? cruise * (2.5 + 2.5 * f.fright)
          : f.pauseT > 0
            ? cruise * 0.08
            : cruise;
      // Beat and glide: coast for a moment, then a few beats to regain speed.
      if (f.fright === 0 && f.pauseT === 0) {
        if (f.gliding > 0) f.gliding -= step;
        else if (rnd() < sp.glide * step * 0.6) f.gliding = 0.6 + rnd() * 1.2;
      } else f.gliding = 0;
      const accel =
        f.gliding > 0
          ? -0.25 * f.speed
          : (f.wantSpeed - f.speed) * (f.fright > 0 ? 4 : 1.2);
      f.speed = Math.max(0, f.speed + accel * step);
      // Tail beats: about 1.5 beats per body length travelled, a floor of a
      // slow scull when hanging still, none in a glide.
      const freq =
        f.gliding > 0 ? 0.25 : Math.max(0.9, (f.speed / f.len) * 1.5);
      f.phase += freq * step * Math.PI * 2;
      const wantAmp =
        f.gliding > 0
          ? sp.amp * 0.15
          : sp.amp * (f.fright > 0 ? 1.5 : f.pauseT > 0 ? 0.35 : 1);
      f.beatAmp += (wantAmp - f.beatAmp) * Math.min(1, step * 4);
      // The spine's curve: into the turn, or the C-start's curl and snap.
      let wantBend = Math.max(-0.4, Math.min(0.4, f.turnRate * 0.16));
      if (f.cstart >= 0) {
        f.cstart += step;
        const t = f.cstart;
        if (t < 0.1) wantBend = 0.75 * f.cside * (t / 0.1);
        else if (t < 0.22)
          wantBend = 0.75 * f.cside - 1.2 * f.cside * ((t - 0.1) / 0.12);
        else f.cstart = -1;
        // The head swings round with the curl.
        f.heading += f.cside * 7 * step * (t < 0.1 ? 1 : 0.4);
        f.speed = Math.max(f.speed, f.len * (t < 0.1 ? 0.5 : 6));
      }
      f.bend +=
        (wantBend - f.bend) * Math.min(1, step * (f.cstart >= 0 ? 30 : 5));
      f.x_ += Math.cos(f.heading) * f.speed * step;
      f.z += Math.sin(f.heading) * f.speed * step;
      const wasDepth = f.depth;
      // ── A LEAP (mullet): out in an arc, a splash and a ring each way.
      // Real mullet do it for no reason anyone agrees on, every few minutes,
      // a body's height or two out of the water.
      f.leapIn -= step;
      if (
        f.leap == null &&
        f.leapIn <= 0 &&
        f.fright === 0 &&
        f.rising === 0 &&
        f.depth < 0.5 &&
        !host.covered(f.x_, f.z)
      ) {
        const vy = 1.7 + rnd() * 0.7; // m/s up: 15-30 cm high
        f.leap = { t: 0, vy, dur: (2 * vy) / 9.8 };
        host.ring(f.x_, f.z, 1.3);
        splash(f.x_, f.z, 10);
        f.speed = Math.max(f.speed, 1.5 * U);
      }
      if (f.leap != null) {
        const L = f.leap;
        L.t += step;
        if (L.t >= L.dur) {
          host.ring(f.x_, f.z, 1.9);
          splash(f.x_, f.z, 18);
          f.leap = null;
          f.depth = 0.15;
          f.leapIn = 90 + rnd() * 200;
        } else {
          f.depth = -(L.vy * L.t - 4.9 * L.t * L.t);
          f.speed = Math.max(f.speed, 1.5 * U);
        }
      } else {
        // ── RISING TO SIP: up to the surface, a small ring, back down.
        f.riseIn -= step;
        if (
          f.rising === 0 &&
          f.riseIn <= 0 &&
          sp.name !== "sea-bass" &&
          f.fright === 0 &&
          !host.covered(f.x_, f.z)
        )
          f.rising = 1;
        if (f.rising === 1 && f.depth < 0.05) {
          host.ring(f.x_, f.z, sp.name === "mullet" ? 0.9 : 0.55);
          f.rising = 0;
          f.riseIn = 40 + rnd() * 80;
          f.wantDepth = sp.depth[0] + rnd() * (sp.depth[1] - sp.depth[0]);
        }
        // Depth: drift toward a preferred depth, never into the bed.
        if (f.rising === 0 && rnd() < step * 0.08)
          f.wantDepth = sp.depth[0] + rnd() * (sp.depth[1] - sp.depth[0]);
        const room = (host.surfaceY - host.bedY(f.x_, f.z)) / U - 0.1;
        const rise = f.rising === 1;
        const want = rise ? 0.02 : f.wantDepth;
        const target = Math.min(
          want,
          Math.max(rise ? 0.02 : sp.depth[0], room),
        );
        f.depth += (target - f.depth) * Math.min(1, step * (rise ? 1.6 : 0.6));
      }
      // ── Pitch: nose up climbing, down diving, following a leap's arc.
      const climb = -(f.depth - wasDepth) / step; // m/s, up positive
      const ahead = Math.max(0.05, f.speed / U);
      const limit = f.leap != null ? 1.2 : 0.55;
      const wantPitch = Math.max(
        -limit,
        Math.min(limit, Math.atan2(climb, ahead)),
      );
      f.pitch +=
        (wantPitch - f.pitch) * Math.min(1, step * (f.leap != null ? 20 : 4));
    }
    stepDrops(step);
    stepLeaves(step, host.waterTime.value);
    // ── Draw.
    const t = host.waterTime.value;
    for (let si = 0; si < SPECIES.length; si++) {
      const mesh = meshes[si]!;
      const depthA = depthAttrs[si]!;
      const swimA = swimAttrs[si]!;
      for (const f of fish) {
        if (f.sp !== si) continue;
        const k = host.scaleAt(f.z);
        const len = f.len * k;
        // Seen through the surface: raised to the apparent depth, and moved
        // by the ripple over it (more the deeper it is).
        // Out of the water (a leap) it is where it is; in it, it is seen raised.
        const apparent = f.depth < 0 ? f.depth * U : (f.depth * U) / 1.33;
        const e2 = 0.25;
        const gx =
          (wHeight(f.x_ + e2, f.z, host.rippleScale, t) -
            wHeight(f.x_ - e2, f.z, host.rippleScale, t)) /
          (2 * e2);
        const gz =
          (wHeight(f.x_, f.z + e2, host.rippleScale, t) -
            wHeight(f.x_, f.z - e2, host.rippleScale, t)) /
          (2 * e2);
        const shift = host.rippleAmt * 22 * Math.max(0, f.depth) * U;
        p.set(f.x_ + gx * shift, host.surfaceY - apparent, f.z + gz * shift);
        // Head toward the heading; pitch with depth change; bank into turns.
        e.set(
          Math.max(-0.35, Math.min(0.35, -f.turnRate * 0.12)),
          -f.heading,
          f.pitch,
        );
        q.setFromEuler(e);
        sc.set(len, len, len);
        m4.compose(p, q, sc);
        mesh.setMatrixAt(f.slot, m4);
        // Below zero means out of the water: no water between it and the eye.
        depthA.setX(f.slot, f.depth < 0 ? -1 : f.depth);
        // Turn bend: the body curves into the turn.
        // Pectoral activity: braking, hovering and turning work the fins.
        const brake = Math.max(
          0,
          (f.speed - f.wantSpeed) / Math.max(0.01, f.len),
        );
        const fins = Math.min(
          1,
          (f.pauseT > 0 ? 0.6 : 0) + brake * 0.5 + Math.abs(f.turnRate) * 0.3,
        );
        swimA.setXYZW(
          f.slot,
          f.phase,
          f.beatAmp,
          f.bend,
          f.fright > 0.6 ? 0 : fins,
        );
      }
      mesh.instanceMatrix.needsUpdate = true;
      depthA.needsUpdate = true;
      swimA.needsUpdate = true;
    }
  }

  return {
    update,
    leapSoon() {
      for (const f of fish)
        if (SPECIES[f.sp]!.name === "mullet") f.leapIn = rnd() * 3;
    },
    fish: () =>
      fish.map((f) => ({
        x: f.x_,
        z: f.z,
        depth: f.depth,
        sp: SPECIES[f.sp]!.name,
      })),
    dispose() {
      host.scene.remove(group);
      for (const g of geoms) g.dispose();
      for (const m of mats) m.dispose();
      for (const m of meshes) m.dispose();
      dropGeo.dispose();
      dropMat.dispose();
      leafGeo.dispose();
      leafMat.dispose();
      leaves.dispose();
    },
  };
}
