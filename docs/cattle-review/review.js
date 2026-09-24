/**
 * Cow and calf, every clip, side by side.
 *
 * A page of its own rather than a flag on the game, because reviewing an
 * animation means watching one clip for as long as you like from wherever you
 * like — and the road gives you a few seconds of each from one angle while a
 * child walks past it.
 *
 * The small motions are a DELIBERATE COPY of `cattleMotion` in world.ts, not
 * an import: this page is plain modules served from `public/` and the game is
 * a bundle. If the two drift, the game is right and this is stale — the
 * figures are named the same on both sides so a diff is easy to read.
 */
import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { KTX2Loader } from "./vendor/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "./vendor/libs/meshopt_decoder.module.js";
import { mergeVertices } from "./vendor/utils/BufferGeometryUtils.js";

const MODELS = [
  { name: "Cow", url: "/kids-assets/models/village-folk/Cow.glb", height: 5.9, calf: false, x: -2.4 },
  { name: "Cow_Calf", url: "/kids-assets/models/village-folk/Cow_Calf.glb", height: 3.3, calf: true, x: 3.2 },
];

const canvas = document.getElementById("view");
const statusEl = document.getElementById("status");
const clipsEl = document.getElementById("clips");
const liveEl = document.getElementById("live");
const nightEl = document.getElementById("night");
const spinEl = document.getElementById("spin");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd8c6);
scene.fog = new THREE.Fog(0xcfd8c6, 26, 60);

const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
const camAt = new THREE.Vector3(0, 2.6, 0);
let camAngle = Math.PI / 2;
let camDist = 17;

// Enough light to read a silhouette and a cast shadow to sit it on the
// ground — the point of the page is the shape moving, not the lighting.
const sun = new THREE.DirectionalLight(0xfff4e0, 2.1);
sun.position.set(-7, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -16;
sun.shadow.camera.right = 16;
sun.shadow.camera.top = 16;
sun.shadow.camera.bottom = -16;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x6d7a55, 1.25));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(40, 48).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x8faa72, roughness: 1 }),
);
ground.receiveShadow = true;
scene.add(ground);

const clock = new THREE.Clock();
const animals = [];
let clipNames = [];
let playing = null;

// ── the copied motions ────────────────────────────────────────────────
const AX_UP = new THREE.Vector3(0, 1, 0);
const AX_R = new THREE.Vector3(1, 0, 0);
const spinQ = new THREE.Quaternion();
const spinAxis = new THREE.Vector3();
const spinWorld = new THREE.Quaternion();

function wrapRight(o, into) {
  return into.set(1, 0, 0).applyQuaternion(o.getWorldQuaternion(spinWorld));
}

/** Turn a bone about a WORLD axis, on top of whatever the clip just posed. */
function addWorldSpin(bone, worldAxis, angle) {
  if (angle === 0) return;
  bone.getWorldQuaternion(spinWorld).invert();
  spinAxis.copy(worldAxis).applyQuaternion(spinWorld).normalize();
  bone.quaternion.multiply(spinQ.setFromAxisAngle(spinAxis, angle));
}

function cattleLife(wrap, calf, height) {
  const bone = (n) => wrap.getObjectByName(n) ?? null;
  return {
    calf,
    head: bone("head"),
    tail: ["tailstart", "tail1", "tail2", "tail3"].map(bone).filter(Boolean),
    ears: ["earend", "R_earend"].map(bone).filter(Boolean),
    phase: Math.random() * Math.PI * 2,
    flickIn: 2 + Math.random() * (calf ? 4 : 7),
    flickT: 0,
    earIn: 1.5 + Math.random() * (calf ? 3 : 6),
    earT: 0,
    earWhich: 0,
    rest: 0,
    // Stride frequency and height for the calf's bounce; set per clip by
    // `play`, zero for anything that should not spring.
    bounce: 0,
    hop: height * 0.012,
    baseY: wrap.position.y,
  };
}

function cattleMotion(cow, wrap, dt, t, night) {
  // WHAT LYING DOWN USED TO BE, AND IS NOT ANY MORE.
  //
  // This held a hand-posed fold: fixed angles per bone, applied additively,
  // four legs jackknifed by numbers tuned by eye against this page. It was
  // wrong three separate ways — the hind profile is not the mirror of the
  // front because a hock bends opposite to a knee; the body's drop cannot be
  // a fraction of its height because what it must equal is how much room
  // folding actually frees; and nothing in it knew where the floor was.
  //
  // Both animals now ship a real `Rest` clip, authored against their own
  // geometry by `buffalo-author.mjs` — body planted on the floor by its own
  // skin, legs solved with IK to ground targets under the barrel. Lying down
  // is a cross-fade to that clip, so everything below is just the small
  // living motions that play on top of whichever clip is running.
  cow.rest += ((night ? 1 : 0) - cow.rest) * Math.min(1, dt * 0.55);
  const calm = 1 - cow.rest * 0.55;
  const quick = (cow.calf ? 1.7 : 1) * calm;
  // AND IT CARRIES ITSELF DIFFERENTLY. Speeding the clip up alone still
  // looks like an adult on fast-forward, because the thing that reads as
  // "young" is the spring: a calf pushes off harder than its weight needs
  // and lifts clear of the ground between steps. This is a small vertical
  // bounce at twice the stride — two pushes per cycle, one per diagonal
  // pair — and it is deliberately NOT applied while resting or grazing,
  // where the same spring would look like a twitch.
  // SET FROM `baseY` EVERY FRAME, NEVER ACCUMULATED. This was `+=` onto
  // whatever height the animal already had, which was harmless only while
  // the night fold assigned `wrap.position.y` outright a few lines above.
  // Removing the fold took that reset with it and the bounce began
  // integrating: the calf climbed a little every frame and floated away.
  wrap.position.y = cow.baseY;
  if (cow.calf && cow.bounce > 0 && cow.rest < 0.2) {
    const hop = Math.abs(Math.sin(t * cow.bounce * Math.PI)) - 0.5;
    wrap.position.y = cow.baseY + hop * cow.hop;
  }
  const ph = cow.phase;
  const chew = Math.sin(t * 5.2 * calm + ph) * 0.012;
  const nod = Math.sin(t * 0.45 + ph) * 0.03 * (1 - cow.rest * 0.6);
  if (cow.head) addWorldSpin(cow.head, wrapRight(wrap, AX_R), chew + nod);
  cow.flickIn -= dt;
  if (cow.flickIn <= 0) {
    cow.flickIn = (cow.calf ? 2.5 : 5) + Math.random() * (cow.calf ? 4 : 9);
    cow.flickT = 0.42;
  }
  if (cow.flickT > 0) cow.flickT = Math.max(0, cow.flickT - dt);
  const swat = cow.flickT > 0 ? Math.sin((cow.flickT / 0.42) * Math.PI) : 0;
  for (let i = 0; i < cow.tail.length; i++) {
    const reach = 0.05 + i * 0.055;
    const swing = Math.sin(t * 1.25 * quick + ph - i * 0.38) * reach;
    addWorldSpin(cow.tail[i], AX_UP, swing + swat * reach * 3.4);
  }
  cow.earIn -= dt;
  if (cow.earIn <= 0) {
    cow.earIn = (cow.calf ? 1.6 : 3) + Math.random() * (cow.calf ? 3.5 : 7);
    cow.earT = 0.26;
    cow.earWhich = Math.random() < 0.5 ? 0 : 1;
  }
  if (cow.earT > 0) {
    cow.earT = Math.max(0, cow.earT - dt);
    const ear = cow.ears[cow.earWhich];
    if (ear) addWorldSpin(ear, wrapRight(wrap, AX_R), Math.sin((cow.earT / 0.26) * Math.PI) * 0.5 * quick);
  }
}

/**
 * Measure a rig the way the game does.
 *
 * Skinned rigs here carry node scales in the hundreds, and the answer
 * depends on measuring THROUGH the skeleton: `SkinnedMesh.computeBoundingBox`
 * applies the bone transforms, where `geometry.boundingBox` is the bind-pose
 * box in local space. Using the latter, both animals were scaled to "the
 * right height", sat in the frustum at the right size by every number I
 * could print — and drew nothing at all, because what the GPU skins is not
 * what that box described.
 *
 * Ported from `measureBox` / `fitToHeight` in world.ts rather than invented
 * again; see the notes there for the quantisation trap as well.
 */
function measureBox(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.computeBoundingBox();
      tmp.copy(o.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(tmp);
    } else if (o.isMesh) {
      o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(tmp);
    }
  });
  return box;
}

/** Scale a loaded model so it stands `height` tall, centred, feet on zero. */
function fitToHeight(root, height) {
  const box = measureBox(root);
  const size = box.getSize(new THREE.Vector3());
  const s = height / (size.y || 1);
  const wrap = new THREE.Group();
  root.scale.setScalar(s);
  root.position.set(
    (-(box.min.x + box.max.x) / 2) * s,
    -box.min.y * s,
    (-(box.min.z + box.max.z) / 2) * s,
  );
  wrap.add(root);
  return wrap;
}

/**
 * Weld and shade exactly as the game's `weldAndShade` does (world.ts).
 *
 * The cattle ship WITHOUT normals — the game recomputes them on load, so the
 * ones in the file never reached the screen — and GLTFLoader answers a
 * missing normal by switching the material to flat shading. Without this
 * step the page would draw faceted animals the village never shows. With it,
 * the page shows the same surface the road does, which it should have done
 * anyway.
 */
function weldAndShade(m) {
  const before = m.geometry;
  m.geometry = mergeVertices(before, 1e-4);
  m.geometry.computeVertexNormals();
  before.dispose();
  for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
    if (mat?.flatShading) {
      mat.flatShading = false;
      mat.needsUpdate = true;
    }
  }
}

/**
 * THE TRANSCODER HAS TO COME FROM A FILE, NOT A BLOB.
 *
 * These models carry Basis textures, and three builds its KTX2 worker in the
 * page and starts it from a `blob:` URL. A blob worker inherits the
 * document's Content-Security-Policy, and the transcoder is emscripten
 * output whose embind layer builds its call wrappers with `new Function` —
 * which this app's policy withholds, deliberately.
 *
 * It fails in the worst possible way: the throw happens inside the worker's
 * own start-up promise, so nothing rejects. The worker simply never reports
 * ready and the load hangs for ever. That is precisely what this page did on
 * its first run — "Loading…" and no error anywhere.
 *
 * A worker started from a real same-origin URL carries its own policy
 * instead, and the game already serves one for exactly this reason. Same
 * override as `serveTranscoderFromUrl` in world.ts.
 */
function serveTranscoderFromUrl(ktx2) {
  ktx2.transcoderPending = fetch("/kids-assets/basis/basis_transcoder.wasm")
    .then((r) => {
      if (!r.ok) throw new Error(`basis_transcoder.wasm: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((binary) => {
      ktx2.transcoderBinary = binary;
      ktx2.workerPool.setWorkerCreator(() => {
        const worker = new Worker("/kids-assets/basis/ktx2-worker.js");
        const transcoderBinary = ktx2.transcoderBinary.slice(0);
        worker.postMessage(
          { type: "init", config: ktx2.workerConfig, transcoderBinary },
          [transcoderBinary],
        );
        return worker;
      });
    });
}

async function boot() {
  const ktx2 = new KTX2Loader().setTranscoderPath("/kids-assets/basis/").detectSupport(renderer);
  serveTranscoderFromUrl(ktx2);
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

  for (const spec of MODELS) {
    let gltf;
    statusEl.textContent = `Loading ${spec.name}…`;
    try {
      gltf = await loader.loadAsync(spec.url);
    } catch (err) {
      statusEl.textContent = `Could not load ${spec.name}: ${String(err)}`;
      console.error("cattle-review:", spec.name, err);
      return;
    }
    statusEl.textContent = `${spec.name} decoded`;
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        weldAndShade(o);
      }
    });
    const wrap = fitToHeight(gltf.scene, spec.height);
    wrap.position.set(spec.x, 0, 0);
    wrap.rotation.y = Math.PI / 2;
    scene.add(wrap);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const actions = new Map();
    for (const c of gltf.animations ?? []) actions.set(c.name, mixer.clipAction(c));
    animals.push({ ...spec, wrap, mixer, actions, life: cattleLife(wrap, spec.calf, spec.height) });
    // Every clip either model ships, in the order the first one lists them.
    for (const c of gltf.animations ?? []) if (!clipNames.includes(c.name)) clipNames.push(c.name);
  }

  for (const name of clipNames) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name.replace(/_/g, " ");
    b.addEventListener("click", () => play(name));
    b.dataset.clip = name;
    clipsEl.append(b);
  }
  // Handy while tuning the page itself; harmless in review.
  // `step` runs one frame on demand. rAF does not run in a background tab,
  // so anything measured while this page is not the focused one measures a
  // world that has not moved since it loaded — which is how two fold
  // profiles came to report identical results. Driving it explicitly makes
  // a measurement independent of whether anybody is looking at it.
  window.__review = { THREE, scene, cam, animals, renderer, step };
  play(clipNames.includes("Graze") ? "Graze" : clipNames[0]);
  onResize();
  renderer.setAnimationLoop(frame);
}

const CALF_RATE = { Walk: 1.32, Idle: 1.12, Idle_Alert: 1.25, Graze: 1, Rest: 1 };

// Lying down is a clip now, so the night switch is a cross-fade rather than
// a pose: `Rest` is authored against each animal's own body and already
// knows where the floor is.
nightEl.addEventListener("change", () => {
  if (nightEl.checked) {
    if (playing !== "Rest") beforeNight = playing;
    play("Rest");
  } else {
    play(beforeNight && beforeNight !== "Rest" ? beforeNight : "Idle");
  }
});
let beforeNight = null;

function play(name) {
  playing = name;
  for (const a of animals) {
    for (const [n, act] of a.actions) {
      if (n === name) {
        act.reset();
        act.setEffectiveWeight(1);
        act.setLoop(THREE.LoopRepeat, Infinity);
        // A CALF IS NOT A SMALL COW. Both animals share the donor's clips,
        // so played straight they move at identical, adult speed — which on
        // a body half the size reads as a heavy, plodding calf. Short legs
        // swing faster: the gait is stepped up, the standstill only a
        // little, and the graze not at all, because a calf eating is the one
        // thing it does as slowly as its mother.
        act.timeScale = a.calf ? (CALF_RATE[name] ?? 1) : 1;
        act.play();
      } else {
        act.stop();
      }
    }
  }
  // The bounce belongs to the gaits only; a standing or grazing calf should
  // not be springing on the spot.
  for (const a of animals) a.life.bounce = a.calf && (name === "Walk" ? 3.0 : name === "Idle_Alert" ? 1.4 : 0);
  for (const b of clipsEl.children) b.setAttribute("aria-pressed", String(b.dataset.clip === name));
  const missing = animals.filter((a) => !a.actions.has(name)).map((a) => a.name);
  statusEl.textContent =
    `${name.replace(/_/g, " ")} — cow 5.9 / calf 3.3` +
    (missing.length ? ` · not in ${missing.join(", ")}` : "");
}

function onResize() {
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  renderer.setSize(w, h, false);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);

for (const [id, angle] of [["front", Math.PI], ["side", Math.PI / 2], ["back", 0]]) {
  document.getElementById(id).addEventListener("click", () => {
    camAngle = angle;
  });
}

function frame() {
  step(Math.min(0.05, clock.getDelta()), clock.elapsedTime);
}

function step(dt, t) {
  if (spinEl.checked) camAngle += dt * 0.25;
  cam.position.set(
    camAt.x + Math.cos(camAngle) * camDist,
    camAt.y + 4.2,
    camAt.z + Math.sin(camAngle) * camDist,
  );
  cam.lookAt(camAt);
  for (const a of animals) {
    a.mixer.update(dt);
    if (liveEl.checked) cattleMotion(a.life, a.wrap, dt, t, nightEl.checked);
    else a.wrap.position.y = a.life.baseY;
  }
  renderer.render(scene, cam);
}

void boot().catch((err) => {
  statusEl.textContent = `Failed: ${String(err)}`;
  console.error("cattle-review boot:", err);
});
