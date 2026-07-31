import { profileStorageKey } from "@keybr/pages-shared";
import * as THREE from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { clone as skinnedClone } from "three/addons/utils/SkeletonUtils.js";

// Lives beside (not inside) /assets — webpack cleans that directory on build.
const ASSETS = "/kids-assets";

export type Land = {
  readonly name: string;
  readonly mood: "day" | "overcast";
  readonly tex: string;
  readonly grass: number;
  readonly grassVar: number;
  readonly dirt: number;
  readonly sun: number;
  readonly fog: number;
  readonly path: "stones" | "sand";
  readonly trees: string;
  readonly friend: string;
};

/** Bright lands only — one per session, straight from the Dino Run biomes. */
export const LANDS: readonly Land[] = [
  {
    name: "Fern Valley",
    mood: "day",
    tex: "leafy_grass",
    grass: 0x74b84e,
    grassVar: 0x8ecb64,
    dirt: 0x9a7b4f,
    sun: 0xffe9c4,
    fog: 0xcdeec0,
    path: "stones",
    trees: "Trees",
    friend: "Triceratops",
  },
  {
    name: "Blossom Meadow",
    mood: "day",
    tex: "leafy_grass",
    grass: 0x86cc5e,
    grassVar: 0xa0dc72,
    dirt: 0xc9b287,
    sun: 0xfff2d0,
    fog: 0xd9f0c4,
    path: "stones",
    trees: "BirchTrees",
    friend: "Stegosaurus",
  },
  {
    name: "Pine Ridge",
    mood: "day",
    tex: "leafy_grass",
    grass: 0x6cbf4a,
    grassVar: 0x84d060,
    dirt: 0x8a6f4c,
    sun: 0xffe9c4,
    fog: 0xcbe8bc,
    path: "stones",
    trees: "PineTrees",
    friend: "Apatosaurus",
  },
  {
    name: "Amber Sands",
    mood: "day",
    tex: "sandy_gravel",
    grass: 0xd8b878,
    grassVar: 0xc9a865,
    dirt: 0xba9358,
    sun: 0xffe2b0,
    fog: 0xf0e0b8,
    path: "sand",
    trees: "PalmTrees",
    friend: "Parasaurolophus",
  },
];

// Hero Trail — a gentle quest through the enchanted forest. Same trails and
// mood as Dino Run, but a little band of heroes walking home.
export const HERO_LANDS: readonly Land[] = [
  {
    name: "Greenwood",
    mood: "day",
    tex: "leafy_grass",
    grass: 0x6cc24a,
    grassVar: 0x86d660,
    dirt: 0x9a7b4f,
    sun: 0xfff0cf,
    fog: 0xcdeec0,
    path: "stones",
    trees: "HeroTrees",
    friend: "Ranger",
  },
  {
    name: "Sunny Glade",
    mood: "day",
    tex: "leafy_grass",
    grass: 0x7ed257,
    grassVar: 0x98e070,
    dirt: 0xc4a568,
    sun: 0xfff6d6,
    fog: 0xd9f0c4,
    path: "stones",
    trees: "HeroTrees",
    friend: "Mage",
  },
  {
    name: "Old Oak Way",
    mood: "day",
    tex: "leafy_grass",
    grass: 0x63b84a,
    grassVar: 0x7fcc60,
    dirt: 0xb08d58,
    sun: 0xffecc0,
    fog: 0xcbe8bc,
    path: "sand",
    trees: "HeroTrees",
    friend: "Barbarian",
  },
];

/**
 * A world theme: same engine (camera, run loop, particles, physics, and the
 * whole KidsWorld API), different cast and scenery. The dino theme reproduces
 * the original behaviour exactly; the hero theme swaps in KayKit adventurers.
 */
export type WorldTheme = {
  /** Folder under models/ for the player and companion models. */
  readonly modelDir: string;
  /** Folder under models/ for the scatter collection GLBs. */
  readonly sceneryDir: string;
  readonly defaultPlayer: string;
  readonly playerHeight: (name: string) => number;
  /** Dino-style baby→adult body morph. Cube characters only scale. */
  readonly morphsBody: boolean;
  readonly lands: readonly Land[];
  /** Companions dotted along the trail. "$friend" resolves to land.friend. */
  readonly herd: readonly {
    readonly model: string;
    readonly x: number;
    readonly z: number;
    readonly h: number;
  }[];
  /** Shared ground dressing (the per-biome trees are added separately). */
  readonly ground: readonly (readonly [
    string,
    number,
    number,
    number,
    "back" | "both",
    number?, // optional per-category size multiplier (e.g. bigger buildings)
  ])[];
  /** Multiplier on scenery size — cube models are authored larger. */
  readonly sceneryScale: number;
  /** How many per-biome trees to scatter (default 30). */
  readonly treeCount?: number;
  /** A pool of "spooky" models: one random guard stands near the camp flag
   * every session, and a whole crew joins around Halloween. */
  readonly flagGuard?: readonly string[];
  /** Show the floating game-style pointer ring over the hero (Hero Trail). */
  readonly pointerRing?: boolean;
  /** Companions turn to watch the hero pass (Hero Trail). Off = they just
   * carry on with their own idle, like the original dino herd. */
  readonly companionsWatch?: boolean;
  /** Scatter a flock of little sheep across the land (Dino Run). */
  readonly sheep?: boolean;
  /** Fraction of companions that patrol back and forth guarding their patch. */
  readonly guardRate?: number;
  /** Photo-textured ground (dino) vs. flat stylized ground (cube/hero). */
  readonly floorTextured: boolean;
  /** Ground opacity — a see-through floor reads airier (1 = solid). */
  readonly floorOpacity: number;
  /** HDR skybox (dino) vs. a flat 2D gradient sky (cube/hero). */
  readonly sky: "hdr" | "flat";
  /** GLBs whose animation clips are shared by every character (KayKit rigs
   * ship their movement clips separately from the meshes). */
  readonly animationUrls?: readonly string[];
  /** Camera framing. The hero world uses a flatter, side-on, zoomed view;
   * dino/cube keep the original 3/4 angle. */
  readonly view?: {
    readonly camY: number;
    readonly camZ: number;
    readonly lookY: number;
    readonly frustum: number;
    readonly topF: number;
    readonly botF: number;
  };
  /** Colour grade. Hero is punchy and kids-bright; dino is subtler. `sat` and
   * `bright` are the base CSS saturate()/brightness() amounts, scaled live by
   * the in-game brightness/paleness slider. */
  readonly grade?: {
    readonly exposure: number;
    readonly sat: number;
    readonly bright: number;
    readonly sun: number;
    readonly hemi: number;
  };
  /** Saturation multiplier applied to the PLAYER's materials, to keep the main
   * character vivid when the scene grade desaturates everything (Hero Trail is
   * paled down, but the hero should still read at full colour). */
  readonly playerVivid?: number;
};

const DEFAULT_VIEW = {
  camY: 14,
  camZ: 22,
  lookY: 2.2,
  frustum: 13.5,
  topF: 0.62,
  botF: 1.38,
} as const;

export const DINO_THEME: WorldTheme = {
  modelDir: "dino",
  sceneryDir: "nature",
  defaultPlayer: "TRex",
  playerHeight: (name) =>
    name === "TRex" ? 3.1 : name === "Triceratops" ? 2.6 : 2.3,
  morphsBody: true,
  lands: LANDS,
  // Fewer dinosaurs now — the flock of sheep fills out the meadow instead.
  herd: [
    { model: "$friend", x: 8, z: -7, h: 2.6 },
    { model: "Apatosaurus", x: 40, z: -10, h: 3.4 },
    { model: "$friend", x: 90, z: -8, h: 2.6 },
    { model: "Stegosaurus", x: 134, z: -7, h: 2.4 },
  ],
  ground: [
    ["Bushes", 16, 4, 16, "both"],
    ["Rocks", 12, 5, 22, "back"],
    ["Flowers", 24, 3, 14, "both"],
  ],
  sceneryScale: 1,
  sheep: true,
  // A rare pacing "guard" here and there; commoner over on the Hero Trail.
  guardRate: 0.1,
  // Modernised like Hero Trail (flat ground + gradient sky + flatter camera),
  // but with a SUBTLE grade — gentle saturation and contrast, not punchy.
  floorTextured: false,
  floorOpacity: 1,
  sky: "flat",
  view: { camY: 11, camZ: 30, lookY: 3.0, frustum: 13, topF: 0.66, botF: 1.34 },
  grade: {
    exposure: 1.36,
    sat: 1.2,
    bright: 1.05,
    sun: 2.85,
    hemi: 0.82,
  },
};

// Hero Trail — a little band of adventurers questing home through the forest.
// KayKit heroes share one rig, so their walk/run/idle clips are loaded from a
// shared animation GLB and bound to every character by bone name.
export const HERO_THEME: WorldTheme = {
  modelDir: "hero",
  sceneryDir: "hero",
  defaultPlayer: "Knight",
  playerHeight: () => 3.4,
  morphsBody: false,
  animationUrls: ["anims-move.glb", "anims-idle.glb"],
  lands: HERO_LANDS,
  // A quieter trail — just a few fellow heroes spread out (the lone skeleton
  // guard near the flag is added separately).
  herd: [
    { model: "$friend", x: 10, z: -6, h: 3.2 },
    { model: "Mage", x: 46, z: -8, h: 3.2 },
    { model: "Ranger", x: 92, z: -6, h: 3.2 },
    { model: "Rogue", x: 132, z: -8, h: 3.0 },
  ],
  // A lush tropical forest — a few big trees, lots of bushes, grass and rocks,
  // with the odd village building tucked into the treeline.
  treeCount: 15,
  ground: [
    ["HeroBuildings", 4, 9, 18, "back", 2.6],
    ["HeroBushes", 54, 2.5, 15, "both"],
    ["HeroRocks", 20, 3, 18, "both"],
    ["HeroGrass", 96, 1.5, 14, "both"],
  ],
  sceneryScale: 1.2,
  // Skeleton_Warrior is reserved as a selectable main character, so the trail
  // guards are the other skeletons only.
  flagGuard: ["Skeleton_Minion", "Skeleton_Mage", "Skeleton_Rogue"],
  floorTextured: false,
  floorOpacity: 1,
  sky: "flat",
  pointerRing: true,
  companionsWatch: true,
  // More of the heroes patrol their stretch of the trail than the dinos do.
  guardRate: 0.22,
  // Flatter and more horizontal than the dino 3/4 view, but still angled
  // enough to show the forest behind the trail. The runner sits high in the
  // frame (big botF) so the practice-text card never covers it.
  view: { camY: 11, camZ: 33, lookY: 3.6, frustum: 12, topF: 0.6, botF: 1.28 },
  // Softer grade — the default punchy look was too saturated and distracting.
  // Just a gentle calm (a touch less saturation, a little more ambient fill),
  // not washed out; the child can dial brightness/paleness further with the
  // in-game slider. The hero keeps a small colour boost so it stays the focus.
  grade: {
    exposure: 1.42,
    sat: 1.12,
    bright: 1.04,
    sun: 2.75,
    hemi: 0.78,
  },
  playerVivid: 1.12,
};

/** How far one round carries the runner. The trail never rewinds — each new
 * round plants the camp flag another stretch ahead. Longer than it looks: a
 * round ends when the passage does, so the distance is what turns a handful of
 * words into a journey worth finishing. */
const RUN_LEN = 64;
/** Trail coverage: about four rounds land-to-land, plus a margin. */
const TRAIL_END = 260;
const groundY = (x: number) =>
  Math.sin(x * 0.045) * 1.6 + Math.sin(x * 0.011 + 1.7) * 2.4;
/** The trail wanders a little, like feet chose it — never far from the lane. */
const meander = (x: number) =>
  Math.sin(x * 0.07) * 0.7 + Math.sin(x * 0.023 + 2.1) * 0.4;
const groundNoise = (x: number, z: number) =>
  Math.sin(x * 0.7 + z * 1.3) * Math.cos(x * 0.31 - z * 0.7);
/** The full terrain height at any (x, z) — matches the ground-mesh vertices,
 * so props sit exactly on the surface (not just at the trail height). */
const terrainY = (x: number, z: number) => {
  let y = groundY(x);
  const distLane = Math.max(0, Math.abs(z) - 2.6);
  y += groundNoise(x * 0.35, z * 0.5) * 0.35 * Math.min(1, distLane / 3);
  if (z < -10) {
    y += (-z - 10) * (0.3 + 0.1 * Math.sin(x * 0.05));
  }
  return y;
};

type DinoRig = {
  readonly wrap: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  readonly run: THREE.AnimationAction | null;
  readonly idle: THREE.AnimationAction | null;
};

export type KidsWorld = {
  readonly land: Land;
  readonly ready: Promise<void>;
  setPlayer(name: string): Promise<void>;
  setProgress(frac: number): void;
  /** Plant the camp flag a fresh stretch ahead — the runner never rewinds. */
  startRun(): void;
  jump(): void;
  /** A happy little bounce — for streaks and other proud moments. */
  hop(): void;
  /** The dino turns to the viewer and wiggles — "come on, keep typing!" */
  beckon(): void;
  stumble(): void;
  roar(): void;
  /** The flag is reached: celebrate, in this world's own idiom. */
  celebrate(): void;
  /** A celebratory size-pop when a new key unlocks. */
  grow(): void;
  /** Baby (0) → adult (1): reshapes the dino's body, size, colour and gait. */
  setAge(age: number): void;
  burstAtPlayer(colors: readonly number[], count?: number, up?: number): void;
  playerScreenXY(): readonly [number, number] | null;
  setNight(night: boolean): void;
  /** Live look control: `brightness` (~0.7–1.3) scales brightness, `paleness`
   * (0 = full colour, 1 = very pale) desaturates the whole scene. */
  setLook(brightness: number, paleness: number): void;
  /** Ambient motion intensity for all companions/sheep: 1 = full liveliness,
   * 0 = they hold still (a calmer, less busy scene). */
  setMotion(intensity: number): void;
  /** Lay the current practice word out as 3-D letter blocks on the trail
   * (youngest kids). `index` is the letter to type next; empty word hides them. */
  setWord(word: string, index: number): void;
  resize(): void;
  dispose(): void;
};

export function createKidsWorld(
  canvas: HTMLCanvasElement,
  land: Land,
  theme: WorldTheme = DINO_THEME,
): KidsWorld {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const bright = theme.sky === "flat";
  // Hero Trail is punchy and kids-bright; the dino world is graded subtler so
  // it doesn't sit at high contrast. Falls back to the classic HDR grade.
  const grade =
    theme.grade ??
    (bright
      ? { exposure: 1.5, sat: 1.5, bright: 1.12, sun: 3.0, hemi: 1.0 }
      : { exposure: 1.16, sat: 1.07, bright: 1.0, sun: 2.4, hemi: 0.5 });
  renderer.toneMappingExposure = grade.exposure;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  // The child's brightness/paleness slider scales the base grade live:
  // brightness multiplies CSS brightness(); paleness (0..1) desaturates.
  let userBright = 1;
  let userPale = 0;
  const applyLook = () => {
    const sat = Math.max(0, grade.sat * (1 - userPale * 0.85));
    const b = grade.bright * userBright;
    canvas.style.filter = `saturate(${sat.toFixed(3)}) brightness(${b.toFixed(3)})`;
  };
  applyLook();

  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(land.sun, grade.sun);
  sun.position.set(-18, 30, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  const hemi = new THREE.HemisphereLight(0xffffff, land.grass, grade.hemi);
  const HERO_LIGHT_LAYER = 1;
  const heroLamp = new THREE.PointLight(0xfff0d0, 0, 3.4, 2);
  heroLamp.layers.set(HERO_LIGHT_LAYER);
  heroLamp.position.set(-6, 4, 3);
  scene.add(sun, hemi, heroLamp);
  // The cube world fogs in nearer so the ground dissolves into the flat sky
  // at the horizon — no hard grass/sky seam.
  scene.fog = bright
    ? new THREE.Fog(land.fog, 34, 120)
    : new THREE.Fog(land.fog, 60, 160);

  const V = theme.view ?? DEFAULT_VIEW;
  const cam = new THREE.OrthographicCamera();
  cam.layers.enable(HERO_LIGHT_LAYER);
  function resize() {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 300;
    const a = w / h;
    const S = V.frustum;
    cam.left = -S * a;
    cam.right = S * a;
    // The frustum reaches further below the look-at point than above it, so
    // the trail (and the runner) sit clear of the floating words bar.
    cam.top = S * V.topF;
    cam.bottom = -S * V.botF;
    cam.near = -100;
    cam.far = 300;
    cam.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  cam.position.set(-10, V.camY, V.camZ);
  cam.lookAt(0, V.lookY, 0);

  // ── sky ────────────────────────────────────────────────────────────────
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rgbe = new RGBELoader();
  async function applySky(mood: string) {
    // Day/night lighting: bright and warm by day, a touch darker and cool by
    // night — the whole pane dims without moving the sun.
    const night = mood === "night";
    heroLamp.intensity = night ? 3.2 : 0;
    renderer.toneMappingExposure = grade.exposure * (night ? 0.56 : 1);
    hemi.intensity = grade.hemi * (night ? 0.42 : 1);
    hemi.color.set(night ? 0x5b6ba8 : 0xffffff);
    if (theme.sky === "flat") {
      // A 2D gradient sky drawn to a canvas — no orbiting camera means no
      // skybox is needed, and a flat backdrop suits the stylized world.
      const [top, bottom] = night
        ? ["#141a35", "#2a3358"]
        : ["#7ec5f2", "#d7f0d2"];
      const c = document.createElement("canvas");
      c.width = 16;
      c.height = 256;
      const g = c.getContext("2d")!;
      const grad = g.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, top);
      grad.addColorStop(1, bottom);
      g.fillStyle = grad;
      g.fillRect(0, 0, 16, 256);
      const sky = new THREE.CanvasTexture(c);
      sky.colorSpace = THREE.SRGBColorSpace;
      scene.background = sky;
      scene.backgroundBlurriness = 0;
      scene.environment = null;
      scene.environmentIntensity = 1;
      scene.backgroundIntensity = 1;
      // Fog matches the sky's lower band so the ground fades straight into
      // the backdrop.
      // Fog closes in after dark, so the far trail fades into the blue.
      (scene.fog as THREE.Fog).color.set(night ? 0x2a3358 : 0xd7f0d2);
      sun.intensity = grade.sun * (night ? 0.46 : 1);
      sun.color.set(night ? 0x7f92cc : land.sun);
      return;
    }
    const tex = await rgbe.loadAsync(`${ASSETS}/env/${mood}.hdr`);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = tex;
    scene.backgroundBlurriness = 0.06;
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    scene.environmentIntensity = mood === "night" ? 0.4 : 0.7;
    scene.backgroundIntensity = mood === "night" ? 0.75 : 1.0;
    (scene.fog as THREE.Fog).color.set(mood === "night" ? 0x2c3560 : land.fog);
    sun.intensity = mood === "night" ? 1.25 : 2.4;
    sun.color.set(mood === "night" ? 0x8fa2d8 : land.sun);
  }

  // ── terrain, worn trail, stepping stones ───────────────────────────────
  const tl = new THREE.TextureLoader();
  function jitterGeo(geo: THREE.BufferGeometry, amt: number) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + (Math.random() - 0.5) * amt,
        pos.getY(i) + (Math.random() - 0.5) * amt,
        pos.getZ(i) + (Math.random() - 0.5) * amt,
      );
    }
    geo.computeVertexNormals();
    return geo;
  }
  // The finished ground mesh, kept so props can be dropped onto the exact
  // rendered surface (raycast) rather than the analytic height — the two differ
  // slightly between vertices, which is what made props hover.
  let groundMesh: THREE.Mesh | null = null;
  const _groundRay = new THREE.Raycaster();
  const _rayFrom = new THREE.Vector3();
  const _rayDir = new THREE.Vector3(0, -1, 0);
  /** The real surface height at (x, z): raycast the ground mesh, falling back
   * to the analytic terrain height off the mesh. `sink` plants feet a touch
   * into the ground so nothing ever appears to float. */
  const surfaceY = (x: number, z: number, sink = 0.06) => {
    if (groundMesh) {
      _rayFrom.set(x, 200, z);
      _groundRay.set(_rayFrom, _rayDir);
      const hit = _groundRay.intersectObject(groundMesh, false);
      if (hit.length > 0) return hit[0].point.y - sink;
    }
    return terrainY(x, z) - sink;
  };
  {
    const diff = tl.load(`${ASSETS}/textures/${land.tex}_diff.jpg`);
    diff.colorSpace = THREE.SRGBColorSpace;
    const nor = tl.load(`${ASSETS}/textures/${land.tex}_nor.jpg`);
    for (const t of [diff, nor]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(40, 8);
    }
    const geo = new THREE.PlaneGeometry(400, 120, 200, 40);
    geo.rotateX(-Math.PI / 2);
    geo.translate(60, 0, 0); // centre the ground on the trail, not the origin
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(land.grass);
    const cVar = new THREE.Color(land.grassVar);
    const cDirt = new THREE.Color(land.dirt);
    const tmp = new THREE.Color();
    const noise2 = groundNoise;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainY(x, z));
      const n = (noise2(x * 0.8, z * 0.9) + 1) / 2;
      // Textured ground stays pale (the photo map darkens it); flat cube
      // ground carries a softer, pastel grass so it melts into the sky
      // rather than sitting as a hard bright slab.
      tmp
        .setRGB(1, 1, 1)
        .lerp(cGrass, theme.floorTextured ? 0.4 : 0.72)
        .lerp(cVar, n * (theme.floorTextured ? 0.2 : 0.32));
      const patch = (noise2(x * 0.09 + 7.3, z * 0.13) + 1) / 2;
      if (patch > 0.62) {
        tmp.lerp(cDirt, (patch - 0.62) * 0.9);
      }
      const halfWidth =
        (land.path === "sand" ? 2.2 : 1.6) + noise2(x * 0.17, 3.1) * 0.45;
      const pathBlend = Math.max(
        0,
        1 - Math.abs(z - meander(x)) / Math.max(1, halfWidth),
      );
      tmp.lerp(cDirt, pathBlend * (land.path === "stones" ? 0.5 : 0.85));
      if (pathBlend > 0.55) {
        // the packed, well-trodden core of the trail is a shade deeper
        tmp.lerp(cDirt.clone().multiplyScalar(0.82), (pathBlend - 0.55) * 0.7);
      }
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    // Cube world: flat stylized ground (vertex colours only) so the floor
    // reads as a low-poly surface under the blocky cast, not photo grass.
    const ground = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        map: theme.floorTextured ? diff : null,
        normalMap: theme.floorTextured ? nor : null,
        normalScale: new THREE.Vector2(0.85, 0.85),
        // A see-through floor (cube) reads airier; the hero forest stays solid.
        transparent: theme.floorOpacity < 1,
        opacity: theme.floorOpacity,
      }),
    );
    ground.receiveShadow = true;
    ground.updateMatrixWorld(true);
    groundMesh = ground;
    scene.add(ground);

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    if (land.path === "stones") {
      // Hand-laid slabs: no two alike — each gets its own warm-grey tint,
      // an elliptical squash, a lean into the hillside, and a real shadow.
      const count = 110;
      const stones = new THREE.InstancedMesh(
        jitterGeo(new THREE.CylinderGeometry(1, 1.18, 0.2, 7), 0.16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }),
        count,
      );
      const cStone = new THREE.Color(0x9c948a);
      const cWarm = new THREE.Color(land.dirt);
      let sx = -40;
      for (let i = 0; i < count; i++) {
        sx += 1.35 + Math.random() * 1.15;
        const sz = meander(sx) + (Math.random() - 0.5) * 1.5;
        const slope = (groundY(sx + 0.6) - groundY(sx - 0.6)) / 1.2;
        dummy.position.set(sx, groundY(sx) + 0.04, sz);
        dummy.rotation.set(
          (Math.random() - 0.5) * 0.1,
          Math.random() * Math.PI,
          -slope * 0.5 + (Math.random() - 0.5) * 0.1,
        );
        const base = 0.55 + Math.random() * 0.6;
        dummy.scale.set(
          base * (0.85 + Math.random() * 0.5),
          1,
          base * (0.85 + Math.random() * 0.5),
        );
        dummy.updateMatrix();
        stones.setMatrixAt(i, dummy.matrix);
        tint
          .copy(cStone)
          .lerp(cWarm, Math.random() * 0.35)
          .multiplyScalar(0.9 + Math.random() * 0.25);
        stones.setColorAt(i, tint);
      }
      stones.castShadow = true;
      stones.receiveShadow = true;
      scene.add(stones);
    }

    // Pebbles kicked to the edges of the trail — every land has them.
    {
      const count = 130;
      const pebbles = new THREE.InstancedMesh(
        new THREE.DodecahedronGeometry(0.14, 0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
        count,
      );
      const cPebble = new THREE.Color(0x8f887c);
      const cDust = new THREE.Color(land.dirt);
      for (let i = 0; i < count; i++) {
        const px = -40 + Math.random() * (TRAIL_END + 40);
        const side = Math.random() > 0.5 ? 1 : -1;
        const pz = meander(px) + side * (1.3 + Math.random() * 1.6);
        dummy.position.set(px, groundY(px) + 0.05, pz);
        dummy.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        );
        dummy.scale.setScalar(0.5 + Math.random() * 1.1);
        dummy.updateMatrix();
        pebbles.setMatrixAt(i, dummy.matrix);
        tint
          .copy(cPebble)
          .lerp(cDust, Math.random() * 0.5)
          .multiplyScalar(0.85 + Math.random() * 0.3);
        pebbles.setColorAt(i, tint);
      }
      pebbles.castShadow = true;
      pebbles.receiveShadow = true;
      scene.add(pebbles);
    }
  }

  // ── model loading, engine-style de-facet, kid-safe clips ───────────────
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  async function loadModel(url: string) {
    const gltf = await loader.loadAsync(url);
    // Kids app: death, attack and bite clips never make it in.
    gltf.animations = (gltf.animations ?? []).filter(
      (c) => !/death|attack|bite/i.test(c.name),
    );
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        try {
          m.geometry = mergeVertices(m.geometry, 1e-4);
          m.geometry.computeVertexNormals();
        } catch {
          // Keep the original geometry if welding fails.
        }
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.metalness = 0.05;
          mat.roughness = Math.max(0.65, mat.roughness ?? 0.8);
        }
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return gltf;
  }
  function measureBox(root: THREE.Object3D) {
    // Skinned rigs carry 100-300x node scales; measure through the skeleton.
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        m.computeBoundingBox();
        tmp.copy(m.boundingBox!).applyMatrix4(m.matrixWorld);
        box.union(tmp);
      } else if ((o as THREE.Mesh).isMesh) {
        box.expandByObject(o);
      }
    });
    return box;
  }
  function fitToHeight(root: THREE.Object3D, targetH: number) {
    const box = measureBox(root);
    const size = box.getSize(new THREE.Vector3());
    const s = targetH / (size.y || 1);
    const wrap = new THREE.Group();
    root.scale.setScalar(s);
    root.position.y = -box.min.y * s;
    wrap.add(root);
    return wrap;
  }
  // Characters carry their own clips (dino/cube); KayKit heroes get them from
  // the shared animation GLBs, bound by matching bone names at runtime.
  let sharedClips: THREE.AnimationClip[] = [];
  const clipsFor = (gltf: { animations?: THREE.AnimationClip[] }) =>
    gltf.animations && gltf.animations.length > 0
      ? gltf.animations
      : sharedClips;

  function rigOf(
    gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] },
    targetH: number,
  ): DinoRig {
    const wrap = fitToHeight(gltf.scene, targetH);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const clips = clipsFor(gltf);
    const pick = (re: RegExp) =>
      clips.find((c) => re.test(c.name.toLowerCase())) ?? null;
    const runClip = pick(/run|gallop|walk/);
    const idleClip = pick(/idle|stand/);
    let run: THREE.AnimationAction | null = null;
    let idle: THREE.AnimationAction | null = null;
    if (runClip) {
      run = mixer.clipAction(runClip);
      run.play();
      run.weight = 0;
    }
    if (idleClip && idleClip !== runClip) {
      idle = mixer.clipAction(idleClip);
      idle.play();
      idle.weight = 1;
    }
    return { wrap, mixer, run, idle };
  }

  // ── population ─────────────────────────────────────────────────────────
  let player: DinoRig | null = null;
  let playerH = 2.6; // fitted height of the current player model
  let playerX = -6;
  let targetX = -6;
  let runStart = -6;
  let runEnd = runStart + RUN_LEN;
  let flagPole: THREE.Mesh | null = null;
  let flagCone: THREE.Mesh | null = null;
  function placeFlag() {
    if (flagPole != null && flagCone != null) {
      flagPole.position.set(runEnd, groundY(runEnd) + 1.7, 0);
      flagCone.position.set(runEnd + 0.55, groundY(runEnd) + 3, 0);
    }
  }
  let jumpV = 0;
  let jumpY = 0;
  let jumpCount = 0; // jumps used since last touchdown (max 2 = double jump)
  let playerGhostly = false; // skeleton hero: floats and glides like a ghost
  // Every character root in the scene, so the dark can reach all of their eyes.
  const characterRoots = new Set<THREE.Object3D>();
  let nightNow = false;
  // The spooky-guard gag. A skeleton's sockets flare a little as the hero
  // passes; the pumpkin's reaction to it is the actual joke, so it gets the
  // big movement. Fires once per run so it stays a moment rather than a tic.
  let scareT = 0;
  let scaredThisRun = false;

  /**
   * Skeleton eyes catch the light after dark.
   *
   * The KayKit rigs name their eye meshes and materials, so the sockets are
   * found by name rather than by guessing at an index — and a model that has
   * none simply keeps the eyes it was shipped with.
   */
  function applyEyeGlow(root: THREE.Object3D, on: boolean): void {
    const skeletal = /skeleton|skull|undead/i.test(root.name);
    if (skeletal) {
      // Bright after dark, still clearly lit by day.
      setEyeFlare(root, 1, on ? 3.2 : 1.2, 0x7fe3ff);
    } else {
      // Everyone else: a subtle catchlight, a touch warmer at night.
      setEyeFlare(root, 1, on ? 0.5 : 0.28, 0xffe8b0);
    }
  }

  const eyeScaleBase = new WeakMap<THREE.Object3D, number>();
  const eyeOwned = new WeakSet<THREE.Object3D>();

  /**
   * Every eye mesh in a character, with its material cloned on first touch.
   *
   * Models are loaded once and reused, so two skeletons of the same kind share
   * one material instance — and one of them writing "dim" cancelled the other
   * writing "bright" in the very same frame. Each character owns its eyes now.
   */
  function eyeMeshes(root: THREE.Object3D): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !/eye|socket/i.test(node.name)) {
        return;
      }
      if (/pumpkin/i.test(node.name)) {
        return;
      }
      if (!eyeOwned.has(node)) {
        eyeOwned.add(node);
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((m) => m.clone())
          : mesh.material.clone();
      }
      out.push(mesh);
    });
    return out;
  }

  /** Lights a character's eyes: scale relative to normal, colour and strength. */
  function setEyeFlare(
    root: THREE.Object3D,
    scale: number,
    intensity: number,
    color = 0x7fe3ff,
  ) {
    for (const mesh of eyeMeshes(root)) {
      let base = eyeScaleBase.get(mesh);
      if (base == null) {
        base = mesh.scale.x;
        eyeScaleBase.set(mesh, base);
      }
      mesh.scale.setScalar(base * scale);
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const mat of mats) {
        const m = mat as THREE.MeshStandardMaterial;
        if (m?.emissive != null) {
          m.emissive.setHex(intensity > 0 ? color : 0x000000);
          m.emissiveIntensity = intensity;
          m.needsUpdate = true;
        }
      }
    }
  }

  /** Who is out on the trail right now. */
  function refreshPopulation(): void {
    for (const f of friends) {
      const ud = f.wrap.userData as { nightOnly?: boolean; dayOnly?: boolean };
      if (ud.nightOnly === true) {
        f.wrap.visible = nightNow;
      } else if (ud.dayOnly === true) {
        f.wrap.visible = !nightNow;
      }
    }
  }

  function refreshEyeGlow(): void {
    for (const root of characterRoots) {
      applyEyeGlow(root, nightNow);
    }
  }
  let stumbleT = 0;
  let pointerHitT = 0; // brief red flash on the hero pointer after a wrong key
  let motionScale = 1; // 0 = characters hold still, 1 = full liveliness
  let beckonT = 0;
  let wasAirborne = false;
  let roarT = 0;
  // Reaching the camp flag. Runs 1 -> 0; the dino spends the first half
  // roaring and the second half hopping, the hero spins the whole way.
  let celebT = 0;
  let celebHops = 0;
  let growTarget = 1;
  // 0 = just-hatched baby, 1 = fully-grown adult. Drives real proportion,
  // colour and gait changes on top of the overall size growth.
  let dinoAge = 1;
  const boneBase = new WeakMap<THREE.Object3D, THREE.Vector3>();
  const friends: DinoRig[] = [];
  const sparks: THREE.Mesh[] = [];

  // A friendly game-style pointer floating over the hero — "this is you".
  // The knight gets a glowing ring; the skeleton gets a little Halloween
  // pumpkin instead.
  const heroRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.07, 10, 24),
    new THREE.MeshStandardMaterial({
      color: 0x37c871,
      emissive: 0x37c871,
      emissiveIntensity: 0.7,
      roughness: 0.5,
      metalness: 0,
    }),
  );
  heroRing.rotation.x = Math.PI / 2.2; // tilt the ring toward the camera
  heroRing.visible = false;
  scene.add(heroRing);

  const heroPumpkin = new THREE.Group();
  const pumpkinBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 14, 12),
    new THREE.MeshStandardMaterial({
      color: 0xff7a1a,
      emissive: 0xff7a1a,
      emissiveIntensity: 0.35,
      roughness: 0.6,
    }),
  );
  pumpkinBody.scale.set(1.2, 0.85, 1.2);
  const pumpkinStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.05, 0.13, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a7f34, roughness: 0.8 }),
  );
  pumpkinStem.position.y = 0.3;
  // A glowing carved jack-o'-lantern face sitting proud of the front surface,
  // facing the camera (the body's front is at z ~0.36 after the x1.2 scale).
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xffe23a,
    emissive: 0xffd21a,
    emissiveIntensity: 1.8,
    roughness: 0.5,
  });
  const eyeGeo = new THREE.ConeGeometry(0.09, 0.13, 3);
  const eyeL = new THREE.Mesh(eyeGeo, faceMat);
  eyeL.rotation.x = Math.PI / 2; // lay the triangle flat against the front
  eyeL.position.set(-0.12, 0.08, 0.33);
  eyeL.name = "pumpkinEyeL";
  const eyeR = eyeL.clone();
  eyeR.name = "pumpkinEyeR";
  eyeR.position.x = 0.12;
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.07, 0.06),
    faceMat,
  );
  mouth.position.set(0, -0.09, 0.33);
  heroPumpkin.add(pumpkinBody, pumpkinStem, eyeL, eyeR, mouth);
  heroPumpkin.visible = false;
  scene.add(heroPumpkin);
  // Base pointer tints, and the angry red it flashes to on a wrong key.
  const RING_C = new THREE.Color(0x37c871);
  const PUMP_C = new THREE.Color(0xff7a1a);
  // A slightly cool, deep red: ACES tone-mapping shifts saturated reds toward
  // orange, so we bias it back so it reads as a true glowing red on screen.
  const HIT_C = new THREE.Color(0xff0026);
  const ringMat = heroRing.material as THREE.MeshStandardMaterial;
  const pumpMat = pumpkinBody.material as THREE.MeshStandardMaterial;

  // ── word tiles ──────────────────────────────────────────────────────────
  // For the youngest learners the practice word is laid out as real 3-D blocks
  // resting on the trail ahead of the runner — lit and shadowed like the rest
  // of the world — with the letter to type next glowing mint and bobbing.
  const wordGroup = new THREE.Group();
  wordGroup.visible = false;
  scene.add(wordGroup);
  const letterTexCache = new Map<string, THREE.Texture>();
  const letterTexture = (ch: string): THREE.Texture => {
    let t = letterTexCache.get(ch);
    if (t != null) return t;
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, 160, 160);
    g.fillStyle = "#31405a";
    g.font =
      "700 122px 'Arial Rounded MT Bold', ui-rounded, 'Trebuchet MS', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(ch.toUpperCase(), 80, 94);
    t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    letterTexCache.set(ch, t);
    return t;
  };
  const TILE_C = new THREE.Color(0xf3ead6); // warm stone card
  const TILE_CUR_C = new THREE.Color(0x53d98b); // mint — the current letter
  type WordTile = {
    grp: THREE.Group;
    base: THREE.Mesh;
    face: THREE.Mesh;
    shadow: THREE.Mesh;
  };
  let wordTiles: WordTile[] = [];
  let wordIdx = 0;
  let wordText = ""; // the whole passage currently laid out as tiles
  let wordSnap = false; // snap the ribbon into place (new passage) vs. glide
  const TILE_GAP = 1.6;
  const buildWordTiles = (n: number) => {
    for (const t of wordTiles) wordGroup.remove(t.grp);
    wordTiles = [];
    for (let i = 0; i < n; i++) {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 1.35, 0.4),
        // Draw on top of the world (no depth test) so nothing — trees, bushes,
        // sheep, the runner — can ever hide the letters; still casts a shadow
        // so it reads as grounded.
        new THREE.MeshStandardMaterial({
          color: TILE_C,
          roughness: 0.85,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      // A soft shadow disc we can fade per-tile (the real shadow map can't be
      // dimmed per object), laid flat on the ground under the tile.
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 1.3),
        new THREE.MeshBasicMaterial({
          color: 0x2c3a20,
          transparent: true,
          opacity: 0.32,
          depthTest: false,
          depthWrite: false,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.renderOrder = 19;
      base.castShadow = false;
      base.receiveShadow = false;
      base.renderOrder = 20;
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 1.15),
        new THREE.MeshStandardMaterial({
          transparent: true,
          roughness: 0.9,
          depthTest: false,
          depthWrite: false,
        }),
      );
      face.position.z = 0.21;
      face.renderOrder = 21;
      const grp = new THREE.Group();
      grp.add(shadow, base, face);
      // Left-aligned: the row starts at the group origin and runs to the right,
      // the way the runner is heading.
      grp.position.x = i * TILE_GAP;
      wordGroup.add(grp);
      wordTiles.push({ grp, base, face, shadow });
    }
  };
  // `text` is the whole practice passage; `index` is the character to type
  // next. The passage is laid out once as a continuous ribbon of letter tiles
  // (spaces between words shown as little stones) and simply GLIDES so the
  // current letter stays put — new letters flow in from the right with no jumpy
  // per-word rebuild. Only a fresh passage rebuilds the tiles.
  const setWordImpl = (text: string, index: number) => {
    if (!text) {
      wordGroup.visible = false;
      wordText = "";
      return;
    }
    wordGroup.visible = true;
    if (text !== wordText) {
      if (text.length !== wordTiles.length) buildWordTiles(text.length);
      for (let i = 0; i < wordTiles.length; i++) {
        const { base, face } = wordTiles[i];
        const ch = text[i] ?? " ";
        const isSpace = ch === " ";
        // Spaces are small flat stones so the gap is visible and the child
        // learns to press it; letters are full cards.
        face.visible = !isSpace;
        if (!isSpace) {
          const fm = face.material as THREE.MeshStandardMaterial;
          fm.map = letterTexture(ch);
          fm.needsUpdate = true;
        }
        base.scale.set(isSpace ? 0.5 : 1, isSpace ? 0.32 : 1, 1);
        base.position.y = isSpace ? -0.42 : 0;
      }
      wordText = text;
      wordSnap = true; // a new passage drops straight into place
    }
    wordIdx = index;
    for (let i = 0; i < wordTiles.length; i++) {
      const bm = wordTiles[i].base.material as THREE.MeshStandardMaterial;
      const fm = wordTiles[i].face.material as THREE.MeshStandardMaterial;
      // Already-typed letters fade back to 30% so the eye lands on what is
      // next; the tile keeps a faded shadow to match.
      const typed = i < index;
      const op = typed ? 0.3 : 1;
      bm.opacity = op;
      fm.opacity = op;
      (wordTiles[i].shadow.material as THREE.MeshBasicMaterial).opacity = typed
        ? 0.1
        : 0.32;
      if (i === index) {
        bm.color.copy(TILE_CUR_C);
        bm.emissive.copy(TILE_CUR_C);
        bm.emissiveIntensity = 0.45;
      } else {
        bm.color.copy(TILE_C);
        bm.emissive.setScalar(0);
        bm.emissiveIntensity = 0;
      }
    }
  };

  // Reshape the loaded skeleton by age: babies get an oversized head, stubby
  // legs, a short tail and a round belly (that reads as "cute"), maturing to
  // lean adult proportions; the skin softens to a lighter green when little,
  // and the whole gait quickens so the baby bounces along.
  const jawBase = new WeakMap<THREE.Object3D, number>();
  /** Opens the mouth, 0..1. Falls back to tipping the head back. */
  function setJawOpen(rig: DinoRig, amount: number): void {
    const wrap = rig.wrap;
    const jaw =
      wrap.getObjectByName("Jaw") ??
      wrap.getObjectByName("jaw") ??
      wrap.getObjectByName("Head");
    if (jaw == null) {
      return;
    }
    let base = jawBase.get(jaw);
    if (base == null) {
      base = jaw.rotation.x;
      jawBase.set(jaw, base);
    }
    jaw.rotation.x = base + amount * 0.6;
  }

  function morphDino(rig: DinoRig, age: number): void {
    const a = Math.max(0, Math.min(1, age));
    const L = (baby: number, adult: number) => baby + (adult - baby) * a;
    const wrap = rig.wrap;
    const setUniform = (name: string, f: number) => {
      const bone = wrap.getObjectByName(name);
      if (bone == null) {
        return;
      }
      let base = boneBase.get(bone);
      if (base == null) {
        base = bone.scale.clone();
        boneBase.set(bone, base);
      }
      bone.scale.set(base.x * f, base.y * f, base.z * f);
    };
    setUniform("Head", L(1.62, 1)); // big baby head
    setUniform("BackUpLeg.L", L(0.82, 1));
    setUniform("BackUpLeg.R", L(0.82, 1));
    setUniform("BackLowLeg.L", L(0.84, 1));
    setUniform("BackLowLeg.R", L(0.84, 1));
    setUniform("Tail1", L(0.72, 1)); // short baby tail (scales the whole tail)
    // A rounder belly when little (wider/deeper torso, non-uniform).
    const torso = wrap.getObjectByName("Torso");
    if (torso != null) {
      let base = boneBase.get(torso);
      if (base == null) {
        base = torso.scale.clone();
        boneBase.set(torso, base);
      }
      torso.scale.set(
        base.x * L(1.14, 1),
        base.y * L(1.05, 1),
        base.z * L(1.2, 1),
      );
    }
    // Soft, lighter skin as a baby; richer/darker fully grown.
    const babyTint = new THREE.Color(0xbdedb0);
    wrap.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.color) {
          const key = m as unknown as THREE.Object3D;
          let base = boneBase.get(key);
          if (base == null) {
            base = new THREE.Vector3(mat.color.r, mat.color.g, mat.color.b);
            boneBase.set(key, base);
          }
          mat.color
            .setRGB(base.x, base.y, base.z)
            .lerp(babyTint, (1 - a) * 0.32);
        }
      }
    });
    // Little dinos bustle; grown ones stride with weight.
    rig.mixer.timeScale = L(1.4, 1);
  }

  // Overall size also reads the age — a small (not tiny) baby up to a big (not
  // giant) adult, so the stage is legible at a glance.
  const sizeForAge = (age: number) =>
    0.72 + 0.66 * Math.max(0, Math.min(1, age));

  async function setPlayer(name: string) {
    const gltf = await loadModel(
      `${ASSETS}/models/${theme.modelDir}/${name}.glb`,
    );
    playerH = theme.playerHeight(name);
    const rig = rigOf(gltf, playerH);
    rig.wrap.position.set(playerX, groundY(playerX), 0);
    rig.wrap.rotation.y = Math.PI / 2;
    if (player) {
      rig.wrap.scale.copy(player.wrap.scale);
      scene.remove(player.wrap);
    }
    player = rig;
    playerGhostly = /skeleton/i.test(name);
    // Only the player answers to the hero lamp.
    player?.wrap.traverse((n) => {
      n.layers.enable(HERO_LIGHT_LAYER);
    });
    // Keep the main character at full colour when the scene grade desaturates
    // the world (Hero Trail is paled): boost the player's own materials so it
    // still pops as the focus, not the washed-out backdrop.
    if (theme.playerVivid && theme.playerVivid !== 1) {
      const v = theme.playerVivid;
      const seen = new Set<THREE.Material>();
      const hsl = { h: 0, s: 0, l: 0 };
      rig.wrap.traverse((o) => {
        const m = o as THREE.Mesh;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (m.isMesh && mat && mat.color && !seen.has(mat)) {
          seen.add(mat);
          mat.color.getHSL(hsl);
          mat.color.setHSL(hsl.h, Math.min(1, hsl.s * v), hsl.l);
        }
      });
    }
    scene.add(rig.wrap);
    characterRoots.add(rig.wrap);
    applyEyeGlow(rig.wrap, nightNow);
    if (theme.morphsBody) {
      morphDino(rig, dinoAge);
    }
  }

  const ready = (async () => {
    // Load the shared movement/idle clips first so every hero can play them.
    if (theme.animationUrls) {
      for (const url of theme.animationUrls) {
        try {
          const g = await loader.loadAsync(
            `${ASSETS}/models/${theme.modelDir}/${url}`,
          );
          sharedClips = sharedClips.concat(
            (g.animations ?? []).filter(
              (c) => !/death|attack|bite|hit/i.test(c.name),
            ),
          );
        } catch {
          // A missing clip file just means no animation — still playable.
        }
      }
    }
    await setPlayer(theme.defaultPlayer);

    const calm = (clips: THREE.AnimationClip[]) =>
      clips.find((c) => /idle|stand|eat|graze/i.test(c.name)) ??
      clips.find((c) => /walk/i.test(c.name)) ??
      null;
    // Each companion gets a different loop so they don't all bob in unison —
    // some stand, some gesture, some fidget; skeletons twitch eerily.
    const pickIdle = (clips: THREE.AnimationClip[], scary: boolean) => {
      // Only calm, friendly loops — no hitting or throwing. Skeletons read as
      // spooky purely through a slow, swaying idle (set below via timeScale).
      const names = scary
        ? ["Idle_B", "Idle_A"]
        : ["Idle_A", "Idle_B", "Interact"];
      const pool = names
        .map((n) => clips.find((c) => c.name === n))
        .filter((c): c is THREE.AnimationClip => c != null);
      return pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : calm(clips);
    };
    const spawnCompanion = async (
      model: string,
      x: number,
      z: number,
      h: number,
      scary = false,
    ) => {
      let gltf;
      try {
        gltf = await loadModel(
          `${ASSETS}/models/${theme.modelDir}/${model}.glb`,
        );
      } catch {
        return; // a single missing companion never breaks the world
      }
      const wrap = fitToHeight(gltf.scene, h);
      wrap.position.set(x, surfaceY(x, z), z);
      // A random home facing — the crowd looks every which way, not all one way.
      const homeY = Math.random() * Math.PI * 2;
      wrap.rotation.y = homeY;
      // A rare few are "guards" who pace back and forth over their patch.
      const guard = !scary && Math.random() < (theme.guardRate ?? 0);
      // Only some companions are "smilers" who give a happy bob; the rest just
      // stop and stare when the hero passes.
      wrap.userData = {
        homeY,
        homeX: x,
        homeZ: z,
        scary,
        guard,
        phase: Math.random() * Math.PI * 2,
        smiler: Math.random() < 0.35,
        dayOnly: !scary && Math.random() < 0.4,
      };
      scene.add(wrap);
      characterRoots.add(wrap);
      applyEyeGlow(wrap, nightNow);
      const mixer = new THREE.AnimationMixer(gltf.scene);
      const clips = clipsFor(gltf);
      // Guards get a walking loop so their legs move while patrolling; everyone
      // else gets a calm, friendly idle.
      const clip = guard
        ? (clips.find((c) => /walk|run|gallop|march/i.test(c.name)) ??
          pickIdle(clips, scary))
        : pickIdle(clips, scary);
      if (clip) {
        const a = mixer.clipAction(clip);
        a.timeScale = guard ? 0.9 : (scary ? 0.6 : 0.85) + Math.random() * 0.4;
        a.play();
        // Start each one at a random point in its loop so companions sharing
        // a clip are never bobbing in unison.
        a.time = Math.random() * (clip.duration || 1);
      }
      friends.push({ wrap, mixer, run: null, idle: null });
    };
    for (const spot of theme.herd) {
      const model = spot.model === "$friend" ? land.friend : spot.model;
      await spawnCompanion(model, spot.x, spot.z, spot.h);
    }
    // A lone skeleton keeps watch near the camp flag every session — and a
    // whole spooky crew shows up around Halloween (October).
    if (theme.flagGuard && theme.flagGuard.length > 0) {
      const pickGuard = () =>
        theme.flagGuard![Math.floor(Math.random() * theme.flagGuard!.length)];
      // One near the camp flag, and one close to the start so the encounter
      // happens early in a run instead of only at the very end.
      await spawnCompanion(pickGuard(), runEnd - 3, -3, 3.0, true);
      await spawnCompanion(pickGuard(), runStart + 10, -3.5, 3.0, true);
      // The trail belongs to the skeletons after dark: a few more of them come
      // out, and some of the daytime crowd has gone home.
      for (let i = 0; i < 4; i++) {
        const gx = 18 + Math.random() * (TRAIL_END - 26);
        const gz = (Math.random() > 0.5 ? -1 : 1) * (3 + Math.random() * 6);
        await spawnCompanion(pickGuard(), gx, gz, 3.0, true);
        const last = friends[friends.length - 1];
        if (last != null) {
          last.wrap.userData.nightOnly = true;
          last.wrap.visible = nightNow;
        }
      }
      if (new Date().getMonth() === 9) {
        for (let i = 0; i < 5; i++) {
          const gx = 24 + Math.random() * (TRAIL_END - 30);
          const gz = (Math.random() > 0.5 ? -1 : 1) * (3 + Math.random() * 6);
          await spawnCompanion(pickGuard(), gx, gz, 3.0, true);
        }
      }
    }

    // A real little flock grazing off the trail (Dino Run). White, brown and
    // black sheep in a few clusters plus the odd loner, heads down eating.
    if (theme.sheep) {
      let sheepGltf: Awaited<ReturnType<typeof loadModel>> | null = null;
      try {
        sheepGltf = await loadModel(
          `${ASSETS}/models/${theme.sceneryDir}/Sheep.glb`,
        );
      } catch {
        sheepGltf = null;
      }
      if (sheepGltf) {
        const sheepScene = sheepGltf.scene;
        const sheepClips = clipsFor(sheepGltf);
        const idleClip =
          sheepClips.find((c) => /idle|graze|eat/i.test(c.name)) ??
          sheepClips[0] ??
          null;
        // White is the common coat; brown and black are the rarer ones.
        const COATS = [0xf3efe6, 0xf3efe6, 0xf0ece1, 0x9c7550, 0x2e2a26];
        const spawnSheep = (x: number, z: number) => {
          const src = skinnedClone(sheepScene);
          const coat = COATS[Math.floor(Math.random() * COATS.length)];
          const isBlack = coat === 0x2e2a26;
          let head: THREE.Object3D | null = null;
          src.traverse((o) => {
            if (o.name === "Head") head = o;
            const m = o as THREE.Mesh;
            if (!m.isMesh || !m.material) return;
            // SkeletonUtils.clone shares materials — clone so each sheep tints
            // independently. Primitive "White" is the wool; "Black" the face.
            const mat = (m.material as THREE.MeshStandardMaterial).clone();
            if (mat.name === "White") {
              mat.color.setHex(coat);
            } else if (isBlack) {
              mat.color.setHex(0x201d1a);
            }
            mat.metalness = 0;
            mat.roughness = 1;
            m.material = mat;
          });
          const homeY = Math.random() * Math.PI * 2;
          const wrap = fitToHeight(src, 0.9 + Math.random() * 0.3);
          wrap.position.set(x, surfaceY(x, z), z);
          wrap.rotation.y = homeY;
          // Each sheep grazes its own little patch: ambling a few steps, dipping
          // its head to nibble, wandering on — never straying far from home.
          wrap.userData = {
            sheep: true,
            head,
            headBaseX: head ? (head as THREE.Object3D).rotation.x : 0,
            baseX: x,
            baseZ: z,
            homeY,
            phase: Math.random() * Math.PI * 2,
            state: "graze",
            stateT: Math.random() * 4, // stagger so they don't all move at once
            tx: x,
            tz: z,
            // Only ~40% ever wander; the rest are settled grazers that keep
            // their heads down and nibble one patch, never walking.
            roams: Math.random() < 0.4,
          };
          scene.add(wrap);
          characterRoots.add(wrap);
          applyEyeGlow(wrap, nightNow);
          characterRoots.add(wrap);
          applyEyeGlow(wrap, nightNow);
          characterRoots.add(wrap);
          applyEyeGlow(wrap, nightNow);
          const mixer = new THREE.AnimationMixer(src);
          if (idleClip) {
            const a = mixer.clipAction(idleClip);
            a.timeScale = 0.6 + Math.random() * 0.5;
            a.time = Math.random() * (idleClip.duration || 1);
            a.play();
          }
          friends.push({ wrap, mixer, run: null, idle: null });
        };
        // Sheep are meadow animals: most graze the open grass field in front
        // of the trail, a few on the far side — and they keep clear of the
        // treeline. Clusters are spread evenly down the trail so some are
        // always in view.
        const CLUSTERS = 8;
        const span = TRAIL_END + 24;
        // The open near-field (z > 0) is grassy and tree-free; the far side
        // has the odd shallow clearing between trail and trees.
        const fieldZ = () => 5 + Math.random() * 12; // open grass, near side
        const farZ = () => -(3.5 + Math.random() * 4); // shallow strip, far side
        for (let g = 0; g < CLUSTERS; g++) {
          const gx = -12 + (span / CLUSTERS) * (g + Math.random() * 0.8);
          // ~70% of clusters graze the open field, the rest the far side.
          const gz = Math.random() < 0.7 ? fieldZ() : farZ();
          const n = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            spawnSheep(
              gx + (Math.random() - 0.5) * 5,
              gz + (Math.random() - 0.5) * 4,
            );
          }
          // The odd loner grazing a little apart — usually out in the field.
          if (Math.random() < 0.6) {
            const lz = Math.random() < 0.75 ? fieldZ() : farZ();
            spawnSheep(gx + (Math.random() - 0.5) * 14, lz);
          }
        }
      }
    }

    for (const [file, count, minD, maxD, side, scaleMul = 1] of [
      [land.trees, theme.treeCount ?? 30, 6, 26, "back"] as const,
      ...theme.ground,
    ]) {
      let gltf;
      try {
        gltf = await loadModel(
          `${ASSETS}/models/${theme.sceneryDir}/${file}.glb`,
        );
      } catch {
        continue; // skip a missing scenery set rather than break the build
      }
      const variants = [...gltf.scene.children];
      for (let i = 0; i < count; i++) {
        const v = variants[i % variants.length].clone();
        const box = new THREE.Box3().setFromObject(v);
        v.position.sub(
          new THREE.Vector3(
            (box.min.x + box.max.x) / 2,
            box.min.y,
            (box.min.z + box.max.z) / 2,
          ),
        );
        const wrap = new THREE.Group();
        wrap.add(v);
        const x = -26 + Math.random() * (TRAIL_END + 26);
        const depth = minD + Math.random() * (maxD - minD);
        const z =
          side === "back" ? -depth : Math.random() > 0.65 ? depth : -depth;
        wrap.position.set(x, surfaceY(x, z), z);
        wrap.rotation.y = Math.random() * Math.PI * 2;
        wrap.scale.setScalar(
          (0.8 + Math.random() * 0.8) * theme.sceneryScale * scaleMul,
        );
        scene.add(wrap);
        characterRoots.add(wrap);
        applyEyeGlow(wrap, nightNow);
        characterRoots.add(wrap);
        applyEyeGlow(wrap, nightNow);
      }
    }

    flagPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a6f4c }),
    );
    flagCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1, 3),
      new THREE.MeshStandardMaterial({ color: 0xff5c5c }),
    );
    flagCone.rotation.z = -Math.PI / 2;
    flagPole.castShadow = flagCone.castShadow = true;
    scene.add(flagPole, flagCone);
    placeFlag();

    await applySky(land.mood);
  })();

  function burst(
    x: number,
    y: number,
    z: number,
    colors: readonly number[],
    n = 10,
    up = 0.22,
  ) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.16),
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length] }),
      );
      m.position.set(x, y, z);
      m.userData.v = new THREE.Vector3(
        (Math.random() - 0.6) * 0.25,
        up + Math.random() * 0.18,
        (Math.random() - 0.5) * 0.2,
      );
      m.userData.life = 1;
      scene.add(m);
      sparks.push(m);
    }
  }

  // ── loop ───────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let disposed = false;
  function tick() {
    if (disposed) {
      return;
    }
    const dt = clock.getDelta();
    if (player) {
      const p = player.wrap.position;
      const dx = targetX - p.x;
      p.x += dx * 0.06;
      playerX = p.x;
      jumpY = Math.max(0, jumpY + jumpV);
      jumpV -= 0.03;
      p.y = groundY(p.x) + jumpY;
      // Keep the lamp just above and in front of the runner.
      heroLamp.position.set(p.x + 0.9, p.y + 2.1, p.z + 1.6);
      // The skeleton hero still runs on its feet, but with a faint hover and
      // bob so it reads as a little spooky — not fully floating.
      if (playerGhostly) {
        p.y += 0.12 + Math.sin(clock.elapsedTime * 2.2) * 0.08;
      }
      if (jumpY > 0.05) {
        wasAirborne = true;
      } else if (wasAirborne) {
        wasAirborne = false; // touchdown — kick up a puff of dust
        jumpCount = 0; // back on the ground: jumps refresh
        burst(p.x, p.y + 0.15, p.z, [0xcfc4ae, 0xb8ab90], 8, 0.14);
      }
      const moving = Math.abs(dx) > 0.08;
      if (moving) {
        beckonT = 0;
      }
      if (player.run && player.idle) {
        // Legs move when moving (skeleton included) — the ghostly feel comes
        // from the faint hover above, not from stiff gliding.
        player.run.weight += ((moving ? 1 : 0) - player.run.weight) * 0.12;
        player.idle.weight = 1 - player.run.weight;
      }
      const cur = player.wrap.scale.x;
      player.wrap.scale.setScalar(cur + (growTarget - cur) * 0.06);
      if (celebT > 0) {
        celebT -= 0.012;
        const t = 1 - Math.max(0, celebT); // 0 -> 1 across the celebration
        if (theme.pointerRing) {
          // A full turn on the spot, landing back where it started.
          player.wrap.rotation.y = Math.PI / 2 + t * Math.PI * 2;
          player.wrap.rotation.z = Math.sin(t * Math.PI) * 0.18;
        } else if (t < 0.5) {
          // Dino Run, first half: rear back and roar with the jaw wide.
          const k = Math.sin((t / 0.5) * Math.PI);
          player.wrap.rotation.z = k * 0.45;
          player.wrap.rotation.y = Math.PI / 2;
          setJawOpen(player, k);
        } else {
          // Second half: mouth shut, two small pleased hops.
          setJawOpen(player, 0);
          player.wrap.rotation.z = 0;
          player.wrap.rotation.y = Math.PI / 2;
          const want = t < 0.75 ? 1 : 2;
          if (celebHops < want && jumpY <= 0.02) {
            jumpV = 0.16;
            celebHops = want;
          }
        }
      } else if (roarT > 0) {
        roarT -= 0.02;
        player.wrap.rotation.z = Math.sin(Math.min(1, roarT) * Math.PI) * 0.5;
      } else if (stumbleT > 0) {
        stumbleT -= 0.05;
        player.wrap.rotation.z = Math.sin(stumbleT * Math.PI) * -0.3;
      } else if (beckonT > 0) {
        beckonT -= 0.012;
        const k = Math.sin(Math.max(0, Math.min(1, beckonT)) * Math.PI);
        player.wrap.rotation.y = Math.PI / 2 - k;
        player.wrap.rotation.z = Math.sin(beckonT * 14) * 0.05 * k;
      } else {
        player.wrap.rotation.y = Math.PI / 2;
        player.wrap.rotation.z = 0;
      }
      // Float the pointer just above the hero's head (Hero Trail only) — a
      // ring for the knight, a bobbing pumpkin for the skeleton.
      if (theme.pointerRing) {
        const top = playerH * player.wrap.scale.y;
        const py = p.y + top + 0.7 + Math.sin(clock.elapsedTime * 2) * 0.12;
        heroRing.visible = !playerGhostly;
        heroPumpkin.visible = playerGhostly;
        if (scareT > 0) {
          scareT -= dt * 0.9;
          const k = Math.sin(Math.max(0, Math.min(1, scareT)) * Math.PI);
          // Eyes clamped shut - flattened rather than hidden, so the face still
          // reads at a glance.
          eyeL.scale.y = eyeR.scale.y = 1 - k * 0.92;
          // A flinch backwards and a shiver. The pumpkin keeps its size: it is
          // still the marker showing where the hero is.
          heroPumpkin.position.z = -k * 0.35;
          heroPumpkin.rotation.z = Math.sin(clock.elapsedTime * 26) * 0.16 * k;
          // The knight's ring has no face to pull, so it recoils and shivers
          // instead — the same beat, told with the only vocabulary it has.
          heroRing.position.z = -k * 0.3;
          heroRing.rotation.z = Math.sin(clock.elapsedTime * 22) * 0.3 * k;
        } else {
          eyeL.scale.y = eyeR.scale.y = 1;
          heroPumpkin.position.z = 0;
          heroPumpkin.rotation.z = 0;
          heroRing.position.z = 0;
          heroRing.rotation.z = 0;
        }
        // The pointer glows brighter while the hero is running, dims when idle,
        // and flares an angry red for a moment after a wrong key.
        pointerHitT = Math.max(0, pointerHitT - dt * 1.3);
        const advancing = Math.abs(targetX - playerX) > 0.06;
        const pulse = advancing
          ? 1 + 0.35 * Math.sin(clock.elapsedTime * 9)
          : 0.4;
        const hit = pointerHitT;
        // A deep, glowing red flush. Keep the emissive moderate — cranking it
        // high blows out to pink/white under ACES tone-mapping; a fully
        // saturated red at ~2x reads as a proper angry red glow instead.
        ringMat.color.copy(RING_C).lerp(HIT_C, hit);
        ringMat.emissive.copy(RING_C).lerp(HIT_C, hit);
        ringMat.emissiveIntensity = 0.55 * pulse * (1 - hit) + hit * 1.15;
        pumpMat.color.copy(PUMP_C).lerp(HIT_C, hit);
        pumpMat.emissive.copy(PUMP_C).lerp(HIT_C, hit);
        pumpMat.emissiveIntensity = 0.3 * pulse * (1 - hit) + hit * 1.15;
        // …and a quick side-to-side shake, fiercest right after the miss.
        const shakeX = Math.sin(clock.elapsedTime * 60) * hit * 0.28;
        const shakeY = Math.cos(clock.elapsedTime * 52) * hit * 0.12;
        if (playerGhostly) {
          heroPumpkin.position.set(p.x + shakeX, py + shakeY, p.z);
          heroPumpkin.rotation.y = Math.sin(clock.elapsedTime * 1.5) * 0.15;
          heroPumpkin.rotation.z = Math.sin(clock.elapsedTime * 55) * hit * 0.5;
        } else {
          heroRing.position.set(p.x + shakeX, py + shakeY, p.z);
          heroRing.rotation.z +=
            0.03 + Math.sin(clock.elapsedTime * 55) * hit * 0.4;
        }
      }
      cam.position.x += (p.x - 2 - cam.position.x) * 0.06;
      sun.position.x = cam.position.x - 8;
      sun.target.position.x = cam.position.x;
      sun.target.updateMatrixWorld();
      player.mixer.update(dt);
      // The 3-D word rides on the trail to the RIGHT of the runner — the way
      // he's heading — held steady on screen by tracking the camera; the
      // current tile lifts + bobs.
      if (wordGroup.visible) {
        // The ribbon glides so the current letter always sits at the same spot
        // (just to the right of the runner, low in the pane); typed letters
        // scroll off left, upcoming ones flow in from the right — no jump.
        const gz = 10;
        const anchorX = p.x + 3;
        const targetX = anchorX - wordIdx * TILE_GAP;
        if (wordSnap) {
          wordGroup.position.x = targetX;
          wordSnap = false;
        } else {
          wordGroup.position.x += (targetX - wordGroup.position.x) * 0.18;
        }
        wordGroup.position.z = gz;
        wordGroup.position.y = 0;
        for (let i = 0; i < wordTiles.length; i++) {
          const g = wordTiles[i].grp;
          const cur = i === wordIdx;
          const s = cur ? 1.28 : 1;
          g.scale.x += (s - g.scale.x) * 0.2;
          g.scale.y = g.scale.z = g.scale.x;
          const lift = cur ? 0.35 + Math.sin(clock.elapsedTime * 3) * 0.12 : 0;
          // Hover clearly above the ground (still following its contour) so the
          // row reads as floating, not resting on the dirt.
          const tileX = wordGroup.position.x + g.position.x;
          const groundH = terrainY(tileX, gz);
          g.position.y += (groundH + 1.35 + lift - g.position.y) * 0.25;
          // Pin the soft shadow to the actual ground beneath the floating tile.
          wordTiles[i].shadow.position.y =
            (groundH - g.position.y) / (g.scale.y || 1);
        }
      }
    }
    // Companions notice the runner: when it comes near they turn to watch it
    // pass, then drift back to their own random facing once it's gone.
    const heroX = player ? player.wrap.position.x : 0;
    const heroZ = player ? player.wrap.position.z : 0;
    for (const f of friends) {
      // The "reduce movement" slider slows every companion's animation (and,
      // below, their wandering) — right down to stillness at 0.
      f.mixer.update(dt * motionScale);
      const ud = f.wrap.userData as {
        homeY?: number;
        homeX?: number;
        homeZ?: number;
        scary?: boolean;
        /** How lit this guard's sockets are, 1 on approach then fading. */
        alert?: number;
        /** Comes out only after dark. */
        nightOnly?: boolean;
        /** Turns in when the sun goes down. */
        dayOnly?: boolean;
        guard?: boolean;
        phase?: number;
        smiler?: boolean;
        sheep?: boolean;
        head?: THREE.Object3D | null;
        headBaseX?: number;
        baseX?: number;
        baseZ?: number;
        state?: "graze" | "walk";
        stateT?: number;
        tx?: number;
        tz?: number;
        roams?: boolean;
      };
      // Grazing sheep live their own little life: nibble a patch for a while,
      // then get up and amble several steps to fresh grass, and repeat.
      if (ud.sheep) {
        const t = clock.elapsedTime;
        const ph = ud.phase ?? 0;
        const homeX = ud.baseX ?? f.wrap.position.x;
        const homeZ = ud.baseZ ?? f.wrap.position.z;
        ud.stateT = (ud.stateT ?? 0) - dt;
        if (ud.stateT <= 0) {
          if (ud.state === "walk") {
            // Reached the new patch — settle in and graze for a spell.
            ud.state = "graze";
            ud.stateT = 2 + Math.random() * 3.5;
          } else if (!ud.roams) {
            // A settled grazer: never wanders — just keeps its head down,
            // nibbling the same patch of grass.
            ud.stateT = 3 + Math.random() * 4;
          } else {
            // Pick a fresh patch several steps away, kept near home and off the
            // trail, then walk to it.
            const ang = Math.random() * Math.PI * 2;
            const dist = 4 + Math.random() * 5;
            let nx = f.wrap.position.x + Math.cos(ang) * dist;
            let nz = f.wrap.position.z + Math.sin(ang) * dist;
            nx = homeX + Math.max(-9, Math.min(9, nx - homeX));
            nz = homeZ + Math.max(-7, Math.min(7, nz - homeZ));
            // Keep to its own side of the trail — never wander onto the path.
            nz = homeZ >= 0 ? Math.max(nz, 3.5) : Math.min(nz, -3.5);
            ud.tx = nx;
            ud.tz = nz;
            ud.state = "walk";
            ud.stateT = 9; // safety cap so it never walks forever
          }
        }
        if (ud.state === "walk") {
          const dx = (ud.tx ?? f.wrap.position.x) - f.wrap.position.x;
          const dz = (ud.tz ?? f.wrap.position.z) - f.wrap.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.2) {
            ud.state = "graze";
            ud.stateT = 2 + Math.random() * 3.5;
          } else {
            const step = Math.min(dist, 1.9 * dt * motionScale); // ~1.9 u/s
            const nx = f.wrap.position.x + (dx / dist) * step;
            const nz = f.wrap.position.z + (dz / dist) * step;
            // A clear gait bounce so the walk reads as stepping, not gliding.
            const bob = Math.abs(Math.sin(t * 10 + ph)) * 0.1 * motionScale;
            f.wrap.position.set(nx, terrainY(nx, nz) - 0.06 + bob, nz);
            const face = Math.atan2(dx, dz);
            let d = face - f.wrap.rotation.y;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            f.wrap.rotation.y += d * 0.16;
            f.mixer.timeScale = 2; // livelier limbs while walking
            // Head bobs with each step, carried a little forward.
            if (ud.head) {
              ud.head.rotation.x =
                (ud.headBaseX ?? 0) + 0.1 + Math.sin(t * 10 + ph) * 0.12;
            }
          }
        } else {
          // Grazing: repeated head-dips to nibble the grass, then now and then
          // a lift to look around — a clear, lively rhythm.
          f.mixer.timeScale = 1;
          f.wrap.position.y =
            terrainY(f.wrap.position.x, f.wrap.position.z) - 0.06;
          f.wrap.rotation.y += Math.sin(t * 0.5 + ph) * 0.006;
          if (ud.head) {
            // A slow ~4s cycle: mostly head-down nibbling, briefly head-up.
            const cyc = (Math.sin(t * 1.5 + ph) + 1) / 2; // 0..1
            const lookUp = Math.sin(t * 0.35 + ph) > 0.8 ? 1 : 0;
            ud.head.rotation.x = lookUp
              ? (ud.headBaseX ?? 0) - 0.15
              : (ud.headBaseX ?? 0) + 0.25 + cyc * 0.4;
          }
        }
        continue;
      }
      // Other props carry no home — they just animate in place.
      if (ud.homeX == null) {
        continue;
      }
      const near = player != null && Math.abs(heroX - ud.homeX) < 7;
      // Guards pace back and forth over their patch (both worlds), pausing
      // mid-stride whenever the hero draws alongside.
      if (ud.guard) {
        if (near) {
          f.mixer.timeScale = 0;
        } else {
          f.mixer.timeScale = 1;
          const gz = ud.homeZ ?? f.wrap.position.z;
          const t = clock.elapsedTime * 0.5 + (ud.phase ?? 0);
          const px = ud.homeX + Math.sin(t) * 3 * motionScale;
          f.wrap.position.set(px, terrainY(px, gz), gz);
          const faceTarget = Math.cos(t) >= 0 ? Math.PI / 2 : -Math.PI / 2;
          let d = faceTarget - f.wrap.rotation.y;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          f.wrap.rotation.y += d * 0.1;
        }
        continue;
      }
      // Dino companions just carry on with their own idle — no watching.
      if (!theme.companionsWatch || ud.homeY == null) {
        continue;
      }
      const target = near
        ? Math.atan2(heroX - f.wrap.position.x, heroZ - f.wrap.position.z)
        : ud.homeY;
      let diff = target - f.wrap.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      f.wrap.rotation.y += diff * (near ? 0.12 : 0.04);
      const homeGY = terrainY(ud.homeX, ud.homeZ ?? 0);
      if (ud.scary) {
        // Skeletons act spooky when the hero is near — a shudder and a rise —
        // then settle back once it passes.
        if (near) {
          f.wrap.rotation.z = Math.sin(clock.elapsedTime * 9) * 0.14;
          f.wrap.position.y =
            homeGY + 0.15 + Math.abs(Math.sin(clock.elapsedTime * 4)) * 0.2;
          ud.alert = 1;
          if (!scaredThisRun) {
            scaredThisRun = true;
            scareT = 1;
          }
        } else {
          ud.alert = Math.max(0, (ud.alert ?? 0) - dt * 0.45);
          f.wrap.rotation.z *= 0.88;
          f.wrap.position.y += (homeGY - f.wrap.position.y) * 0.1;
        }
        const a = ud.alert ?? 0;
        if (a > 0.001) {
          const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5);
          const base = nightNow ? 3.2 : 1.2;
          setEyeFlare(
            f.wrap,
            1 + pulse * 0.35 * a,
            base + pulse * 3 * a,
            0x7fe3ff,
          );
        } else {
          applyEyeGlow(f.wrap, nightNow);
        }
      } else {
        // Everyone else stops what they were doing and turns to watch. A
        // random few "smilers" add a happy bob; the rest simply stand and
        // stare, then pick it all back up once the hero has passed.
        f.mixer.timeScale = near ? 0 : 1;
        if (near && ud.smiler) {
          f.wrap.position.y =
            homeGY + Math.abs(Math.sin(clock.elapsedTime * 5)) * 0.13;
        } else {
          f.wrap.position.y += (homeGY - f.wrap.position.y) * 0.1;
        }
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.position.add(s.userData.v);
      s.userData.v.y -= 0.012;
      s.userData.life -= 0.02;
      s.rotation.x += 0.2;
      s.rotation.y += 0.13;
      s.scale.setScalar(Math.max(0.01, s.userData.life));
      if (s.userData.life <= 0) {
        scene.remove(s);
        sparks.splice(i, 1);
      }
    }
    renderer.render(scene, cam);
    requestAnimationFrame(tick);
  }
  tick();

  return {
    land,
    ready,
    setPlayer,
    setProgress(frac) {
      targetX = runStart + Math.max(0, Math.min(1, frac)) * (runEnd - runStart);
    },
    startRun() {
      scaredThisRun = false;
      runStart = Math.min(targetX, TRAIL_END - RUN_LEN);
      runEnd = runStart + RUN_LEN;
      placeFlag();
    },
    jump() {
      // Single or double jump only — holding/mashing space can't turn into
      // flight. A second mid-air jump gives a little extra lift.
      if (jumpCount < 2) {
        jumpV = jumpCount === 0 ? 0.34 : 0.3;
        jumpCount += 1;
      }
    },
    hop() {
      if (jumpY <= 0) {
        jumpV = 0.22 * (1 + (1 - dinoAge) * 0.5); // littler dinos bounce higher
      }
    },
    beckon() {
      beckonT = 1;
    },
    stumble() {
      stumbleT = 1;
      pointerHitT = 1; // flash the hero pointer red (Hero Trail)
      targetX = playerX; // a wrong key stops the run
    },
    celebrate() {
      celebT = 1;
      celebHops = 0;
      if (player) {
        const p = player.wrap.position;
        burst(
          p.x,
          p.y + 2.2,
          p.z,
          theme.pointerRing
            ? [0xffd66b, 0x8fd9b6, 0xffffff]
            : [0xffd66b, 0xff9f43, 0x37c871],
          22,
          0.34,
        );
      }
      if (theme.pointerRing) {
        // Hero Trail: leap and spin at once, which is what joy looks like when
        // you have arms.
        jumpV = 0.36;
      }
    },
    roar() {
      roarT = 1;
      // Dino Run keeps its little particle burst; Hero Trail says it through
      // the pointer flaring red instead (no "blood splash").
      if (player && !theme.pointerRing) {
        const p = player.wrap.position;
        burst(p.x + 1.2, p.y + 2.4, p.z, [0xff5c5c, 0xffd66b], 12, 0.28);
      }
    },
    grow() {
      // A celebratory pop; the steady size is set by the age (setAge below).
      if (player) {
        player.wrap.scale.setScalar(growTarget * 1.18); // pop, then settle
        const p = player.wrap.position;
        burst(p.x, p.y + 2.2, p.z, [0x37c871, 0xffd66b, 0x8fd9b6], 18, 0.32);
      }
    },
    setAge(age) {
      dinoAge = Math.max(0, Math.min(1, age));
      growTarget = sizeForAge(dinoAge);
      if (player) {
        // Snap to the current size so switching worlds carries the growth
        // straight over instead of re-growing from a baby.
        player.wrap.scale.setScalar(growTarget);
        if (theme.morphsBody) {
          morphDino(player, dinoAge);
        }
      }
    },
    burstAtPlayer(colors, count = 6, up = 0.12) {
      if (player) {
        const p = player.wrap.position;
        burst(p.x - 0.6, p.y + 0.2, p.z, colors, count, up);
      }
    },
    playerScreenXY() {
      if (!player) {
        return null;
      }
      const v = player.wrap.position.clone();
      v.y += 3.4;
      v.project(cam);
      return [
        (v.x * 0.5 + 0.5) * canvas.clientWidth,
        (-v.y * 0.5 + 0.5) * canvas.clientHeight,
      ];
    },
    setNight(night) {
      nightNow = night;
      applySky(night ? "night" : land.mood).catch(() => {});
      refreshEyeGlow();
      refreshPopulation();
    },
    setLook(brightness, paleness) {
      userBright = brightness;
      userPale = paleness;
      applyLook();
    },
    setMotion(intensity) {
      motionScale = Math.max(0, Math.min(1, intensity));
    },
    setWord: setWordImpl,
    resize,
    dispose() {
      disposed = true;
      renderer.dispose();
      pmrem.dispose();
    },
  };
}

/**
 * The little running character shown while the real world loads — the same
 * model as the chosen world, on its own tiny canvas, so the loader is the
 * game. Defaults to the TRex; pass a theme to load its hero instead.
 */
export function createLoaderScene(
  canvas: HTMLCanvasElement,
  theme: WorldTheme = DINO_THEME,
): {
  dispose(): void;
} {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(canvas.width, canvas.height, false);
  const scene = new THREE.Scene();
  scene.add(
    new THREE.HemisphereLight(0xffffff, 0x8fce7e, 1.6),
    new THREE.DirectionalLight(0xffffff, 2.2),
  );
  const cam = new THREE.PerspectiveCamera(
    30,
    canvas.width / canvas.height,
    0.1,
    100,
  );
  // Straight-on side profile — the runner crosses the frame, no angle.
  cam.position.set(0, 1.6, 10);
  cam.lookAt(0, 1.3, 0);
  let mixer: THREE.AnimationMixer | null = null;
  let disposed = false;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader
    .loadAsync(`${ASSETS}/models/${theme.modelDir}/${theme.defaultPlayer}.glb`)
    .then((gltf) => {
      if (disposed) {
        return;
      }
      gltf.scene.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const tmp = new THREE.Box3();
      gltf.scene.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (m.isSkinnedMesh) {
          m.computeBoundingBox();
          tmp.copy(m.boundingBox!).applyMatrix4(m.matrixWorld);
          box.union(tmp);
        }
      });
      const size = box.getSize(new THREE.Vector3());
      const s = 2.6 / (size.y || 1);
      gltf.scene.scale.setScalar(s);
      gltf.scene.position.y = -box.min.y * s;
      gltf.scene.rotation.y = Math.PI / 2;
      scene.add(gltf.scene);
      const playRun = (clips: readonly THREE.AnimationClip[]) => {
        const run = clips.find((c) => /run/i.test(c.name));
        if (run != null) {
          mixer = new THREE.AnimationMixer(gltf.scene);
          mixer.clipAction(run).play();
        }
      };
      const own = gltf.animations ?? [];
      if (own.some((c) => /run/i.test(c.name)) || !theme.animationUrls) {
        playRun(own);
      } else {
        // KayKit heroes: fetch the shared run clip and bind it by bone name.
        loader
          .loadAsync(
            `${ASSETS}/models/${theme.modelDir}/${theme.animationUrls[0]}`,
          )
          .then((g) => {
            if (!disposed) {
              playRun(g.animations ?? []);
            }
          })
          .catch(() => {});
      }
    })
    .catch(() => {});
  const clock = new THREE.Clock();
  function tick() {
    if (disposed) {
      return;
    }
    mixer?.update(clock.getDelta());
    renderer.render(scene, cam);
    requestAnimationFrame(tick);
  }
  tick();
  return {
    dispose() {
      disposed = true;
      renderer.dispose();
    },
  };
}

export function pickLand(lands: readonly Land[] = LANDS): Land {
  let n = 0;
  try {
    const key = profileStorageKey("kids.land");
    n = Number(localStorage.getItem(key) ?? 0);
    localStorage.setItem(key, String(n + 1));
  } catch {
    // Storage may be unavailable.
  }
  return lands[n % lands.length];
}
