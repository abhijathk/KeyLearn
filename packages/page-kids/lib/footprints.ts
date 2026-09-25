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

/**
 * What a walker's print looks like — read off each model's own feet
 * (rendered close up, 25 Sep 2026), not guessed. The three children and
 * Abee all wear trainers, so they differ by the sole they leave: a running
 * shoe's chevrons, a canvas shoe's diamond grid, a kid's wavy tread, a bar
 * tread. The villagers are barefoot, except the headman in rubber chappals
 * and the boy in leather slip-ons.
 */
export type PrintKind =
  | "chevron"
  | "canvas"
  | "wave"
  | "bars"
  | "tread"
  | "paw"
  | "bare"
  | "slipper"
  | "loafer";

const PRINT_OF: Readonly<Record<string, PrintKind>> = {
  Explorer: "chevron",
  Explorer6: "canvas",
  Peeli: "wave",
  Abee: "bars",
  Robot: "tread",
  Puppy: "paw",
  FarmerWoman: "bare",
  TeaStall: "bare",
  Blacksmith: "bare",
  Headman: "slipper",
  VillageBoy: "loafer",
};

export function printKindFor(name: string, _guide = false): PrintKind {
  return PRINT_OF[name] ?? "bare";
}

/** Print length as a share of the walker's height; paws are small and many. */
// Larger than life on purpose: the camera looks along the road at about
// eleven degrees, which squashes a print's width to a sliver. At true size
// they rendered — measured by painting them black — as two-pixel dashes.
const LENGTH_OF: Readonly<Record<PrintKind, number>> = {
  chevron: 0.2,
  canvas: 0.19,
  wave: 0.18,
  bars: 0.19,
  tread: 0.21,
  paw: 0.15,
  bare: 0.2,
  slipper: 0.21,
  loafer: 0.2,
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
const PRINTS = 240;
const PUFFS = 64;
/** How strong a fresh print is. Subtle by request: a mark in the dust. */
const PRINT_ALPHA = 0.5;

/*
 * A PRINT PRESSED INTO DUST, NOT A STAMP ON IT (owner: "nicer, real looking").
 *
 * Drawn at 256×128, toe towards +u, the MEDIAL side (big toe, arch) at the top.
 * Four layers, the way a real print reads in dry earth:
 *   - the RIM: the wall the foot pushed down, darkest, just inside the edge;
 *   - the FLOOR: the packed bottom, a lighter brown than the rim;
 *   - the SOLE: its own pattern, pressed darker into the floor;
 *   - the LIP: displaced dust thrown up just outside the edge, paler than
 *     the road — the one light in it, and what makes it read as a hollow.
 */
const W = 256;
const H = 128;
const MID = H / 2;

/** Half-widths along the foot, t = 0 at the heel to 1 at the toe. */
function outline(
  g: CanvasRenderingContext2D,
  top: (t: number) => number,
  bottom: (t: number) => number,
  x0 = 14,
  x1 = 242,
) {
  const N = 48;
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = x0 + (x1 - x0) * t;
    const y = MID - top(t);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    g.lineTo(x0 + (x1 - x0) * t, MID + bottom(t));
  }
  g.closePath();
}

/** A rounded shoe or slipper sole: heel, waist, ball, round toe. */
function sole(g: CanvasRenderingContext2D, waist = 0.72, toe = 1) {
  const cap = (t: number) => Math.sqrt(Math.max(0, 1 - ((t - 0.5) / 0.5) ** 8));
  const lat = (t: number) =>
    cap(t) *
    (t < 0.3
      ? 24 + 6 * (t / 0.3)
      : t < 0.55
        ? 30 - 4 * Math.sin(((t - 0.3) / 0.25) * Math.PI)
        : 30 + 6 * Math.sin(((t - 0.55) / 0.45) * Math.PI * 0.8) * toe);
  const med = (t: number) =>
    cap(t) *
    (t < 0.3
      ? 22 + 6 * (t / 0.3)
      : t < 0.6
        ? 28 - (1 - waist) * 26 * Math.sin(((t - 0.3) / 0.3) * Math.PI)
        : 28 + 8 * Math.sin(((t - 0.6) / 0.4) * Math.PI * 0.85) * toe);
  outline(g, med, lat);
}

/** A bare foot: heel, the lateral edge in contact, the medial arch lifted. */
function bareFoot(g: CanvasRenderingContext2D) {
  const cap = (t: number) => Math.sqrt(Math.max(0, 1 - ((t - 0.5) / 0.5) ** 6));
  const lat = (t: number) =>
    cap(t) * (t < 0.25 ? 22 + 4 * (t / 0.25) : 26 + 4 * Math.sin(t * 2));
  // The arch: almost nothing touches between heel and ball on the medial side.
  const med = (t: number) =>
    cap(t) *
    (t < 0.28
      ? 20
      : t < 0.62
        ? 20 - 21 * Math.sin(((t - 0.28) / 0.34) * Math.PI) ** 1.4
        : 26 + 4 * Math.sin(((t - 0.62) / 0.38) * Math.PI));
  outline(g, med, lat, 14, 196);
  g.fill();
  // Five toes, big toe on the medial side, set just clear of the ball.
  for (const [x, y, rx, ry] of [
    [216, MID - 19, 17, 13],
    [220, MID + 1, 9, 8],
    [214, MID + 15, 8, 7],
    [205, MID + 27, 7, 6],
    [194, MID + 36, 6, 5],
  ] as const) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function dogPaw(g: CanvasRenderingContext2D) {
  // The main pad: three lobes at the back, one broad front edge.
  g.beginPath();
  g.moveTo(70, MID);
  g.bezierCurveTo(70, MID - 34, 130, MID - 40, 140, MID - 14);
  g.bezierCurveTo(146, MID, 146, MID, 140, MID + 14);
  g.bezierCurveTo(130, MID + 40, 70, MID + 34, 70, MID);
  g.fill();
  for (const [x, y] of [
    [170, MID - 34],
    [196, MID - 12],
    [196, MID + 12],
    [170, MID + 34],
  ] as const) {
    g.beginPath();
    g.ellipse(x, y, 17, 13, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Claws: just the two middle ones mark, as on a real dog in dust.
  for (const y of [MID - 14, MID + 14]) {
    g.beginPath();
    g.ellipse(226, y, 5, 3, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/** The pattern a sole presses into the floor, clipped to the sole. */
function pattern(g: CanvasRenderingContext2D, kind: PrintKind) {
  g.lineCap = "round";
  switch (kind) {
    case "chevron":
      g.lineWidth = 5;
      for (let x = 40; x < 236; x += 16) {
        g.beginPath();
        g.moveTo(x - 8, MID - 40);
        g.lineTo(x + 6, MID);
        g.lineTo(x - 8, MID + 40);
        g.stroke();
      }
      break;
    case "canvas":
      g.lineWidth = 2.5;
      for (let d = -140; d < 300; d += 13) {
        g.beginPath();
        g.moveTo(d, 0);
        g.lineTo(d + 128, H);
        g.stroke();
        g.beginPath();
        g.moveTo(d + 128, 0);
        g.lineTo(d, H);
        g.stroke();
      }
      // The toe cap's smooth band, as on a canvas shoe.
      g.lineWidth = 7;
      g.beginPath();
      g.arc(236, MID, 30, Math.PI * 0.6, Math.PI * 1.4);
      g.stroke();
      break;
    case "wave":
      g.lineWidth = 4;
      for (let x = 34; x < 240; x += 14) {
        g.beginPath();
        for (let y = MID - 44; y <= MID + 44; y += 4) {
          const wx = x + Math.sin(y / 7) * 4;
          if (y === MID - 44) g.moveTo(wx, y);
          else g.lineTo(wx, y);
        }
        g.stroke();
      }
      break;
    case "bars":
      g.lineWidth = 6;
      for (let x = 36; x < 238; x += 15) {
        g.beginPath();
        g.moveTo(x, MID - 42);
        g.lineTo(x, MID + 42);
        g.stroke();
      }
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(20, MID);
      g.lineTo(236, MID);
      g.stroke();
      break;
    case "slipper":
      // A chappal is flat: one pressure hollow under the heel and the ball,
      // and the toe post's little hole between the first two toes.
      g.globalAlpha = 0.5;
      g.beginPath();
      g.ellipse(46, MID, 24, 20, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(176, MID - 4, 34, 24, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.ellipse(214, MID - 14, 4, 3, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case "loafer":
      // Smooth leather, with the heel block standing apart from the sole.
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(78, MID - 40);
      g.lineTo(78, MID + 40);
      g.stroke();
      break;
    default:
      break;
  }
}

function printTexture(kind: PrintKind): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  // The shape, as a mask.
  const mask = document.createElement("canvas");
  mask.width = W;
  mask.height = H;
  const m = mask.getContext("2d")!;
  m.fillStyle = "#fff";
  if (kind === "bare") bareFoot(m);
  else if (kind === "paw") dogPaw(m);
  else if (kind === "tread") {
    for (let x = 18; x <= 222; x += 26) m.fillRect(x, MID - 40, 20, 80);
  } else {
    sole(
      m,
      kind === "slipper" ? 0.85 : kind === "loafer" ? 0.6 : 0.7,
      kind === "wave" ? 0.8 : 1,
    );
    m.fill();
  }

  const layer = (fill: string, blur: number, dx = 0, dy = 0, scale = 1) => {
    const l = document.createElement("canvas");
    l.width = W;
    l.height = H;
    const lg = l.getContext("2d")!;
    lg.filter = `blur(${blur}px)`;
    lg.translate(W / 2 + dx, MID + dy);
    lg.scale(scale, scale);
    lg.translate(-W / 2, -MID);
    lg.drawImage(mask, 0, 0);
    lg.filter = "none";
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = "source-in";
    lg.fillStyle = fill;
    lg.fillRect(0, 0, W, H);
    return l;
  };

  // The lip: pale displaced dust just outside the edge, on the far side.
  const lip = layer("rgba(222,196,160,0.55)", 3, 0, -4, 1.04);
  const lipCut = lip.getContext("2d")!;
  lipCut.globalCompositeOperation = "destination-out";
  lipCut.drawImage(mask, 0, 0);
  g.drawImage(lip, 0, 0);
  // The rim, then the lighter floor inside it.
  g.drawImage(layer("rgba(62,38,22,0.95)", 1.5), 0, 0);
  g.drawImage(layer("rgba(104,70,44,0.85)", 2.5, 0, 1, 0.88), 0, 0);
  // The sole's own pattern, pressed darker into the floor.
  if (kind !== "bare" && kind !== "paw" && kind !== "tread") {
    const pat = document.createElement("canvas");
    pat.width = W;
    pat.height = H;
    const pg = pat.getContext("2d")!;
    pg.strokeStyle = pg.fillStyle = "rgba(58,34,20,0.75)";
    pattern(pg, kind);
    pg.globalCompositeOperation = "destination-in";
    pg.drawImage(mask, 0, 0);
    g.filter = "blur(0.8px)";
    g.drawImage(pat, 0, 0);
    g.filter = "none";
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
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
      // White: the colour is in the texture (rim, floor, pattern, lip).
      color: 0xffffff,
      // The left print is the right one mirrored (a negative scale), which
      // with the lean turns its face away from the camera.
      side: THREE.DoubleSide,
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
