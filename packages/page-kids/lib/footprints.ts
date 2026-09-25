import * as THREE from "three";

/**
 * DUST AND FOOTPRINTS ON THE TIME KEEPERS ROAD (owner, 25 Sep 2026: mock E).
 *
 * Every walker — the child, the companions, the village guide — leaves a
 * faint print on each step, and the step raises a little dust. The rules the
 * owner set on the mocks:
 *
 *   - The dust is never the same twice: how much, how big, which way it
 *     drifts and even its colour are drawn per step. Walking skews light
 *     (about a third of steps raise nothing at all); running raises some on
 *     nearly every step, and more of it.
 *   - The prints are subtle, differ by who made them, hold, then fade out:
 *     four seconds in all.
 *   - Nothing on the bridge. The caller decides where a foot may print
 *     (`allowed`) — dry ground, not a deck, not in the air — because only the
 *     world knows what is underfoot.
 *
 * Everything is pooled and allocated once. A walker that steps while the pool
 * is full reuses the oldest print, which is the one nearest to gone anyway.
 */

/** What a walker's print looks like. */
export type PrintKind =
  | "shoe"
  | "smallShoe"
  | "sandal"
  | "tread"
  | "paw"
  | "bare";

const PRINT_OF: Readonly<Record<string, PrintKind>> = {
  Explorer: "shoe",
  Explorer6: "smallShoe",
  Peeli: "sandal",
  Robot: "tread",
  Puppy: "paw",
};

/** The guide is a village child, barefoot on his own road. */
export function printKindFor(name: string, guide: boolean): PrintKind {
  return guide ? "bare" : (PRINT_OF[name] ?? "shoe");
}

/** Print length as a share of the walker's height; paws are small and many. */
// Larger than life on purpose: the camera looks along the road at about
// eleven degrees, which squashes a print's width to a sliver. At true size
// they rendered — measured by painting them black — as two-pixel dashes.
const LENGTH_OF: Readonly<Record<PrintKind, number>> = {
  shoe: 0.2,
  smallShoe: 0.17,
  sandal: 0.19,
  tread: 0.21,
  paw: 0.15,
  bare: 0.2,
};
/** Width as a share of length. */
const WIDTH_SHARE = 0.55;
/**
 * LEANED TOWARD THE CAMERA. Flat on the road, even painted black at three
 * times the size, a print was a one-pixel ribbon: the camera looks along the
 * road at about eleven degrees. Tipped up by this much about the road's
 * axis — the lower edge on the ground, the upper edge lifted — the shape
 * reads, and at a fifth of full ink it still reads as a mark in the dust
 * rather than a card standing on it.
 */
const TILT = 1.0;

const HOLD = 2.8;
const FADE = 1.2;
const PRINTS = 160;
const PUFFS = 64;
/** How dark a fresh print is. Subtle by request: a shade on the road. */
const PRINT_ALPHA = 0.38;

function printTexture(kind: PrintKind): THREE.Texture {
  // Toe towards +u, heel at the left. Drawn soft: blurred shapes read as a
  // mark pressed into earth, hard ones as a sticker lying on it.
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.filter = "blur(2.5px)";
  g.fillStyle = "#fff";
  const blob = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    g.fill();
  };
  switch (kind) {
    case "shoe":
    case "smallShoe": {
      blob(78, 32, 34, 18); // forefoot
      blob(30, 32, 18, 14); // heel
      g.globalCompositeOperation = "destination-out";
      g.filter = "blur(1px)";
      for (let x = 50; x <= 104; x += 9) g.fillRect(x, 20, 3, 24); // tread bars
      g.fillRect(44, 22, 6, 20); // arch gap
      break;
    }
    case "sandal": {
      blob(76, 32, 36, 17);
      blob(30, 32, 19, 15);
      g.globalCompositeOperation = "destination-out";
      g.filter = "blur(1.5px)";
      blob(96, 30, 5, 3); // the thong post between the toes
      g.fillRect(56, 18, 4, 28); // strap line pressed across
      break;
    }
    case "tread": {
      g.filter = "blur(1.5px)";
      for (let x = 12; x <= 108; x += 16) g.fillRect(x, 14, 11, 36); // blocks
      break;
    }
    case "paw": {
      blob(52, 32, 15, 13); // main pad
      blob(78, 16, 7, 6);
      blob(84, 29, 7, 6);
      blob(84, 42, 7, 6);
      blob(76, 54, 7, 6);
      break;
    }
    case "bare": {
      blob(68, 34, 30, 15, -0.08); // ball and outer edge
      blob(28, 33, 16, 13); // heel
      blob(48, 38, 16, 8); // outer arch
      for (const [x, y, r] of [
        [104, 22, 6],
        [102, 32, 4.5],
        [99, 40, 4],
        [95, 47, 3.5],
        [90, 53, 3.2],
      ] as const)
        blob(x, y, r, r);
      break;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function puffTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type StepInput = {
  /** Who made it — decides the print. */
  readonly name: string;
  readonly guide: boolean;
  /** Feet position (ground height at the walker). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Distance moved this frame along the road (signed). */
  readonly dx: number;
  readonly running: boolean;
  /** The walker's height, for sizing. */
  readonly height: number;
  /** May this foot print here? Dry ground, not a deck, not airborne. */
  readonly allowed: boolean;
  /** Ground height under a point, so a print lies on the slope it is on. */
  readonly groundAt: (x: number, z: number) => number;
};

export type Footprints = {
  step(key: object, s: StepInput): void;
  update(dt: number): void;
  /** Calm mode: prints stay (they are still), dust stops (it moves). */
  setCalm(calm: boolean): void;
  dispose(): void;
};

export function createFootprints(parent: THREE.Object3D): Footprints {
  const group = new THREE.Group();
  group.name = "footprints";
  parent.add(group);

  const textures = new Map<PrintKind, THREE.Texture>();
  const texFor = (k: PrintKind) => {
    let t = textures.get(k);
    if (t == null) textures.set(k, (t = printTexture(k)));
    return t;
  };
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  type Print = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number };
  const prints: Print[] = [];
  for (let i = 0; i < PRINTS; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4a2c18,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(plane, mat);
    mesh.visible = false;
    mesh.renderOrder = 1;
    group.add(mesh);
    prints.push({ mesh, mat, t: Infinity });
  }
  let nextPrint = 0;

  const puffTex = puffTexture();
  type Puff = {
    sprite: THREE.Sprite;
    mat: THREE.SpriteMaterial;
    t: number;
    life: number;
    r0: number;
    grow: number;
    a0: number;
    v: THREE.Vector3;
  };
  const puffs: Puff[] = [];
  for (let i = 0; i < PUFFS; i++) {
    const mat = new THREE.SpriteMaterial({
      map: puffTex,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    group.add(sprite);
    puffs.push({
      sprite,
      mat,
      t: 0,
      life: 0,
      r0: 0,
      grow: 0,
      a0: 0,
      v: new THREE.Vector3(),
    });
  }
  let nextPuff = 0;
  let calm = false;

  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const walked = new WeakMap<object, { d: number; left: boolean }>();

  function puff(
    x: number,
    y: number,
    z: number,
    h: number,
    k: number,
    running: boolean,
    dir: number,
  ) {
    const p = puffs[nextPuff]!;
    nextPuff = (nextPuff + 1) % PUFFS;
    p.t = 0;
    p.life = rnd(0.55, 1.1);
    p.r0 = h * rnd(0.03, running ? 0.075 : 0.045) * (0.7 + 0.5 * k);
    p.grow = h * rnd(0.04, running ? 0.12 : 0.07) * k;
    p.a0 =
      rnd(running ? 0.14 : 0.22, running ? 0.4 : 0.34) * Math.min(1, k + 0.2);
    // Back from the direction of travel, low, and a little either side.
    p.v.set(
      -dir * rnd(0.05, 0.25) * h * (running ? 1.2 : 0.6),
      rnd(0.02, 0.08) * h,
      rnd(-0.06, 0.06) * h,
    );
    // Drier grey-tan to redder earth, per puff.
    const c = Math.random();
    p.mat.color.setRGB(
      (150 + 40 * c) / 255,
      (104 + 30 * c) / 255,
      (70 + 22 * c) / 255,
    );
    p.sprite.position.set(
      x + dir * rnd(-0.04, 0.03) * h,
      y + rnd(0.01, 0.04) * h,
      z + rnd(-0.05, 0.05) * h,
    );
    p.sprite.scale.setScalar(p.r0 * 2);
    p.sprite.visible = true;
  }

  /** How much THIS step kicks up: 0 is nothing at all. */
  function kick(running: boolean): number {
    const r = Math.random();
    // Walking raises a little on nearly every step — too sparse and it could
    // not be seen at all (owner, 25 Sep 2026).
    if (!running)
      return r < 0.1 ? 0 : r < 0.75 ? rnd(0.5, 0.85) : rnd(0.85, 1.15);
    return r < 0.08 ? 0.2 : r < 0.7 ? rnd(0.6, 1) : rnd(1, 1.5);
  }

  return {
    step(key, s) {
      const w = walked.get(key) ?? { d: 0, left: false };
      walked.set(key, w);
      if (!s.allowed) {
        w.d = 0;
        return;
      }
      w.d += Math.abs(s.dx);
      // One print per footfall: a walking step is about 0.38 of a child's
      // height, a running one longer, which is what makes running strides
      // land further apart.
      const stride = s.height * (s.running ? 0.52 : 0.38);
      if (w.d < stride) return;
      w.d -= stride;
      w.left = !w.left;
      const dir = s.dx < 0 ? -1 : 1;
      const kind = printKindFor(s.name, s.guide);
      const len = s.height * LENGTH_OF[kind];
      const side =
        (w.left ? -1 : 1) * s.height * (kind === "paw" ? 0.05 : 0.07);
      const px = s.x + dir * rnd(-0.03, 0.03) * s.height;
      const pz = s.z + side;
      const p = prints[nextPrint]!;
      nextPrint = (nextPrint + 1) % PRINTS;
      p.t = 0;
      p.mat.map = texFor(kind);
      p.mat.needsUpdate = true;
      // Along the direction of travel, a hair off-axis, and the left foot is
      // the right one mirrored; then leaned toward the camera (see TILT) and
      // raised by half its leaned height, so its lower edge sits on the road.
      const wide = len * WIDTH_SHARE;
      p.mesh.rotation.set(
        TILT,
        (dir < 0 ? Math.PI : 0) + rnd(-0.18, 0.18),
        0,
        "XYZ",
      );
      p.mesh.scale.set(len * rnd(0.92, 1.06), 1, wide * (w.left ? -1 : 1));
      p.mesh.position.set(
        px,
        s.groundAt(px, pz) + (wide / 2) * Math.sin(TILT) + 0.002 * s.height,
        pz - (wide / 2) * (1 - Math.cos(TILT)),
      );
      p.mesh.visible = true;
      p.mat.opacity = PRINT_ALPHA * rnd(0.75, 1.1);
      p.mesh.userData.a0 = p.mat.opacity;
      if (!calm) {
        const k = kick(s.running);
        if (k > 0) {
          const n = Math.max(
            1,
            Math.round(rnd(s.running ? 1 : 1, s.running ? 3 : 2.2) * k),
          );
          for (let i = 0; i < n; i++)
            puff(px, s.y, pz, s.height, k, s.running, dir);
        }
      }
    },
    update(dt) {
      for (const p of prints) {
        if (!p.mesh.visible) continue;
        p.t += dt;
        if (p.t >= HOLD + FADE) {
          p.mesh.visible = false;
          continue;
        }
        const a0 = p.mesh.userData.a0 as number;
        p.mat.opacity = p.t < HOLD ? a0 : a0 * (1 - (p.t - HOLD) / FADE);
      }
      for (const p of puffs) {
        if (!p.sprite.visible) continue;
        p.t += dt;
        const u = p.t / p.life;
        if (u >= 1) {
          p.sprite.visible = false;
          continue;
        }
        p.sprite.position.addScaledVector(p.v, dt);
        p.v.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
        p.sprite.scale.setScalar((p.r0 + p.grow * u) * 2);
        p.mat.opacity = p.a0 * (1 - u);
      }
    },
    setCalm(c) {
      calm = c;
      if (calm) for (const p of puffs) p.sprite.visible = false;
    },
    dispose() {
      parent.remove(group);
      plane.dispose();
      for (const p of prints) p.mat.dispose();
      for (const p of puffs) p.mat.dispose();
      for (const t of textures.values()) t.dispose();
      puffTex.dispose();
    },
  };
}
