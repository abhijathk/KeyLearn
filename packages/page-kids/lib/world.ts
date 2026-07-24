import { profileStorageKey } from "@keybr/pages-shared";
import * as THREE from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

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
    grass: 0x5d7f43,
    grassVar: 0x74905a,
    dirt: 0x8a6f4c,
    sun: 0xffe9c4,
    fog: 0xbfe0c8,
    path: "stones",
    trees: "Trees",
    friend: "Triceratops",
  },
  {
    name: "Blossom Meadow",
    mood: "day",
    tex: "leafy_grass",
    grass: 0x7aa855,
    grassVar: 0x94c46a,
    dirt: 0xc9b287,
    sun: 0xfff2d0,
    fog: 0xd8f0c8,
    path: "stones",
    trees: "BirchTrees",
    friend: "Stegosaurus",
  },
  {
    name: "Mammoth Crossing",
    mood: "overcast",
    tex: "snow_02",
    grass: 0xaac4d6,
    grassVar: 0x92b2c6,
    dirt: 0x7b98ae,
    sun: 0xdceeff,
    fog: 0xdfeafc,
    path: "stones",
    trees: "PineTrees",
    friend: "Apatosaurus",
  },
  {
    name: "Amber Sands",
    mood: "day",
    tex: "sandy_gravel",
    grass: 0xc2a06c,
    grassVar: 0xb08c56,
    dirt: 0xa07a4c,
    sun: 0xffe2b0,
    fog: 0xf0d9b0,
    path: "sand",
    trees: "PalmTrees",
    friend: "Parasaurolophus",
  },
];

/** How far one round carries the runner. The trail never rewinds — each new
 * round plants the camp flag another stretch ahead. */
const RUN_LEN = 40;
/** Trail coverage: three rounds land-to-land, plus a margin. */
const TRAIL_END = 150;
const groundY = (x: number) =>
  Math.sin(x * 0.045) * 1.6 + Math.sin(x * 0.011 + 1.7) * 2.4;
/** The trail wanders a little, like feet chose it — never far from the lane. */
const meander = (x: number) =>
  Math.sin(x * 0.07) * 0.7 + Math.sin(x * 0.023 + 2.1) * 0.4;

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
  grow(scale: number): void;
  /** Baby (0) → adult (1): reshapes the dino's body, colour and gait. */
  setAge(age: number): void;
  burstAtPlayer(colors: readonly number[], count?: number, up?: number): void;
  playerScreenXY(): readonly [number, number] | null;
  setNight(night: boolean): void;
  resize(): void;
  dispose(): void;
};

export function createKidsWorld(
  canvas: HTMLCanvasElement,
  land: Land,
): KidsWorld {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  canvas.style.filter = "saturate(1.07) contrast(1.045)";

  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(land.sun, 2.4);
  sun.position.set(-18, 30, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  scene.add(sun, new THREE.HemisphereLight(0xcfe8ff, land.grass, 0.5));
  scene.fog = new THREE.Fog(land.fog, 60, 160);

  const cam = new THREE.OrthographicCamera();
  function resize() {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 300;
    const a = w / h;
    const S = 13.5; // wider than the game's 9.5 — plenty of land in view
    cam.left = -S * a;
    cam.right = S * a;
    // The frustum reaches further below the look-at point than above it, so
    // the trail (and the runner) sit clear of the floating words bar.
    cam.top = S * 0.62;
    cam.bottom = -S * 1.38;
    cam.near = -100;
    cam.far = 300;
    cam.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  cam.position.set(-10, 14, 22);
  cam.lookAt(0, 2.2, 0);

  // ── sky ────────────────────────────────────────────────────────────────
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rgbe = new RGBELoader();
  async function applySky(mood: string) {
    const tex = await rgbe.loadAsync(`${ASSETS}/env/${mood}.hdr`);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = tex;
    scene.backgroundBlurriness = 0.06;
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    scene.environmentIntensity = mood === "night" ? 0.85 : 0.7;
    scene.backgroundIntensity = mood === "night" ? 1.6 : 1.0;
    (scene.fog as THREE.Fog).color.set(mood === "night" ? 0x4a5580 : land.fog);
    sun.intensity = mood === "night" ? 1.9 : 2.4;
    sun.color.set(mood === "night" ? 0xb8c8ec : land.sun);
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
    const noise2 = (x: number, z: number) =>
      Math.sin(x * 0.7 + z * 1.3) * Math.cos(x * 0.31 - z * 0.7);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let y = groundY(x);
      const distLane = Math.max(0, Math.abs(z) - 2.6);
      y += noise2(x * 0.35, z * 0.5) * 0.35 * Math.min(1, distLane / 3);
      if (z < -10) {
        y += (-z - 10) * (0.3 + 0.1 * Math.sin(x * 0.05));
      }
      pos.setY(i, y);
      const n = (noise2(x * 0.8, z * 0.9) + 1) / 2;
      tmp
        .setRGB(1, 1, 1)
        .lerp(cGrass, 0.4)
        .lerp(cVar, n * 0.2);
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
    const ground = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        map: diff,
        normalMap: nor,
        normalScale: new THREE.Vector2(0.85, 0.85),
      }),
    );
    ground.receiveShadow = true;
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
  function rigOf(
    gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] },
    targetH: number,
  ): DinoRig {
    const wrap = fitToHeight(gltf.scene, targetH);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const clips = gltf.animations ?? [];
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
  let stumbleT = 0;
  let beckonT = 0;
  let wasAirborne = false;
  let roarT = 0;
  let growTarget = 1;
  // 0 = just-hatched baby, 1 = fully-grown adult. Drives real proportion,
  // colour and gait changes on top of the overall size growth.
  let dinoAge = 1;
  const boneBase = new WeakMap<THREE.Object3D, THREE.Vector3>();
  const friends: DinoRig[] = [];
  const sparks: THREE.Mesh[] = [];

  // Reshape the loaded skeleton by age: babies get an oversized head, stubby
  // legs, a short tail and a round belly (that reads as "cute"), maturing to
  // lean adult proportions; the skin softens to a lighter green when little,
  // and the whole gait quickens so the baby bounces along.
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

  async function setPlayer(name: string) {
    const gltf = await loadModel(`${ASSETS}/models/dino/${name}.glb`);
    const targetH = name === "TRex" ? 3.1 : name === "Triceratops" ? 2.6 : 2.3;
    const rig = rigOf(gltf, targetH);
    rig.wrap.position.set(playerX, groundY(playerX), 0);
    rig.wrap.rotation.y = Math.PI / 2;
    if (player) {
      rig.wrap.scale.copy(player.wrap.scale);
      scene.remove(player.wrap);
    }
    player = rig;
    scene.add(rig.wrap);
    morphDino(rig, dinoAge);
  }

  const ready = (async () => {
    await setPlayer("TRex");

    const calm = (clips: THREE.AnimationClip[]) =>
      clips.find((c) => /idle|stand|eat|graze/i.test(c.name)) ??
      clips.find((c) => /walk/i.test(c.name)) ??
      null;
    const herdSpots = [
      { model: land.friend, x: 6, z: -6, h: 2.6 },
      { model: "Triceratops", x: 20, z: -8, h: 2.4 },
      { model: "Apatosaurus", x: 34, z: -10, h: 3.4 },
      { model: "Parasaurolophus", x: 44, z: -7, h: 2.4 },
      { model: land.friend, x: 72, z: -8, h: 2.6 },
      { model: "Stegosaurus", x: 96, z: -6, h: 2.4 },
      { model: "Apatosaurus", x: 122, z: -10, h: 3.4 },
      { model: "Triceratops", x: 142, z: -7, h: 2.4 },
    ];
    for (const spot of herdSpots) {
      const gltf = await loadModel(`${ASSETS}/models/dino/${spot.model}.glb`);
      const wrap = fitToHeight(gltf.scene, spot.h);
      wrap.position.set(spot.x, groundY(spot.x), spot.z);
      wrap.rotation.y = 0.4 + Math.random() * 1.2;
      scene.add(wrap);
      const mixer = new THREE.AnimationMixer(gltf.scene);
      const clip = calm(gltf.animations ?? []);
      if (clip) {
        const a = mixer.clipAction(clip);
        a.timeScale = 0.75;
        a.play();
      }
      friends.push({ wrap, mixer, run: null, idle: null });
    }

    for (const [file, count, minD, maxD, side] of [
      [land.trees, 26, 6, 26, "back"],
      ["Rocks", 12, 5, 22, "back"],
      ["Flowers", 24, 3, 14, "both"],
      ["Bushes", 16, 4, 16, "both"],
    ] as const) {
      const gltf = await loadModel(`${ASSETS}/models/nature/${file}.glb`);
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
        wrap.position.set(x, groundY(x), z);
        wrap.rotation.y = Math.random() * Math.PI * 2;
        wrap.scale.setScalar(0.8 + Math.random() * 0.8);
        scene.add(wrap);
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
      if (jumpY > 0.05) {
        wasAirborne = true;
      } else if (wasAirborne) {
        wasAirborne = false; // touchdown — kick up a puff of dust
        burst(p.x, p.y + 0.15, p.z, [0xcfc4ae, 0xb8ab90], 8, 0.14);
      }
      const moving = Math.abs(dx) > 0.08;
      if (moving) {
        beckonT = 0;
      }
      if (player.run && player.idle) {
        player.run.weight += ((moving ? 1 : 0) - player.run.weight) * 0.12;
        player.idle.weight = 1 - player.run.weight;
      }
      const cur = player.wrap.scale.x;
      player.wrap.scale.setScalar(cur + (growTarget - cur) * 0.06);
      if (roarT > 0) {
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
      cam.position.x += (p.x - 2 - cam.position.x) * 0.06;
      sun.position.x = cam.position.x - 8;
      sun.target.position.x = cam.position.x;
      sun.target.updateMatrixWorld();
      player.mixer.update(dt);
    }
    for (const f of friends) {
      f.mixer.update(dt);
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
      runStart = Math.min(targetX, TRAIL_END - RUN_LEN);
      runEnd = runStart + RUN_LEN;
      placeFlag();
    },
    jump() {
      jumpV = 0.34;
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
      targetX = playerX; // a wrong key stops the run
    },
    roar() {
      roarT = 1;
      if (player) {
        const p = player.wrap.position;
        burst(p.x + 1.2, p.y + 2.4, p.z, [0xff5c5c, 0xffd66b], 12, 0.28);
      }
    },
    grow(scale) {
      growTarget = scale;
      if (player) {
        player.wrap.scale.setScalar(scale * 1.18); // pop, then settle
        const p = player.wrap.position;
        burst(p.x, p.y + 2.2, p.z, [0x37c871, 0xffd66b, 0x8fd9b6], 18, 0.32);
      }
    },
    setAge(age) {
      dinoAge = Math.max(0, Math.min(1, age));
      if (player) {
        morphDino(player, dinoAge);
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
      applySky(night ? "night" : land.mood).catch(() => {});
    },
    resize,
    dispose() {
      disposed = true;
      renderer.dispose();
      pmrem.dispose();
    },
  };
}

/**
 * The little running TRex shown while the real world loads — the same model,
 * on its own tiny canvas, so the loader is the game.
 */
export function createLoaderScene(canvas: HTMLCanvasElement): {
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
    .loadAsync(`${ASSETS}/models/dino/TRex.glb`)
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
      const run = (gltf.animations ?? []).find((c) => /run/i.test(c.name));
      if (run != null) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        mixer.clipAction(run).play();
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

export function pickLand(): Land {
  let n = 0;
  try {
    const key = profileStorageKey("kids.land");
    n = Number(localStorage.getItem(key) ?? 0);
    localStorage.setItem(key, String(n + 1));
  } catch {
    // Storage may be unavailable.
  }
  return LANDS[n % LANDS.length];
}
