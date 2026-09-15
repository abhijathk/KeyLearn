import { profileStorageKey } from "@keylearn/pages-shared";
import * as THREE from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { clone as skinnedClone } from "three/addons/utils/SkeletonUtils.js";
import {
  attachTint,
  type CharacterTint,
  type ClothingColours,
} from "./character-tint.ts";
import { type DeviceTier, nightPlan, type NightStyle } from "./night.ts";
import { MAX_UNITS_PER_KEY, RUN_LEN, runLengthFor } from "./run-length.ts";
import { MIN_STONE_GAP, stoneXFor } from "./stone-x.ts";

// Lives beside (not inside) /assets — webpack cleans that directory on build.
const ASSETS = "/kids-assets";

/**
 * Runs the Basis transcoder from a served file instead of a blob.
 *
 * three builds the KTX2 worker in the page and starts it from a blob: URL.
 * Blob workers inherit the document's Content-Security-Policy, and the
 * transcoder is emscripten output whose embind layer builds its call wrappers
 * with `new Function(...)` — which our policy withholds, deliberately. The
 * throw happens inside the worker's own start-up promise, so nothing rejects:
 * the transcoder simply never reports ready and every Basis texture load hangs
 * unresolved. That is what left the Explorer stuck on the loading screen.
 *
 * A worker started from a real same-origin URL carries its own policy instead,
 * so the eval the transcoder needs is granted to that file and to nothing else.
 * Priming `transcoderPending` here makes `init()` a no-op, which is the whole
 * of the override — the worker protocol, the config and the wasm binary are
 * still three's.
 *
 * The worker file is generated from three's own KTX2Loader by
 * scripts/build-ktx2-worker.mjs; its CSP is in server/lib/app/headers.ts.
 */
/**
 * How long a single model may take before the world stops waiting for it.
 *
 * Generous: this is a ceiling on a stuck load, not a performance budget. The
 * largest character is about three megabytes and a slow phone on a slow
 * connection should still finish well inside it.
 */
const MODEL_LOAD_TIMEOUT_MS = 45_000;

/**
 * Where the character breaks into a run, in words per minute.
 *
 * A child pecking out their first letters is not running anywhere, and a
 * sprint cycle under slow typing reads as the game ignoring them. Below this
 * they walk; at or above it they run.
 *
 * Two numbers rather than one because a single threshold flickers: somebody
 * typing right at the boundary would toggle gait every few keystrokes. It
 * takes RUN_WPM to start running and a drop to WALK_WPM to stop, so the gait
 * changes when the pace really changes.
 */
const RUN_WPM = 29;
const WALK_WPM = 25;

/** How long after a jump a second press still counts as a double. ~0.4s. */
/**
 * When the character gives up waiting, in seconds since the last keystroke.
 *
 * REST_WAVE_S is a FLOOR, not the wave's start time — see `waveAt`, which
 * backs the wave off the crouch so the two run together with no idle between.
 *
 * The gaps widen deliberately: a wave is a small thing to do after a short
 * pause, sitting down on the path is a bigger statement and should take a
 * while to earn. Twenty seconds is long enough that a child who is reading
 * the words rather than typing them does not get sat down mid-thought, and it
 * leaves a good eight seconds of crouching in between rather than a glance.
 */
/** Frames sampled per gait cycle when deciding where the ground is. */
const SAMPLES_PER_GAIT = 12;
/**
 * How tall a scattered prop must stand before it is worth a shadow.
 *
 * A knee. Below this the shadow is a few dark pixels directly beneath an
 * object that is already visibly sitting on the ground, and it costs a full
 * extra draw of the mesh every frame to produce them.
 */
const SHADOW_MIN_HEIGHT = 1.5;
/**
 * The most foot vertices any one mesh is skinned at per sampled frame.
 *
 * See plantFeet: this loop runs SAMPLES_PER_GAIT times for every clip a
 * character has, and `applyBoneTransform` is four matrix multiplies a
 * vertex. It is the one place in the world build where a badly named bone
 * can cost seconds, so it is bounded rather than trusted.
 */
const FOOT_SAMPLE_CAP = 600;

/** Crossfade between two resting clips. Long enough to hide a seam, short
 * enough that the pose still lands on the beat it was timed for. */
const REST_CROSSFADE_S = 0.28;

/**
 * How the waiting behaviour backs off when somebody pauses a lot.
 *
 * The first version ran the whole chain, with a line at every step, on every
 * pause. For a child who stops to think between words — which is most of them,
 * most of the time — that is a character waving and talking at them every few
 * seconds, and the effect of a friendly nudge repeated twenty times is not
 * friendliness.
 *
 * Three separate brakes, because they solve different halves of the problem:
 *
 * 1. PATIENCE — the thresholds stretch each time they pause, so someone who
 *    pauses constantly is simply left alone for longer before anything starts.
 * 2. SHORTER CHAIN — the wave stops appearing after the first couple of
 *    pauses, then the crouch does. It has been seen; it is no longer news. By
 *    the sixth pause he just quietly sits down.
 * 3. SPEECH BUDGET — at most ONE line per pause (it was three), and never two
 *    lines within the cooldown. The poses carry the message on their own; the
 *    words are for the first time and the long absence.
 *
 * The poses stay generous and the talking gets rare, which is the right way
 * round: watching a character sit down is pleasant, being told to press a key
 * for the fifth time is not.
 */
/**
 * Stretched, but far less than it was.
 *
 * At 0.55 the stretch doubled the whole chain after two pauses and tripled
 * it after four: the wave went from 6.7s to 14s to 21.5s, and by then a
 * child who had paused a few times was watching a character stand still for
 * twenty seconds before it acknowledged them at all. The idea is right —
 * somebody who pauses constantly should not be waved at constantly — but
 * the size of it turned "patient" into "not responding".
 */
const PATIENCE_STEP = 0.3;
const PATIENCE_CAP = 4;
/** After this many pauses the wave is dropped from the chain. */
const WAVE_UNTIL_PAUSE = 2;
/** After this many, the crouch goes too and only the sit is left. */
const CROUCH_UNTIL_PAUSE = 5;
/** No two spoken lines closer together than this, in seconds. */
const SPEAK_COOLDOWN_S = 45;

/**
 * Peeli is the brave one, and this is where it shows.
 *
 * After dark the villagers on the trail rise as their own skeletons. Dave
 * and Little Drew walk past them; she squares up. The clips are ordered by
 * how much they claim — the ready stance is a girl deciding she is not
 * scared, the strikes are her meaning it — and the weights keep the loud
 * ones rare, because a nine-year-old shadow-boxing every skeleton on the
 * path stops reading as brave and starts reading as a cutscene.
 *
 * Her two long combos (3.9s each) are deliberately absent. They are the
 * least subtle thing she owns and they outlast the moment.
 */
const BRAVE_CLIPS: readonly { readonly re: RegExp; readonly weight: number }[] =
  [
    // Peeli. The ready stance carries most of it — a girl deciding she is not
    // scared — and the strikes are her meaning it.
    { re: /^martialarts_ready$/, weight: 6 },
    { re: /^high_kick_stepin$/, weight: 2 },
    { re: /^sweeping_kick$/, weight: 1 },
    { re: /^punch_forward_bothfists$/, weight: 1 },
    // Dave and Little Drew, who own a different set under different names.
    // Each character picks up only the clips it actually has, so one list
    // serves all three and a character without any of them simply never
    // reacts — which is what every other rig in the game does.
    //
    // No ready stance exists for the boys, so a single quick jab does the job
    // the stance does for her: small, over quickly, and unmistakably "I am
    // not running". The three-hit combo is the biggest thing either of them
    // throws and stays rare for the same reason her long combos are left out
    // altogether.
    { re: /^punch_right$/, weight: 4 },
    { re: /^punch_left$/, weight: 4 },
    { re: /^kick$/, weight: 2 },
    { re: /^combo_3hit$/, weight: 1 },
    // Deliberately absent: `Hit_Front` and `Hit_Back` are the character BEING
    // hit, which would read as the skeleton striking a child; `Dodge_*` reads
    // as flinching away rather than standing up to it; and Little Drew's
    // `Kung_Fu_Punch` is 7.4s, long enough to stop being a reaction and start
    // being a scene.
  ];

/**
 * Standing beats for a character with more to say than an idle loop.
 *
 * Peeli ships two gestures that are neither locomotion, nor combat, nor a
 * pose she has to get up from — a delighted one and a "nope". They fill
 * the two places a standing character otherwise has nothing to do: the
 * gap before she sits, and the whole time she is somebody's companion
 * while that somebody is sat down.
 *
 * Everything else of hers is already spoken for. Her two long punch
 * combos are the only other unused clips and they are neither subtle nor
 * short; `Forward_Charge_InPlace` and `Run_Fast_RootMotion` are travel,
 * and root motion in particular would fight a trail that decides position
 * from how much has been typed.
 */
const FIDGET_CLIPS: readonly RegExp[] = [
  /^excited$/,
  /^no_disagree$/,
  // The robot's one in-place gesture. It has no celebration and nothing to
  // say, so this is the whole of what it does while it waits — which is
  // exactly what a fidget is for.
  //
  // Its `Idle` sits EARLIER in the file than `Standing`, and `pick` takes
  // the first match, so `/idle|stand/` still resolves to the idle rather
  // than to this. Worth knowing if the clips are ever reordered.
  /^standing$/,
];

/**
 * How close the hero has to be for the trail to notice them.
 *
 * One radius, used by both halves of the same moment: it is what makes a
 * skeleton turn and watch (and a known one loom), and it is what makes
 * Peeli square up. They were separate numbers — 7 for the watching, 22 for
 * her — so she was answering something twenty-two units away that had not
 * so much as looked at her, and by the time it did she was on cooldown.
 * The standoff only reads as a standoff if both halves start together.
 */
const NEAR_HERO_RANGE = 7;

/** Kept as its own name where her reaction is read, but the same distance. */
const BRAVE_RANGE = NEAR_HERO_RANGE;

/** She does not react to every one — this is the chance she takes it on. */
const BRAVE_CHANCE = 0.55;

/** And never twice inside this, so the trail is not a running fight. */
const BRAVE_COOLDOWN_S = 9;

/**
 * How long the character waits before doing anything about it.
 *
 * Shortened across the board (from 5 / 10 / 20). The first version was
 * tuned by reading the numbers rather than by sitting in front of it: ten
 * seconds is not long on a stopwatch and is a very long time to watch
 * somebody stand, and the wave — the one beat that says "I noticed you
 * stopped" — was the worst of it, arriving at 6.7s on a first pause and
 * later than that on every one after.
 */
const REST_WAVE_S = 3;
const REST_CROUCH_S = 7;
const REST_SIT_S = 13;

const DOUBLE_TAP_FRAMES = 24;

/**
 * Turns a load that never finishes into one that fails.
 *
 * Every caller already handles a model that rejects — a character that will
 * not load falls back to the one this world ships with, and the game runs. A
 * promise that neither resolves nor rejects defeats all of that: the loading
 * screen spins forever with nothing to catch, which is exactly what a decoder
 * failing inside its own worker start-up produces. Nothing downstream can tell
 * "slow" from "never" without a clock, so this supplies one.
 */
function withDeadline<T>(work: Promise<T>, url: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`kids: timed out loading ${url}`)),
        MODEL_LOAD_TIMEOUT_MS,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Removes bone scale tracks from a clip.
 *
 * Nothing in these character rigs animates bone scale on purpose. What the
 * tracks actually contain is a rig-scale artefact: across all twenty of the
 * Explorer's clips, every scale key is either exactly 1 (72,300 of them) or a
 * point on a smooth ramp towards 1.1768 — which is 1/0.85, the ratio between
 * the scale the rig was authored at and the scale it was exported at. Squash
 * and stretch would differ per axis and cluster on impact frames; this is one
 * uniform number, interpolated, on the same bone.
 *
 * Left in, it does visible damage. `Idle` pinned Hips at 1.1768 for the whole
 * clip while `Walk` and `Run` sat at 1, so the character stood 17.7% taller
 * than he ran. The one-shot clips — Wave, Jump, Crouch, Sit — ramp between the
 * two, so each would swell and shrink as it played.
 *
 * An earlier version of this dropped only CONSTANT tracks, which fixed the
 * standing-taller bug and left every ramp untouched. Dropping all of them is
 * both simpler and more honest about what the data is: with no scale track the
 * bind pose governs, which is the pose `fitToHeight` measured and `plantFeet`
 * planted.
 */
/**
 * How far the upper arms are rotated to bring the hands down onto the knees,
 * in degrees, per bone. Local to the bone, applied after its own rotation.
 *
 * These are solved, not eyeballed. In the shipped `Sit_CrossLegged_Idle` the
 * hands reach 0.15 forward of and 0.09 below the knees with the arms close to
 * straight — a bracing pose, which is why the character read as being about to
 * stand up rather than settled. Searching upper-arm rotations for the one that
 * puts each hand on its knee, while preferring the smallest rotation that does
 * it and rejecting any that pulls the elbow inside the torso, gives these:
 * hand-to-knee distance drops from 0.137 to 0.013 on the left and 0.124 to
 * 0.006 on the right, elbows staying about 0.25 clear.
 *
 * Tune here if the pose still reads wrong — the first number is the one that
 * lowers the arm.
 */
/**
 * The gait cycle lengths the trail's travel speed was tuned against — the
 * Explorer's own Walk and Run. Every other character's gait is retimed to
 * these so its feet match the ground it covers.
 */
/**
 * Models whose clips ARE the Explorer's, baked in by
 * `scripts/kids-bake-clips.mjs`.
 *
 * The six-year-old's own animation was rejected, so he ships wearing the
 * ten-year-old's — retargeted offline through each rig's rest pose, since the
 * two share a bone chain and neither their units nor their rest orientations.
 * The corrections below are solved against those clips, so they follow the
 * clips rather than the character.
 */
/**
 * The AK 3D Pack — the characters that are NOT ours to give away.
 *
 * KeyLearn's code is AGPL. The models in this pack are not: they were
 * bought under a commercial licence and are included so this deployment
 * can show them. They live in their own folder — `models/ak-3d-pack/` —
 * so the boundary is a directory rather than a paragraph somebody has to
 * read: anyone forking this can delete one folder and know they have
 * removed everything they have no right to, and this list is what tells
 * the loader where to look.
 *
 * The directory is `ak-3d-pack` rather than the pack's written name
 * because it is also a URL path, and a space in one becomes `%20` in
 * every request for a model.
 *
 * See `root/public/kids-assets/models/ak-3d-pack/COMMERCIAL-LICENSE.md`.
 */
const AK_3D_PACK: ReadonlySet<string> = new Set([
  "Explorer", // Dave
  "Explorer6", // Little Drew
  "Peeli",
  "Robot",
  "Puppy",
  "Buffalo", // wild random character — not a hero or companion
]);

/**
 * Characters that are neither pack members nor themed cast, each in its own
 * folder. Abee is ours -- keeping him out of `ak-3d-pack/` keeps that folder
 * exactly what its COMMERCIAL-LICENSE.md says it is.
 */
const OWN_MODELS: ReadonlyMap<string, string> = new Map([["Abee", "abee"]]);

/** Where a character's model actually lives, pack members included. */
/**
 * What to CALL each thing while the world is being built.
 *
 * Only the names a child would use. The files are called `MegaBroadleaf` and
 * `Milestone_Vazhivilakku`, which is right for a folder and no good at all
 * on a loading screen; anything not listed falls back to its filename with
 * the underscores taken out, which reads acceptably for the rest.
 */
const SCENE_NAMES: ReadonlyMap<string, string> = new Map([
  // The cast, by the names the page shows. These have to match, or a child
  // watches somebody called "Explorer6" arrive and then plays as Little Drew.
  ["Explorer", "Dave"],
  ["Explorer6", "Little Drew"],
  ["Peeli", "Peeli"],
  ["Robot", "the robot"],
  ["Puppy", "the puppy"],
  ["Abee", "Abee"],
  ["Buffalo", "a buffalo"],
  // The village.
  ["Temple", "the temple"],
  ["Market", "the market"],
  ["Cart", "a cart"],
  ["Banyan", "the banyan tree"],
  ["Banyan_Almaram", "the banyan tree"],
  ["Stone_Althara", "the althara"],
  ["Wall", "garden walls"],
  ["HouseThatch", "a thatched house"],
  ["HouseMoss", "an old house"],
  ["HouseHearth", "a house with a hearth"],
  // The land itself.
  ["MegaBroadleaf", "the big trees"],
  ["Trees", "the trees"],
  ["BirchTrees", "the trees"],
  ["MegaPine", "the pines"],
  ["MegaPlants", "the undergrowth"],
  ["Flowers", "wildflowers"],
  ["MegaPebbles", "loose pebbles"],
  ["KeralaBambooGroves", "a bamboo grove"],
  // The roadside.
  // One stone, not two: the milestone carries its own vazhivilakku head.
  ["Milestone_Vazhivilakku", "the milestones"],
  ["Laterite_Rock", "laterite rock"],
  ["Granite_Boulder", "granite boulders"],
  ["Mossy_Stone", "mossy stones"],
  ["River_Stone", "river stones"],
  ["Stepping_Stone", "stepping stones"],
]);

/** The name for whatever is at this URL — see SCENE_NAMES. */
function sceneName(url: string): string {
  const file =
    url
      .split("/")
      .pop()
      ?.replace(/\.glb$/i, "") ?? "";
  return SCENE_NAMES.get(file) ?? file.replace(/[_-]+/g, " ").toLowerCase();
}

function modelUrl(modelDir: string, name: string): string {
  const own = OWN_MODELS.get(name);
  if (own != null) return `${ASSETS}/models/${own}/${name}.glb`;
  return AK_3D_PACK.has(name)
    ? `${ASSETS}/models/ak-3d-pack/${name}.glb`
    : `${ASSETS}/models/${modelDir}/${name}.glb`;
}

const WEARS_EXPLORER_CLIPS: ReadonlySet<string> = new Set([
  "Explorer",
  "Explorer6",
]);

/**
 * The gait cycle lengths the trail's travel speed was tuned against — the
 * Explorer's own Walk and Run. Every other character's gait is retimed to
 * these so its feet match the ground it covers.
 */
const TUNED_WALK_SECONDS = 1.03;
const TUNED_RUN_SECONDS = 0.63;

const SIT_ARM_CORRECTION: Readonly<
  Record<string, readonly [number, number, number]>
> = {
  LeftArm: [20, -5, 5],
  RightArm: [15, -5, -5],
};

/**
 * Applies the arm correction to a sitting clip.
 *
 * `ramp` decides how the correction is phased across the clip, and getting
 * this wrong is what would produce a visible snap:
 *
 * - `full` — every key corrected. For the looping sit.
 * - `in` — none at the first key, all at the last. For sitting down, so the
 *   clip ends exactly where the looping sit begins.
 * - `out` — all at the first key, none at the last. For standing up, so it
 *   starts where the sit left off and finishes on the authored pose.
 *
 * The sit-down clip already ends on precisely the sit-idle pose (measured: 0.0
 * degrees of difference on every bone), so correcting one without the others
 * would introduce a discontinuity where there is currently none.
 */
/**
 * Puts a standing clip's hips where the idle's hips are.
 *
 * Peeli's clips each carry a hips translation track, and every one of them
 * was authored from its own baseline: measured across her 21 clips, the
 * hips start at 20 different heights spread over ~0.055 model units, which
 * at her size on the trail is about 0.15 of a unit. Every other bone agrees
 * to the fourth decimal, as it must — a bone's translation is its length,
 * and those cannot differ between two clips on one skeleton.
 *
 * So the difference is real, legitimate authoring (a pose sits where the
 * animator put it) and wrong for us: the crossfade does its job and
 * interpolates faithfully from one baseline to the other, which is seen as
 * the character settling or lifting slightly every time a gesture starts
 * or ends.
 *
 * The whole track is shifted by the difference at its first frame, so the
 * motion inside the clip is untouched and only the baseline moves. Applied
 * to standing clips only: a sit and a crouch are SUPPOSED to put the hips
 * somewhere else, and `lifts` already measures them for exactly that.
 */
function alignHipsToIdle(
  clip: THREE.AnimationClip,
  idleHips: readonly [number, number, number] | null,
): THREE.AnimationClip {
  if (idleHips == null) return clip;
  const out = clip.clone();
  for (const track of out.tracks) {
    if (!/(^|\.)Hips\.position$/.test(track.name)) continue;
    const v = track.values;
    if (v.length < 3) continue;
    const dx = idleHips[0] - v[0]!;
    const dy = idleHips[1] - v[1]!;
    const dz = idleHips[2] - v[2]!;
    for (let i = 0; i + 2 < v.length; i += 3) {
      v[i] = v[i]! + dx;
      v[i + 1] = v[i + 1]! + dy;
      v[i + 2] = v[i + 2]! + dz;
    }
  }
  return out;
}

/** The hips position on a clip's first frame, for `alignHipsToIdle`. */
function firstHips(
  clip: THREE.AnimationClip | null,
): [number, number, number] | null {
  if (clip == null) return null;
  for (const track of clip.tracks) {
    if (!/(^|\.)Hips\.position$/.test(track.name)) continue;
    const v = track.values;
    if (v.length >= 3) return [v[0]!, v[1]!, v[2]!];
  }
  return null;
}

function correctSittingArms(
  clip: THREE.AnimationClip,
  ramp: "full" | "in" | "out",
): THREE.AnimationClip {
  const identity = new THREE.Quaternion();
  const offset = new THREE.Quaternion();
  const partial = new THREE.Quaternion();
  const key = new THREE.Quaternion();
  const euler = new THREE.Euler();
  for (const track of clip.tracks) {
    if (!track.name.endsWith(".quaternion")) continue;
    const deg = SIT_ARM_CORRECTION[track.name.slice(0, -".quaternion".length)];
    if (deg == null) continue;
    const d = Math.PI / 180;
    euler.set(deg[0] * d, deg[1] * d, deg[2] * d);
    offset.setFromEuler(euler);
    const v = track.values;
    const keys = v.length / 4;
    for (let i = 0; i < keys; i++) {
      const t = keys === 1 ? 1 : i / (keys - 1);
      const amount = ramp === "full" ? 1 : ramp === "in" ? t : 1 - t;
      partial.copy(identity).slerp(offset, amount);
      key
        .set(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3])
        .multiply(partial);
      v[i * 4] = key.x;
      v[i * 4 + 1] = key.y;
      v[i * 4 + 2] = key.z;
      v[i * 4 + 3] = key.w;
    }
  }
  return clip;
}

/**
 * Hair that answers to what the head just did.
 *
 * Peeli's hair used to be part of her skull -- 30,080 of her 38,786 vertices
 * were weighted to `Head` -- so it could only ever move exactly as the head
 * moved, which is to say it looked painted on. She now carries a four-bone
 * chain down the length of it, and this swings it.
 *
 * A spring per bone, driven by the HEAD'S OWN ACCELERATION rather than by the
 * clip that is playing. That is the whole trick: it means every animation
 * gets hair for free, including ones written years before the hair existed,
 * and the hair is always answering the real movement rather than a guess
 * about which clip this is.
 *
 * Each bone lags the one above it, which is what reads as weight: the root
 * starts to swing, the tip is still catching up, and by the time the tip
 * arrives the root is already coming back.
 */
type HairSim = {
  readonly bones: readonly THREE.Object3D[];
  readonly rest: readonly THREE.Quaternion[];
  /** Current deflection and its rate, per bone, in radians. */
  readonly ax: number[];
  readonly az: number[];
  readonly vx: number[];
  readonly vz: number[];
  /** Last head position, for working out acceleration. */
  readonly lastPos: THREE.Vector3;
  readonly lastVel: THREE.Vector3;
  /** Where she is in her stride, for the sway. See `stepHair`. */
  phase: number;
  ready: boolean;
};

const HAIR_TMP_P = new THREE.Vector3();
const HAIR_TMP_V = new THREE.Vector3();
const HAIR_TMP_A = new THREE.Vector3();
const HAIR_TMP_Q = new THREE.Quaternion();
const HAIR_TMP_E = new THREE.Euler();

function makeHairSim(root: THREE.Object3D): HairSim | null {
  const bones: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (/^Hair_\d+$/.test(o.name)) {
      bones.push(o);
    }
  });
  if (
    typeof window !== "undefined" &&
    window.location.search.includes("perf")
  ) {
    const w = window as unknown as Record<string, unknown>;
    ((w.__hair ??= []) as string[]).push(
      `${root.name || "(scene)"}: ${bones.length} hair bones ${bones.map((b) => b.name).join(",")}`,
    );
  }
  if (bones.length === 0) {
    return null;
  }
  bones.sort((a, b) => a.name.localeCompare(b.name));
  return {
    bones,
    rest: bones.map((b) => b.quaternion.clone()),
    ax: bones.map(() => 0),
    az: bones.map(() => 0),
    vx: bones.map(() => 0),
    vz: bones.map(() => 0),
    lastPos: new THREE.Vector3(),
    lastVel: new THREE.Vector3(),
    phase: 0,
    ready: false,
  };
}

/**
 * One step of the hair, run after the mixer has posed the skeleton.
 *
 * `gain` is how hard this character is moving -- a run throws the hair about,
 * an idle barely stirs it. Passed in rather than measured here because the
 * caller already knows it.
 */
function stepHair(sim: HairSim | null, dt: number, gain: number): void {
  if (sim == null || dt <= 0) {
    return;
  }
  const head = sim.bones[0]!.parent;
  if (head == null) {
    return;
  }
  head.getWorldPosition(HAIR_TMP_P);
  if (!sim.ready) {
    sim.lastPos.copy(HAIR_TMP_P);
    sim.ready = true;
    return;
  }
  // Acceleration of the head, in the head's OWN frame: hair does not care
  // which way she is facing, only whether her head just moved and which way
  // relative to her.
  HAIR_TMP_V.copy(HAIR_TMP_P).sub(sim.lastPos).divideScalar(dt);
  sim.lastPos.copy(HAIR_TMP_P);
  HAIR_TMP_A.copy(HAIR_TMP_V).sub(sim.lastVel).divideScalar(dt);
  sim.lastVel.copy(HAIR_TMP_V);
  head.getWorldQuaternion(HAIR_TMP_Q);
  HAIR_TMP_A.applyQuaternion(HAIR_TMP_Q.invert());
  // Clamped before it is used, not after: one long frame (a tab coming back,
  // a model finishing loading) produces an acceleration in the thousands and
  // would fire the hair straight through her shoulders.
  // SIDEWAYS IS THE MOVEMENT; FORE-AFT IS THE ARTEFACT.
  //
  // Measured on her walk, the head travels 0.0144 sideways, 0.0328 in bob and
  // 0.0259 fore-and-aft. Fed in raw, the fore-aft term is the larger of the
  // two the hair uses -- and fore-aft rotation is precisely the motion that
  // folds the hair into her back, which is what it was doing. Hair on a
  // walking person swings ACROSS her, so the lateral term is weighted up and
  // the fore-aft one held right down.
  //
  // The bob is the strongest of the three and deliberately unused: a pendulum
  // hanging from a pivot that moves straight up and down does not swing, it
  // only gets heavier and lighter.
  const ax = Math.max(-60, Math.min(60, HAIR_TMP_A.z)) * 0.42;
  const az = Math.max(-60, Math.min(60, HAIR_TMP_A.x)) * 2.7;
  // THE SWAY COMES FROM THE STRIDE, NOT FROM THE HEAD.
  //
  // Measured on her walk, the head travels 0.0144 sideways over a whole
  // cycle -- about four millimetres at her scale. There is simply not enough
  // lateral movement in the clip to swing anything from, which is why
  // weighting the measured term up did not produce a walk swing: it was
  // amplifying almost nothing, and what it did amplify was noise.
  //
  // So the side-to-side is driven by where she is in her stride instead. A
  // walking person's hair crosses once per stride because her shoulders
  // counter-rotate against her hips; the clip under-states that at this size,
  // and this is that rotation made visible. The phase advances with how hard
  // she is moving, so it speeds up into a run and stops dead when she does.
  sim.phase += gain * 3.4 * dt;
  if (sim.phase > Math.PI * 2) {
    sim.phase -= Math.PI * 2;
  }
  // Fixed sub-steps, so the spring behaves the same at 30fps as at 60 and a
  // dropped frame cannot make it explode.
  const steps = Math.min(4, Math.max(1, Math.ceil(dt / 0.012)));
  const h = dt / steps;
  for (let i = 0; i < sim.bones.length; i++) {
    // Further down the chain: softer spring, so the tip trails the root.
    // Softer at the root than it was. This is a parent chain, so Hair_01
    // carries the whole sheet -- at 150 it barely moved, and only the tip,
    // which accumulates all four rotations, went anywhere.
    const k = 64 - i * 9;
    const c = 7.4 - i * 0.7;
    // SOLVED, not guessed. A spring settles where the drive balances the
    // spring, at `drive * a / k` radians. Walking bobs her head at roughly
    // 3 units/s^2, and the first version used a drive of 0.016 -- which
    // against k=150 is 0.0003 radians, a hundredth of a degree. It ran
    // perfectly and moved nothing.
    //
    // For a visible 0.12 rad (about 7 degrees) at a walk: drive = k*0.12/3,
    // so about 6. Running throws four times that and the clamp catches it,
    // which is what gives the run its whip.
    const drive = (4.6 + i * 1.1) * gain;
    // Each bone a little later in the stride than the one above it, so the
    // swing travels down the hair instead of the whole sheet moving as a
    // board. A tenth of a cycle per bone -- enough to see, not so much that
    // the tip is going one way while the root goes the other.
    const sway = Math.sin(sim.phase - i * 0.62) * 5.0 * gain;
    for (let s = 0; s < steps; s++) {
      sim.vx[i]! += (-k * sim.ax[i]! - c * sim.vx[i]! + ax * drive) * h;
      sim.vz[i]! += (-k * sim.az[i]! - c * sim.vz[i]! + az * drive + sway) * h;
      sim.ax[i]! += sim.vx[i]! * h;
      sim.az[i]! += sim.vz[i]! * h;
    }
    // Fore-aft kept on a short rein whichever way it goes -- into her back it
    // clips, away from it the hair stands off her shoulders like a board. The
    // sideways swing is the one allowed a full arc.
    sim.ax[i] = Math.max(-0.13, Math.min(0.13, sim.ax[i]!));
    sim.az[i] = Math.max(-0.46, Math.min(0.46, sim.az[i]!));
    HAIR_TMP_E.set(sim.ax[i]!, 0, sim.az[i]!);
    sim.bones[i]!.quaternion.copy(sim.rest[i]!).multiply(
      HAIR_TMP_Q.setFromEuler(HAIR_TMP_E),
    );
  }
}

function stripScaleTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  clip.tracks = clip.tracks.filter((track) => !track.name.endsWith(".scale"));
  return clip;
}

/**
 * MESHOPT DECODING, OFF THE MAIN THREAD.
 *
 * Every model on this road ships `EXT_meshopt_compression`, and the decoder
 * three is handed decodes SYNCHRONOUSLY on the main thread unless it has been
 * given workers. Twenty-four files and sixteen megabytes of them, unpacked a
 * buffer at a time on the thread that also runs the page, is the shape of a
 * load that stutters and then stops responding altogether.
 *
 * `useWorkers` builds its pool from a blob: URL, which this app's policy
 * allows — `worker-src 'self' blob:` — and a blob worker inherits the
 * document's CSP, which grants `wasm-unsafe-eval`. That is all the decoder
 * needs; unlike the Basis transcoder above it does no `new Function`, so it
 * does not need a served file of its own.
 *
 * Two, not one per core: the decode is short and bursty, the pool costs a
 * wasm instance each, and the machines that most need this are the ones with
 * the least memory to spend on it.
 *
 * Called once. Failure is not fatal — if the pool cannot start, the decoder
 * simply keeps doing the work where it always did.
 */
let meshoptPooled = false;
function meshoptOffMainThread(): void {
  if (meshoptPooled) {
    return;
  }
  meshoptPooled = true;
  try {
    // three's worker pool, not a React hook: the rule matches on the `use`
    // prefix alone and cannot tell the difference.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    MeshoptDecoder.useWorkers(2);
  } catch {
    // Main thread it is.
  }
}

function serveTranscoderFromUrl(ktx2: KTX2Loader): void {
  const self = ktx2 as unknown as {
    transcoderPending: Promise<void> | null;
    transcoderBinary: ArrayBuffer | null;
    workerConfig: unknown;
    workerPool: { setWorkerCreator: (fn: () => Worker) => void };
  };
  self.transcoderPending = fetch(`${ASSETS}/basis/basis_transcoder.wasm`)
    .then((r) => {
      if (!r.ok) throw new Error(`basis_transcoder.wasm: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((binary) => {
      self.transcoderBinary = binary;
      self.workerPool.setWorkerCreator(() => {
        const worker = new Worker(`${ASSETS}/basis/ktx2-worker.js`);
        const transcoderBinary = (self.transcoderBinary as ArrayBuffer).slice(
          0,
        );
        worker.postMessage(
          { type: "init", config: self.workerConfig, transcoderBinary },
          [transcoderBinary],
        );
        return worker;
      });
    });
}

/**
 * Which of the three worlds a learner is in.
 *
 * A named type rather than the inline `"dino" | "hero"` this used to be
 * repeated as: the union appeared in nine declarations across four files and
 * was read against in fifty more, so adding a third world by hand meant
 * finding every one of them and hoping. Named, the compiler finds them.
 */
export type WorldId = "dino" | "hero" | "village";

export type Land = {
  readonly name: string;
  readonly mood: "day" | "overcast";
  readonly tex: string;
  readonly grass: number;
  readonly grassVar: number;
  readonly dirt: number;
  readonly sun: number;
  readonly fog: number;
  /**
   * What the trail underfoot is made of.
   *
   * "stones" lays hand-cut slabs along it, "sand" is a pale track, and "mud"
   * is an old unmade road: wider than either, bare earth rather than dressed,
   * and worn into a pair of cart ruts down the middle.
   */
  readonly path: "stones" | "sand" | "mud";
  /**
   * The three surfaces blended across THIS land, overriding the theme's.
   *
   * Per-land because the third surface is the one that says where you are:
   * dry sand under the palms on the coast, wet leaf litter under the canopy
   * inland. The field and the road stay the same across a country; what is
   * lying on the ground between them does not.
   */
  readonly mix?: {
    /** The land's own growing ground - rice, or grass. */
    readonly field: string;
    /** The cart road. */
    readonly road: string;
    /** Shaded ground: leaf litter, forest floor, wet mud. */
    readonly litter: string;
    /** Open dry ground: sand, gravel, sun-baked earth. */
    readonly dry: string;
    /**
     * Where the FIELD surface gets its colour.
     *
     * "land" (the default): the map is reduced to luminance and supplies only
     * grain and wear, while the hue comes from this land's own grass. Every
     * land can then have its own green without a texture painted for it, and
     * any detail map will do.
     *
     * "texture": the map keeps its own colour. Use this once there is a field
     * texture actually worth looking at — a real paddy, painted for this
     * world — rather than a stand-in borrowed from the scatter set.
     */
    readonly fieldHue?: "land" | "texture";
  };
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
 * How tall each of the cast stands. ONE table, for every world.
 *
 * Height is a property of the character, not of the world it is standing in:
 * a child who knows Dave as the tall one must not find him shorter on a
 * different road. Both worlds used to say so in a comment and then keep
 * their own copy of the numbers, and the copies had already drifted — Peeli
 * was 4.55 on one road and 4.4 on the other, Little Drew 3.95 and 4.0, so
 * the two of them swapped places depending on where they were walking. A
 * comment cannot hold an invariant that two tables are free to break; a
 * shared function can.
 *
 * The siblings are all nine or six and drawn to read as siblings: close
 * enough that they are obviously the same family, far enough apart that a
 * child can tell at a glance which one they picked.
 */
/**
 * How big a character's head is drawn, relative to the way it shipped.
 *
 * Beside `castHeight` because it is the same kind of fact and had the same
 * kind of bug waiting in it: the head scale existed, but only on the
 * COMPANION path, passed in by hand at one call site. A character who is
 * sometimes the player and sometimes a companion — which is all of them —
 * therefore had two different heads depending on which road they were
 * walking, and only the companion one had ever been looked at.
 *
 * Applied to the bone named exactly `Head`. These rigs also carry
 * `head_end`, `headfront` and `Head_Top`; scaling those as well inflates the
 * same skull three and four times over, so the name is matched exactly and
 * the children come along because they are parented to it.
 */
function castHeadScale(name: string): number {
  switch (name) {
    // Peeli's head is drawn small for her body — noticeably smaller than
    // Dave's, though they are the same age and read as siblings, and small
    // enough that she stops looking like a nine-year-old at all. Children
    // are top-heavy; that is most of what separates a child's proportions
    // from an adult's, and hers had been cut the wrong way.
    case "Peeli":
      return 1.18;
    // Bespoke, and deliberately the biggest head in the cast. Measured rather
    // than guessed: the raw model is 4.07 heads tall, where Peeli is 4.12 and
    // Little Drew 3.26. Peeli's 1.18 brings her to 3.49; the same figure put
    // Abee at 3.45, which read as her age rather than as the younger child he
    // is meant to be. 1.26 lands him at 3.24 — just under Little Drew, who is
    // six — and that ratio is what says "younger", far more than height does.
    //
    // Do not push much past this. At 1.34 the skull starts to overhang the
    // shoulders in profile and he tips over into a bobblehead.
    //
    // (The nine-year-old he replaced measured 5.98 heads — nearly adult — and
    // needed 1.22 on top of being scaled up to 6.3 just to stop reading as a
    // small man.)
    case "Abee":
      return 1.26;
    default:
      return 1;
  }
}

/**
 * Grow the skull on the bone, so the skin deforms with it and everything
 * parented to it — jaw, hair, the lot — comes too.
 *
 * Safe to set statically because `stripScaleTracks` clears every scale track
 * from every clip on load. Abee's clips animate head scale in 48 places;
 * without that strip this would be gone on the first frame.
 */
function scaleHead(root: THREE.Object3D, scale: number): void {
  if (scale === 1) {
    return;
  }
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone && o.name === "Head") {
      o.scale.setScalar(scale);
    }
  });
}

/**
 * THE TWO HOURS A CLOCK TIME STAGES AS.
 *
 * Village Road is lit by the hour the child is actually playing at, folded
 * onto a twelve-hour face: at ten in the morning the day is a ten o'clock
 * morning and the night is ten at night; at eight in the evening the day is
 * eight in the morning and the night is eight at night.
 *
 * THE FOLD HAS TO PICK THE RIGHT ONE OF THE TWO. A clock position `h` has two
 * candidate hours, `h` and `h + 12`, and only one of them is daylight. Taking
 * the AM reading for day and the PM reading for night works for six through
 * twelve and breaks badly for one through five — two in the AFTERNOON, which
 * is one of the commonest times a child plays, would have been staged as two
 * in the morning. So each mode takes whichever candidate falls in its own
 * half of the day:
 *
 *   10am -> day 10am, night 10pm      2pm -> day 2pm,  night 2am
 *    8pm -> day  8am, night  8pm      3am -> day 3pm,  night 3am
 *
 * Which is a rule you can say in one line — day mode shows the daylight hour
 * nearest your clock, night mode shows the night hour nearest it — and which
 * never stages a sky that could not exist.
 *
 * Fractional, so half past reads between the two hours rather than snapping.
 */
/**
 * WHERE THE SUN ACTUALLY IS OVER KERALA.
 *
 * The road is a real place at about ten and a half degrees north, and the sun
 * behaves in a way a generic arc does not reproduce. Two things matter and
 * both of them show:
 *
 *   - The tropics barely have seasons in the CLOCK. Sunrise sits between
 *     about 6:10 and 6:30 all year and sunset between 6:15 and 6:50, against
 *     the four-hour swing a temperate latitude gets. A child in Kerala walks
 *     out at half past six into the same light in January as in July.
 *   - But the noon sun swings a very long way in HEIGHT — from about 56
 *     degrees at the December solstice to directly overhead twice a year, in
 *     April and again in August, when a stone at noon has no shadow at all.
 *
 * And the detail that gives it away if you get it wrong: north of the equator
 * but south of the tropic, the midday sun is in the SOUTH for half the year
 * and in the NORTH for the other half. Shadows at noon fall one way in
 * December and the other in June. No hand-placed vector does that.
 *
 * Standard astronomy, to the accuracy this needs (a fraction of a degree):
 * declination from the day of the year, hour angle from solar time, then the
 * spherical triangle. `hour` is read as local solar time — the child's own
 * clock, staged over Kerala, which is the whole conceit.
 */
const KERALA_LAT = (10.5 * Math.PI) / 180;
const D2R = Math.PI / 180;

/** The sun's tilt for a date, +23.44 deg at midsummer and -23.44 at midwinter. */
function declination(now: Date): number {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const day = (now.getTime() - start) / 86400000;
  // The usual Cooper approximation. Good to about half a degree, which is a
  // long way inside what a light in a game can show.
  return 23.44 * D2R * Math.sin(((360 / 365.24) * (day - 81) * Math.PI) / 180);
}

/**
 * The sun's height and bearing at an hour, over Kerala.
 *
 * Elevation in radians above the horizon (negative below it), and azimuth in
 * radians clockwise from north — so a quarter turn is due east, a half turn
 * due south.
 */
function solarAngles(
  hour: number,
  now: Date,
): { readonly elev: number; readonly az: number } {
  const dec = declination(now);
  const H = (hour - 12) * 15 * D2R; // hour angle: zero at solar noon
  const sinElev =
    Math.sin(KERALA_LAT) * Math.sin(dec) +
    Math.cos(KERALA_LAT) * Math.cos(dec) * Math.cos(H);
  const elev = Math.asin(Math.min(1, Math.max(-1, sinElev)));
  // atan2 form rather than the acos one: acos loses the sign and puts the
  // afternoon sun back in the east.
  const az = Math.atan2(
    -Math.sin(H) * Math.cos(dec),
    Math.sin(dec) * Math.cos(KERALA_LAT) -
      Math.cos(dec) * Math.sin(KERALA_LAT) * Math.cos(H),
  );
  return { elev, az };
}

/**
 * When the sun is up over Kerala on a date, in local solar hours.
 *
 * Used by the fold below, so "is this hour daylight" is answered by the sky
 * rather than by a hardcoded six and eighteen.
 */
export function daylightWindow(now: Date = new Date()): {
  readonly rise: number;
  readonly set: number;
} {
  const dec = declination(now);
  const cosH = -Math.tan(KERALA_LAT) * Math.tan(dec);
  // At this latitude the sun rises and sets every day of the year, so the
  // polar cases cannot happen — clamped anyway rather than returning NaN.
  const H = Math.acos(Math.min(1, Math.max(-1, cosH))) / D2R / 15;
  return { rise: 12 - H, set: 12 + H };
}

export function stagedHours(now: Date = new Date()): {
  readonly day: number;
  readonly night: number;
} {
  const h = (((now.getHours() + now.getMinutes() / 60) % 12) + 12) % 12;
  // "Daylight" is asked of the SKY, not of a hardcoded six and eighteen: over
  // Kerala the sun is up from about ten past six to about half past, and the
  // window shifts by a few minutes across the year. Close to 6-18, and the
  // few minutes are exactly the ones a fold gets wrong.
  const { rise, set } = daylightWindow(now);
  const isDay = (t: number) => t >= rise && t <= set;
  return isDay(h) ? { day: h, night: h + 12 } : { day: h + 12, night: h };
}

/**
 * WHERE THE SUN IS AT A GIVEN HOUR, as an offset from what it looks at.
 *
 * Elevation is taken through the SINE, not applied to the angle: the sun's
 * height goes as `sin(elevation) = sin(peak) * sin(hour angle)`, and ramping
 * the angle itself instead puts eight in the morning at forty-six degrees
 * when it belongs at about thirty. The difference is the whole character of a
 * morning — one of them lays long shadows down the road and the other does
 * not.
 *
 * FLOORED AT `LOW`, and that is a hard constraint rather than a taste. Shadow
 * length is height over the tangent of the elevation, and the shadow camera
 * reaches 45 units behind the child: a ten-unit palm at twelve degrees throws
 * forty-seven and is cut off mid-shadow. At eighteen it throws thirty-one and
 * fits. Dawn and dusk are long, not infinite — which is also the only way the
 * road stays readable at either end.
 *
 * `lat` keeps the sun off the road's own line all day, so shadows fall ACROSS
 * the track rather than straight along it; at noon it is the only thing left
 * deciding which way they point.
 */
/**
 * WHERE TO STAND THE LIGHT FOR AN HOUR, in the scene's own axes.
 *
 * Taken straight from `solarAngles` rather than from a shaped curve, so the
 * height, the bearing and the length of every shadow are Kerala's at that
 * hour on today's date — including the one nothing hand-placed would do: the
 * noon sun crossing from the southern side of the sky to the northern one in
 * April and back in August, which swings every midday shadow across the road.
 *
 * THE SCENE'S AXES: the road runs along +x and the camera looks from +z, so
 * +x is taken as east and +z as south. A bearing therefore lands as
 * (sin az, ., -cos az) — due east at sunrise is straight down the road ahead
 * of a child walking it, which is exactly where the sun is at half past six.
 *
 * AT NIGHT it is the moon, and the moon is roughly opposite the sun: the same
 * geometry with the bearing turned half round and the height taken off the
 * night hour. Near enough for a light in a game, and it is what puts night
 * shadows somewhere the day never puts them.
 *
 * `LOW` is not a taste. Shadow length is height over the tangent of the
 * elevation, so as the sun touches the horizon it goes to infinity and the
 * whole ground becomes one shadow; half past six is 7 degrees and untouched,
 * and only the last few minutes either side are held off the floor. The
 * shadow box is grown to match — see `fitShadowCamera`.
 */
function sunAtHour(
  hour: number,
  night: boolean,
  now: Date = new Date(),
): THREE.Vector3 {
  const LOW = 6.5 * D2R;
  const Y = 30;
  // THE MOON IS NOT WHERE THE SUN IS TWELVE HOURS ON.
  //
  // That was the model, and combined with the fold it cancelled exactly: the
  // fold stages night as day + 12, so asking for the sun twelve hours past
  // THAT asks for the sun at the day hour, and the moon came out standing in
  // precisely the same place as the sun with the same shadows. The whole
  // point of a night is that it is lit from somewhere else.
  //
  // It lags the sun by its AGE — fifty minutes a day, a full cycle over a
  // month — so `age * 24` hours back is where it is. At full that is twelve
  // hours and the old model was right by accident; at every other phase it is
  // somewhere else entirely, which is what a crescent low in the west after
  // sunset actually looks like.
  const back = night ? moonAge(now) * 24 : 0;
  const { elev, az } = solarAngles(hour - back, now);
  const up = Math.max(LOW, elev);
  // How far out it has to stand to be that high.
  const run = Y / Math.tan(up);
  // NO FLIP. The half-turn that used to be here was reasoning about the moon
  // being "opposite the sun", which is true of where it sits in the sky
  // relative to the sun and NOT of the path it walks: taking the sun's
  // position twelve hours away already puts it opposite, and turning the
  // bearing as well turned it back. The result was a moon that rose in the
  // WEST at dusk and set in the east at dawn, so night shadows swept the
  // wrong way across the whole night.
  //
  // Unflipped, `solarAngles(hour + 12)` is exactly the path of a full moon:
  // up in the east as the sun goes down, due south and highest at midnight,
  // down in the west at dawn. A full moon is also the right one to model —
  // it is the one that is actually up all night.
  const bearing = az;
  return new THREE.Vector3(
    Math.sin(bearing) * run,
    Y,
    -Math.cos(bearing) * run,
  );
}

/**
 * TONIGHT'S MOON, FROM THE ACTUAL CALENDAR.
 *
 * Returns the lit fraction of the disc: 0 at new moon, 1 at full.
 *
 * Not an approximation standing in for a lookup table — the phase genuinely
 * is closed form. It runs on a 29.530588853 day synodic month, and counting
 * from a known new moon is good to a few hours for centuries either side,
 * which is far more precision than a light on a cartoon road can spend. No
 * data, no network, no dependency. The epoch is the new moon of 6 January
 * 2000, 18:14 UTC.
 *
 * Nothing draws a moon. What this is for is the DARKNESS: a road under a new
 * moon is close to black and the lamps are the only thing on it, and a week
 * later the same road is silver and you can see the paddy. That swing is the
 * thing a child recognises — it matches the sky they can walk outside and
 * look at, on the night they are playing — and it costs one cosine.
 */
const LUNAR_EPOCH = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
const SYNODIC_DAYS = 29.530588853;
/**
 * HOW FAR THROUGH ITS CYCLE THE MOON IS, 0 at new and 0.5 at full.
 *
 * Which is also how far BEHIND THE SUN it runs: the moon loses about fifty
 * minutes a day against it, a whole twenty-four hours over a cycle. So the
 * moon at a given hour stands where the sun stood `age * 24` hours earlier —
 * at full, twelve hours earlier, which is why a full moon rises as the sun
 * sets and is due south at midnight.
 */
export function moonAge(now: Date = new Date()): number {
  const days = now.getTime() / 86400000 - LUNAR_EPOCH;
  return (((days / SYNODIC_DAYS) % 1) + 1) % 1;
}

export function moonLit(now: Date = new Date()): number {
  const days = now.getTime() / 86400000 - LUNAR_EPOCH;
  // Age through the cycle, 0..1. `%` keeps the sign for dates before the
  // epoch, so it is folded back round.
  const age = (((days / SYNODIC_DAYS) % 1) + 1) % 1;
  // Illuminated fraction, and NOT the age itself: the disc fills as a
  // cosine, so the nights either side of full are nearly as bright as full
  // and the ones either side of new nearly as dark as new. A linear ramp
  // gets both ends wrong, which is exactly where the difference is worth
  // having.
  return (1 - Math.cos(age * Math.PI * 2)) / 2;
}

function castHeight(name: string): number {
  switch (name) {
    // Dave, the eldest-looking. A TINY bit taller than Peeli and no more:
    // they are both nine, and at 4.8 against her 4.55 he read as the big
    // brother rather than the twin. 0.15 is the difference you notice
    // standing them next to each other and not otherwise.
    case "Explorer":
      return 4.7;
    // Nine like Dave, and drawn a little shorter than him.
    case "Peeli":
      return 4.55;
    // The same character at six: rounder and shorter.
    case "Explorer6":
      return 3.95;
    // A bit above waist-high on Dave. Sized against the TALLEST sibling on
    // purpose: it is a companion to all three, and a robot that reads as
    // small beside Dave still reads as small beside Little Drew at 3.95,
    // whereas one sized against the youngest would come up to Dave's chest
    // and stop being a gadget. 2.6 was waist exactly and looked lost.
    case "Robot":
      return 3.0;
    // Half the robot, so it reads as a puppy at their heel rather than a dog
    // walking with them.
    // Knee-high on Dave rather than half the robot, which is where this
    // started. 1.5 was chosen to read as "a puppy at their heel" and read as
    // something further off instead — at this camera a small animal beside a
    // 4.7 child loses its detail, and the tail it spends most of its time
    // wagging is the smallest part of it.
    case "Puppy":
      return 1.9;
    // Drawn in the pack's own proportions — 4.07 heads tall against Peeli's
    // 4.12, 0.556 wide for his height against her 0.559.
    //
    // LEVEL WITH PEELI, and a clear head under Dave. He was a year younger
    // and set a year shorter, which is defensible on paper and wrong in the
    // frame: he is the one who walks beside the child the whole way, and
    // stood next to them at 4.35 he read as a little brother tagging along
    // rather than the boy showing them the road. Eye to eye with Peeli he
    // reads as what he is.
    //
    // The model he replaced was drawn realistically — 5.98 heads, narrower —
    // and read as a small fifteen-year-old at a child's height. It took three
    // separate corrections to hide that: 6.3 tall, 1.14 girth and a 1.22
    // head. None of them are needed any more, and carrying them over would
    // have put a giant in the opening frame.
    // SHORTER THAN PEELI, because he is younger than her.
    //
    // He was 4.55, exactly her height, so the pair read as the same age and
    // the only thing telling them apart was the clothes. He is eight and she
    // is nine, and at this age a year is visible: 4.28 is about six per cent
    // down, which is roughly the real gap and enough to see without making
    // him look like a small child beside her.
    case "Abee":
      return 4.28;
    // Village Road only. A water buffalo stands taller than the children
    // walking past it — that is the whole point of the charge.
    case "Buffalo":
      return 6.0;
    // The hero world's costume box: Knight, Skeleton and the rest.
    default:
      return 3.4;
  }
}

// Village Road — a Kerala village, and a road that runs past it.
//
// The third world is the same engine again, but its scenery is a different
// class of asset from the other two: photoreal bakes rather than stylised
// low-poly sets, and single props rather than collections of variants. So the
// buildings are placed as LANDMARKS by hand (see the village cluster in the
// builder) and only the small stuff is scattered.
//
// The signature is laterite: Kerala's soil is rust-red and its vegetation is
// vivid green, and that pairing is what makes this world unmistakable beside
// Dino Run's earth tones and Hero Trail's forest. Every land below keeps it.
export const VILLAGE_LANDS: readonly Land[] = [
  {
    name: "Paddy Fields",
    mood: "day",
    // Held on the known-good grass until a genuinely GREEN paddy texture
    // exists: the first one generated was red earth under a green name, and a
    // whole biome of rice came out the colour of a brick.
    tex: "leafy_grass",
    // Monsoon paddy: the most saturated green in the whole game, against the
    // red of the bunds between the fields.
    grass: 0x54a840,
    grassVar: 0x6cbd52,
    dirt: 0xa8542c,
    // NEUTRAL DAYLIGHT, on purpose. These are the land's own colours at the
    // top of the sky and nothing else — the hour does the warming now, and a
    // base that was already gold made every hour gold, including noon. See
    // `warm` in applySky.
    sun: 0xfff4d8,
    fog: 0xd6f0c6,
    path: "mud",
    trees: "PalmTrees",
    friend: "Buffalo",
    // Red road, and the dark leaf-littered mud of the bunds. The FIELD map
    // is a detail layer only — its colour comes from this land's own grass
    // (see fieldHue), so what matters about it is its grain, not its hue.
    mix: {
      field: "forest_floor",
      road: "laterite_mud",
      litter: "brown_mud_leaves_01",
      dry: "leafy_grass",
    },
  },
  {
    name: "Coconut Grove",
    mood: "day",
    tex: "coconut_grove",
    // Coastal: sandier ground, warmer light, the green a shade drier.
    grass: 0x74ab4e,
    grassVar: 0x8bbf60,
    dirt: 0xc99a63,
    // NEUTRAL DAYLIGHT, on purpose. These are the land's own colours at the
    // top of the sky and nothing else — the hour does the warming now, and a
    // base that was already gold made every hour gold, including noon. See
    // `warm` in applySky.
    sun: 0xffeec2,
    fog: 0xeae4c4,
    path: "mud",
    trees: "PalmTrees",
    friend: "Buffalo",
    // The coast: genuinely sandy between the palms.
    mix: {
      field: "leafy_grass",
      road: "laterite_mud",
      litter: "brown_mud_leaves_01",
      dry: "coconut_grove",
    },
  },
  {
    name: "Backwater Bend",
    mood: "overcast",
    // Held on the known-good grass until a genuinely GREEN paddy texture
    // exists: the first one generated was red earth under a green name, and a
    // whole biome of rice came out the colour of a brick.
    tex: "leafy_grass",
    // Water-dark earth and a soft grey light - the canals and the mist that
    // sits over them in the early morning.
    grass: 0x4fa845,
    grassVar: 0x69bb58,
    dirt: 0x7d5a3e,
    // NEUTRAL DAYLIGHT, on purpose. These are the land's own colours at the
    // top of the sky and nothing else — the hour does the warming now, and a
    // base that was already gold made every hour gold, including noon. See
    // `warm` in applySky.
    sun: 0xe8eee4,
    fog: 0xc6d8c8,
    path: "mud",
    trees: "MegaBroadleaf",
    friend: "Buffalo",
    // Canal-side: wet ground, dark litter, nothing dry anywhere.
    mix: {
      field: "leafy_grass",
      road: "laterite_mud",
      litter: "forest_floor",
      dry: "brown_mud_leaves_01",
    },
  },
  {
    name: "Hill Garden",
    mood: "overcast",
    // NOT the laterite. `tex` is the whole ground plane, not the road - the
    // road is painted onto it by vertex colour - so naming the red earth here
    // turned every field, verge and hillside in the biome to bare mud. The
    // laterite texture belongs to the ROAD, and the road already has it.
    tex: "leafy_grass",
    // The Western Ghats foothills: the deepest green, the reddest earth, and
    // the coolest light in the set.
    grass: 0x3f9a3c,
    grassVar: 0x57ad4c,
    dirt: 0x9c4a24,
    sun: 0xe4ecdc,
    fog: 0xbcd2bd,
    path: "mud",
    trees: "MegaBroadleaf",
    friend: "Buffalo",
    // Up in the Ghats the forest floor is exactly that.
    mix: {
      field: "leafy_grass",
      road: "laterite_mud",
      litter: "forest_floor",
      dry: "coconut_grove",
    },
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
  /**
   * Which side of the road the hero and companion walk on.
   *
   * 0 is the middle, which is where the other two worlds put them because
   * their trails carry nobody else. Village Road is a road: it has traffic,
   * and traffic keeps to one side. Positive is the near side — towards the
   * camera — so the pair walk the near verge and the whole far half is left
   * clear for villagers coming the other way.
   */
  readonly laneZ?: number;
  /**
   * How far towards the camera the letter ribbon sits, in world units.
   *
   * Larger is nearer the camera, which on screen is LOWER. 10 is where the
   * other two worlds put it; Village Road pushes it much further forward so
   * the letters clear the road rather than lying across it — this one has a
   * village, carts and a buffalo to read past.
   *
   * IT TAKES A LOT OF Z TO MOVE A LITTLE SCREEN, and that is worth knowing
   * before reaching for this dial. Once the camera was flattened to bring
   * the horizon into shot, its up-vector has a z component of only -0.15
   * against a y of 0.99 — so a unit of depth moves the ribbon a sixth as far
   * down the screen as a unit of height would. Measured on this camera, 12.5
   * to 26 shifts it from 42% up the frame to 35%. Lowering it in Y instead
   * would be six times as effective and would bury it in the road, which is
   * why this is the dial even though it is the blunt one.
   */
  readonly wordZ?: number;
  /**
   * How high the word row floats, in world units. Default 0 — on the ground.
   *
   * `wordZ` moves the row towards or away from the camera, which barely
   * changes its height on screen: at a 4-degree pitch a unit of depth is
   * worth 0.07 of a unit of screen height, while a unit of LIFT is worth a
   * full one. When the camera came down to a walker's eye the row went out
   * of the bottom of the frame, and no amount of `wordZ` was going to bring
   * it back — this is the lever that does.
   */
  readonly wordY?: number;
  /** How far to the side the companion walks. Defaults to FOLLOW_SIDE. */
  readonly followSide?: number;
  /** Companions dotted along the trail. "$friend" resolves to land.friend. */
  readonly herd: readonly {
    readonly model: string;
    readonly x: number;
    readonly z: number;
    readonly h: number;
    /** Face this way instead of a random one, in radians. */
    readonly faceY?: number;
    /**
     * Widened across and through, without getting taller.
     *
     * `fitToHeight` scales uniformly, which is right for a character drawn in
     * the same style as the rest and wrong for one drawn realistically: made
     * tall enough to read as older, a realistically-drawn character stays as
     * narrow as it was and looks stretched. This thickens it back up.
     *
     * Nothing uses it at present — the model it was written for has been
     * replaced by one drawn in the pack's own proportions. Kept because the
     * next bespoke character will have the same problem.
     */
    readonly girth?: number;
    /**
     * The head, scaled on its own bone.
     *
     * A per-spawn override for `castHeadScale`. Prefer the table: a value
     * here and a value there is exactly the split that gave characters two
     * different heads depending on whether they were the player or a
     * companion. Reach for it only when one spawn genuinely differs.
     *
     * Worth having at all because the eye reads age from head-to-body ratio
     * far more than from height — a character drawn at adult proportions
     * cannot be made to read as a child by scaling it down.
     */
    readonly headScale?: number;
    /**
     * A WILD animal rather than a companion.
     *
     * The herd list otherwise spawns bystanders: one idle clip, played
     * forever, standing where they were put. That is right for a villager
     * and wrong for a buffalo, which has fifteen usable clips and a temper.
     * Marked wild, it gets `spawnWild` instead — its own state machine,
     * its own repertoire, and the charge. See WILD BEHAVIOUR.
     */
    readonly wild?: boolean;
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
  /**
   * Thickets, as opposed to the even sprinkle `ground` gives.
   *
   * One entry per plant, each planted in tight clumps at the milestone
   * spacing rather than spread over the whole trail. For the low, damp-loving
   * things that genuinely grow that way.
   */
  readonly groundClusters?: readonly {
    readonly file: string;
    /** Clump size, drawn per verge per point. */
    readonly min: number;
    readonly max: number;
    /** How far the clump spreads along the road. */
    readonly spread: number;
    /** Nearest and furthest from the road's centre line, both positive. */
    readonly near: number;
    readonly far: number;
    /**
     * Which verge. "near" is the bottom of the frame, "far" is behind the
     * road, "both" is either.
     *
     * Explicit, because inferring it from the SIGN of near/far was a trap I
     * walked straight into: negative distances put the plot on the far side
     * as intended and then the both-verges rule mirrored it onto the near
     * one, so half the banana plantation ended up across the bottom of the
     * screen -- the exact thing it was set back to avoid.
     */
    readonly verge?: "near" | "far" | "both";
    /**
     * Spacing along the road. Left out, the clumps land at the milestone
     * spacing; set small, they run together into a continuous band.
     */
    readonly stride?: number;
    /**
     * How often a point gets this plant at all, 0-1. Left out, every one
     * does. For the things that should turn up at SOME milestones and not
     * others -- one flowering shrub on the third stone is a detail somebody
     * planted; one on every stone is a pattern.
     */
    readonly chance?: number;
    /**
     * Measure `near`/`far` from the ROAD rather than from world zero.
     *
     * The road meanders, so an absolute z is not a distance from it -- and
     * `onRoad` rejects anything within `roadClear` of `meander(x)`, which is
     * why plantings written in absolute z were being thrown away unevenly
     * along the trail. Anything meant to sit "beside the road" wants this;
     * the foreground band does not, because it is positioned against the
     * CAMERA FRAME, which does not wander.
     */
    readonly roadRelative?: boolean;
    /**
     * Size range, as a multiple of the scenery scale. Defaults to the same
     * 0.7-1.4 every cluster used to share -- which is why the taro along the
     * bottom of the frame read as missing: at that range it stands 12 to 23
     * pixels tall, barely over the grass beside it, and a plant nobody can
     * pick out is a plant that is not there.
     */
    readonly lo?: number;
    readonly hi?: number;
    /**
     * Plant it as a SMALLHOLDING instead of a clump: a few rows running with
     * the road, roughly evenly spaced, roughly straight. `lines` rows of
     * `perLine`, `rowGap` apart across, `wobble` being how far each plant may
     * wander off its mark -- small, because a planted row that wanders too
     * far stops being a planted row.
     */
    readonly plot?: {
      readonly lines: number;
      readonly perLine: number;
      readonly rowGap: number;
      readonly wobble: number;
      /** How often a point gets a plot at all, 0-1. */
      readonly chance: number;
    };
  }[];
  /**
   * How much the ground rolls, 1 being the original hills and 0 dead flat.
   * See RELIEF.
   */
  readonly relief?: number;
  /**
   * Texture laid along the road itself, separate from the ground.
   *
   * The road is the one surface a child looks at for the whole game, and the
   * one the vertex-colour pass can only ever say "brownish" about. A ribbon of
   * its own carries real grain, ruts and damp without imposing a photographic
   * texture on every field in the world.
   */
  readonly roadTexture?: string;
  /**
   * Three ground surfaces, blended across the terrain instead of one repeated
   * everywhere.
   *
   * Real ground is a mix. A single photographic texture stretched over every
   * field, verge and cart track is the thing that most gives a world away -
   * it tiles visibly, and it says the same thing about a paddy field as about
   * the road beside it. These three are weighted per vertex by what is
   * actually at that spot (see the `aMix` attribute) and blended in the
   * shader, so the road is grit, the fields are green, and the dry patches
   * near the palms are sand, with no seams between them.
   */
  readonly groundMix?: {
    readonly field: string;
    readonly road: string;
    readonly litter: string;
    readonly dry: string;
    /**
     * Where the FIELD surface gets its colour.
     *
     * "land" (the default): the map is reduced to luminance and supplies only
     * grain and wear, while the hue comes from this land's own grass. Every
     * land can then have its own green without a texture painted for it, and
     * any detail map will do.
     *
     * "texture": the map keeps its own colour. Use this once there is a field
     * texture actually worth looking at — a real paddy, painted for this
     * world — rather than a stand-in borrowed from the scatter set.
     */
    readonly fieldHue?: "land" | "texture";
  };
  /**
   * Recolour scattered foliage to suit the land.
   *
   * The nature set is a temperate one: several of its broadleaf variants carry
   * autumn reds, which are correct for a dino valley and wrong for Kerala,
   * where nothing turns. Retexturing the source models would mean forking the
   * pack; recolouring their materials as they are cloned costs nothing and
   * leaves the models shared.
   */
  readonly foliageTint?: {
    /** Tropical canopy green. */
    readonly leaf: number;
    /** Trunk, a shade greyer and cooler than the temperate brown. */
    readonly trunk: number;
    /** How far to pull each material toward those, 0-1. */
    readonly strength: number;
  };
  /** Distant mountain range on the horizon, or none. */
  readonly mountains?: {
    readonly colorNear: number;
    readonly colorFar: number;
  };
  /**
   * A PAINTED horizon at the far end of the world, instead of the procedural
   * ranges — the treeline and hills a Kerala road actually ends in.
   *
   * Named without the day/night half or the variant letter: the files are
   * `<name>_day_<v>.png` and `<name>_night_<v>.png`, and one letter is drawn
   * per session so the land is not identical every time it is opened.
   */
  readonly horizon?: {
    readonly name: string;
    readonly variants: readonly string[];
    /** How tall the band stands, in world units. Its width follows the image. */
    readonly height: number;
    /** How far back it sits. Beyond every ridge and every tree. */
    readonly dist: number;
    /**
     * Where the painted skyline sits inside the image, 0 at the bottom edge
     * and 1 at the top — measured off the art, so the solve can put THAT line
     * on the horizon rather than the edge of the file.
     */
    readonly skyline: number;
    /**
     * WHERE THE RIDGE ACTUALLY IS IN EACH FILE, as a fraction up from its
     * bottom edge, measured off the alpha channel rather than assumed.
     *
     * The four cuts are not drawn to a common baseline — `night_A` puts its
     * hills a twentieth of the image lower than `day_A` does, and `night_B`
     * puts them higher. One `skyline` constant for all of them therefore had
     * the night jumping up or down against the day as the crossing ran,
     * depending on which cut a given strip happened to be showing.
     *
     * Keyed `<half>_<variant>`. Anything missing falls back to `skyline`.
     */
    readonly ridge?: Readonly<Record<string, number>>;
  };
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
  /**
   * What the dark toggle means in this world.
   *
   * "night" is a real nightfall: deep sky, mist, moon, the Lost Travellers.
   * "dusk" is only a gentler light — Dino Run is not a night game, and
   * dressing it in the hero world's darkness read as a broken renderer
   * rather than an evening.
   */
  readonly nightMode?: "night" | "dusk";
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
  /**
   * WHERE THIS WORLD'S SUN STANDS, as an offset from what it looks at.
   *
   * Per world, because the hour of the day is part of what a world IS and the
   * three do not share one. Dino Run and the Hero Trail are staged at midday:
   * the sun nearly overhead, shadows tucked under what casts them, everything
   * plainly lit. Village Road is eight in the morning.
   *
   * Only the RATIO matters — the sun rides with the camera and its target is
   * the camera, so its world position is meaningless and this vector alone
   * decides which way shadows fall and how long they are. The painted
   * shadows under the letter cards are displaced by the same vector, so
   * every shadow in the scene, cast and painted alike, is thrown by one sun.
   *
   * Omitted, a world gets the midday rig.
   */
  readonly sunAt?: readonly [x: number, y: number, z: number];
  /**
   * Light this world by the CLOCK rather than by a fixed staging.
   *
   * Village Road only. The other two are deliberately staged at midday and
   * are meant to look the same whenever a child opens them; this one is built
   * around a real place at a real hour, and the hour it shows is the hour
   * they are playing at. See `stagedHours`.
   */
  readonly clockLit?: boolean;
  /**
   * How far this world's night is lifted towards its dusk, 0..1.
   *
   * Hero Trail wants a real night: you are out after dark with a lantern and
   * the dark is the point. Village Road does not — it is an evening in a
   * place where people live, the lamps are lit, and a child has to be able
   * to SEE the village they have walked to. 0 is the full night, 1 is the
   * dusk, and the same expressions produce both, so a twilight is a real
   * blend of the two rather than a third set of numbers to keep in step.
   */
  readonly nightTwilight?: number;
  /**
   * THE SKY HALF OF THE FILL LIGHT, BY DAY.
   *
   * Defaults to white, which is what makes a midday scene look flat: white
   * from above and the grass colour from below means shadow and light are
   * the same colour at different brightnesses, and the eye reads that as an
   * object with the lights turned down rather than as sunlight.
   *
   * What actually separates them outdoors is COLOUR, not level. The sun is
   * warm and the sky is blue, so a shadow is not a darker version of the lit
   * side — it is the blue half, lit by the sky alone. Setting this to a soft
   * daylight blue is the whole of that, and it costs nothing: the light is
   * already in the scene.
   */
  readonly skyFill?: number;
  /**
   * The ground half — what the earth throws back UP into faces and undersides.
   *
   * Defaults to the grass colour. On a road cut through red laterite that is
   * simply wrong: the ground under the child is not green, it is warm red,
   * and the bounce off it is the warmest light in the frame. Free, again —
   * this half of the hemisphere light is already being paid for.
   */
  readonly bounce?: number;
  /**
   * How soft the sun's shadows are, in shadow-map texels.
   *
   * Midday shadows are hard in life, and hard shadows on stylised characters
   * read as stickers cut out and laid on the ground. A few texels of blur is
   * the single cheapest thing that makes a bright scene feel like air rather
   * than like vector art.
   */
  readonly shadowSoft?: number;
  /**
   * HOW MUCH THE LIGHT MOVES AS CLOUD PASSES OVER, 0 for not at all.
   *
   * There are no clouds in this sky and there do not need to be. What a
   * tropical afternoon actually does is dim and lift over twenty or thirty
   * seconds as something crosses the sun — the greens go flat and come back,
   * the shadows soften and sharpen — and it is one of the few things that
   * makes a bright static scene feel like weather rather than like a
   * rendering.
   *
   * Two rates that do not divide into one another, so it never finds a beat.
   * A single sine is a pulse, and a pulse is a machine.
   *
   * Amplitude is a FRACTION of the sun's own intensity. Small: at anything
   * above about 0.2 it stops reading as cloud and starts reading as somebody
   * turning the lights up and down.
   */
  readonly cloudDrift?: number;
  /**
   * How much of the night's ground mist this world gets, 0..1.
   *
   * The mist belongs to Hero Trail, where a fog bank between the trees is
   * most of what makes the dark feel occupied. Village Road is a warm
   * evening in a place where people live and its light comes from oil lamps
   * — haze does two unhelpful things to that: it greys the lamplight it
   * drifts through, and it flattens the fields the low camera was lowered to
   * show. Turned most of the way down here rather than off, because a little
   * damp air over a paddy at night is true.
   */
  readonly mistScale?: number;
  /**
   * Whether the WOODS change after dark, or only the light on them.
   *
   * Hero Trail's night is a different place: a share of the leafy trees go
   * home and bare skeleton trunks stand where they were, which is most of
   * what makes that dark feel haunted. Village Road's night is an evening in
   * a working village — the same palms, the same banyan, lit by oil lamps
   * instead of the sun. Trees that strip themselves at dusk and grow their
   * leaves back at dawn belong to the other world entirely.
   */
  readonly nightTrees?: "change" | "keep";
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
    /**
     * HOW FAR TO THE SIDE THE CAMERA STANDS, which is what sets the yaw.
     *
     * `cam.lookAt` runs once at build and the tick only ever translates the
     * camera along x afterwards, so the rotation is decided here and then
     * never changes: yaw is `atan2(camX, camZ)`.
     *
     * It used to be a bare 10 shared by every world while `camZ` was already
     * per-theme, which quietly gave the three roads three different angles —
     * 13.4 degrees here against 16.9 on the Hero Trail and 18.4 on Dino Run.
     * Naming it per view means changing one road's angle does not silently
     * re-frame the other two.
     */
    readonly camX?: number;
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
  /**
   * The village that recurs along Village Road.
   *
   * Named props rather than a scatter collection, because these are landmarks:
   * a temple, a market, a banyan and the cart parked at it are the same few
   * models placed deliberately, not variants sprinkled about. The other worlds
   * have nothing like this - their scenery is all scatter - so it lives here
   * rather than in `ground`.
   */
  readonly village?: {
    /** Folder under models/ holding the props (the pack folder). */
    readonly dir: string;
    /** How many FLAGS apart villages fall, inclusive range. One flag is one
     * round, and a round carries the runner RUN_LEN units, so this is a
     * distance in rounds rather than in metres. */
    readonly everyFlags: readonly [number, number];
    /** The cluster at the heart of every village, offset from its centre.
     * `h` fits the prop to that height, the way playerHeight fits a character:
     * these models are authored at wildly different scales and none of them
     * means anything until it is sized against the child walking past. */
    readonly heart: readonly {
      readonly model: string;
      readonly dx: number;
      readonly dz: number;
      readonly h: number;
      readonly turn?: number;
    }[];
    /** Dwellings placed around the heart, picked at random per village. */
    readonly houses: readonly string[];
    readonly houseHeight: number;
    /** Wall segments enclosing the yards. */
    readonly wall: string;
    readonly wallHeight: number;
    /** A lone prop, very rarely, out between the villages. */
    readonly strays: readonly { readonly model: string; readonly h: number }[];
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
  // The shared offset every world used before it was named. See `camX`.
  camX: 10,
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
  // 3.4 suits the armoured heroes, who are drawn as adults. The Explorer is a
  // ten-year-old: fitted to the same total height he reads as small, because a
  // child's proportions spend more of that height on head and less on body.
  //
  // 4 is not a guess — it is 3.4 x 1.1765, the constant his Idle clip used to
  // pin on the Hips bone. That scale track inflated him only while standing
  // still (see stripScaleTracks), so idle was the one pose anybody judged
  // his size by. Applying it as a real fitted height gives him that size in
  // every pose instead of one.
  // Height is a property of the character, never of the role.
  //
  // Whoever is asking — the player, a companion, a preview — gets the same
  // answer for the same name, and no caller may scale it. The gap between
  // these two numbers IS the age difference, and it is the only thing telling
  // a child which of them is the older one.
  //
  // Explorer6 is a six-year-old beside a ten-year-old, so he is shorter —
  // but not by the real-world ratio. A cartoon child of six is drawn with a
  // proportionally larger head, so scaling him by height alone would read as
  // "the same boy, further away" rather than "a younger boy". 4.0 against
  // 4.8 keeps him visibly smaller while leaving his head where the eye
  // expects a small child's to be.
  // Peeli is nine like Dave and drawn a little shorter than him — the
  // sibling difference a child reads at a glance without either of them
  // looking like the other seen from further away.
  playerHeight: castHeight,
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
  nightMode: "night",
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

// Village Road — the third world. Same engine, Kerala village.
//
// The cast is the AK pack only: no knights or mages, because a paddy field is
// not a quest. Dave, Little Drew and Peeli lead; Robot and Puppy walk with
// them; the buffalo stands about in the fields as a wild thing rather than a
// companion, which is what it is in the pack's own manifest.
export const VILLAGE_THEME: WorldTheme = {
  /**
   * EIGHT IN THE MORNING, not noon.
   *
   * The other two worlds are staged overhead — see `sunAt` — which is the
   * right light for a dinosaur valley you are meant to read at a glance, and
   * the wrong one entirely for this road. A Kerala morning is the hour the
   * whole place is FOR: the light comes in low along the road rather than
   * down onto it, every palm and every stone lays a long shadow across the
   * laterite instead of sitting on a disc of its own, and the haze has not
   * burned off yet.
   *
   * 13 of height against 24 of run is about 28 degrees off the horizon, which
   * is where the sun is at eight. Low enough for the shadows to stretch and
   * still high enough that they stay inside the shadow camera, which reaches
   * 45 units behind the child.
   *
   * The x is negative, so the sun is BEHIND them as they walk east up the
   * road and their own shadow goes out ahead of them — which is the thing
   * anybody who has walked a road at that hour remembers about it.
   */
  sunAt: [-24, 13, 9],
  /**
   * AND THE HOUR IS THE CHILD'S OWN. See `clockLit` and `stagedHours`.
   *
   * `sunAt` above is the fallback for a build that has not staged yet — an
   * eight o'clock morning, which is what this road was tuned to look like
   * and a sane thing to be caught showing.
   */
  clockLit: true,
  modelDir: "ak-3d-pack",
  // The small scenery still comes from the nature set - coconut palms and
  // broadleaf are already in there and are exactly right for Kerala, so the
  // village props do not have to carry the whole landscape.
  sceneryDir: "nature",
  defaultPlayer: "Peeli",
  // The same heights the hero world uses, from the same function — see
  // castHeight for why that is not a coincidence any more.
  playerHeight: castHeight,
  morphsBody: false,
  // No shared animation GLBs. Hero Trail needs them because the KayKit rigs
  // ship their movement clips separately from the meshes, but every character
  // on this road is an AK pack model carrying its own - Dave has 20 clips,
  // Peeli 21, the buffalo 16. Listing them here asked for
  // models/ak-3d-pack/anims-move.glb, which does not exist: the dev server
  // answered each 404 with its index page, so two 2 KB "models" were being
  // parsed as glTF on every single load.
  lands: VILLAGE_LANDS,
  // Kerala roads keep left, but a game camera does not care which hand the
  // country drives on — what matters is that the pair keep to ONE side and
  // leave the other free, so a villager can come the other way without
  // walking through them. They take the near half; the far half is the
  // oncoming lane.
  laneZ: 2,
  wordZ: 28,
  // Exactly the two units the camera just rose by (`view.camY` 10.6 to 12.6,
  // with `lookY` following so the pitch is unchanged). Raising the eye raises
  // the whole window with it, which took the letter row out of the bottom of
  // the frame again; lifting the row by the same amount puts it back where a
  // child was reading it, without touching the framing that was asked for.
  wordY: 2,
  // Tighter than the default 1.9, so the two of them fit in one half of the
  // road instead of the companion trailing off the edge of it.
  followSide: 1.3,
  // Buffalo in the fields. Further off the road than the hero world's
  // companions stand, because a buffalo is not walking with you.
  herd: [
    // Big. A water buffalo stands taller than the children walking past it —
    // Peeli is 4.4 and Dave 3.4 — and at the 3.6 it started on it read as a
    // large dog out in the field rather than as the thing that makes you
    // stop. The charge only lands if the animal arriving is worth minding.
    { model: "Buffalo", x: 34, z: -12, h: 6.0, wild: true },
    { model: "Buffalo", x: 118, z: -14, h: 6.0, wild: true },
    { model: "Buffalo", x: 206, z: -11, h: 6.0, wild: true },
    // Abee, stood just behind the pair at the start so he is in the opening
    // frame rather than somewhere down the road. No `wild`, so the herd list
    // spawns him as a bystander -- which is the whole of what the engine can
    // give him: `friends` are built with their rest chain hardcoded null, so
    // crouch, sit, jump, wave and joy are unreachable by construction and his
    // idle pool is his entire animated surface. He ships three for it.
    //
    // He now has `Walking` and `Running` too, so promoting him to a companion
    // or a selectable player is a roster change rather than an animation job.
    //
    // `faceY: 0` turns him to the camera instead of taking the crowd's random
    // facing; his model's forward is +Z. No `girth` or `headScale` override:
    // both were corrections for the realistically-drawn model he replaced,
    // and the head now comes from `castHeadScale` so there is one source of
    // truth for it rather than two that can drift apart.
    // Abee is NOT here any more. He is the guide, and the guide walks the
    // road with the children — see `setGuide`. Standing him in a field as
    // scenery contradicted the one thing the voice script is most explicit
    // about: "he is on the road, in their lane, always."
  ],
  // Palms and broadleaf, thinner than the hero forest: this is farmland with
  // trees in it, not woodland. The stray village props are mixed in here at
  // low counts - a path segment with a "/" in it is read as a full folder
  // path, which is how scenery from the pack folder reaches a nature world.
  treeCount: 18,
  ground: [
    // Everything here is kept off the road by `onRoad`, except the grit -
    // see ROAD_OK. The distances are the same shape as the other worlds use;
    // the clearance does the work rather than a set of hand-tuned minimums
    // that would go stale the moment the road width changed again.
    // NO BUSHES. The nature set's are pale-green half-domes — a shape that
    // reads as topiary on a lawn, not as anything growing beside a Kerala
    // cart road, and at 34 of them they were the most repeated object in the
    // world. MegaPlants and Flowers carry the low planting instead, and the
    // stone set now carries the things that are not plants at all.
    // KERALA PLANTS, rather than the nature set's generic undergrowth.
    //
    // Same reasoning as the stone below: `MegaPlants` and `Flowers` were a
    // temperate scatter set standing in for a tropical one, and `Flowers.glb`
    // turned out to hold exactly ONE mesh -- so all twenty-two flowers in the
    // world were the same object, which no amount of rotating hides.
    //
    // Counts follow where each thing actually grows: the ground layer close
    // in and numerous, the crops set back and few. Heights are the models'
    // own, from 0.48 for a grass tuft to 3.1 for a drumstick tree, so the
    // planting has a real range instead of one shrub size repeated.
    // Grass, fern and taro are thinned right down here because they are
    // planted properly in `groundClusters` below -- these few are the strays
    // between the thickets, which is what stops the clumps looking placed.
    ["village-plants/Kerala_Grass_Tuft", 6, 5, 13, "both"],
    ["village-plants/Kerala_Fern", 4, 6, 15, "both"],
    ["village-plants/Taro_Chembu", 3, 8, 18, "both"],
    // A FLOWERING SHRUB IS AN EVENT, not ground cover. At eight it was the
    // brightest thing on the road several times over, and repeated colour is
    // what makes a scatter read as wallpaper. Three, well apart.
    // "back" for everything waist-high and over -- see the foreground band in
    // `groundClusters`. "both" lets the scatter drop one on the NEAR verge,
    // which is the bottom of the frame, and a banana plant there is a green
    // wall across the shot. Only grass, fern and taro belong down there.
    ["village-plants/Hibiscus_Chemparathi", 3, 12, 24, "back"],
    // THE CROPS, weighted by what a Kerala smallholding actually carries.
    //
    // Banana and tapioca are the staples -- they go in by the dozen, in the
    // ground nearest the house -- so they lead. Drumstick is the tree in the
    // corner of the plot: present, never massed. Papaya is the one somebody
    // planted for the fruit, and two or three is a garden while ten is an
    // orchard, which this road is not.
    ["village-plants/Banana_Plant", 16, 12, 30, "back"],
    ["village-plants/Tapioca_Cassava", 14, 11, 26, "back"],
    ["village-plants/Drumstick_Muringa", 6, 18, 38, "back"],
    ["village-plants/Papaya_Tree", 2, 20, 36, "back"],
    // KERALA STONE, rather than the nature set's rocks shrunk to 0.35.
    //
    // Those were a dino valley's boulders scaled down until they stopped
    // looking absurd, which is not the same as looking right: a shrunken
    // monolith is still shaped like a monolith. These are laterite, granite,
    // river stone and moss — the things actually lying about a Kerala field —
    // and they need no scale correction because they were made at this size.
    //
    // Listed one file per entry because each is a single object rather than a
    // collection of variants. Six requests instead of one, at 70-90 KB each,
    // and the file cache means each is fetched once however many are planted.
    ["village-stone/Laterite_Rock", 7, 8, 22, "both"],
    ["village-stone/Granite_Boulder", 6, 10, 24, "both"],
    ["village-stone/Mossy_Stone", 6, 9, 22, "both"],
    ["village-stone/River_Stone", 5, 10, 20, "both"],

    // NO MILESTONE IN THE SCATTER. Blank ones were planted out between the
    // villages as ordinary roadside stone, and they cannot be read that way:
    // a milestone anywhere but at the end of a lesson makes the numbered
    // ones look arbitrary, because the child has no way to tell which stones
    // count. The shape is reserved for the lesson markers alone.
    // Loose stones scattered along and across the road itself, small enough
    // to be grit rather than obstacles.
    ["MegaPebbles", 70, 0, 12, "both", 0.5],
  ],
  // The thickets: low, damp-loving planting massed where the milestones fall.
  // Counts are per verge per stone, so the trail carries roughly ten of these
  // clumps and each one is different on each side.
  groundClusters: [
    {
      file: "village-plants/Kerala_Grass_Tuft",
      min: 4,
      max: 8,
      spread: 7,
      near: 9,
      far: 15,
      verge: "both",
      roadRelative: true,
    },
    {
      file: "village-plants/Kerala_Fern",
      min: 2,
      max: 6,
      spread: 6,
      near: 10,
      far: 16,
      verge: "both",
      roadRelative: true,
    },
    {
      file: "village-plants/Taro_Chembu",
      min: 1,
      max: 3,
      spread: 5,
      near: 10,
      far: 16,
      verge: "both",
      roadRelative: true,
    },
    // ── right up against the milestone ────────────────────────────────
    //
    // The stone sits just off the near edge of the road (see the milestone
    // placement: `meander(x) - roadClear * 0.92`), so "behind it" is FURTHER
    // from the road and "in front of it" is nearer. Taro goes behind, because
    // it is the tall one of the three and a broad leaf behind a marker frames
    // it; fern and grass go in front, where they are low enough to sit around
    // the foot of the stone.
    //
    // The face carrying the number looks back down the road, and nothing here
    // is tall enough or near enough to cross it: the taro is a metre high and
    // a clear stride behind, the grass and fern are half that and to the side
    // of the foot. Tight `spread`, so they gather at the stone rather than
    // trailing away from it.
    // NOTE: the planting AT the milestones is not here. It cannot be -- the
    // stones are placed as the child reaches them, not when the world is
    // built. See `makeBasePlants`, which is handed the stone's own position.
    // ── the foreground, along the bottom of the frame ──────────────────
    //
    // The word ribbon rides at `wordZ` 28, right at the bottom edge of the
    // view, over ground that was bare -- so the letters sat on nothing and
    // the frame simply stopped. A dense band of the low, wet-ground planting
    // either side of them closes it: growth in front of the text and growth
    // behind it, which is what gives the shot a foreground at all.
    //
    // `stride` small, so the clumps run together into continuous planting
    // rather than landing every twenty-six units. Both distances positive, so
    // it is the NEAR side only -- the far verge is already dressed and this
    // band is about the bottom of the screen specifically.
    //
    // Nothing is planted across 27-29: that is where the letters are, and a
    // taro leaf through the middle of a word is worse than bare ground.
    // Densities kept in check on purpose: instancing makes these cheap in
    // DRAW CALLS but not in triangles, and the first pass at this came to
    // about 290k of them -- roughly what the entire rest of the world costs.
    {
      file: "village-plants/Kerala_Grass_Tuft",
      min: 2,
      max: 5,
      spread: 5,
      near: 30,
      far: 37,
      stride: 9,
      verge: "near",
    },
    {
      file: "village-plants/Kerala_Fern",
      min: 1,
      max: 3,
      spread: 5,
      near: 31,
      far: 38,
      stride: 11,
      verge: "near",
    },
    // SPREAD, NOT CLUMPED. One plant at a time and often, rather than a pair
    // every sixteen units -- taro along the bottom of the frame is a margin
    // of planting, and a margin that gathers into knots reads as a hedge with
    // gaps in it. The wide `spread` against the short `stride` is what keeps
    // them irregular without letting them bunch.
    // BIG ENOUGH TO READ. The taro model is a metre tall, so at the shared
    // 0.7-1.4 it came out barely taller than the grass beside it and was lost
    // in the band. 1.2-2.2 puts it at 1.4 to 2.5 units -- the broad leaves
    // that make the bottom of the frame look like wet Kerala ground rather
    // than the edge of a lawn.
    {
      file: "village-plants/Taro_Chembu",
      min: 1,
      max: 1,
      spread: 6,
      near: 31,
      far: 39,
      stride: 6,
      verge: "near",
      lo: 1.2,
      hi: 2.2,
    },
    {
      file: "village-plants/Kerala_Grass_Tuft",
      min: 1,
      max: 3,
      spread: 5,
      near: 22,
      far: 26.5,
      stride: 11,
      verge: "near",
    },
    // ── smallholdings ─────────────────────────────────────────────────
    //
    // Banana and tapioca again, but dug in rows this time and only here and
    // there: `chance` means most points along the road get nothing, so a plot
    // is something you come across rather than a texture. Two or three short
    // rows each -- a household's patch, not an estate.
    //
    // Set well back (near 20+) so they read as the field behind the verge,
    // and never at the bottom of the frame.
    {
      file: "village-plants/Banana_Plant",
      min: 0,
      max: 0,
      spread: 9,
      near: 16,
      far: 24,
      stride: 34,
      verge: "far",
      roadRelative: true,
      plot: { lines: 2, perLine: 5, rowGap: 3.2, wobble: 0.55, chance: 0.5 },
    },
    {
      file: "village-plants/Tapioca_Cassava",
      min: 0,
      max: 0,
      spread: 8,
      near: 15,
      far: 22,
      stride: 41,
      verge: "far",
      roadRelative: true,
      plot: { lines: 2, perLine: 5, rowGap: 2.6, wobble: 0.45, chance: 0.45 },
    },
  ],
  sceneryScale: 1.15,
  // Table-flat. Kerala's paddy country has no hills in it, and the rolling
  // ground the other two worlds use reads as somewhere else entirely.
  relief: 0.12,
  // The Western Ghats on the horizon - the one piece of height in the view,
  // and what tells you which way the land goes.
  mountains: { colorNear: 0x6f8f7a, colorFar: 0x93a9a0 },
  // The painted far horizon replaces those two ranges on this road — see
  // `horizonBand`. 0.42 is measured off the art: the hill line sits a little
  // under halfway up the file, with the mist below it and clear sky above.
  horizon: {
    name: "chapter1_far_horizon",
    // The art has cut-out sky above the hills ON PURPOSE, so the dynamic sky
    // shows through it: the gradient behind this band is the one that carries
    // the hour, the twilight, the moon and the stars (see `applySky` and
    // `flatSky`), and the horizon is a silhouette laid over whatever that
    // sky happens to be doing. Two files per variant, day and night, cross-
    // faded on the same blend as everything else.
    variants: ["A", "B"],
    // SMALL AND FAR. 34, not 62 — under an orthographic camera nothing
    // shrinks with distance, so "further away" is a thing you can only say by
    // drawing it smaller. At 62 the hills stood as tall as the banyan in the
    // foreground and read as a wall across the road rather than as the far
    // side of a valley. 34 puts the ridge at about a ninth of the frame,
    // which is what a treeline a couple of miles off actually measures.
    // 26, not 20. Raising the ridge to where it can be seen lifts the whole
    // strip, and the art is transparent below its mist — so a taller band is
    // what keeps that mist down on the ground instead of leaving a line of
    // sky under the hills.
    height: 26,
    // BEHIND EVERYTHING, BUT NOT BEHIND THE FAR PLANE.
    //
    // This was 260 and invisible, and the reason took measuring: the camera
    // stands at z = 42, so 260 out is about 302 units of view depth against a
    // `cam.far` of 300. Its clip-space z came back at 1.08 — a hundredth past
    // the edge of the volume — and it was thrown away before anything was
    // drawn. Every other number about it was right, which is why it looked so
    // much like a texture or an alpha problem.
    //
    // It does not need to be far anyway. The band takes no depth test, so
    // nothing can occlude it and nothing can z-fight with it; the distance
    // only decides how much of the frame it covers via the skyline solve.
    // NEARER THAN THE GROUND IT STANDS BEHIND, which sounds backwards and is
    // the whole fix. The terrain writes depth and reaches 92 units out, so a
    // band at 200 was behind it and got cut off along the terrain's own edge —
    // a hard line straight through the treeline. The skirt was never the
    // culprit; it does not write depth at all.
    //
    // At 88 the band is in front of that edge and nothing about it changes
    // otherwise: this camera is orthographic, so distance has no effect on
    // size. Everything that should still occlude it does — the scatter ends
    // at 68 units, the temple stands at 84 — and the only thing it now draws
    // over is the far ground, which is what it is for.
    dist: 80,
    // 0.58, measured off the art rather than guessed at: the hill ridge sits
    // a little under three fifths of the way up the file, with the mist band
    // under it and cut-out sky above. At 0.42 the whole painted strip was
    // lifted ten units too high and sat above the visible window — the plane
    // was in frame the entire time (forcing its material red filled the sky
    // exactly as it should), and only the pixels were in the wrong place.
    // The line every cut is registered TO — day_A's own ridge, measured.
    skyline: 0.462,
    ridge: {
      day_A: 0.462,
      day_B: 0.473,
      night_A: 0.415,
      night_B: 0.489,
    },
  },
  // FLAT-SHADED fields, like the other two worlds. Photoreal ground was tried
  // here and lost: a repeating photographic surface under stylised characters
  // reads as sand rather than as a grove, its tiling is visible at this camera
  // height, and it fights the vertex-coloured grading the whole world is built
  // on. The detail goes where it earns its keep instead - see `roadTexture`,
  // which puts a real laterite surface on the ROAD and leaves the fields to
  // the flat colour that suits them.
  floorTextured: false,
  // Three surfaces blended across the ground by what is actually underfoot:
  // green rice in the fields, red laterite where the carts run, dry sand in
  // patches out near the palms. No ribbon and no second mesh - a strip laid
  // over the field would have its own edge, and an edge is the one thing this
  // is meant not to have.
  groundMix: {
    field: "leafy_grass",
    road: "laterite_mud",
    litter: "brown_mud_leaves_01",
    dry: "coconut_grove",
  },
  village: {
    dir: "ak-3d-pack",
    // Every 4 to 7 flags. A round carries the runner 64 units and the trail is
    // 260, so this is roughly one village per trail and sometimes none - which
    // is the point: a market you meet every round is scenery, and a market you
    // meet now and then is an event.
    everyFlags: [4, 7],
    // Temple, market and banyan together, with the cart parked at the market.
    // The temple sits back from the road and the market fronts it, which is
    // how a village actually arranges itself: you pass the shops and the
    // temple stands behind them.
    // Depth from the road is the whole composition. A village is read in
    // layers as you walk past it: the market right on the road because that is
    // what a market is for, the banyan behind it, and the temple furthest back
    // with the tree standing between it and the road - which is how you
    // actually glimpse a Kerala temple, through the branches of the tree in
    // its own grounds rather than square on.
    // ── HOW BIG A BUILDING IS, MEASURED AGAINST THE CHILD ────────────────
    //
    // These were set by eye against nothing — the village had never once been
    // seen (see `measureBox`, which was scaling every one of them a million
    // units across and clipping them out of the world), so a house had been
    // left the same height as the nine-year-old standing in front of it and a
    // compound wall came up to his knee.
    //
    // There is a real ruler on this road, so it is used. Dave is nine and
    // stands 4.7 units; a nine-year-old is about 1.35 m, which puts this
    // world at **3.48 units to the metre**. Everything below is a real
    // measurement through that:
    //
    //   an adult          1.70 m   5.9 u   — a clear head above Dave
    //   a door head       2.00 m   7.0 u   — an adult walks through it
    //   house eaves       2.40 m   8.4 u
    //   house ridge       4.00 m    14 u
    //   market ridge      3.60 m  12.5 u   — open shed, tall for the shade
    //   compound wall     1.20 m   4.2 u   — chest-high on an adult
    //   bullock cart      1.45 m   5.0 u   — to the top of the rail
    //   temple            5.75 m    20 u   — the tallest roof for a mile
    //   village banyan    6.90 m    24 u
    //
    // The ceiling on all of it is the frame: this camera shows 27.4 units of
    // height, so the temple at 20 is already most of the sky and a truly
    // life-sized banyan (10 m, 35 u) would not fit in the world at all. Those
    // two are the honest numbers bent to the picture; the house, the wall and
    // the door are not bent at all, because they are the ones a child reads
    // their own size against.
    heart: [
      // THE MARKET IS OUT UNTIL THERE IS A NEW ONE.
      //
      // The bought asset is too distorted to use at this size: it is four and
      // a third times wider than it is tall, so sizing it honestly against
      // the child stretched it across most of the road, and the texture will
      // not carry the enlargement. A village with no market reads as a small
      // village; a village with a smeared one reads as broken.
      //   { model: "Market", dx: -6, dz: -16, h: 12.5, turn: 0 },
      // The cart stays. It was parked at the market, and a cart left standing
      // at the roadside is a thing on its own — the strays list already puts
      // lone ones out on the empty stretches.
      { model: "Cart", dx: -1.2, dz: -9, h: 5.0, turn: 0.9 },
      // The ALTHARA IS HELD BACK until the new banyan is ready.
      //
      // It only makes sense underneath a tree -- a Kerala village banyan grows
      // out of a raised stone platform, and the platform on its own is just a
      // slab of granite in a field. It goes back in, on this exact line and
      // before the tree so the tree stands ON it rather than in it, the moment
      // the new banyan lands.
      //   { model: "village-stone/Stone_Althara", dx: 7, dz: -11.5, h: 0.85 },
      // CLOSE TO THE ROAD, AND OFF TO THE SIDE OF THE SHRINE.
      //
      // A village banyan grows at the roadside — it is the thing you walk
      // under, and the shade it throws is the reason the althara and the
      // market ended up beneath it. Set back at -26 it was just another tree
      // in the middle distance.
      //
      // But brought forward on the shrine's own line (dx 7 against its 5) it
      // stood directly in front of it and the shrine was gone again. It sits
      // a good way along the road instead, so the two are met side by side:
      // the tree first, the shrine past its trunk.
      //
      // 18, not 24. At the roadside a banyan is the nearest thing in the
      // frame, and this camera does not shrink it for being close — at 24 it
      // was a trunk filling a third of the sky with the village behind it.
      //
      // OURS, NOT THE PACK'S. `village-plants/` is where this project's own
      // Kerala flora lives and `ak-3d-pack/` is a product for sale, so the
      // new tree goes with the papaya and the drumstick. It is better on
      // every axis than the bought one it replaces — 194 KB against 424,
      // 3,860 triangles against 7,346, 4,050 vertices against 18,285 — and
      // its accessor bounds are declared in the raw integers the
      // quantisation flag says they are, rather than in the already
      // normalised units that made every building in this village invisible.
      // See `measureBox`.
      { model: "village-plants/Banyan_Almaram", dx: -13, dz: -16, h: 18 },
      // The VAZHIVILAKKU are not here. They belong to the ROAD, not to the
      // village — and they are no longer even their own object: the lamp head
      // is welded onto the milestone, so one arrives with every marker the
      // whole length of the trail. See `lightTheNiche`.
      // SMALL. A village shrine, not a great temple — it is the one a few
      // families walk to, and at 20 it was the tallest thing for a mile and
      // took most of the sky with it. 11 is about 3.2 m: shorter than the
      // houses' ridges, taller than their eaves, which is the right size for
      // the thing you glimpse through the banyan rather than the thing that
      // announces itself.
      //
      // And brought FORWARD to -24, from -42. Behind the banyan still, so it
      // is met through the branches, but inside the haze rather than beyond
      // it: at -42 the fog had two thirds of it and a shrine nobody can make
      // out is the same as no shrine at all.
      { model: "Temple", dx: 5, dz: -24, h: 9, turn: 0.08 },
    ],
    houses: ["HouseThatch", "HouseMoss", "HouseHearth"],
    // ELEVEN, WITH THE DISTANCE DOING THE REST. 14 was the human-scale
    // figure and too big in the frame; 8.4 was 60 per cent of it and right
    // for the nearest house but wrong for the far ones, which were the same
    // size again because an orthographic camera does not shrink anything.
    //
    // `perspective()` in the build now scales every building by its depth, so
    // this is the size of a house STANDING ON THE ROAD and the ones set back
    // come down from it on their own: 11 at the verge, about 8 at the nearest
    // spot, a little over 7 at the furthest. The old note follows because it
    // still governs the temple, the wall and the cart.
    //
    // (Was: SIXTY PER CENT of the 14 they were measured to. 8.4 is about 2.4 m to
    // the ridge, which is a metre under the human-scale figure above and is a
    // deliberate departure from it: at 14 the houses were right against a
    // ruler and too big against the FRAME, crowding the road they are meant
    // to sit back from. The door comes down with them, to roughly 4.2 — level
    // with Dave rather than over an adult's head — so the honest measurement
    // in `heart` above no longer describes these two numbers. Left in place
    // because it still describes the temple, the wall and the cart, and
    // because the reasoning is worth keeping when the art is next revisited.)
    houseHeight: 11,
    wall: "Wall",
    wallHeight: 4.2,
    // Out on the empty stretches, very rarely: a house set back off the road,
    // or a cart somebody left. See `strayRate` where these are placed.
    strays: [
      { model: "HouseThatch", h: 8.4 },
      { model: "HouseMoss", h: 8.4 },
      { model: "Cart", h: 5.0 },
    ],
  },
  floorOpacity: 1,
  sky: "flat",
  // A light twilight, not a blackout. The village is lit by its own lamps
  // after dark and the lamps only read as lamps if there is something around
  // them to be lit — in a full night the buildings vanish and the oil flames
  // hang in a void. Just under halfway to the dusk keeps the sky evening-blue
  // and the paddy legible, and leaves the lamps clearly the brightest thing
  // on the road.
  // Dark, and deliberately so — twice reduced.
  //
  // 0.45 was set when the night had nothing in it but sky and the village
  // vanished into it. That is no longer the problem it was solving: there
  // are oil lamps at every milestone, lit windows in every house, a petromax
  // over the market and the temple burning, so the road now carries its own
  // light and the sky does not have to.
  //
  // A lamp is only bright relative to what is around it. Every unit of lift
  // taken out of the night is a unit the flames gain for nothing, and at
  // 0.10 the lamplight is the brightest thing in the frame — which is what a
  // lamp is for. Not zero: some lift is what keeps the paddy and the
  // mountains legible as shapes rather than leaving a black pane with dots
  // of fire on it.
  // ── THE VILLAGE'S OWN DAYLIGHT ──────────────────────────────────────
  //
  // Midday, kept at midday, but lit as open air rather than as flat
  // brightness. Three values and no extra lights: the fill already in the
  // scene is simply told what colour the sky and the ground are.
  //
  // A soft daylight blue overhead, so a shadow is the BLUE half of the world
  // — lit by sky alone — instead of a dimmer copy of the sunlit half. Held
  // well back from a real sky blue on purpose: ACES pushes saturated blues
  // hard, and anything stronger turns the shade under the palms cyan.
  // WARM, BUT SOFT — and the second half of that took two goes.
  //
  // A proper daylight blue was the first attempt: correct physics, and it
  // made a Kerala noon look like an English one, because at this latitude
  // what fills the shade is bounce off red laterite and off a great deal of
  // green, none of it blue. So it went warm — and too warm. A warm sky over
  // a warm ground is warm light arriving from every direction at once, which
  // has no separation left in it and lands as an orange wash over everybody's
  // faces. Warm is not the same as dreamy; that version was just rough.
  //
  // Barely cool overhead, dusty warm from below, LOW CHROMA ON BOTH. The
  // warmth in the frame comes from the sun, which is where warmth comes
  // from; these two only decide what colour the shadows are. Soft light is
  // light with the saturation taken OUT of the fill, not more colour put in.
  skyFill: 0xe6eaf0,
  // And warm red from below, because that is what the ground IS here. The
  // default bounces the grass colour, which on a laterite road put green
  // light up into everybody's faces while they walked over red earth.
  // Dusty clay rather than orange, so the laterite reads as ground colour and
  // not as a lamp held under everybody's chin. Still clearly the warm side
  // against the fill above it, which is all the separation a soft scene needs.
  bounce: 0xbfa38f,
  // Three texels of blur. Midday shadows are hard in life, and hard shadows
  // under stylised characters read as cut-out stickers laid on the ground.
  shadowSoft: 3,
  // Cloud crossing the sun, slowly, all afternoon. See cloudDrift.
  cloudDrift: 0.16,
  nightTwilight: 0.1,
  mistScale: 0.22,
  nightTrees: "keep",
  pointerRing: true,
  companionsWatch: true,
  nightMode: "night",
  guardRate: 0.1,
  // LOW, AND LOOKING OUT — so the horizon is in the picture.
  //
  // This went the wrong way twice. "See further" was read as "see more
  // ground", which means tilting DOWN, and tilting down is exactly what
  // removes the horizon: a steep camera fills the frame with the floor and
  // the far distance never appears. What was wanted is the opposite — a low
  // camera looking OUT, where the fields run away to the Western Ghats and
  // you can see where they stop.
  //
  // So the camera sits lower than it did and further BACK — 42 rather than
  // 33 — with the aim just above the child's head. Back and low is what
  // straightens the road out: a near camera throws it across the frame on a
  // hard diagonal (16 was tried, and reverted on sight), a far one keeps it
  // running level and lets the land stack up behind it.
  //
  // 11.8 degrees. Flatter than it was when the camera sat close, and a
  // notch steeper than the 8.3 it was taken down to — at that angle the
  // ground plane ran out inside the frame and bare sky showed in the top
  // corner, which is the cost of looking too far out: the world is 120 deep
  // and a shallow enough camera can see past the end of it.
  //
  // `topF` and `botF` slide the frame up and down the view WITHOUT zooming:
  // their sum is the height, so keeping it at 1.90 and moving weight from
  // one to the other re-centres the picture and changes nothing else.
  //
  // Weighted downward here, twice over. Raising topF to make room for the
  // horizon had pushed the road and the letters into the bottom third —
  // measured, the road at 31% up the frame and the letters at 24%, low
  // enough to be awkward to read. Shifting weight to botF lifts the whole
  // picture: the road now sits at 56%, a little above centre, with the
  // child's head at 72% and the mountains still at 92% with sky above them,
  // because the ridge solve reads topF and follows it without being told.
  //
  // The letters are held down by `wordZ` rather than rising with everything
  // else — the gap between the road and the letters is the thing being tuned
  // here, not either one alone. 39 put them at 29%, which was too low to
  // read comfortably; 28 sits them at 36%, a clear band under the road.
  view: {
    // ── STOOD ON THE ROAD, NOT FLOATING OVER IT ──────────────────────────
    //
    // 11 units up looking 11.6 degrees down is a camera on a ladder. This is
    // a road you walk, so the eye that watches it is at a walker's height and
    // looks very nearly level.
    //
    // The height is not a taste, it is the same ruler the buildings are
    // measured with: Dave is nine and 4.7 units, a nine-year-old is about
    // 1.35 m, so this world runs at 3.48 units to the metre and an adult's
    // eye at 1.70 m is 5.9. The gaze is three degrees down — what somebody
    // walking actually does, watching the road a little ahead of their feet
    // rather than the horizon.
    //
    // AND IT IS WHAT PUTS SKY IN THE PICTURE. Under an orthographic camera
    // nothing shrinks with distance, so the pitch alone decides where the
    // ground's far edge lands: at 11.6 degrees down it projected ABOVE the
    // top of the frame and the whole view was grass, which is why a painted
    // horizon had nothing to stand against. At three degrees that edge drops
    // to about 3.1 units of screen height, leaving ten units of sky over it.
    camY: 12.6,
    camZ: 42,
    // 9, for a yaw of 12.1 degrees: atan(9 / 42) = 12.098. It was 10, which
    // gave 13.39. The pitch is set by the same single `lookAt` and shifts
    // with it, from 11.52 degrees down to 11.58 — six hundredths of a degree,
    // which moves the horizon about a twentieth of a unit in a frame twenty-
    // seven units tall.
    camX: 9,
    // TEN FEET UP, AND STILL LOOKING ALONG THE ROAD.
    //
    // 3.05 m at 3.48 units to the metre is 10.6 — near where the camera
    // started, and that is the point: the height was never the problem. The
    // ANGLE was. At 11.6 degrees down the ground's far edge projected above
    // the top of the frame and the entire picture was grass; at 4 degrees it
    // sits about four units up the screen with sky over it, which is what a
    // horizon needs to exist at all.
    //
    // TILTED DOWN TO SEE THE CHILDREN. 8.09 against a 12.6 eye over a
    // 42.95-unit reach is atan(4.51 / 42.95) = 6.0 degrees, up from 4.
    //
    // Every degree of pitch is paid for in sky, and the bill is exact: the
    // ground's far edge lands at `FAR * sin(pitch)` of screen height, so at 4
    // degrees 116 units of ground reached 8.1 and at 6 the same ground would
    // reach 12.1 — over the top of the frame, with no sky and no horizon
    // left. So the skirt comes in to 104 and the frame top goes out to 0.80,
    // and the edge lands at 10.87 under a top of 12.32.
    //
    // 104 AND NOT LESS, and this is the trap. The terrain itself reaches 102
    // units out, so a skirt shorter than that hides behind it and the edge on
    // screen is the TERRAIN's — which has relief, so it CURVES, while the
    // painted band is straight. A wedge of sky then opens between them
    // wherever the ground dips. The skirt only does its job while it is
    // longer than the thing it is covering for.
    //
    // 100 is nearer than the fog's saturation at 120, so that edge is only
    // three quarters faded and would once have shown as a line. It does not
    // now: the painted band's own mist draws over the skirt (see the skirt's
    // `depthWrite`), and covering that join is exactly what the mist is for.
    lookY: 4.25,
    // 12.2 — a fifth closer than the 15.4 this started at, so the children
    // are big enough to read a face on.
    //
    // Worth knowing what it spends: the frame's top is `frustum * topF`, so a
    // narrower view is a lower ceiling, and the ground's far edge does not
    // move when the ceiling does. Zooming in and lifting the scene both push
    // that ceiling down towards the edge, and the sky between them is what
    // closes up.
    frustum: 12.2,
    // THE FRAME SLIDES UP, AND KEEPS ITS HEIGHT.
    //
    // 0.68/1.22 against 0.92/0.98: the two still sum to 1.90, so the view is
    // exactly as tall as it was and nothing about the scale changes — it is
    // the same window moved about three and a half units up the wall. What it
    // spends is the empty grass on the near verge, which nobody looks at, and
    // what it buys is sky: at 0.68 the ground's own far edge projected above
    // the top of the frame, so there was no sky in the picture at all and a
    // painted horizon had nothing to stand against.
    // The road wanted to sit higher in the frame than the first slide left
    // it, so the window comes back down a little: 0.82/1.08 still sums to
    // 1.90, so the view is the same size and the same scale, moved.
    // THE WHOLE WINDOW MOVES, not the things inside it.
    //
    // 0.70/1.20 still sums to 1.90, so the view is the same size and the same
    // scale — it just sits lower on its wall, which lifts everything in the
    // world in the picture at once. Raising the letters on their own got them
    // back on screen and made them look like a banner hung in the sky; the
    // row belongs where it always was, and it was the frame that was wrong.
    // MORE GROUND, LESS SKY — and the fog is what pays for it.
    //
    // The frame's top has to clear the line where the fog goes solid, or the
    // ground's far edge shows and the horizon has nothing to sit on. Pitching
    // down to see the children pushed that line UP the screen (it lands at
    // `fogFar * sin(pitch)`), so the frame had to grow upwards to keep it,
    // and the road went out of the bottom.
    //
    // Bringing the fog in from 100 to 85 drops the line from 13.9 to 11.8,
    // which buys back two units of frame at the top and spends them on the
    // road. 0.80/1.10 still sums to 1.90, so nothing has zoomed.
    // The frame grows DOWNWARDS, which is the only direction that shows more
    // road. 0.86/1.30 sums to more than the 1.90 the others keep — a
    // fourteen per cent step back — because the two ends are not
    // interchangeable here: the top is pinned by the fog line, which the
    // horizon has to sit on, and the bottom is where the children and the
    // letters are. Trading top for bottom loses the horizon, so the frame has
    // to get bigger instead.
    // The window slides DOWN its wall so the world rises in the picture:
    // 0.90/1.50 keeps the same 2.40 total, so the lift costs no zoom of its
    // own. The ground is deliberately left alone here — it is the frame that
    // was asked to move, not the world.
    topF: 0.9,
    botF: 1.5,
  },
  // Tropical, and nothing turns. Several broadleaf variants in the nature set
  // carry autumn reds; on a Kerala road they read as a different climate.
  foliageTint: { leaf: 0x4e8f3a, trunk: 0x6b5a46, strength: 0.62 },
  // Warm but NOT boosted. Kerala light is strong and the instinct is to grade
  // up to match it, but the ground now carries its own colour from three
  // photographic surfaces - and a saturation boost on top of those turns rice
  // green into lime and laterite into a warning sign. The exposure stays high
  // for the brightness; the saturation comes off.
  grade: {
    exposure: 1.44,
    sat: 1.02,
    bright: 1.04,
    sun: 2.8,
    hemi: 0.85,
  },
  playerVivid: 1.1,
};

/** How far one round carries the runner. The trail never rewinds — each new
 * round plants the camp flag another stretch ahead. Longer than it looks: a
 * round ends when the passage does, so the distance is what turns a handful of
 * words into a journey worth finishing. */
/** Trail coverage: about four rounds land-to-land, plus a margin. */
const TRAIL_END = 260;
/**
 * How much the ground rolls, as a multiple of the original hills.
 *
 * Module-level and mutable because `groundY`, `groundNoise` and `terrainY` are
 * module-level helpers called from a dozen places - props, shadows, the flag,
 * the word blocks - and every one of them has to agree with the ground mesh to
 * the millimetre or things float and sink. Threading a parameter through all of
 * them to say one number per world would be a much larger change for no more
 * correctness, and two worlds are never built at once.
 *
 * Village Road sets it near zero: Kerala's paddy country is table-flat, and
 * rolling hills under a rice field is the one thing that would say "this is
 * not really that place" before a child had read a single word.
 */
let RELIEF = 1;
/**
 * How far the road is worn BELOW the field beside it.
 *
 * A road that carts have used for ninety years is not a stripe painted on a
 * field, it is a hollow: the surface is carried away by wheels and feet and
 * washed off by every monsoon, and it ends up sitting lower than the ground it
 * crosses. That dip is most of what makes it read as old rather than as
 * recently drawn, and it costs nothing - the ground mesh already runs through
 * `terrainY`, so sinking it there sinks the mesh, the shadows, the props and
 * the child walking on it, all in agreement.
 */
let ROAD_SINK = 0;
const groundY = (x: number) =>
  (Math.sin(x * 0.045) * 1.6 + Math.sin(x * 0.011 + 1.7) * 2.4) * RELIEF;
/** The trail wanders a little, like feet chose it — never far from the lane. */
const meander = (x: number) =>
  Math.sin(x * 0.07) * 0.7 + Math.sin(x * 0.023 + 2.1) * 0.4;
const groundNoise = (x: number, z: number) =>
  Math.sin(x * 0.7 + z * 1.3) * Math.cos(x * 0.31 - z * 0.7);
/** The full terrain height at any (x, z) — matches the ground-mesh vertices,
 * so props sit exactly on the surface (not just at the trail height). */
const terrainY = (x: number, z: number) => {
  let y = groundY(x);
  if (ROAD_SINK > 0) {
    const off = Math.abs(z - meander(x));
    const worn = 2.9 + groundNoise(x * 0.13, 1.7) * 0.5;
    // A shallow bowl across the used width, smoothstepped so the shoulders
    // round off into the field instead of meeting it at a crease.
    const t = Math.max(0, Math.min(1, 1 - off / (worn * 1.7)));
    y -= ROAD_SINK * t * t * (3 - 2 * t);
    // CART TRACKS, and only in places. Ruts do not run the whole length of a
    // road - they are cut where the ground stays soft and are worn away where
    // it does not - so a third noise decides which stretches have them. Ruts
    // everywhere read as tram rails.
    const gauge = 1.5 + groundNoise(x * 0.05, 9.7) * 0.28;
    const inRut = Math.max(0, 1 - Math.abs(off - gauge) / 0.5);
    const where = (groundNoise(x * 0.06 + 5.5, 2.2) + 1) / 2;
    if (where > 0.42 && inRut > 0) {
      y -= 0.085 * inRut * inRut * Math.min(1, (where - 0.42) * 3);
    }
  }
  const distLane = Math.max(0, Math.abs(z) - 2.6);
  y +=
    groundNoise(x * 0.35, z * 0.5) * 0.35 * Math.min(1, distLane / 3) * RELIEF;
  if (z < -10) {
    // The far bank rising behind the trail. Kept at a fraction of its usual
    // slope on a flat world, so the land still lifts towards the horizon
    // rather than running to a hard edge - the mountains go on top of this.
    y += (-z - 10) * (0.3 + 0.1 * Math.sin(x * 0.05)) * (0.25 + 0.75 * RELIEF);
  }
  return y;
};

type DinoRig = {
  readonly wrap: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  readonly run: THREE.AnimationAction | null;
  /**
   * A separate, slower gait. Null for the characters that ship one move clip
   * — they run or they stand, exactly as before.
   */
  readonly walk: THREE.AnimationAction | null;
  /**
   * The calm loop CURRENTLY showing. Not readonly: a character with several
   * idles moves between them, and the cycler swaps this to whichever is up
   * so that every weight site downstream keeps driving "the idle" without
   * needing to know there is more than one.
   */
  idle: THREE.AnimationAction | null;
  /**
   * Every calm loop the character has, the showing one included. One entry
   * (or none) means there is nothing to cycle and the cycler stays out of it.
   */
  readonly idles: readonly THREE.AnimationAction[];
  /**
   * Hair with weight in it, for the characters rigged for it. Null for
   * everybody else, and the whole feature costs them nothing.
   */
  readonly hair: HairSim | null;
  /** A one-shot celebration the character performs itself, if it has one. */
  readonly joy: THREE.AnimationAction | null;
  /**
   * What the character does while nobody is typing. All optional — a
   * character without them simply stands in `idle`, which is what every rig
   * but the Explorer's does today.
   */
  readonly rest: RestClips;
  /**
   * How far each settled rest pose floats above the planted ground, measured
   * once at load. Added back to the character's Y while that pose plays, so a
   * crouch or a sit lands on the path instead of hovering over it.
   */
  /**
   * How far each pose floats above the planted ground, measured.
   *
   * The GAITS are in here too, and they have to be: `plantFeet` plants on the
   * lowest point across idle, walk and run together, so every pose but the
   * deepest one stands above the ground by the difference.
   */
  readonly lifts: {
    readonly crouch: number;
    readonly sit: number;
    readonly idle: number;
    readonly walk: number;
    readonly run: number;
  };
  /**
   * Weighted one-shots for a character who answers back — empty for the
   * ones who do not, which is every rig but Peeli's today.
   */
  readonly brave: readonly {
    readonly action: THREE.AnimationAction;
    readonly weight: number;
  }[];
  /** Standing gestures for the waiting gap — empty for a rig without them. */
  readonly fidget: readonly THREE.AnimationAction[];
  /**
   * A tail wag, for the companion that has a tail. Looping rather than a
   * one-shot: how LONG it wags is the whole character of it, and that is
   * decided when it starts, not by the length of the clip.
   */
  readonly wag: THREE.AnimationAction | null;
  /**
   * Walks on four legs, read from the skeleton rather than from a list of
   * names. A person turning on the spot to look about is a person looking
   * about; a dog doing it is a dog spinning, which is what it looked like.
   */
  readonly quadruped: boolean;
  /**
   * Things a dog does when it is waiting for somebody.
   *
   * The puppy ships eighteen clips and the game used to reach five of them:
   * it walked, it ran, it stood, it jumped, and it wagged. Everything else —
   * the bow, the bark, the shake, the sniff, sitting down, lying down,
   * falling asleep — was authored, shipped, and never once played.
   *
   * Weighted because a dog is not a shuffle: it sniffs far more often than
   * it begs, and it barks less than either.
   */
  readonly tricks: readonly {
    readonly action: THREE.AnimationAction;
    readonly weight: number;
  }[];
  /**
   * Settling down, in order: sit, then lie, then sleep.
   *
   * Kept separate from the tricks because it is a PROGRESSION, not a draw.
   * A dog left waiting long enough gets bored in stages, and the stages only
   * go one way.
   */
  readonly settle: {
    readonly lie: THREE.AnimationAction | null;
    readonly sleep: THREE.AnimationAction | null;
    readonly turnLeft: THREE.AnimationAction | null;
    readonly turnRight: THREE.AnimationAction | null;
  };
};

/** One-shot and looping clips for the idle chain, plus the jump. */
type RestClips = {
  readonly wave: THREE.AnimationAction | null;
  readonly crouchDown: THREE.AnimationAction | null;
  readonly crouchIdle: THREE.AnimationAction | null;
  readonly standFromCrouch: THREE.AnimationAction | null;
  readonly sitDown: THREE.AnimationAction | null;
  readonly sitIdle: THREE.AnimationAction | null;
  readonly standFromSit: THREE.AnimationAction | null;
  readonly jump: THREE.AnimationAction | null;
};

export type KidsWorld = {
  readonly land: Land;
  readonly ready: Promise<void>;
  setPlayer(name: string): Promise<void>;
  /**
   * Stage the light for an hour of the day, or `null` to follow the clock.
   *
   * The hour is the DAY hour; night is its twin twelve hours round. Only
   * `clockLit` worlds listen — see the theme flag.
   */
  setHour(hour: number | null): void;
  /**
   * A second character who walks the trail alongside the first.
   *
   * Not a second player: it never types, never scores, and nothing it does
   * changes the lesson. Pass null to send it home.
   */
  setCompanion(name: string | null): Promise<void>;
  /**
   * Who walks with the player, nearest first — at most two.
   *
   * Given in the order they should line up, which the caller decides from the
   * cast order rather than from the order the choices were made.
   */
  setCompanions(names: readonly string[]): Promise<void>;
  /** The local boy who shows them the village, or null to send him away. */
  setGuide(name: string | null): Promise<void>;
  /** Milestones ever passed — decides which of his three bands he walks in. */
  setGuideBand(stones: number): void;
  /**
   * Recolour the character's clothes at runtime.
   *
   * Only the Explorer carries the masks this needs; for anyone else the
   * choice is remembered and applied if they switch to him, rather than
   * being dropped while he is off screen.
   */
  setCharacterColors(colours: ClothingColours): void;
  resetCharacterColors(): void;
  characterColors(): ClothingColours;
  canTintCharacter(): boolean;
  setProgress(frac: number): void;
  /** Plant the camp flag a fresh stretch ahead — the runner never rewinds. */
  /**
   * Begins a run, sized to the passage it is for.
   *
   * The character count decides how far the trail carries them, so that
   * every keystroke moves the same distance whoever is typing — see
   * `runLengthFor`. Omitted, the run is the full length.
   */
  startRun(passageChars?: number): void;
  jump(): void;
  /** A happy little bounce — for streaks and other proud moments. */
  hop(): void;
  /** The dino turns to the viewer and wiggles — "come on, keep typing!" */
  beckon(): void;
  stumble(): void;
  roar(): void;
  /**
   * The flag is reached: celebrate, in this world's own idiom.
   *
   * Returns how long the celebration will run, in milliseconds, so a
   * caller can hold anything that would cover it — the new-key ceremony
   * is a full-width panel, and opening it on the frame the flag is
   * reached puts a dialog over the one animation the run was for.
   *
   * A measured length rather than a guessed constant: it comes from the
   * joy clip's own duration below, so a character whose celebration is
   * re-authored keeps this honest with no second place to update.
   */
  celebrate(): number;
  /** A celebratory size-pop when a new key unlocks. */
  grow(): void;
  /** Baby (0) → adult (1): reshapes the dino's body, size, colour and gait. */
  setAge(age: number): void;
  burstAtPlayer(colors: readonly number[], count?: number, up?: number): void;
  playerScreenXY(): readonly [number, number] | null;
  /**
   * Let the world start moving. Called once, when the loader has gone.
   *
   * Everything is frozen until then — see `held` in the tick.
   */
  /**
   * The lesson is finished: the stone ahead has been reached.
   *
   * Called by the page at the same moment it counts the milestone, and the
   * only thing that makes a stone permanent or moves the number on. Without
   * it the road plants a stone every time a run is set up — see
   * `pendingStone` — and runs ahead of the lessons actually walked.
   */
  passStone(): void;
  setHeld(on: boolean): void;
  setNight(night: boolean): void;
  /** Live look control: `brightness` (~0.7–1.3) scales brightness, `paleness`
   * (0 = full colour, 1 = very pale) desaturates the whole scene. */
  setLook(brightness: number, paleness: number): void;
  /** Ambient motion intensity for all companions/sheep: 1 = full liveliness,
   * 0 = they hold still (a calmer, less busy scene). */
  setMotion(intensity: number): void;
  /**
   * How fast the learner is typing, in words per minute.
   *
   * Decides the character's gait: below RUN_WPM they walk, at or above it they
   * run. Characters carrying a single move clip ignore it.
   */
  setPace(wpm: number): void;
  /**
   * A keystroke happened. Ends any resting pose and restarts the idle clock.
   *
   * Separate from `setPace` because a wrong key is still activity: it does not
   * advance the trail, so movement alone would leave him sitting down while
   * somebody is very much still there and typing.
   */
  wake(): void;
  /**
   * Hold the celebrations and the flinches still.
   *
   * Separate from `setMotion`, which is about how lively the scenery is. This
   * is about what the world does *to the learner*: the shake after a wrong
   * key, the shiver of a fright, the burst of sparks. The colours still
   * change, because that is what carries the meaning — it is the movement
   * that arrives unasked, and always at the worst moment.
   */
  setCalm(calm: boolean): void;
  /** The learner's accent, for the tile marking the letter to type next. */
  setAccent(hex: string): void;
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
  opts: {
    /** Which night this learner gets; see night.ts. Hero world only. */
    readonly nightStyle?: NightStyle;
    /**
     * Whether this trail contains a village (Village Road only).
     *
     * The page decides, not the world. Villages fall every four to seven
     * FLAGS, and a flag is a round - but the world is rebuilt once per
     * session and has no idea how many rounds the child has typed, in this
     * session or any before it. The page keeps that count, so the page is
     * what knows when one is due.
     */
    readonly villageDue?: boolean | "near";
    /**
     * Review only, for `?wild`: bring a buffalo up next to the start and let
     * it lose patience in seconds rather than in half a minute.
     *
     * The charge is the hardest thing in this world to look at. It needs a
     * buffalo within noticing distance AND a child who has stopped typing
     * for twenty-two seconds, and in play the nearest buffalo is forty units
     * down the road — so on a normal load it can simply never happen where
     * anyone can see it. This makes it happen.
     */
    readonly wildReview?: boolean;
    /** Which chapter this is, carved into the roadside milestone. */
    readonly chapter?: number;
    /**
     * How many milestones this child has already passed, across every
     * session they have ever played.
     *
     * A milestone is a stone in the ground. It does not reset because the
     * page reloaded, and a child who walked past stone 7 yesterday should
     * not meet stone 1 again today — the number is the whole reward. The
     * count lives with the saved preferences because the world is rebuilt
     * from nothing every session and cannot remember anything itself.
     */
    readonly stonesPassed?: number;
    readonly tier?: DeviceTier;
    /**
     * Called when the character settles into a waiting pose, so the page can
     * say something. Fired on the pose the learner actually sees land — the
     * wave as it starts, the crouch and the sit once they have arrived — not
     * on the transitions in between, which would make the coach talk over
     * itself twice in two seconds.
     */
    readonly onRest?: (stage: "wave" | "crouch" | "sit") => void;
    /**
     * Dev/review showcase: spawn one model beside the path and cycle through
     * every one of its clips, so each move can be judged in the game's own
     * lighting and next to a hero for scale. Off in normal play. Gated in the
     * page by a `?buffalo` or `?puppy` URL.
     *
     * Takes a model NAME rather than a boolean. It began as `buffaloShowcase`
     * and the puppy needed exactly the same rig: eighty lines of loading,
     * grounding, placement and clip-cycling that differ only in which file to
     * load and how tall to draw it. Two copies of that would have drifted the
     * first time either was touched.
     */
    readonly showcaseModel?: string;
    /**
     * A SECOND showcase model, parked beside the first and held on its idle
     * loop rather than cycling. Lets one animal be reviewed against another for
     * scale without two moving things competing for attention - the eye needs
     * something still to measure the moving one against.
     */
    readonly showcaseIdleModel?: string;
    /** Fired when the showcase advances to a new clip, for a caption. */
    readonly onShowcaseClip?: (
      name: string,
      index: number,
      total: number,
    ) => void;
    /**
     * Fired as each piece of the world arrives, with a name a child can read.
     *
     * The loading card used to show a chapter title and a bar, which says
     * only "wait". What is actually happening is that a place is being built
     * out of named things — Dave, Peeli, the banyan, the temple — and saying
     * so turns the wait into the story of the road being laid. See
     * `sceneName` for where the names come from.
     */
    readonly onLoadStep?: (label: string) => void;
    /**
     * Something happened on the road that is worth a word.
     *
     * One callback rather than one per event, because the page's answer to all
     * of them is the same — pick a line and show it — and a second parameter is
     * cheaper than six more fields nobody can keep in step.
     *
     * Fired at most once per occurrence, from the state machine that owns the
     * event, so the page never has to poll or guess.
     */
    readonly onEvent?: (
      what:
        | "buffaloNotice"
        | "buffaloWarn"
        | "buffaloCharge"
        | "buffaloSafe"
        | "stared"
        | "nightfall"
        | "village",
    ) => void;
  } = {},
): KidsWorld {
  // Whether dark here means night, and what tonight holds if it does.
  // Set before ANYTHING measures the ground - the mesh, the props and the
  // helpers must all be built against the same relief.
  RELIEF = theme.relief ?? 1;
  ROAD_SINK = land.path === "mud" ? 0.22 : 0;
  const trueNight = (theme.nightMode ?? "dusk") === "night";
  const nightStyle: NightStyle = opts.nightStyle ?? "full";
  const villageDue = opts.villageDue ?? false;
  /**
   * Put the village where it can be seen from the start.
   *
   * Review only, for `?village`. In play a village sits well down the road so
   * the child walks to it, which also makes it impossible to look at while
   * building one - it is two or three full runs away, and every reload starts
   * you back at the beginning.
   */
  const villageNear = villageDue === "near";
  const wildReview = opts.wildReview === true;
  const plan = nightPlan(nightStyle, opts.tier ?? "mid");
  // ASK FOR THE REAL GPU.
  //
  // Left at the default, a laptop with both an integrated and a discrete
  // chip hands WebGL to the integrated one -- which is precisely the machine
  // this has to run on, and precisely the one that cannot afford a 3072
  // shadow map and 300k triangles. Costs nothing and changes nothing on a
  // machine with only one GPU.
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
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
  // How far into night the LOOK is, 0..1. Night flattens the palette: greens
  // read nearly grey under a blue twilight, which no amount of blue light
  // alone achieves while the canvas is still saturating them.
  let nightLook = 0;
  /** Where the canvas grade is heading. Walked across in the tick. */
  let nightLookTo = 0;
  const applyLook = () => {
    const sat = Math.max(
      0,
      grade.sat * (1 - userPale * 0.85) * (1 - nightLook * 0.48),
    );
    const b = grade.bright * userBright * (1 - nightLook * 0.05);
    canvas.style.filter = `saturate(${sat.toFixed(3)}) brightness(${b.toFixed(3)})`;
  };
  applyLook();

  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(land.sun, grade.sun);
  /**
   * WHERE THE SUN IS, RELATIVE TO WHAT IT IS LOOKING AT.
   *
   * Relative, and that is the important word. The sun rides along with the
   * camera so its shadow frustum stays over the part of the road anybody can
   * see — `sun.position.x = cam.x + SUN_AT.x` with the target at `cam.x` — so
   * its WORLD position is meaningless and only this offset decides which way
   * shadows fall.
   *
   * Named because more than the light reads it: the painted shadows under
   * the letter cards are displaced by the same vector, so every shadow in the
   * scene, cast and painted alike, is thrown by one sun. It used to be typed
   * in two places as two different numbers — the light was set up at -18 and
   * then moved to -8 on the first frame — so anything derived from the
   * written-down value was derived from a position the sun never occupies.
   */
  /**
   * WHAT HOUR THE WORLD IS STAGED AT, or null to read the clock.
   *
   * Set from the kids settings — "Time of day: auto" reads the clock, and a
   * chosen time pins it. Held here rather than baked in at build so changing
   * it does not cost a world rebuild: `setHour` restages the light in place.
   */
  let hourPref: number | null = null;
  const SUN_DAY = new THREE.Vector3(...(theme.sunAt ?? [-8, 30, 7]));
  /**
   * AND WHERE THE MOON STANDS, which is not where the sun stood.
   *
   * The night light is the same `DirectionalLight` re-coloured, so before
   * this every shadow after dark fell exactly where it had at noon — the
   * same length, the same way, thrown by a light that had supposedly set.
   * On a road whose whole night is about what the lamps reach, that is the
   * detail that says none of it is real.
   *
   * Over the other shoulder and steeper: 30 of height against 15 of run is
   * about 63 degrees, so moonlight drops shadows close under what casts them
   * instead of stretching them up the road the way the eight o'clock sun
   * does. Shorter, softer, and from the other side — three things the eye
   * reads instantly without being able to say why.
   */
  const SUN_NIGHT = new THREE.Vector3(15, 30, -9);
  /** Where the light actually is: eased between the two by `nightBlend`. */
  const SUN_AT = SUN_DAY.clone();
  /** The hours this world is currently lit for. Day, and its night twin. */
  let stagedAt = stagedHours();
  /**
   * Point the sun and the moon at the staged hour.
   *
   * Called at build and again whenever the setting changes. Worlds that are
   * not `clockLit` keep the fixed rig their theme names and this does
   * nothing at all to them.
   */
  function restageSun(): void {
    if (theme.clockLit !== true) {
      return;
    }
    stagedAt =
      hourPref == null
        ? stagedHours()
        : { day: hourPref, night: (hourPref + 12) % 24 };
    SUN_DAY.copy(sunAtHour(stagedAt.day, false));
    SUN_NIGHT.copy(sunAtHour(stagedAt.night, true));
    // And the live vector with it. `SUN_AT` is cloned from `SUN_DAY` before
    // this ever runs, so without this the FIRST frame is lit by the theme's
    // fallback rig rather than by the staged hour — which matters more now
    // that the loading screen waits for the staging before it hands over: the
    // one frame it was wrong for was the opening shot.
    // `SUN_DAY` unconditionally, and NOT `nightNow ? … : …`: this function
    // runs during the build, thousands of lines before `nightNow` is
    // declared, and reading a `let` from its temporal dead zone throws —
    // which TypeScript cannot see from inside a function body and which
    // would have taken the whole world build down at load. The tick re-lerps
    // this every frame by `nightBlend` anyway, so a world staged at night is
    // right one frame later; all this has to be correct for is the first.
    SUN_AT.copy(SUN_DAY);
    fitShadowCamera();
  }
  /**
   * GROW THE SHADOW BOX WHEN THE SUN IS LOW.
   *
   * Shadow length is the caster's height over the tangent of the elevation,
   * so it runs away fast at the ends of the day: the tallest thing on this
   * road is an 11.5-unit banyan, which throws 21 units at eight in the
   * morning and NINETY-ONE at half past six. The fixed box reached 45 behind
   * and 70 ahead, so a dawn shadow was simply cut off in the middle of the
   * road — the one hour where the shadows are the whole picture.
   *
   * Fitted to whichever rig throws further, and only when the hour changes,
   * so it costs nothing per frame. The map does not grow with it, so a dawn
   * shadow is drawn at about half the texels per unit that a midday one gets
   * — which is the right way round: it is enormous, soft-edged and low
   * contrast, and nobody can see the resolution in it.
   */
  function fitShadowCamera(): void {
    const TALL = 11.5;
    const reachOf = (v: THREE.Vector3) =>
      TALL / Math.tan(Math.atan2(v.y, Math.hypot(v.x, v.z)));
    const reach = Math.min(
      130,
      Math.max(reachOf(SUN_DAY), reachOf(SUN_NIGHT)) + 24,
    );
    // SYMMETRIC, because the sun crosses. The box used to reach 45 behind and
    // 70 ahead, which was right while the light was pinned on one side of the
    // road: shadows only ever fell one way, so there was no reason to pay for
    // ground on the other. The sun now walks from east to west over the day
    // and the moon does the same over the night, so shadows fall BOTH ways
    // and half the box was on the wrong side of the child every morning.
    const half = Math.max(70, reach);
    const c = sun.shadow.camera;
    c.left = -half;
    c.right = half;
    c.top = Math.max(52, reach * 0.72);
    c.bottom = -Math.max(52, reach * 0.72);
    c.updateProjectionMatrix();
  }
  restageSun();
  // HIGH, because it is meant to be midday.
  //
  // z was 18 against a height of 30, which is a sun about thirty degrees off
  // the horizon in that axis — and a ten-unit palm throws its canopy SIX
  // UNITS back from its own trunk at that angle. The shadow is in the
  // geometrically correct place and looks like a separate object lying on
  // the grass, because the only thing that would join it to the tree is the
  // trunk's own shadow, which is thin and mostly hidden behind the trunk
  // itself. That is the "shadows not linked to the tree bottom".
  //
  // At 7 the same canopy lands about two units back — close enough that the
  // blob reads as belonging to the tree standing in it, which is also what a
  // midday sun actually does. Kept off zero on purpose: a sun directly
  // overhead gives every object a shadow exactly its own shape underneath
  // it, and the scene loses all its modelling.
  sun.position.copy(SUN_AT);
  /**
   * TONIGHT'S MOON, read once when the world is built.
   *
   * Once, and not per frame: it moves by three per cent of a cycle in an
   * evening, which is nothing, and a light that recomputed it every frame
   * would be spending a cosine to model something slower than the session.
   */
  const moonNow = moonLit();
  /**
   * TODAY'S CLOUD COVER, 0 clear to 1 overcast, drawn once per world.
   *
   * One number, and everything about the weather reads it — which is the
   * whole point. Cover decided separately from the light, or from the haze,
   * or from how hard the sun dims when something crosses it, gives you dark
   * clouds over a gold-lit road: each part defensible on its own and the
   * picture incoherent. A real sky does not work that way, so this does not
   * either.
   *
   * Biased towards the middle rather than uniform. A flat random would make
   * one day in five a flawless blue and one in five a slab of grey, and
   * neither is what most days are: the common case, in Kerala as anywhere, is
   * some cloud about. Averaging two draws gives that shape for nothing.
   *
   * Drawn from the DATE, not from `Math.random`, so a child who reloads at
   * ten in the morning gets the same weather they had at nine. Weather that
   * reshuffles on every refresh is not weather, it is noise — the same
   * reasoning that keeps the stars and the moon on the real calendar.
   */
  const cloudCover = (() => {
    const d = new Date();
    const day = Math.floor(d.getTime() / 86400000);
    // Two cheap uncorrelated hashes of the day, averaged.
    const h = (n: number) => {
      const x = Math.sin(day * 12.9898 + n * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return (h(1) + h(2)) / 2;
  })();
  /**
   * How grey the day is, 0..1 — cover past the point where it starts to
   * matter. A quarter of the sky in cloud changes nothing you can see; it is
   * the last half that flattens the light and drains the colour out.
   */
  const overcast = Math.max(0, (cloudCover - 0.45) / 0.55);
  sun.castShadow = true;
  // BIG ENOUGH TO COVER WHAT IS ON SCREEN.
  //
  // A directional light only shadows what falls inside its own orthographic
  // box, and anything outside simply casts nothing — no warning, no error, it
  // is just missing. The box was 80 by 60 while the camera sees roughly 115
  // along the road and 100 across it, so the palms at the back of the frame
  // and the buffalo out in the field were beyond it: a scene where some trees
  // had shadows and some had none, which reads as the ones without being
  // unattached to the ground.
  //
  // The map grows with the box so the shadows do not get coarser as the box
  // gets bigger. 3072 over 115 units is 26.7 texels per unit, which is what
  // 2048 over 80 was — same sharpness, more ground.
  sun.shadow.mapSize.set(3072, 3072);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 52;
  sun.shadow.camera.bottom = -52;
  // A hair of normal bias, which is what stops a shadow detaching from the
  // thing casting it: without any, a curved surface self-shadows in bands and
  // the usual cure — a depth bias — is what slides a shadow away from its own
  // trunk. Normal bias offsets along the surface normal instead, so contact
  // stays put.
  sun.shadow.normalBias = 0.035;
  // See theme.shadowSoft. Zero leaves the hard PCF edge every other world has.
  sun.shadow.radius = theme.shadowSoft ?? 1;
  const hemi = new THREE.HemisphereLight(0xffffff, land.grass, grade.hemi);
  /**
   * What the sun and the sky fill are set to before cloud is taken off them.
   *
   * The drift in the tick is a MULTIPLIER, so it needs the un-drifted value
   * to multiply — reading back what it wrote last frame would compound, and a
   * scene that dims a per cent per frame goes black in twenty seconds.
   */
  let sunBase = grade.sun;
  let hemiBase = grade.hemi;
  /**
   * WHAT THE KEY LIGHT IS ACTUALLY AT, as opposed to what it is heading for.
   *
   * `applySky` sets `sunBase`/`hemiBase` to the values the new sky wants and
   * it sets them in ONE FRAME. Everything else about nightfall is a blend:
   * the mist, the stars, the cast cross-fade, the flame coming up in the
   * milestone's niche, all of it eased over `nightBlend`. The world's key
   * light was the one thing that snapped — so at the flip the whole road
   * changed exposure at once, from nothing the child can see, and the lamp
   * they were meant to read as the CAUSE lit up a second later.
   *
   * These ease toward the base at the same rate the night blend runs, so the
   * sky dims as the lamp comes up rather than before it.
   */
  let sunLit = sunBase;
  let hemiLit = hemiBase;
  /** False until the first sky is applied, which snaps rather than eases. */
  let skySettled = false;
  /**
   * WHAT THE SKY IS HEADING FOR, as opposed to what it is showing.
   *
   * `applySky` computes a whole look in one pass — sun colour, the two
   * hemisphere colours, fog, exposure and the two scene intensities — and it
   * used to write every one of them straight onto the scene. Which meant that
   * however carefully the rest of nightfall was blended, the moment the flag
   * flipped the world CHANGED COLOUR in a single frame and then spent the
   * next second and a half easing the brightness of a light that was already
   * the wrong colour.
   *
   * So the function still computes exactly as it did, and what it produces is
   * captured here and rolled back off the scene; the tick walks the live
   * values across. Capturing the result rather than refactoring the function
   * into a "spec" is deliberate — it branches four ways on world, mood,
   * twilight and sky type, and every one of those branches would have had to
   * be rewritten to return instead of assign.
   */
  const blankLook = () => ({
    sun: new THREE.Color(),
    hemi: new THREE.Color(),
    ground: new THREE.Color(),
    fog: new THREE.Color(),
    exposure: 1,
    env: 1,
    bg: 1,
    /** The flat backdrop's two gradient stops, and how far the stars are out. */
    top: new THREE.Color(),
    bottom: new THREE.Color(),
    stars: 0,
  });
  const skyNow = blankLook();
  const skyTo = blankLook();
  type SkyLook = typeof skyNow;
  /**
   * THE LIVE STATE OF THE FLAT BACKDROP.
   *
   * The other seven values in a `SkyLook` are properties of something in the
   * scene, so `readSky` can ask the scene what they are. The backdrop's two
   * gradient stops are not: they are baked into a canvas the moment they are
   * chosen, and a texture cannot be asked what colours drew it. So the flat
   * sky keeps its own live copy here, and it is a full member of the look —
   * captured, rolled back and walked across exactly like the fog colour.
   *
   * This is what stopped the flat worlds from blending at all. `applySky`
   * used to build the canvas and RETURN from inside the flat branch, before
   * the capture at the end of the function — so the backdrop, the fog and the
   * key light's colour all changed in the frame the toggle was pressed, and
   * `skyTo` was left holding the black it was constructed with. Every one of
   * this page's three worlds uses the flat sky.
   */
  const flatSky = {
    top: new THREE.Color(),
    bottom: new THREE.Color(),
    stars: 0,
  };
  /** Redraw the backdrop only when it has actually moved. See `drawFlatSky`. */
  let flatDrawn = { top: -1, bottom: -1, stars: -1 };
  const readSky = (into: SkyLook): SkyLook => {
    into.sun.copy(sun.color);
    into.hemi.copy(hemi.color);
    into.ground.copy(hemi.groundColor);
    into.fog.copy((scene.fog as THREE.Fog).color);
    into.exposure = renderer.toneMappingExposure;
    into.env = scene.environmentIntensity;
    into.bg = scene.backgroundIntensity;
    into.top.copy(flatSky.top);
    into.bottom.copy(flatSky.bottom);
    into.stars = flatSky.stars;
    return into;
  };
  const writeSky = (from: SkyLook): void => {
    sun.color.copy(from.sun);
    hemi.color.copy(from.hemi);
    hemi.groundColor.copy(from.ground);
    (scene.fog as THREE.Fog).color.copy(from.fog);
    renderer.toneMappingExposure = from.exposure;
    scene.environmentIntensity = from.env;
    scene.backgroundIntensity = from.bg;
    flatSky.top.copy(from.top);
    flatSky.bottom.copy(from.bottom);
    flatSky.stars = from.stars;
  };
  /** The hero lamp's night value before any milestone boost. See the tick. */
  let heroLampBase = 0;
  /** Cloud only crosses the sun in daylight; after dark there is no sun. */
  let driftLit = true;
  const HERO_LIGHT_LAYER = 1;
  // 5.2, NOT 3.4.
  //
  // The hero stands 4.7 units tall and the lamp rides just above and in front
  // of her, so a 3.4 range with quadratic decay had almost nothing left by
  // the time it reached her face -- and beside a milestone, whose oil lamp is
  // a 46-unit flood at twice this intensity, the little she had was simply
  // washed out. The reach is what was wrong, not the brightness: a lamp you
  // carry should light YOU first.
  // 5.2, not 3.4. She stands 4.7 units tall and the lamp rides just above
  // and in front of her, so at 3.4 with quadratic decay there was almost
  // nothing left by the time it reached her face.
  const heroLamp = new THREE.PointLight(0xfff0d0, 0, 5.2, 2);
  heroLamp.layers.set(HERO_LIGHT_LAYER);
  heroLamp.position.set(-6, 4, 3);
  /**
   * The companion's own lamp, identical to the hero's.
   *
   * Not the hero's lamp reaching further. That one carries a 3.4 range, and
   * the companion stands 2.6 back and 1.9 across — about 3.65 out, just past
   * the edge — so widening it enough to catch the companion would also light
   * a stretch of trail either side of the player and lose the pool-of-light
   * look the range was chosen for.
   *
   * Its own layer as well as its own light, so the two lamps cannot both fall
   * on the same character: each child is lit once, by their own.
   */
  const COMPANION_LIGHT_LAYER = 2;
  // A LITTLE FURTHER THAN THE HERO'S, because it lights a group rather than
  // a person: hung over the middle of two people walking a couple of units
  // apart, 3.4 left the one at the back on the edge of the pool.
  // Raised with the hero's, and by the same reasoning -- see above.
  // Raised with the hero's, by the same reasoning.
  const companionLamp = new THREE.PointLight(0xfff0d0, 0, 6.2, 2);
  companionLamp.layers.set(COMPANION_LIGHT_LAYER);
  companionLamp.position.set(-6, 4, 3);
  scene.add(sun, hemi, heroLamp, companionLamp);
  // The cube world fogs in nearer so the ground dissolves into the flat sky
  // at the horizon — no hard grass/sky seam.
  scene.fog = bright
    ? // 100, not 120. THE GROUND'S FAR EDGE IS A DIAGONAL and cannot be
      // made otherwise: it is a straight line in world space, and this view
      // is yawed twelve degrees, so it projects across the screen at an
      // angle while the painted horizon is level. They meet along one line
      // and open a wedge of sky everywhere else.
      //
      // The edge does not have to be level, though — it has to be INVISIBLE,
      // and fog does that regardless of which way it runs. Saturating at 100
      // instead of 120 hides it before it can be seen, which is what lets
      // the camera pitch down far enough to see the children on the road.
      new THREE.Fog(land.fog, 38, 96)
    : new THREE.Fog(land.fog, 60, 160);

  const V = theme.view ?? DEFAULT_VIEW;
  const cam = new THREE.OrthographicCamera();
  // A way in, for measuring. Off unless the URL asks for it, so it costs a
  // string compare once per world and nothing at all in normal play.
  if (
    typeof window !== "undefined" &&
    window.location.search.includes("perf")
  ) {
    const _w = window as unknown as Record<string, unknown>;
    _w.__builds = ((_w.__builds as number) ?? 0) + 1;
    _w.__buildAt = ((_w.__buildAt as number[]) ?? []).concat(
      Math.round(performance.now()),
    );
    (window as unknown as Record<string, unknown>).__world = {
      scene,
      cam,
      renderer,
      sun,
      THREE,
    };
  }
  cam.layers.enable(HERO_LIGHT_LAYER);
  cam.layers.enable(COMPANION_LIGHT_LAYER);
  /**
   * The pane height this world was framed for. Set from the first real
   * measurement, so the view at load is exactly what it has always been and
   * only a RESIZE is compensated for.
   */
  let refH = 0;
  function resize() {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 300;
    const a = w / h;
    // KEEP THE SCENE THE SAME SIZE WHEN THE WINDOW CHANGES SHAPE.
    //
    // The frustum was a constant, so the same 27 world units were mapped onto
    // however many pixels the pane happened to have. Shorten the pane and
    // everything in it shrinks -- the road "reads as zoomed out", which is
    // exactly what the note on `.sceneCard` warns about. Widen it and the
    // view gains ground sideways while the vertical framing stays put, so the
    // two axes disagree about what a metre is.
    //
    // Scaling the frustum with the pane's height fixes both: world units per
    // pixel stay constant, so the boy is the same size on a short window as a
    // tall one, and a wider window simply sees further along the road at the
    // same scale -- which is what a window onto a place should do.
    //
    // Clamped, because the compensation must not run away: on a very short
    // pane holding the scale exactly would crop the character, and the floor
    // trades a little zoom-out for keeping him in frame.
    if (refH === 0 && h > 320) {
      refH = h;
    }
    const k = refH > 0 ? Math.min(1.3, Math.max(0.72, h / refH)) : 1;
    frustumK = k;
    frustumA = a;
    applyFrustum();
    renderer.setSize(w, h, false);
  }
  /**
   * STANDING BACK TO TAKE THE VILLAGE IN.
   *
   * This camera is ORTHOGRAPHIC, and that is the whole reason this exists: a
   * building does not get smaller by being further away, so there is no
   * distance at which a real house fits a frame too short for it. The frame
   * shows 9.8 units above the look-at point. A house measured honestly
   * against the child is 14 to the ridge and the temple is 20, so the only
   * two ways to have both were to keep building a village out of dollhouses —
   * which is what it was, a house exactly as tall as the nine-year-old
   * standing in front of it — or to widen the view when there is something
   * worth widening it for.
   *
   * So the road keeps its framing and the village borrows a wider one, eased
   * over a second and a half as the child walks in and handed back as they
   * walk out. It reads as the thing a person does on arriving somewhere:
   * stop, and take it in.
   */
  let frustumK = 1;
  let frustumA = 2;
  /** 0 on the open road, 1 in the middle of a village; eased in the tick. */
  let villageWide = 0;
  // Half again as wide. With the market gone and the shrine brought down to
  // 11, the tallest built thing is a 14-unit house, so the view only has to
  // open enough to clear a roof — not enough to make the children small.
  const VILLAGE_WIDEN = 0.5;
  function applyFrustum(): void {
    const S = V.frustum * frustumK * (1 + villageWide * VILLAGE_WIDEN);
    cam.left = -S * frustumA;
    cam.right = S * frustumA;
    // The frustum reaches further below the look-at point than above it, so
    // the trail (and the runner) sit clear of the floating words bar.
    cam.top = S * V.topF;
    cam.bottom = -S * V.botF;
    cam.near = -100;
    // 420, not 300. The painted horizon sat a hundredth of a clip unit past
    // the old far plane and was silently discarded; the volume now has room
    // for anything that wants to stand behind the world rather than in it.
    cam.far = 420;
    cam.updateProjectionMatrix();
  }
  resize();
  cam.position.set(-(V.camX ?? 10), V.camY, V.camZ);
  cam.lookAt(0, V.lookY, 0);

  // ── sky ────────────────────────────────────────────────────────────────
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rgbe = new RGBELoader();

  /**
   * THE FLAT BACKDROP, DRAWN ONCE AND REPAINTED AS IT MOVES.
   *
   * A 2D gradient sky on a canvas texture — no orbiting camera means no
   * skybox is needed, and a flat backdrop suits the stylized world.
   *
   * It used to be a NEW canvas and a NEW `CanvasTexture` per sky change, with
   * the old one disposed, which is why the sky could only ever cut: you
   * cannot cross-fade between two textures by replacing one with the other.
   * One texture is built here and kept for the life of the world, and
   * nightfall repaints its two gradient stops a frame at a time from the
   * eased `flatSky` — so the backdrop crosses from blue to navy over the same
   * four and a half seconds the lights, the fog and the mist take.
   *
   * FIVE HUNDRED AND TWELVE WIDE, ALWAYS. A gradient needs sixteen pixels and
   * the day sky used to get sixteen — but the stars are drawn on the same
   * canvas now, and a star on a strip sixteen across, stretched over the
   * whole sky, comes out as a horizontal streak.
   */
  // 1024x512, NOT 512x256. The stars are drawn as circles in canvas pixels
  // and the whole canvas is then stretched across the sky, so their size on
  // screen is set by how coarse this is: at 512 a "0.6 pixel" star came out
  // as a visible blob. Doubling the grid halves the angular size of every
  // dot without changing a single radius below. The gradient does not care,
  // and the redraw only runs while the sky is actually crossing.
  const SKY_W = 1024;
  const SKY_H = 512;
  // The ends of the flat sky's palette, allocated once. `applySky` runs on
  // every hour change and every toggle, and a `new THREE.Color` per stop per
  // call is garbage for a value that never varies.
  /** Where the day sky goes as the sun drops: amber overhead, fire at the treeline. */
  const SKY_DAWN_TOP = new THREE.Color(0x6fa8d8);
  const SKY_DAWN_LOW = new THREE.Color(0xffc98a);
  /** And at the top of the arc: haze back in, contrast off. */
  const SKY_NOON_TOP = new THREE.Color(0xa8d8f5);
  const SKY_NOON_LOW = new THREE.Color(0xeaf3e2);
  /** A full moon's milk, and the silver it puts on the light. */
  const SKY_MOONHAZE = new THREE.Color(0x54648f);
  const SKY_MOON_SILVER = new THREE.Color(0xb9c2e0);
  /** The day sun's two ends: deep amber low, a whisper of cream at noon. */
  const SKY_SUN_AMBER = new THREE.Color(0xff9a43);
  const SKY_SUN_CREAM = new THREE.Color(0xfff0d4);
  /** What the distance fades into by day — the old sky-bottom green. */
  const FOG_HAZE_DAY = new THREE.Color(0xd7f0d2);
  /** Where the haze goes when the sun is low: the light has further to travel. */
  const HAZE_LOW_SUN = new THREE.Color(0xf2cf9e);
  /** And at the top of the arc, when it is mostly clean air overhead. */
  const HAZE_NOON = new THREE.Color(0xd3e6ef);
  /** And under cloud, when nothing is colouring it at all. */
  const HAZE_OVERCAST = new THREE.Color(0xc3c9c6);
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = SKY_W;
  skyCanvas.height = SKY_H;
  const skyCtx = skyCanvas.getContext("2d")!;
  /**
   * THE STARS, PAINTED ONCE ONTO THEIR OWN TRANSPARENT LAYER.
   *
   * They used to be scattered afresh inside every `applySky`, which was fine
   * while a sky change was a single hard cut and is not fine now: repainting
   * the backdrop sixty times a second would re-roll all two hundred and
   * twenty of them every frame and the night would arrive as static. Rolled
   * once, then composited at whatever alpha the crossing has reached, so they
   * come out of the blue where they stand.
   *
   * Not scattered evenly over the whole sky either: the bottom of the
   * gradient is the haze just above the treeline, where in life the
   * atmosphere has already put out everything but the brightest few. Stars
   * painted down into it read as dust on the lens.
   */
  const starCanvas = document.createElement("canvas");
  starCanvas.width = SKY_W;
  starCanvas.height = SKY_H;
  {
    const g = starCanvas.getContext("2d")!;
    for (let i = 0; i < 260; i++) {
      // A third of the way down, in canvas terms, and stopping short of the
      // haze above the treeline.
      const y = Math.pow(Math.random(), 1.7) * SKY_H * 0.66;
      // Fainter as they near the horizon, and never quite white: a warm white
      // star on a blue sky is what the eye expects, and pure white on this
      // background reads as a hole in it.
      const a = (0.25 + Math.random() * 0.6) * (1 - y / (SKY_H * 0.82));
      // Unchanged numbers on a grid twice as fine, which is the whole point:
      // the same radii are now half the size in the sky.
      const r = Math.random() < 0.86 ? 0.6 : 1.1;
      g.fillStyle = `rgba(255,251,236,${a.toFixed(3)})`;
      g.beginPath();
      g.arc(Math.random() * SKY_W, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  const _moonDir = new THREE.Vector3();
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;

  /**
   * Repaint the backdrop from `flatSky`, if it has moved since the last one.
   *
   * Called from the tick, so the guard is what keeps it honest: a 512×256
   * fill plus one composite is cheap, but it is not free, and for all but the
   * few seconds of a crossing the sky is standing still. Comparing the packed
   * hex rather than the components is exact and is one number each.
   */
  function drawFlatSky(): void {
    const top = flatSky.top.getHex();
    const bottom = flatSky.bottom.getHex();
    const stars = flatSky.stars;
    if (
      top === flatDrawn.top &&
      bottom === flatDrawn.bottom &&
      Math.abs(stars - flatDrawn.stars) < 0.002
    ) {
      return;
    }
    flatDrawn = { top, bottom, stars };
    const grad = skyCtx.createLinearGradient(0, 0, 0, SKY_H);
    grad.addColorStop(0, `#${flatSky.top.getHexString()}`);
    grad.addColorStop(1, `#${flatSky.bottom.getHexString()}`);
    skyCtx.globalAlpha = 1;
    skyCtx.fillStyle = grad;
    skyCtx.fillRect(0, 0, SKY_W, SKY_H);
    if (stars > 0.002) {
      skyCtx.globalAlpha = Math.min(1, stars);
      skyCtx.drawImage(starCanvas, 0, 0);
      skyCtx.globalAlpha = 1;
      drawMoon(Math.min(1, stars));
    }
    skyTexture.needsUpdate = true;
  }

  /**
   * THE MOON, WHICH HAS NEVER ACTUALLY BEEN IN THE SKY.
   *
   * Its phase and its position have been modelled for a long time —
   * `moonLit()` gives tonight's lit fraction and `SUN_NIGHT` is the direction
   * it hangs in, solved from the staged hour and used to light the whole
   * road — but nothing ever DREW it. `moonLit`'s own note says as much: "what
   * this is for is the DARKNESS". So on a clear night a child could see the
   * road silver over and the shadows swing, and find nothing in the sky to
   * explain it.
   *
   * Drawn into the sky canvas rather than as an object in the world, for the
   * same reason the stars are: the backdrop is a screen-space quad, so the
   * canvas IS the screen and placing it is a projection rather than a piece
   * of scenery to light, cull and dispose.
   *
   * WHERE it goes is `SUN_NIGHT` and nothing else — the same vector that
   * aims the key light, so the moon is always on the side the shadows say it
   * is. If it has moved off screen, that is the hour: at ten at night in
   * October it rides high, at four in the morning it has set, and the road
   * is dark because there is nothing up there.
   */
  function drawMoon(alpha: number): void {
    if (moonNow < 0.04) {
      return; // new moon: there IS nothing to draw
    }
    _moonDir.copy(SUN_NIGHT).normalize().multiplyScalar(240).add(cam.position);
    _moonDir.project(cam);
    if (Math.abs(_moonDir.x) > 1.08 || Math.abs(_moonDir.y) > 1.08) {
      return; // below the horizon or off the side — see the note above
    }
    const mx = (_moonDir.x * 0.5 + 0.5) * SKY_W;
    const my = (1 - (_moonDir.y * 0.5 + 0.5)) * SKY_H;
    const r = SKY_H * 0.038;
    skyCtx.save();
    skyCtx.globalAlpha = alpha;
    // A halo first, so it sits IN the sky rather than on it.
    const glow = skyCtx.createRadialGradient(mx, my, r * 0.9, mx, my, r * 3.4);
    glow.addColorStop(0, "rgba(226,232,246,0.34)");
    glow.addColorStop(1, "rgba(226,232,246,0)");
    skyCtx.fillStyle = glow;
    skyCtx.beginPath();
    skyCtx.arc(mx, my, r * 3.4, 0, Math.PI * 2);
    skyCtx.fill();
    // The disc, then the shadow carved out of it.
    skyCtx.fillStyle = "rgba(247,249,255,0.96)";
    skyCtx.beginPath();
    skyCtx.arc(mx, my, r, 0, Math.PI * 2);
    skyCtx.fill();
    if (moonNow < 0.97) {
      // WAXING SHOWS ITS RIGHT SIDE, waning its left — `moonAge` runs 0 at
      // new through 0.5 at full, so the first half of the month is waxing and
      // the shadow is carved from the left. Offsetting a second circle is not
      // the true terminator, which is a half-ellipse, but at this size the
      // difference is under a pixel and the crescent leans the right way,
      // which is the part anybody would notice.
      const waxing = moonAge() < 0.5;
      const dx = (1 - moonNow) * 2 * r * (waxing ? -1 : 1);
      skyCtx.globalCompositeOperation = "destination-out";
      skyCtx.beginPath();
      skyCtx.arc(mx + dx, my, r, 0, Math.PI * 2);
      skyCtx.fill();
    }
    skyCtx.restore();
  }
  async function applySky(mood: string) {
    // Everything this function writes onto the scene is a TARGET, not a
    // value — see `skyNow`. The look it is replacing is held here so it can
    // be put back at the end, leaving the tick to walk across.
    // A REAL COPY, not a spread. `{ ...skyNow }` copies the numbers by value
    // and the four Colors by REFERENCE, so `readSky` on the result would
    // write straight through into `skyNow` — half the snapshot aliased to the
    // thing it was snapshotting and half of it not. It happened to survive,
    // because the tick keeps `skyNow` equal to the scene anyway; it would not
    // have survived the next person to touch it.
    const held = skySettled ? readSky(blankLook()) : null;
    /**
     * Hand the finished look to the tick instead of to the scene.
     *
     * What this function just computed is where the sky is GOING. Read it
     * off, then put the old look back so the tick can cross the gap rather
     * than the scene jumping it. The very first sky of a session is not a
     * transition — there is nothing to cross from — so that one is left
     * standing.
     *
     * BOTH branches end here. The flat branch used to return before it,
     * which left `skyTo` holding the black it was constructed with and every
     * flat world — which is all three of them — cutting between day and
     * night in a single frame.
     */
    const settleSky = (): void => {
      readSky(skyTo);
      if (held != null) {
        writeSky(held);
      } else {
        readSky(skyNow);
      }
    };
    // What "dark" means depends on the world. Hero Trail gets a real night —
    // deep and blue, lit by the lantern. Dino Run gets a dusk: a gentler,
    // warmer dimming, because it is not a night game and the full darkness
    // read as a broken renderer rather than an evening.
    const dark = mood === "night";
    /**
     * HOW LOW THE SUN IS, 0 overhead and 1 on the floor of its arc.
     *
     * Everything the hour changes about the palette hangs off this one
     * number: how gold the light is, how much haze is left in the air, how
     * far the exposure comes down. Taken from the staged vector rather than
     * from the hour, so it is right by construction — the angle and the
     * colour cannot drift apart.
     */
    const rig = dark ? SUN_NIGHT : SUN_DAY;
    const elevNow = Math.atan2(rig.y, Math.hypot(rig.x, rig.z));
    const elevDeg = (elevNow * 180) / Math.PI;
    /**
     * HOW GOLD THE LIGHT IS — and it is a real curve, not a taste.
     *
     * Warmth is an atmosphere effect: it climbs steeply in the last twenty
     * degrees above the horizon and is simply not there higher up. The first
     * version of this ramped gold linearly from noon to dusk, which made
     * NINE IN THE MORNING look like an evening — a golden hour that lasts
     * all day is the thing that makes a scene look filtered rather than lit.
     *
     * At half past six this reaches 0.75 and the road is properly amber; by
     * nine it is under a fifth; past thirty degrees there is none of it.
     */
    const warm =
      theme.clockLit === true
        ? Math.pow(Math.min(1, Math.max(0, (22 - elevDeg) / 22)), 0.7)
        : 0;
    /**
     * AND THE ONLY PLACE THE HONESTY IS BENT: the top of the arc.
     *
     * A true midday is flat, white and hard, which is correct and is the one
     * hour that would look bad — so noon keeps a little cream in the light
     * and comes down a touch in exposure. It is worth being clear how small
     * this is: zero below fifty-two degrees, which is everything before about
     * half past nine, and full only within a few degrees of noon. Midnight
     * gets the same treatment at the top of the moon's arc for the same
     * reason.
     *
     * Everything else — the angle, the length of the shadows, the colour on
     * the way up and down — is left alone.
     */
    const soften =
      theme.clockLit === true
        ? Math.min(1, Math.max(0, (elevDeg - 52) / 22))
        : 0;
    /**
     * NEVER A HARD LIGHT AT THE TOP OF EITHER ARC.
     *
     * The three moments this road can look harsh are the three where the key
     * light is strongest and comes from straight overhead: noon, midnight
     * with the moon high, and a full moon at any height. All of them give a
     * short, hard-edged shadow and a high-contrast picture, which is what a
     * camera sees and not what those hours feel like.
     *
     * So all three get the same treatment — more haze, a little less
     * contrast, and the light carried away from white. It is a deliberate
     * departure from the accuracy everywhere else on this road, and it is
     * confined to the top of the curve: at half past six it is zero, and the
     * long amber light and the thirty-unit shadows are untouched.
     */
    const dreamy = Math.min(
      1,
      dark ? Math.max(soften * 0.7, moonNow * 0.85) : soften,
    );
    /**
     * STYLISED, AND THAT IS THE POINT — it never goes fully harsh.
     *
     * A true midday is flat white with the haze burned off, which is honest
     * and is the one look this road must not have: a child who happens to
     * practise at lunchtime would get the plainest version of the world for
     * no reason they could help. So noon is brighter, crisper and higher
     * contrast than eight in the morning, and still warm — `goldFloor` is
     * how much gold survives at the top of the arc, and it is never zero.
     *
     * The swing that IS real is the shadows. Those come from the angle and
     * are not softened at all: at noon they are tucked under what casts them
     * and at six they are thirty units long. That is where a child reads the
     * hour from, so that is where the honesty belongs.
     */

    const night = dark && trueNight;
    // The twilight lift. Every night value below is written as a blend from
    // the night figure to the dusk figure that sits beside it, so a world
    // that asks for a lighter night gets one that is consistent across the
    // exposure, the lights, the sky and the fog at once — rather than an
    // exposure nudge that leaves the fog the colour of midnight.
    /**
     * HOW MUCH LIGHT THE SUN HAS LEFT IN THE SKY, at the staged night hour.
     *
     * This was a constant per world — a tenth, applied to every hour of every
     * night of the year — so ten at night was lifted towards dusk exactly as
     * much as half past six was, and the road never got properly dark.
     *
     * Twilight is just the sun below the horizon, and how far below is a
     * thing that can be asked. The standard bands: down to six degrees is
     * civil twilight and still plainly light, twelve is nautical, and by
     * eighteen it is night by definition. Squared-ish on the way down,
     * because the glow falls off much faster than the angle does.
     *
     * AND THE MONTHS COME OUT OF IT FOR FREE. Over Kerala the sun sets almost
     * straight down, so twilight is short all year — but not the same: at
     * half past six the sun is three degrees down in June and eleven in
     * January, which is the difference between a lit horizon and a dark one.
     * By eight it is twenty-two to thirty-two degrees down whatever the
     * month, and there is nothing left in the sky at all.
     */
    const twCeil = theme.nightTwilight ?? 0;
    let tw = twCeil;
    if (theme.clockLit === true && dark) {
      const depth =
        (solarAngles(stagedAt.night, new Date()).elev * 180) / Math.PI;
      const band = Math.min(1, Math.max(0, (depth + 18) / 18));
      tw = twCeil * Math.pow(band, 2.2);
    }
    const lerp = (a: number, b: number) => a + (b - a) * tw;
    const mix = (a: number, b: number) =>
      new THREE.Color(a).lerp(new THREE.Color(b), tw);
    // The base, and NOT gated on `night` any more.
    //
    // It used to be `night ? … : 0`, which is a step — the flag flips and the
    // lamp is simply on, in one frame, while the sky, the mist and the flame
    // in the milestone's niche all cross-fade over the next second and a
    // half. A light that snaps on while everything around it fades does not
    // read as a lamp being lit; it reads as something outside the scene being
    // switched on, which is exactly what it was.
    //
    // The tick multiplies this by `nightBlend`, so it comes up with the rest
    // of the night and goes down with it at dawn. Reading back what the tick
    // wrote would compound it a frame at a time, so the un-blended value is
    // kept here.
    heroLampBase = 3.2 * (1 - tw * 0.45);
    heroLamp.intensity = heroLampBase * nightBlend;
    // The companion's lamp is driven in the tick (see companionLamp.position
    // there) — it has to be, because this function runs before a companion
    // exists. Left out here on purpose rather than set to a value that would
    // be wrong for a frame.
    // THE MOON IS APPLIED ONCE, AND NOT HERE.
    //
    // It used to scale the key light, the ambient, the two scene intensities
    // AND the exposure, on the reasoning that each of them is part of how
    // dark a night looks. Every one of those multiplies the others: at the
    // near-new moon of a couple of nights ago the factor was 0.5, and 0.5
    // through the key light times 0.5 through the exposure times 0.5 through
    // the ambient left the road at an eighth of its brightness. It read as
    // broken, because it was — a dark night is not a night with the lights
    // off.
    //
    // The moon is the key light after dark, so the key light is where it
    // belongs, and the ambient gets a much gentler curve of its own (see
    // `moonSky`) because sky glow does not vanish at new moon. Exposure is
    // left out entirely: it is a global multiplier and compounds with
    // everything downstream of it.
    renderer.toneMappingExposure =
      grade.exposure *
      (dark ? (night ? lerp(0.56, 0.84) : 0.84) : 1) *
      // The softening of both peaks — see `dreamy`. Twelve per cent, which
      // is a stop and a bit off the top of the curve: enough to take the
      // glare off noon and a full moon, not enough to read as a grade.
      (1 - dreamy * 0.12);
    // Barely touched by the phase: what fills a moonless night is starlight
    // and the last of the west, and neither of those cares what the moon is
    // doing. Enough to be felt against a full moon, not enough to put the
    // road out.
    const moonSky = 0.8 + 0.15 * moonNow;
    /**
     * TONIGHT'S MOON ON THE KEY LIGHT, for the flat worlds.
     *
     * The HDR branch below carries the moon as `moonGrade`, an absolute
     * multiplier on an absolute intensity. The flat branch cannot use that
     * number: its night figure is already written as a fraction of the day's,
     * and a 0.38-at-new multiplier on top of it would take a moonless road to
     * about a sixth of the light it is meant to have. Which is the mistake
     * `moonGrade`'s own note is about — a dark night is not a night with the
     * lights off.
     *
     * So the same swing, centred on one instead of applied from above: 0.7 at
     * new, 1.25 at full, and about 0.97 at half. A week of evenings is not
     * the same evening seven times, and the road is silver one night and
     * nearly black the next — which is when the oil lamps become the thing a
     * child reads it by, and the whole reason the milestones carry one.
     */
    const moonKey = 0.7 + 0.55 * moonNow;
    hemi.intensity =
      // 0.54, not 0.42 — the sky fill comes up with the key light, so the
      // ground gains where the moon is not reaching rather than only where it
      // is. See the note on `sun.intensity` in the flat-sky branch.
      //
      // And it RISES with cloud, where the key light falls: an overcast sky
      // is one enormous soft source. See the same note.
      grade.hemi *
      (dark ? (night ? lerp(0.54, 0.78) * moonSky : 0.78) : 1) *
      (1 + overcast * 0.3);
    // Remembered so the cloud drift has something to be a fraction OF. The
    // tick multiplies these; it must never accumulate on its own last value.
    hemiBase = hemi.intensity;
    driftLit = !dark;
    // See theme.skyFill: a world that names its own daylight sky gets the
    // warm-sun/cool-sky separation that makes a midday scene read as open air
    // rather than as flat brightness. Everything else keeps plain white.
    const daySky = theme.skyFill ?? 0xffffff;
    if (night) {
      hemi.color.copy(mix(0x4c5da8, 0xbdc4de));
    } else {
      hemi.color.set(dark ? 0xbdc4de : daySky);
    }
    // The ground half of the hemisphere light is what the earth throws back
    // up — the grass colour unless the world names something else, which on
    // a laterite road it should. Night bounces twilight blue instead.
    const dayBounce = theme.bounce ?? land.grass;
    if (night) {
      hemi.groundColor.copy(mix(0x2e3550, dayBounce));
    } else {
      hemi.groundColor.set(dayBounce);
    }
    // The TARGET for the canvas grade. It used to be assigned outright, and
    // `applyLook` writes a CSS filter — so the whole picture lost 48% of its
    // saturation in one frame while the lights it was grading took a second
    // and a half to follow. The tick walks it across; only the first sky of a
    // session, which is not a transition, lands on it directly.
    nightLookTo = night ? 1 : 0;
    if (!skySettled) {
      nightLook = nightLookTo;
      // And the blend with it, so a world OPENED at night opens at night
      // rather than fading up into it behind the loading screen.
      nightBlend = nightLookTo;
    }
    applyLook();
    if (theme.sky === "flat") {
      // The two gradient stops are TARGETS now, written into `flatSky` and
      // walked across by the tick like every other colour in the look — the
      // canvas itself is repainted from them in `drawFlatSky`. See `flatSky`
      // for what this branch used to do instead, and why nightfall was a cut.
      if (night) {
        // A HIGH OR FULL MOON PUTS HAZE IN THE AIR, not glare on the ground:
        // the night goes milky rather than bright. The same `dreamy` that
        // softens noon, doing the same job at the top of the moon's arc.
        flatSky.top
          .copy(mix(0x141a35, 0x5a6a9e))
          .lerp(SKY_MOONHAZE, dreamy * 0.4);
        flatSky.bottom
          .copy(mix(0x2a3358, 0xa9a2c0))
          .lerp(SKY_MOONHAZE, dreamy * 0.5);
      } else if (dark) {
        flatSky.top.set(0x5a6a9e);
        flatSky.bottom.set(0xa9a2c0);
      } else {
        // THE SKY GOES WITH THE HOUR, and it is the same curve the key light
        // is on: `warm` climbs steeply in the last twenty degrees above the
        // horizon and is simply not there higher up, so half past six is a
        // properly amber sky and nine in the morning is not. `dreamy` puts
        // the haze back at the top of the arc so noon is not clinical.
        // The blue goes out of the top of the sky first and furthest — that
        // is where you are looking through the least air and so where the
        // cloud has the most to hide.
        flatSky.top
          .set(0x7ec5f2)
          .lerp(SKY_DAWN_TOP, warm * 0.8)
          .lerp(SKY_NOON_TOP, dreamy * 0.3)
          .lerp(HAZE_OVERCAST, overcast * 0.82);
        // A PALE BLUE, NOT A PALE GREEN. This stop used to be 0xd7f0d2, a
        // washed green chosen so the ground could fade into the sky before
        // there was anything painted on the horizon — which is why a green
        // band sat above the hills and read as ground hanging in the air.
        // The painted treeline does that job now, so the sky is allowed to
        // be sky all the way down to it.
        flatSky.bottom
          .set(0xbcdcf0)
          .lerp(SKY_DAWN_LOW, warm)
          .lerp(SKY_NOON_LOW, dreamy * 0.34)
          .lerp(HAZE_OVERCAST, overcast * 0.7);
      }
      // The stars, and the two things that put them out: twilight still in
      // the sky, and a moon bright enough to wash them off it. Never quite
      // gone at either — a few always survive.
      flatSky.stars = night ? (1 - tw * 0.55) * (1 - moonNow * 0.3) : 0;
      (scene.environment as THREE.Texture | null)?.dispose?.();
      scene.background = skyTexture;
      scene.backgroundBlurriness = 0;
      scene.environment = null;
      scene.environmentIntensity = 1;
      scene.backgroundIntensity = 1;
      // Fog matches the sky's lower band so the ground fades straight into
      // the backdrop — and because it is now COPIED from that band rather
      // than written out again beside it, it goes gold at dusk and milky
      // under a full moon for free, and the two cannot drift apart.
      // The fog keeps the haze colour the ground fades into, which is NOT the
      // sky's bottom stop any more — see that stop's note. They were one value
      // while the ground had to melt into the sky; now the horizon separates
      // them and each can be what it actually is.
      // THE HAZE IS THE SKY, SEEN SIDEWAYS.
      //
      // It was pinned to one washed green — the same colour at six in the
      // morning, at noon and at dusk — which is why the hour never reached
      // the far ground or the hills however much the sky itself changed.
      //
      // Haze is sunlight scattered by the air between you and the thing you
      // are looking at, so it takes the colour of the light doing the
      // scattering. `warm` already measures how low the sun is by its real
      // elevation, which is exactly how much further that light has had to
      // travel, so the same curve that golds the sun golds the distance. At
      // the top of the arc it goes the other way: clean air overhead, a
      // cooler and slightly blue haze. Under cloud it goes neutral, because
      // nothing is colouring it.
      //
      // AND THIS IS THE CHANNEL THAT CARRIES THE HOUR ONTO THE LANDSCAPE.
      // Everything is tinted towards this colour in proportion to its
      // distance — the children 12 per cent, the far trees 52, the ground's
      // far edge 72, the painted hills their own share — so a change here
      // lands on the mountains and the floor and barely touches the child.
      // That falloff IS the "strong far, subtle near" rule; nothing needs to
      // be special-cased to get it.
      if (night) {
        (scene.fog as THREE.Fog).color.copy(flatSky.bottom);
      } else {
        (scene.fog as THREE.Fog).color
          .copy(FOG_HAZE_DAY)
          .lerp(HAZE_NOON, dreamy * 0.55)
          .lerp(HAZE_LOW_SUN, warm * 0.8)
          .lerp(HAZE_OVERCAST, overcast * 0.75);
      }
      // MORE LIGHT ON THE GROUND AFTER DARK. 0.58, not 0.46.
      //
      // The night figure is written as a fraction of the day's, and it was
      // set before the moon's phase was also multiplying into it — on a thin
      // crescent like tonight's `moonKey` takes another quarter off, and the
      // two together left the road darker than a child can read the ground
      // by. This lifts the floor without touching the swing: a full moon is
      // still plainly brighter than a new one.
      // AND THE WEATHER REACHES THE LIGHT, or the haze goes grey under a sun
      // that never noticed. Overcast does two things in life and both are
      // here: the direct sun weakens, because it is coming through cloud, and
      // the sky fill STRENGTHENS, because the whole dome is now a lamp. That
      // second half is what makes an overcast day read as flat rather than
      // simply dark — shadows go soft and shallow instead of black.
      sun.intensity =
        grade.sun *
        (dark ? (night ? lerp(0.58, 0.8) * moonKey : 0.8) : 1) *
        (1 - overcast * 0.45);
      sunBase = sun.intensity;
      if (night) {
        // Moonlight, warmed a touch towards the dusk sun — a tropical
        // evening is not the same blue as a northern midnight — and carried
        // off the hard blue-white towards silver as the moon climbs.
        sun.color
          .copy(mix(0x7f92cc, 0xe8c8a0))
          .lerp(SKY_MOON_SILVER, dreamy * 0.5);
      } else if (dark) {
        sun.color.set(0xe8c8a0);
      } else {
        // THE COLOUR GOES WITH THE ANGLE. A low sun is a gold one — the light
        // is coming through more air — so the land's own sun colour is
        // carried towards amber by `warm`, and at the very top of the arc
        // gets a whisper of cream so noon is not clinical.
        sun.color
          .set(land.sun)
          .lerp(SKY_SUN_AMBER, warm)
          .lerp(SKY_SUN_CREAM, dreamy * 0.34);
      }
      if (!skySettled) {
        // The first sky of a session is not a change, it is the world
        // arriving — so it lands rather than eases, and the backdrop is
        // painted here so the opening frame is already the right colour.
        skySettled = true;
        sunLit = sunBase;
        hemiLit = hemiBase;
        drawFlatSky();
      }
      settleSky();
      return;
    }
    // A dusk keeps the day sky, only dimmed and warmed — the night HDR under
    // a dusk grade looked like a renderer fault, not an evening.
    const skyFile = dark && !night ? land.mood : mood;
    const tex = await rgbe.loadAsync(`${ASSETS}/env/${skyFile}.hdr`);
    if (disposed) {
      // The world was torn down while this HDR was in flight — nothing left
      // to hang it on, so free it here rather than leaving it in the promise
      // closure with no scene reference to ever dispose it.
      tex.dispose();
      return;
    }
    tex.mapping = THREE.EquirectangularReflectionMapping;
    (scene.background as THREE.Texture | null)?.dispose?.();
    (scene.environment as THREE.Texture | null)?.dispose?.();
    scene.background = tex;
    scene.backgroundBlurriness = 0.06;
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    // ── HOW DARK TONIGHT IS, from the real moon ──────────────────────
    //
    // `moonGrade` is 1 at full and about 0.45 at new. Not 0 at new: a moonless
    // road still has stars, the last of the west, and a child who has to be
    // able to see where they are walking. What the swing buys is that a week
    // of evenings is not the same evening seven times — the road is silver
    // one night and nearly black the next, and it is black on the nights the
    // sky outside their window is.
    //
    // The floor is deliberately high enough that new moon is atmospheric
    // rather than a fault report. The lamps are what a child reads the road
    // by then, which is the whole reason the milestones carry one.
    // 1 at full, 0.45 at new. Not 0: a moonless road still has stars, the
    // last of the west, and a child who has to see where they are walking —
    // and on those nights the milestone lamps become the thing they read the
    // road by, which is the whole reason the stones carry one.
    // 0.38 at new, 0.72 at full — and the CEILING is the point as much as the
    // floor. It used to reach 1.0, which is the brightness the night had
    // before there was a moon in it at all: a full moon lit the road as well
    // as a heavily overcast afternoon and the whole scene stopped reading as
    // night. A full moon is bright FOR A NIGHT. It is about a four-hundred-
    // thousandth of sunlight, and the thing that makes it feel bright is that
    // your eyes have adjusted — which a screen cannot reproduce and should
    // not try to.
    const moonGrade = 0.38 + 0.34 * moonNow;
    // The environment and the background are not the moon's doing either —
    // the sky is the sky whatever is hanging in it. See the note on exposure
    // above: these were two more places the same factor was multiplied in.
    scene.environmentIntensity = dark ? (night ? 0.4 : 0.56) : 0.7;
    scene.backgroundIntensity = dark ? (night ? 0.75 : 0.9) : 1.0;
    // And the haze with it: thickest and warmest at the ends of the day,
    // thinnest at noon and never gone. It is the haze rather than the sun
    // that does most of the dreaminess in a Kerala morning.
    (scene.fog as THREE.Fog).color.set(
      night
        ? new THREE.Color(0x2c3560)
            // A high or full moon puts haze in the air rather than glare on
            // the ground: the night goes milky, not bright.
            .lerp(new THREE.Color(0x54648f), dreamy * 0.55)
        : dark
          ? 0x6a7396
          : new THREE.Color(land.fog)
              .lerp(new THREE.Color(0xf6d9a6), warm)
              .lerp(new THREE.Color(0xe8eeda), dreamy * 0.3),
    );
    sun.intensity = dark ? (night ? 1.25 * moonGrade : 1.9) : 2.4;
    sunBase = sun.intensity;
    if (!skySettled) {
      // The first sky of a session is not a change, it is the world
      // arriving. Easing into it would open every session on a visible
      // lighting ramp up from whatever the defaults happened to be.
      skySettled = true;
      sunLit = sunBase;
      hemiLit = hemiBase;
    }
    // THE COLOUR GOES WITH THE ANGLE. A low sun is a gold one — the light is
    // coming through more air — so the land's own sun colour is carried
    // towards gold by `gold`, which never reaches zero. Night is left alone:
    // moonlight is moonlight at any height.
    sun.color.set(
      night
        ? new THREE.Color(0x8fa2d8)
            // Off the hard blue-white and towards a soft silver as it climbs.
            .lerp(new THREE.Color(0xb9c2e0), dreamy * 0.6)
        : dark
          ? 0xe3c49e
          : new THREE.Color(land.sun)
              // Up the arc to a deep amber, and at the very top a whisper of
              // cream so noon is not clinical.
              .lerp(new THREE.Color(0xff9a43), warm)
              .lerp(new THREE.Color(0xfff0d4), dreamy * 0.34),
    );
    settleSky();
  }

  // ── the night itself ───────────────────────────────────────────────────
  //
  // Everything in this section exists only in the hero world and only after
  // dark, and every piece of it obeys the Lost Travellers' rule from
  // night.ts: nothing approaches, nothing chases, nothing is sudden. The
  // atmosphere is carried by the cheapest things in the scene — mist, a moon,
  // pairs of far-off eyes — so it survives being scaled down on a weak
  // machine, and `nightBlend` fades the whole layer in over a couple of
  // seconds so nightfall is an event rather than a switch.
  const nightLayer = new THREE.Group();
  nightLayer.visible = false;
  scene.add(nightLayer);
  let nightBlend = 0; // 0 = day, 1 = full night; eased in tick()
  /**
   * HOW LONG NIGHTFALL TAKES, in seconds.
   *
   * One number for the whole crossing — the blend, the key light and the sky
   * colours all read it, so they cannot drift out of step with each other.
   *
   * It was 1.8, which is about as long as a lamp takes to be lit and far too
   * short for a sky. Sunset is the slowest thing that happens in a day, and
   * the switch reads as a switch at anything under about three seconds. At
   * four and a half a child can watch it happen — which is the point, since
   * it is the one piece of weather on this road they control.
   */
  const NIGHTFALL_S = 4.5;

  type EyePair = {
    readonly group: THREE.Group;
    readonly mats: readonly THREE.SpriteMaterial[];
    readonly phase: number;
    readonly speed: number;
    readonly baseO: number;
  };
  /**
   * A knot of watchers deep in the treeline.
   *
   * Each cluster keeps a fixed offset from wherever the hero is and drifts
   * lazily after them — the watch follows the lanterns down the whole road.
   * Sometimes it is a single pair of eyes, sometimes a huddle of three; all of
   * them stay far back and small, because far away is what they are.
   */
  type EyeCluster = {
    readonly pairs: EyePair[];
    readonly offsetX: number;
    /** How fast this knot keeps up with the hero — far things lag more. */
    readonly followRate: number;
    x: number;
  };
  const eyeClusters: EyeCluster[] = [];
  let fireflies: {
    readonly points: THREE.Points;
    readonly mat: THREE.PointsMaterial;
    readonly base: Float32Array;
    readonly phase: Float32Array;
  } | null = null;
  const mistMats: THREE.ShaderMaterial[] = [];
  const lanternMats: THREE.SpriteMaterial[] = [];

  /**
   * The painted far horizon: a day row of strips and a night one, cross-faded.
   *
   * A row rather than a single plane because the art is 3:1 — see the build.
   */
  const horizonBand: { group: THREE.Group; night: boolean }[] = [];
  /** Where the camera stood when the horizon was built. See the drift. */
  let horizonCamX0 = 0;
  /**
   * HOW MUCH OF THE CHILD'S TRAVEL THE HORIZON KEEPS.
   *
   * It followed the camera exactly, which is what you do with a backdrop and
   * is why it read as painted ON the window rather than as country: walk the
   * whole 260-unit trail and it did not shift by a pixel (measured — two
   * frames either side of a word, identical).
   *
   * Far things do move, just barely. Six per cent means the whole trail
   * drifts it about sixteen units, a hand's width over a session, which is
   * under the threshold of noticing frame to frame and plainly there if you
   * look up after a while. The strips are a cross-faded chain 320 units long,
   * so there is a great deal more country than the drift can ever use.
   */
  const HORIZON_DRIFT = 0.06;
  /**
   * HOW MUCH OF THE FOG THE PAINTED HORIZON TAKES.
   *
   * The scene fog alone cannot settle this: pulling it in far enough to push
   * the band back takes the far trees with it and turns the middle distance
   * to milk, and letting it off enough for the trees leaves the band too
   * present. They sit at nearly the same range, so one number cannot serve
   * both.
   *
   * THIS FADES THE HAZE, NOT THE PICTURE. The obvious dial is opacity, and it
   * is the wrong one — it makes the hills themselves see-through, so the sky
   * shows through the land and the art goes ghostly. What wants easing is the
   * fog laid over the art, so that is what is scaled: the band keeps a full,
   * solid image and receives 0.30 of the haze its distance would otherwise
   * give it.
   *
   * It still darkens with the hour and still shares the trees' colour,
   * because it is the same fog — just less of it.
   */
  const HORIZON_HAZE = 0.3;

  // ══ LAMPLIGHT ════════════════════════════════════════════════════════
  //
  // The village after dark is lit by what the village owns: a wick in oil at
  // every doorway, a pressure lantern over the market stalls, and rows of
  // them at the temple. Nothing here is a "night effect" laid over the
  // scene — each light is a thing somebody in that village lit.
  //
  // Three properties do all the work, and the third is the one that matters:
  //
  //   COLOUR    oil is deep amber and burns towards red at its edge;
  //             a petromax is a mantle, near-white with a cold rim.
  //   REACH     how big the halo is, which is what says how bright it is
  //             in a scene with no exposure cues.
  //   STEADINESS an oil flame moves constantly; a pressure lantern does not.
  //             That difference alone tells you which is which across a
  //             dark field, before you can see either lamp.
  //
  // The flicker is two sine waves at an irrational-ish ratio so it never
  // finds a beat. A single sine reads as a pulse — a machine, not a flame —
  // and a random walk reads as a fault.
  type Lamp = {
    readonly mat: THREE.SpriteMaterial;
    readonly peak: number;
    readonly phase: number;
    readonly rate: number;
    /** 0 = a mantle that does not move, 1 = a wick in the open air. */
    readonly wick: number;
    /** A point light, or a cone where the lamp only throws one way. */
    readonly light: THREE.PointLight | THREE.SpotLight | null;
    readonly lightPeak: number;
  };
  const lamps: Lamp[] = [];
  /**
   * HOW MANY REAL LIGHTS THE LAMPS MAY HAVE, of both kinds together.
   *
   * This is a hard budget, not a guideline. A three.js material's fragment
   * shader loops over every light in the scene, so the eighth lamp costs
   * every pixel of the world, not just the pixels near it — and the first
   * version of the pool below simply added its eight on TOP of this number
   * and froze the renderer outright. Anything that wants a real light takes
   * one from here.
   */
  const LAMP_LIGHTS = 8;
  /**
   * Of that budget, the ones reserved as aimed cones for roadside lamps.
   *
   * TWO, and built before the first frame — see the pool below. Two is what
   * the road can actually show: the lamps stand at the milestones, the
   * milestones are 26 units apart and the camera frustum is 14, so a third
   * lit cone has never been in shot.
   */
  const AIMED_LIGHTS = 2;
  /** What is left for the plain point lamps: houses, market, temple. */
  let lampLightBudget = LAMP_LIGHTS - AIMED_LIGHTS;
  /**
   * EVERY ROADSIDE LIGHT, BUILT BEFORE THE FIRST FRAME.
   *
   * This is the fix for the world locking up as the child reached a
   * milestone, and the cause is not the milestone at all.
   *
   * three.js compiles a material's shader against the exact number of lights
   * of each type in the scene. Change that number — add one spot light to a
   * scene that had none — and the lighting hash changes, so EVERY material in
   * the world is invalidated and recompiled: the ground, the road, the tiles,
   * every scattered prop, every character. Several hundred programs, on the
   * main thread, in one frame. That is the freeze.
   *
   * It happened at the milestone because that is where the lamps are now
   * planted: the vazhivilakku was the first spot light the scene had ever
   * seen, and it was being created on the frame the child arrived.
   *
   * So the lights are made HERE, while the world is still loading and a
   * stall costs nothing. They sit at zero intensity until a lamp claims one,
   * and the count never changes again for the life of the world. Nothing is
   * added and nothing is removed, so nothing recompiles.
   *
   * THEY COME OUT OF THE LAMP BUDGET, they are not added to it. The first
   * version of this made eight of them in every world on top of the eight
   * plain lamp lights that already existed — sixteen lights in a fragment
   * shader that loops over all of them — and what it bought in load time it
   * gave back many times over in frame time: the renderer stopped responding
   * altogether. A pre-allocated light is only free if it replaces one that
   * was going to be allocated anyway.
   */
  /**
   * Where every aimed lamp stands, so the cones can be lent to the nearest.
   *
   * Each carries its OWN guttering — the phase and rate of its particular
   * flame. When the aimed lamps stopped owning a light and started borrowing
   * one, the flicker was left behind in the loop over `lamps`, which only
   * touches lights a lamp owns: the sprite went on dancing and the pool of
   * light on the road went flat and electric. A borrowed light has to gutter
   * as the lamp it is standing in, not as the pool it came from.
   */
  const aimed: {
    x: number;
    y: number;
    z: number;
    aim: THREE.Vector3;
    phase: number;
    rate: number;
  }[] = [];
  /**
   * WHERE THE LIGHT ON SOMEBODY IS COMING FROM, AFTER DARK.
   *
   * The personal lamps that light the cast are hung just above and in front
   * of whoever they follow, which is right in the middle of a stretch: there
   * is nothing else burning out there, and the alternative is a child walking
   * an unlit road as a silhouette.
   *
   * It is wrong the moment they come up to a milestone. There IS a light
   * then, it is in the niche, and it is off to one side and below head
   * height — so a runner lit from above and in front while standing beside a
   * lamp is lit by nothing that exists, and the one place a child can see
   * exactly where the light is coming from is the one place we contradict it.
   *
   * So the lamp slides. Far from a stone it sits where it always did; coming
   * up to one it eases across to that stone's flame, which puts the light on
   * the side the stone is on, throws the far side of the face into shadow,
   * and follows them round as they pass it. Blended rather than switched, or
   * the cast would flip their shading on one frame.
   *
   * `into` is the default follow-position and is moved IN PLACE to where the
   * light should actually be. What comes back is how much of that light is
   * the milestone's, 0 to 1 — the caller uses it to brighten, because a child
   * standing at a lit stone should be easier to see than one out on the dark
   * road between two of them, and moving the lamp without turning it up only
   * changes which side of them is dark.
   */
  function lampFrom(into: THREE.Vector3, at: THREE.Vector3): number {
    if (aimed.length === 0 || nightBlend <= 0.001) {
      return 0;
    }
    let best: (typeof aimed)[number] | null = null;
    let bestD = Infinity;
    for (const a of aimed) {
      // In x, like everything else that asks "am I level with that stone":
      // the stones stand on the far verge and the cast walk the near one, so
      // a straight-line distance never drops low enough to mean anything.
      const d = Math.abs(a.x - at.x);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    // Within about a stone's own width of it the flame owns the lighting
    // entirely; from there it eases out over the next few paces.
    const NEAR = 3.2;
    const FAR = 9;
    if (best == null || bestD >= FAR) {
      return 0;
    }
    const k = bestD <= NEAR ? 1 : 1 - (bestD - NEAR) / (FAR - NEAR);
    // Smoothstepped, so there is no moment where the shading visibly starts
    // or stops moving.
    const e = k * k * (3 - 2 * k) * nightBlend;
    // MOST OF THE WAY, NEVER ALL OF IT.
    //
    // Handing the lamp over completely put it in the niche and took the
    // child's own ring of light off them entirely: the flame is low, off to
    // one side and behind their shoulder, so everything it could not reach
    // went black at the exact moment they arrived somewhere lit. Stopping
    // the slide short keeps their own pool on them and still swings the
    // light round to the stone's side, which is what the eye is reading —
    // the direction it comes FROM, not whether it is the only source.
    into.lerp(TMP_LAMP.set(best.x, best.y, best.z), e * LAMP_SHIFT);
    return e;
  }
  /** Scratch for `lampFrom`, so a per-frame call allocates nothing. */
  const TMP_LAMP = new THREE.Vector3();
  const TMP_HERO = new THREE.Vector3();
  /**
   * How much brighter somebody standing in a milestone's light is.
   *
   * A lamp is the brightest thing on this road after dark, and walking up to
   * one should be the moment a child can see themselves properly rather than
   * as the same silhouette they were between the stones.
   */
  // 2.9, not 1.6.
  //
  // This is how much the child's own lamp comes up as they reach a milestone,
  // and it is the only thing lighting their FACE there -- the niche lamp is a
  // 46-unit flood with near-linear falloff that lands on everything equally
  // and so models nothing. At 1.6 the face stayed in the flood's flat orange.
  // Nearly double puts a readable highlight on it without becoming a torch:
  // the niche still owns the road, the carried lamp owns the face.
  // 1.9. It was 4.6, and 4.6 was wrong for a reason worth recording: it was
  // chosen while the lamp was still sliding six units off her face, so it was
  // sized to overcome a distance problem rather than to light anybody. With
  // `LAMP_SHIFT` fixed the same number lands as a hard white pool on her --
  // the right amount of light, delivered from far too close.
  //
  // At 1.9 her face reads about twice as bright as it does on the open road,
  // which is what walking up to a flame does. A lamp in a stone niche is a
  // small fire; it should show her, not stage her.
  const LAMP_LIFT = 1.9;
  /**
   * And how much FURTHER it has to reach once it has moved.
   *
   * The personal lamps are short-range on purpose — 3.4 and 4.6, tuned to
   * throw a pool around somebody they are hanging directly over. Slide one
   * across to a milestone and it is suddenly two or three units away from the
   * person it is lighting, which on a squared falloff is most of its output
   * gone: moving it made the child DARKER at the one spot on the road that is
   * actually lit. The range grows with the slide, so what changes as they
   * walk up to a stone is where the light comes from, not how much there is.
   */
  const LAMP_REACH = 9;
  /**
   * AND THE COLOUR IT TURNS AS IT HANDS OVER TO THE STONE.
   *
   * The personal lamp is a warm white — right for a light that is nominally
   * the scene's own and has no source in it. The milestone's lamp is an oil
   * flame, and the pool IT casts on the road is `0xffb867`. So a child
   * standing in that pool was still being lit warm WHITE: the ground at her
   * feet was amber, she was not, and the two lights plainly were not the same
   * light. That mismatch is most of what read as hard — a white key light
   * over an amber ground is a studio, not a lamp.
   *
   * Carried most of the way to the flame's own amber as it slides. Amber
   * also simply reads softer than white at the same intensity: the blue end
   * is what makes a highlight look hot.
   */
  const LAMP_WHITE = new THREE.Color(0xfff0d0);
  const LAMP_AMBER = new THREE.Color(0xffb867);
  /**
   * How far towards the stone the lamp is allowed to travel, at most.
   *
   * The rest of the distance is what keeps the child lit by their own light
   * as well as by the milestone's — see `lampFrom`.
   */
  // 0.18, NOT 0.6 -- AND THIS WAS THE WHOLE BUG.
  //
  // The lamp slides toward the niche so the light reads as coming from the
  // stone's side. At 0.6 it slid most of the way there, and the stone stands
  // about 9.5 units across the road from where the child walks -- so the one
  // light responsible for her face moved nearly six units off it, and the
  // inverse square did the rest.
  //
  // Measured: at 0.6 her face received 0.42 AT a milestone against 0.62
  // walking between them. Arriving somewhere lit made her DARKER. Three
  // separate rounds of raising the intensity could not win against that,
  // because they were fighting a distance term, not a brightness one.
  //
  // A fifth of the way still swings the direction the light arrives from,
  // which is what the eye actually reads, and leaves the source on her.
  // 0.18, NOT 0.6 -- and this was the real bug behind "no light on her face".
  //
  // The lamp slides toward the niche so the light reads as coming from the
  // stone's side. At 0.6 it slid most of the way, and the stone stands about
  // 9.5 units across the road -- so the one light responsible for her face
  // moved nearly six units off it and the inverse square did the rest.
  // Measured: 0.42 at a milestone against 0.62 walking between them, i.e.
  // arriving somewhere lit made her DARKER.
  const LAMP_SHIFT = 0.18;
  const TMP_MATE = new THREE.Vector3();
  /**
   * The group's centre, passed as `at`.
   *
   * Its own vector and not `TMP_LAMP`: that one is the lerp target INSIDE
   * `lampFrom`, so handing it in as the argument would have the function
   * overwrite what it was asked about. It happens to read `at.x` before it
   * writes, so it would have worked — right up until somebody moved a line.
   */
  const TMP_AT = new THREE.Vector3();

  const spotPool: THREE.SpotLight[] = [];
  for (let i = 0; i < AIMED_LIGHTS; i++) {
    // Wide and very soft: this is a flame in an opening, not a torch. The
    // penumbra does the work — a hard cone edge on a mud road reads as a
    // stage light.
    // Wider and slower-falling than a lamp of this size would be in life.
    // A real wick in a stone niche throws a pool a couple of paces across,
    // which at this camera height is a smudge nobody would call a light. The
    // cone is opened up and the decay eased so it lays a stretch of the road
    // out in front of the child — the lamp is there so the road can be read,
    // and it has to actually do that to be worth standing there.
    const spot = new THREE.SpotLight(0xffb867, 0, 46, 1.22, 0.85, 1.0);
    // Parked below the ground, aimed at nothing, until claimed.
    spot.position.set(0, -500, 0);
    spot.target.position.set(0, -501, 0);
    nightLayer.add(spot);
    nightLayer.add(spot.target);
    spotPool.push(spot);
  }
  /**
   * One texture per kind of flame, shared by every lamp of that kind.
   *
   * `glowTexture` paints a fresh 64px canvas each call, and a village runs to
   * a couple of dozen lamps — two dozen identical textures uploaded to the
   * GPU to be sampled identically. The MATERIALS stay separate, because each
   * lamp fades and gutters on its own; only the picture is shared.
   */
  const lampTex = new Map<string, THREE.Texture>();

  /**
   * Light a lamp at a point in the world.
   *
   * Mostly these are sprites. A sprite costs nothing and, drawn additively,
   * reads convincingly as a flame seen at this distance — but it lights
   * nothing around it, and a lamp that leaves the wall behind it black is
   * obviously a sticker. So a SMALL number of them also carry a real
   * PointLight, and the budget is deliberately tiny: every light in the
   * scene is a per-fragment cost on every lit material, and this world
   * already runs a lantern for the hero and one for the companion. Four more
   * go where they are seen most — the temple, the market, and the roadside
   * lamps the child walks straight past — and everything else borrows the
   * atmosphere they create.
   */
  /**
   * STAND A LIGHT IN THE STONE'S OWN LAMP NICHE.
   *
   * The model carries a little emissive flame mesh inside the triangular
   * opening, so the light is placed on THAT rather than at a measured
   * fraction of the height: find the emissive child, take the centre of its
   * box. An asset that moves its lamp brings the light with it.
   *
   * This used to live inside the separate vazhivilakku's planting function.
   * The lamp is now welded onto the milestone itself, so the milestone
   * factory is what calls it — same code, same flame, one stone.
   */
  function lightTheNiche(wrap: THREE.Object3D): void {
    const box = measureBox(wrap);
    const niche = new THREE.Box3();
    let found = false;
    wrap.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // NOT THE NUMBER. The carved plate is emissive too — that is how it
      // lights up as somebody comes to read it — so an honest search for
      // "the glowing thing on this stone" finds the number as well as the
      // flame and stands the lamp halfway between them, a third of the way
      // down the shaft. It is flagged rather than guessed at: the plate's
      // emissive intensity is zero at rest, so testing for that would have
      // worked here and broken the moment the glow came on.
      if (m.userData.carving === true) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const glows = mats.some((mm) => {
        const sm = mm as THREE.MeshStandardMaterial | undefined;
        return sm?.emissive != null && sm.emissive.getHex() !== 0x000000;
      });
      if (!glows) return;
      const bb = new THREE.Box3().setFromObject(m);
      if (bb.isEmpty()) return;
      if (found) niche.union(bb);
      else niche.copy(bb);
      found = true;
    });
    const flame = found
      ? niche.getCenter(new THREE.Vector3())
      : new THREE.Vector3(
          (box.min.x + box.max.x) / 2,
          box.min.y + (box.max.y - box.min.y) * 0.72,
          (box.min.z + box.max.z) / 2,
        );
    makeLamp(flame.x, flame.y, flame.z, {
      // Small: a flame in an opening, not a glow around a post.
      size: 0.8,
      peak: 0.92,
      // EVERY roadside lamp is lit for real. A lamp that puts no pool of
      // light on the road is a decoration of a lamp, and they stand one per
      // milestone — far enough apart that only one or two are ever near
      // enough to matter.
      lit: 9,
      // AIMED AT THE ROAD. The stones stand on the far verge at negative z
      // with the road at zero, so the opening faces +z and the light goes
      // with it; the closed back of the stone stays dark instead of glowing
      // through it.
      aim: new THREE.Vector3(flame.x, 0, flame.z + 9),
    });
  }

  function makeLamp(
    x: number,
    y: number,
    z: number,
    opts: {
      kind?: "oil" | "petromax" | "mirror";
      size?: number;
      /** Taller than it is wide, for the mirror's smear of caught light. */
      aspect?: number;
      peak?: number;
      /** Ask for a real light. Granted only while the budget lasts. */
      lit?: number;
      /**
       * Throw the light one way only, towards this point.
       *
       * A vazhivilakku is a stone box with an opening in one face. A point
       * light at its wick lights the field behind it as brightly as the road
       * in front, through the back of a solid stone — the one thing the
       * object is shaped to prevent. Given an aim, the light becomes a cone
       * pointed at the road and the closed side stays dark, which is what
       * the carving was for.
       */
      aim?: THREE.Vector3;
    } = {},
  ): void {
    const kind = opts.kind ?? "oil";
    const petromax = kind === "petromax";
    const inner = petromax
      ? "rgba(255,250,226,1)"
      : kind === "mirror"
        ? "rgba(255,228,168,1)"
        : "rgba(255,196,104,1)";
    const outer = petromax
      ? "rgba(196,214,255,0)"
      : kind === "mirror"
        ? "rgba(255,170,70,0)"
        : "rgba(255,116,24,0)";
    let tex = lampTex.get(kind);
    if (tex == null) {
      tex = glowTexture(inner, outer);
      lampTex.set(kind, tex);
    }
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    const size = opts.size ?? (petromax ? 2.6 : 1.5);
    sprite.scale.set(size, size * (opts.aspect ?? 1), 1);
    sprite.position.set(x, y, z);
    nightLayer.add(sprite);
    let light: THREE.PointLight | null = null;
    const lit = opts.lit ?? 0;
    if (lit > 0) {
      if (opts.aim != null) {
        // AIMED LAMPS DO NOT OWN A LIGHT, THEY BORROW ONE.
        //
        // There are two cones for the whole road and thirty-odd lamps on it,
        // so a cone cannot be handed out at build time and kept: the first
        // two lamps would light their patch of ground forever and every lamp
        // the child actually walked up to would be a dark stone with a
        // painted flame on it. The lamp registers where it stands and what
        // it points at, and the tick lends the cones to whichever two are
        // nearest — which, because they are 26 units apart and the frustum
        // is 14, is exactly the ones in shot.
        const phase = Math.random() * Math.PI * 2;
        const rate = 3.4 + Math.random() * 2.2;
        aimed.push({ x, y, z, aim: opts.aim.clone(), phase, rate });
        lamps.push({
          mat,
          peak: opts.peak ?? 0.82,
          phase,
          rate,
          wick: 1,
          light: null,
          lightPeak: lit,
        });
        const sprite2 = new THREE.Sprite(mat);
        const sz2 = opts.size ?? 1.5;
        sprite2.scale.set(sz2, sz2 * (opts.aspect ?? 1), 1);
        sprite2.position.set(x, y, z);
        nightLayer.add(sprite2);
        return;
      }
      if (lampLightBudget <= 0) {
        // Past the budget: the flame still glows as a sprite, there is just
        // no lit ground under it. See LAMP_LIGHTS for why there is a limit.
        lamps.push({
          mat,
          peak: opts.peak ?? (petromax ? 0.95 : 0.82),
          phase: Math.random() * Math.PI * 2,
          rate: petromax ? 1.1 : 3.4 + Math.random() * 2.2,
          wick: petromax ? 0.12 : kind === "mirror" ? 0.4 : 1,
          light: null,
          lightPeak: lit,
        });
        return;
      }
      lampLightBudget -= 1;
      // Reach and falloff, not only brightness. A roadside lamp stands about
      // seven units off the centre line, so a light that has faded to nothing
      // by then lights its own post and nothing else: the range carries to
      // the far verge and the gentler decay leaves some of it when it gets
      // there.
      light = new THREE.PointLight(
        petromax ? 0xfff2d2 : 0xffb867,
        0,
        kind === "oil" ? 34 : 26,
        kind === "oil" ? 1.15 : 1.6,
      );
      light.position.set(x, y, z);
      nightLayer.add(light);
    }
    lamps.push({
      mat,
      peak: opts.peak ?? (petromax ? 0.95 : 0.82),
      phase: Math.random() * Math.PI * 2,
      // A wick in still air moves a few times a second; a mantle hums.
      rate: petromax ? 1.1 : 3.4 + Math.random() * 2.2,
      wick: petromax ? 0.12 : kind === "mirror" ? 0.4 : 1,
      light,
      lightPeak: lit,
    });
  }

  /** A soft radial dot, for eyes, moon and fireflies alike. */
  function glowTexture(inner: string, outer: string): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  if (trueNight) {
    // Ground mist: one wide plane (two on stronger machines) of scrolling
    // value noise, fading at its own edges. A shader plane, not particles —
    // this is the single biggest mood for the smallest cost.
    const mistShader = {
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color(0xaebcd8) },
      },
      vertexShader:
        "varying vec2 vUv; void main(){ vUv = uv; " +
        "gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
      fragmentShader: `
        uniform float uTime; uniform float uOpacity; uniform vec3 uColor;
        varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),
                     mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y); }
        void main(){
          vec2 p = vUv * vec2(26., 5.);
          float m = n(p + vec2(uTime*.05, uTime*.02)) * .62
                  + n(p*2.1 - vec2(uTime*.08, 0.)) * .38;
          float edge = smoothstep(0.,.18,vUv.y) * smoothstep(1.,.72,vUv.y)
                     * smoothstep(0.,.05,vUv.x) * smoothstep(1.,.95,vUv.x);
          gl_FragColor = vec4(uColor, m * edge * uOpacity);
        }`,
    };
    const mistLayers = (opts.tier ?? "mid") === "low" ? 1 : 2;
    for (let i = 0; i < mistLayers; i++) {
      const mat = new THREE.ShaderMaterial({
        ...mistShader,
        uniforms: THREE.UniformsUtils.clone(mistShader.uniforms),
        transparent: true,
        depthWrite: false,
      });
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(TRAIL_END + 100, 46),
        mat,
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(TRAIL_END / 2, 0.7 + i * 0.9, -4);
      nightLayer.add(plane);
      mistMats.push(mat);
    }

    // Fireflies: a handful of warm dots that bob near the trail. The quiet
    // night gets the most of them — they are its whole cast.
    if (plan.fireflies > 0) {
      const n = plan.fireflies;
      const base = new Float32Array(n * 3);
      const phase = new Float32Array(n);
      // IN KNOTS, OUT IN THE FIELD.
      //
      // Spread evenly along the road these read as a particle effect — a
      // constant sprinkle at a constant distance, which is what a shader
      // does and not what an insect does. Fireflies gather: a few dozen over
      // one wet corner of a paddy and none at all for the next fifty metres.
      //
      // So they are dealt into a handful of knots at random points down the
      // road, each knot a few units across, and pushed well back off the
      // verge — the empty field is where they are, not the roadside where
      // the traffic and the lamps are.
      const knots = Math.max(2, Math.round(n / 7));
      const at: [number, number][] = [];
      for (let k = 0; k < knots; k++) {
        at.push([
          10 + Math.random() * (TRAIL_END - 20),
          -(11 + Math.random() * 13),
        ]);
      }
      for (let i = 0; i < n; i++) {
        const [kx, kz] = at[i % knots];
        base[i * 3] = kx + (Math.random() - 0.5) * 9;
        base[i * 3 + 1] = 0.6 + Math.random() * 2.2;
        base[i * 3 + 2] = kz + (Math.random() - 0.5) * 6;
        phase[i] = Math.random() * Math.PI * 2;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
      const mat = new THREE.PointsMaterial({
        color: 0xffd98a,
        size: 3.2,
        sizeAttenuation: false,
        map: glowTexture("rgba(255,220,150,1)", "rgba(255,220,150,0)"),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      fireflies = { points: new THREE.Points(geo, mat), mat, base, phase };
      nightLayer.add(fireflies.points);
    }

    // The eyes in the fog: pale dots deep in the treeline that blink and
    // follow the hero at a fixed remove. Sometimes one pair alone, sometimes
    // a huddle of three — and always small, because far away is what they are.
    if (plan.eyePairs > 0) {
      const eyeTex = glowTexture("rgba(180,230,255,1)", "rgba(180,230,255,0)");
      let remaining = plan.eyePairs;
      while (remaining > 0) {
        const r = Math.random();
        const size = Math.min(remaining, r < 0.45 ? 1 : r < 0.8 ? 2 : 3);
        remaining -= size;
        // An orthographic camera gives no perspective for free, so depth is
        // manufactured from three cues at once: deeper eyes are smaller,
        // dimmer, and lag further behind the hero as they follow. The lag is
        // the strongest of the three — far things seem to move slowly, and
        // that is what makes the treeline feel like it has a back.
        const depth = 16 + Math.random() * 14; // world units behind the trail
        const far = (depth - 16) / 14; // 0 nearest .. 1 deepest
        const cluster: EyeCluster = {
          pairs: [],
          // Where this knot stands relative to the hero — some ahead, some
          // behind, none ever underfoot.
          offsetX: (Math.random() - 0.4) * 26,
          followRate: 0.85 - far * 0.62,
          x: 0,
        };
        for (let i = 0; i < size; i++) {
          const group = new THREE.Group();
          const mats: THREE.SpriteMaterial[] = [];
          const scale = 0.32 - far * 0.15;
          for (const dx of [-1, 1]) {
            const mat = new THREE.SpriteMaterial({
              map: eyeTex,
              transparent: true,
              opacity: 0,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            });
            const eye = new THREE.Sprite(mat);
            eye.scale.setScalar(scale);
            eye.position.x = dx * scale * 0.55;
            group.add(eye);
            mats.push(mat);
          }
          group.position.set(
            i * (0.9 + Math.random() * 0.8),
            0.9 + Math.random() * 1.3 + far * 0.6,
            -(depth + Math.random() * 1.5),
          );
          nightLayer.add(group);
          cluster.pairs.push({
            group,
            mats,
            phase: Math.random() * Math.PI * 2,
            speed: 0.3 + Math.random() * 0.45,
            baseO: (0.45 + Math.random() * 0.3) * (1 - far * 0.45),
          });
        }
        eyeClusters.push(cluster);
      }
    }
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
  let roadMesh: THREE.Mesh | null = null;
  const _groundRay = new THREE.Raycaster();
  const _rayFrom = new THREE.Vector3();
  const _rayDir = new THREE.Vector3(0, -1, 0);
  /** The real surface height at (x, z): raycast the ground mesh, falling back
   * to the analytic terrain height off the mesh. `sink` plants feet a touch
   * into the ground so nothing ever appears to float. */
  /**
   * How far the road is kept clear of scenery, either side of its centre.
   *
   * Zero on the other two worlds: their paths are narrow and their scatter was
   * tuned around them years ago, and widening the exclusion would thin out
   * trails that read correctly today. Village Road's road is thirteen units
   * across, and the scatter's own minimum distances - two for the flowers, six
   * for the trees - put bushes and whole trees in the middle of it.
   *
   * A cart road has nothing growing on it. That is what makes it a road.
   */
  const roadClear = land.path === "mud" ? 8.2 : 0;
  /**
   * Scatter that may sit ON the road anyway.
   *
   * Loose grit is not an obstruction - a cart road HAS stones on it, and a
   * road swept perfectly clean of everything reads as a painted stripe. Only
   * the things a cart would have to go round are kept off.
   */
  const ROAD_OK = /pebble|grit/i;
  /**
   * Is this spot ON the road, and therefore no place for a tree?
   *
   * `reach` is how far the thing being placed extends sideways from that
   * spot, and it matters more than the spot does. The coconut palms lean —
   * some of them a long way — so a palm whose BASE cleared the road by half
   * a metre still had its trunk and half its crown out over the middle of
   * it, and the road read as having trees growing in it. Testing the point
   * alone cannot see that; testing the footprint can.
   */
  const onRoad = (x: number, z: number, file = "", reach = 0) =>
    roadClear > 0 &&
    !ROAD_OK.test(file) &&
    Math.abs(z - meander(x)) < roadClear + reach;

  /**
   * Pulls a scattered plant's colours toward this land's foliage.
   *
   * Leaf and trunk are told apart by name first and by colour second: the pack
   * names most of its parts, and where it does not, a red or green material is
   * foliage and a dark brown one is bark. The red test is the one that matters
   * - an autumn maple and a mango tree are the same geometry here, and only
   * the colour says which country you are in.
   *
   * Materials are CLONED before being touched. They are shared between every
   * clone of a model, so recolouring in place would repaint every tree in
   * every world that had loaded the same file.
   */
  function tintFoliage(root: THREE.Object3D): void {
    const tint = theme.foliageTint;
    if (tint == null) {
      return;
    }
    const leaf = new THREE.Color(tint.leaf);
    const trunk = new THREE.Color(tint.trunk);
    const hsl = { h: 0, s: 0, l: 0 };
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || mesh.material == null) {
        return;
      }
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      mesh.material = mats.map((m) => {
        const src = m as THREE.MeshStandardMaterial;
        if (src.color == null) {
          return m;
        }
        const c = src.clone() as THREE.MeshStandardMaterial;
        const name = `${node.name} ${src.name ?? ""}`.toLowerCase();
        c.color.getHSL(hsl);
        const named = /leaf|leaves|foliage|canopy|frond|bush|grass/.test(name)
          ? "leaf"
          : /trunk|bark|stem|wood|branch|log/.test(name)
            ? "trunk"
            : null;
        // Hue near red/orange OR near green, with some saturation, is foliage.
        const reddish = hsl.s > 0.15 && (hsl.h < 0.11 || hsl.h > 0.93);
        const greenish = hsl.s > 0.1 && hsl.h > 0.16 && hsl.h < 0.45;
        const isLeaf =
          named === "leaf" || (named == null && (reddish || greenish));
        const isTrunk = named === "trunk" || (named == null && !isLeaf);
        // Autumn colour gets pulled ALL the way - at 1.35 a strong red was
        // still arriving as a dull maroon canopy, which on a Kerala road reads
        // as a dead tree rather than a different species. A green that is
        // merely the wrong green is only nudged, so the set keeps its variety.
        const k = reddish ? 1 : tint.strength;
        c.color.lerp(isLeaf ? leaf : trunk, Math.min(1, k));
        void isTrunk;
        return c;
      });
      if (!Array.isArray(mesh.material)) {
        return;
      }
      if (mesh.material.length === 1) {
        mesh.material = mesh.material[0];
      }
    });
  }

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
    // A MISSING TEXTURE MUST NOT BLACK OUT THE WORLD.
    //
    // TextureLoader hands back an empty texture immediately and fills it in
    // later, so a 404 leaves the material sampling nothing - and a ground mesh
    // sampling nothing renders BLACK, across the entire world, with no error
    // anybody sees. That is what happened the moment this world asked for a
    // Kerala surface that had not been drawn yet.
    //
    // The floor already has a complete vertex-coloured look underneath - it is
    // what the other two worlds use - so the honest failure is to fall back to
    // it. The texture is an enhancement, and an enhancement that is not there
    // should leave the thing it enhances working.
    const onTexFail = (which: "map" | "normalMap") => () => {
      const mat = groundMesh?.material as
        | THREE.MeshStandardMaterial
        | undefined;
      if (mat != null) {
        mat[which] = null;
        mat.needsUpdate = true;
      }
    };
    const diff = tl.load(
      `${ASSETS}/textures/${land.tex}_diff.jpg`,
      undefined,
      undefined,
      onTexFail("map"),
    );
    diff.colorSpace = THREE.SRGBColorSpace;
    const nor = tl.load(
      `${ASSETS}/textures/${land.tex}_nor.jpg`,
      undefined,
      undefined,
      onTexFail("normalMap"),
    );
    for (const t of [diff, nor]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(40, 8);
    }
    // 76 DEEP, NOT 120. The far edge is what the painted horizon has to
    // clear, and at a 9-degree pitch every unit of depth is 0.16 of a unit of
    // screen height: 120 put it at 17.7, well over a frame top of 15.4, so
    // the ground filled the picture and there was no sky to put a horizon in.
    // 84 brings it to 16.0 with a unit of sky above, and every further
    // degree of pitch takes another bite: the ceiling on tilting this camera
    // down is how short the ground can get before the village runs off it. The segment count is
    // unchanged, so the relief under the child is exactly as fine as it was
    // and `surfaceY` raycasts the same 16,000 triangles.
    const geo = new THREE.PlaneGeometry(400, 76, 200, 40);
    geo.rotateX(-Math.PI / 2);
    geo.translate(60, 0, 0); // centre the ground on the trail, not the origin
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(land.grass);
    const cVar = new THREE.Color(land.grassVar);
    const cDirt = new THREE.Color(land.dirt);
    const tmp = new THREE.Color();
    const noise2 = groundNoise;
    // A blended ground is a textured ground for colouring purposes: the vertex
    // pass has to go pale and let the maps carry the hue, or the two multiply
    // and the world comes out in neon. This is the same reason `floorTextured`
    // already halves these numbers.
    const textured =
      theme.floorTextured || (land.mix ?? theme.groundMix) != null;
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
        // A blended ground normally goes pale and lets the maps carry the
        // hue — but the FIELD map is now colourless by design (see the
        // fragment shader), so on a groundMix world the grass has to come
        // back to nearly full strength or the fields render grey.
        .lerp(cGrass, theme.groundMix != null ? 0.68 : textured ? 0.4 : 0.72)
        .lerp(cVar, n * (textured ? 0.2 : 0.32));
      const patch = (noise2(x * 0.09 + 7.3, z * 0.13) + 1) / 2;
      if (patch > 0.62) {
        tmp.lerp(cDirt, (patch - 0.62) * 0.9);
      }
      // An unmade village road is far wider than a footpath - it has to take
      // a bullock cart with room for people to walk past it both ways - and it
      // wanders more, because nobody ever set it out.
      const halfWidth =
        (land.path === "mud" ? 6.6 : land.path === "sand" ? 2.2 : 1.6) +
        noise2(x * 0.17, 3.1) * (land.path === "mud" ? 1.3 : 0.45);
      const off = Math.abs(z - meander(x));
      const pathBlend = Math.max(0, 1 - off / Math.max(1, halfWidth));
      if (land.path === "mud") {
        // A wide road is not uniformly bare. The middle is worn to earth by
        // the carts; the outer thirds are verge - earth showing through grass
        // that people walk on but wheels mostly miss. Blending the whole
        // corridor evenly gave a ten-metre brown stripe, which reads as a
        // runway rather than a road through a village.
        const worn = 2.9 + noise2(x * 0.13, 1.7) * 0.5;
        const bare =
          off <= worn ? 1 : Math.max(0, 1 - (off - worn) / (halfWidth - worn));
        // Much lighter when the road has a texture of its own: the laterite
        // map IS the road's colour, and tinting to full dirt underneath it
        // stacked two reds into a stripe you could see from orbit.
        tmp.lerp(
          cDirt,
          Math.min(
            1,
            bare * ((land.mix ?? theme.groundMix) != null ? 0.22 : 0.96),
          ),
        );
        if (off > worn) {
          // grass creeping back in across the verge, patchily
          const creep = (noise2(x * 0.1 + 11.3, z * 0.12) + 1) / 2;
          tmp.lerp(cGrass, (1 - bare) * (0.35 + creep * 0.4));
        }
        // CART RUTS. Two worn grooves either side of the centre, which is what
        // actually makes a mud road read as a road rather than a wide brown
        // stripe: it is the only mark on it that says something with wheels
        // comes this way. A cart's axle is a fixed width whatever the road
        // does, so the gauge stays narrow even as the road widens - they wander
        // a little along its length, the way real ruts do where a driver
        // pulled out to pass.
        const gauge = 1.5 + noise2(x * 0.05, 9.7) * 0.28;
        // One term, not two: `off` is already the distance from the centre
        // line, so a single |off - gauge| puts a groove at that distance on
        // BOTH sides.
        const rut = Math.abs(off - gauge);
        const inRut = Math.max(0, 1 - rut / 0.42) * (off <= worn ? 1 : 0);
        if (inRut > 0) {
          tmp.lerp(cDirt.clone().multiplyScalar(0.62), inRut * 0.8);
        }
        // THE GRASS CROWN. An unmade road that carries a cart or two a day
        // wears two ruts and keeps growing down the middle, and that green
        // strip between the wheel tracks is the single thing that most says
        // "country road nobody has surfaced" rather than "wide brown stripe".
        const crown = Math.max(0, 1 - off / (gauge * 0.62));
        const lush = (noise2(x * 0.08 + 3.1, 5.2) + 1) / 2;
        if (crown > 0 && lush > 0.32) {
          tmp.lerp(cGrass, crown * (lush - 0.32) * 1.15);
        }
        // Damp ground in the hollows - the monsoon never quite leaves a
        // laterite road, and the low spots stay dark for weeks.
        const damp = (noise2(x * 0.11 - 2.4, z * 0.09) + 1) / 2;
        if (damp > 0.68) {
          tmp.lerp(
            cDirt.clone().multiplyScalar(0.55),
            (damp - 0.68) * 2.2 * Math.min(1, bare),
          );
        }
      } else {
        tmp.lerp(cDirt, pathBlend * (land.path === "stones" ? 0.5 : 0.85));
        if (pathBlend > 0.55) {
          // the packed, well-trodden core of the trail is a shade deeper
          tmp.lerp(
            cDirt.clone().multiplyScalar(0.82),
            (pathBlend - 0.55) * 0.7,
          );
        }
      }
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    // Which surface is at each vertex: x = field, y = road, z = sand.
    //
    // Computed here, on the CPU, because everything that decides it already
    // lives here - the road's centre line, its width, where the cart has worn
    // it bare. Re-deriving that in GLSL would mean porting the meander and
    // three octaves of noise to the shader and keeping the two in step for
    // ever; a vertex attribute says the same thing once.
    const groundMix = land.mix ?? theme.groundMix;
    if (groundMix != null) {
      const mix = new Float32Array(pos.count * 4);
      // Smoothstep, not a linear ramp. A straight ramp reaches its ends with a
      // sudden change of slope, and across a ground mesh whose vertices are two
      // units apart that corner is visible as a crease running the length of
      // the road. Smoothstep arrives flat at both ends, so the road fades into
      // the verge with nothing to catch the eye.
      const ss = (e0: number, e1: number, x: number) => {
        const t = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-6, e1 - e0)));
        return t * t * (3 - 2 * t);
      };
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const off = Math.abs(z - meander(x));
        const hw = 6.6 + noise2(x * 0.17, 3.1) * 1.3;
        const worn = 2.9 + noise2(x * 0.13, 1.7) * 0.5;
        // Full road out to the worn part, then feathered well past the edge.
        // The feather runs beyond `hw` on purpose: a transition that finishes
        // exactly where the colour pass stops tinting puts two edges in the
        // same place, and two soft edges on top of each other read as one hard
        // one.
        const road = 1 - ss(worn * 0.8, hw + 2.5, off);
        // Two independent patch fields, on different frequencies and offsets
        // so they never coincide: shaded litter in the low damp places, dry
        // ground out in the open. Both are squeezed by (1 - road), because
        // whatever else is true, the cart track is bare.
        const damp = (noise2(x * 0.045 + 12.7, z * 0.05) + 1) / 2;
        const dryN = (noise2(x * 0.031 - 6.2, z * 0.037) + 1) / 2;
        const litter = ss(0.52, 0.8, damp) * (1 - road);
        const dry = ss(0.55, 0.84, dryN) * (1 - road) * (1 - litter);
        const field = Math.max(0, 1 - road - litter - dry);
        const sum = road + litter + dry + field || 1;
        mix[i * 4] = field / sum;
        mix[i * 4 + 1] = road / sum;
        mix[i * 4 + 2] = litter / sum;
        mix[i * 4 + 3] = dry / sum;
      }
      geo.setAttribute("aMix", new THREE.BufferAttribute(mix, 4));
    }
    // Cube world: flat stylized ground (vertex colours only) so the floor
    // reads as a low-poly surface under the blocky cast, not photo grass.
    const groundMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      map: theme.floorTextured ? diff : null,
      normalMap: theme.floorTextured ? nor : null,
      normalScale: new THREE.Vector2(0.85, 0.85),
      // A see-through floor (cube) reads airier; the hero forest stays solid.
      transparent: theme.floorOpacity < 1,
      opacity: theme.floorOpacity,
    });
    // ── three surfaces, blended ──────────────────────────────────────────
    //
    // MeshStandardMaterial is patched rather than replaced, so the ground keeps
    // every bit of the engine's lighting, fog, shadows and tone mapping. A
    // hand-written ShaderMaterial would have had to reimplement all of it to
    // gain nothing but the texture blend.
    //
    // Weights arrive per vertex and are interpolated across each triangle, so
    // the transition is already continuous; the shader only has to sample three
    // maps and weight them. Nothing here can produce an edge, which is the
    // whole reason the mix is decided per vertex rather than by a threshold in
    // the fragment shader.
    if (groundMix != null) {
      const mixTex = (name: string) => {
        const t = tl.load(`${ASSETS}/textures/${name}_diff.jpg`);
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        return t;
      };
      const texField = mixTex(groundMix.field);
      const texRoad = mixTex(groundMix.road);
      const texLitter = mixTex(groundMix.litter);
      const texDry = mixTex(groundMix.dry);
      groundMat.onBeforeCompile = (shader) => {
        shader.uniforms.tField = { value: texField };
        shader.uniforms.tRoad = { value: texRoad };
        shader.uniforms.tLitter = { value: texLitter };
        shader.uniforms.tDry = { value: texDry };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
             attribute vec4 aMix;
             varying vec4 vMix;
             varying vec2 vGroundUv;`,
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             vMix = aMix;
             // World XZ, so the surfaces tile with the ground rather than with
             // the plane's own UVs - which are stretched 400 by 120 and would
             // smear the grain into streaks along the road.
             vGroundUv = (modelMatrix * vec4(position, 1.0)).xz;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
             uniform sampler2D tField;
             uniform sampler2D tRoad;
             uniform sampler2D tLitter;
             uniform sampler2D tDry;
             varying vec4 vMix;
             varying vec2 vGroundUv;
             /**
              * One surface, sampled so it does not visibly repeat.
              *
              * A 512px texture tiled across a 400-unit ground repeats about
              * sixty times, and the eye finds that period immediately - the
              * ground stops reading as earth and starts reading as wallpaper.
              * Sampling the SAME map a second time at an unrelated scale and
              * offset, then averaging, replaces one short period with the beat
              * between two - which is far longer than the ground is wide, so
              * there is no repeat left to see.
              *
              * 0.37 is deliberately not a simple ratio: at 0.5 or 0.25 the two
              * samples line up again every few tiles and the pattern comes
              * back, larger.
              */
             vec3 groundSample(sampler2D t, vec2 uv, float sc) {
               vec3 a = texture2D(t, uv * sc).rgb;
               vec3 b = texture2D(t, uv * sc * 0.37 + vec2(31.7, 17.3)).rgb;
               return mix(a, b, 0.5);
             }`,
          )
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
             {
               // Each surface at its own scale: grit is fine, a field is
               // broader. Sharing one scale made the road look like grass that
               // had been recoloured.
               // Four surfaces, each at its own scale: grit is fine-grained,
               // a field is broad, litter sits between. One shared scale made
               // every surface look like the same material recoloured.
               vec3 f = groundSample(tField,  vGroundUv, 0.16);
               // THE FIELD KEEPS ITS DETAIL AND LOSES ITS COLOUR.
               //
               // The paddy map was the only green-dominant texture in the
               // set and it read badly here: a photographed rice paddy under
               // stylised characters looks like a photograph laid on the
               // ground, and its rows repeat as rows however they are
               // sampled. But swapping it for any other map turns the fields
               // brown, because every other texture in the folder is a tan or
               // a red - leafy_grass included, despite the name. (No
               // backticks in this comment: it lives inside a JS template
               // literal, and one would end the shader source early.)
               //
               // So the field's HUE comes from the land's own palette, which
               // the vertex pass already carries, and the map contributes
               // only its light and shade. Reduced to luminance it is a
               // detail layer: the grain, the clumping and the wear survive,
               // the photograph does not. Every land can then have its own
               // green without needing a texture painted for it.
               ${
                 (groundMix?.fieldHue ?? "land") === "land"
                   ? "f = vec3(dot(f, vec3(0.299, 0.587, 0.114)));"
                   : '// fieldHue: "texture" — the map keeps its own colour.'
               }
               vec3 r = groundSample(tRoad,   vGroundUv, 0.30);
               vec3 l = groundSample(tLitter, vGroundUv, 0.23);
               vec3 d = groundSample(tDry,    vGroundUv, 0.20);
               // PALE the laterite. The source texture is fresh-cut earth -
               // strong rust - and a road is not: it is walked on, rained on
               // and bleached by years of sun, so it sits much closer to dusty
               // pink than to the colour of the soil it was cut from. Pulled
               // a third of the way to its own luminance and lifted, which
               // takes the fire out of it without turning it grey.
               float rl = dot(r, vec3(0.299, 0.587, 0.114));
               r = mix(r, vec3(rl), 0.42) * 1.06 + 0.10;
               vec3 surf = f * vMix.x + r * vMix.y + l * vMix.z + d * vMix.w;
               // Kept as a MULTIPLY over the vertex colour rather than a
               // replacement: the vertex pass already carries the land's
               // palette, the ruts, the damp and the grass crown, and all of
               // that has to survive. 2.0 restores the mid-grey the textures
               // average to, so the ground neither darkens nor washes out.
               // 1.75 rather than 2.0: the textures average a shade above mid
               // grey, and the extra was pushing the whole ground bright.
               // A very slow light/dark drift over the whole ground, on a
               // wavelength far longer than any tile. Real ground is never
               // uniform over fifty metres, and without this the blend is
               // smooth but flat.
               float drift =
                 0.93 +
                 0.07 * sin(vGroundUv.x * 0.031 + 1.7) *
                   cos(vGroundUv.y * 0.024 - 0.6);
               diffuseColor.rgb *= surf * 1.75 * drift;
             }`,
          );
      };
      // Any change to a patched material needs a new program.
      groundMat.customProgramCacheKey = () => `groundmix-${land.name}`;
    }
    const ground = new THREE.Mesh(geo, groundMat);
    ground.receiveShadow = true;
    ground.updateMatrixWorld(true);
    groundMesh = ground;
    scene.add(ground);

    // THE FAR SKIRT IS GONE. It was a flat plane carrying on past the
    // terrain so the terrain's own edge could not be seen, and it did that —
    // but it ran from 36 units out to 98, which at this pitch is most of the
    // upper frame, so what it actually did was paint a green band across the
    // sky. The painted horizon does the job properly: it stands in front of
    // the terrain's edge and covers it, and everything above its ridge is
    // sky again rather than ground.

    // ── the road itself ─────────────────────────────────────────────────
    //
    // A ribbon following the same centre line and the same width the vertex
    // pass uses, laid a few millimetres above the ground so it reads as the
    // surface of the road rather than a decal floating over a field.
    //
    // Built as a strip rather than painted into the ground mesh because the
    // ground is one 400x120 plane at a fixed 200x40 resolution: a road four
    // vertices wide cannot hold grain, and raising the whole plane's
    // resolution to give it some would cost forty thousand vertices to detail
    // a strip that covers a twentieth of it.
    if (theme.roadTexture != null) {
      const roadDiff = tl.load(
        `${ASSETS}/textures/${theme.roadTexture}_diff.jpg`,
        undefined,
        undefined,
        () => {
          // No road texture is survivable - the vertex colours underneath
          // already draw a road. A black stripe down the world is not.
          roadMesh?.removeFromParent();
        },
      );
      roadDiff.colorSpace = THREE.SRGBColorSpace;
      const roadNor = tl.load(
        `${ASSETS}/textures/${theme.roadTexture}_nor.jpg`,
        undefined,
        undefined,
        () => {},
      );
      for (const t of [roadDiff, roadNor]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
      }
      const steps = 260;
      const x0 = -30;
      const x1 = TRAIL_END + 30;
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x0 + (x1 - x0) * t;
        const c = meander(x);
        // The same width the colour pass uses, so the ribbon and the tint it
        // sits on are the same road rather than two roads that nearly agree.
        const hw = 6.6 + noise2(x * 0.17, 3.1) * 1.3;
        pos.push(x, surfaceY(x, c - hw) + 0.02, c - hw);
        pos.push(x, surfaceY(x, c + hw) + 0.02, c + hw);
        // Tiled along its length at roughly one repeat every four units, so
        // the grain is the size of grit rather than of paving slabs.
        uv.push((x - x0) / 4, 0, (x - x0) / 4, 1);
        if (i < steps) {
          const a = i * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const rgeo = new THREE.BufferGeometry();
      rgeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      rgeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      rgeo.setIndex(idx);
      rgeo.computeVertexNormals();
      roadMesh = new THREE.Mesh(
        rgeo,
        new THREE.MeshStandardMaterial({
          map: roadDiff,
          normalMap: roadNor,
          normalScale: new THREE.Vector2(0.6, 0.6),
          roughness: 1,
          metalness: 0,
          // The edges melt into the field instead of ending at a cut line -
          // an unmade road has no kerb.
          transparent: true,
          opacity: 0.96,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);
    }

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
        // BEDDED INTO THE ROAD, NOT RESTING ON IT.
        //
        // Two things were wrong and they compounded. `groundY` is the height
        // of the FIELD and takes no z at all, while Village Road sinks its
        // own surface up to 0.22 below that — so on this road every pebble
        // was already floating a fifth of a unit clear of the ground it was
        // meant to be lying on. The `+ 0.05` then lifted the whole stone
        // clear of even that, and a shadow under a stone that is not touching
        // anything is what gives it away.
        //
        // `surfaceY` raycasts the real ground mesh and takes a sink, so the
        // stone is placed on the road it is actually on and pushed into it by
        // a little under half its own radius. Grit on a cart road is trodden
        // in; what shows is the top of it.
        const sc = 0.5 + Math.random() * 1.1;
        dummy.position.set(px, surfaceY(px, pz, 0.14 * sc * 0.45), pz);
        dummy.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        );
        dummy.scale.setScalar(sc);
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
  meshoptOffMainThread();
  loader.setMeshoptDecoder(MeshoptDecoder);
  /**
   * Basis/KTX2 textures, which the Explorer needs and nothing else uses yet.
   *
   * Its GLB lists `KHR_texture_basisu` in extensionsREQUIRED, not merely
   * used — so without a transcoder the loader refuses the file outright
   * rather than falling back. This is what makes that character loadable
   * at all.
   *
   * `detectSupport` has to see the real renderer to pick a format the GPU
   * can take, so it gets the one this world already built.
   */
  const ktx2 = new KTX2Loader()
    .setTranscoderPath(`${ASSETS}/basis/`)
    .detectSupport(renderer);
  serveTranscoderFromUrl(ktx2);
  loader.setKTX2Loader(ktx2);
  /**
   * Every model this world parsed.
   *
   * Most of what is loaded is used as a clone SOURCE — `variants` holds the
   * GLTF's own children and the scene only ever receives copies — so the
   * parsed originals are never part of the scene graph and disposing the
   * scene does not reach them. They are the largest thing the page allocates,
   * so they are tracked here and released with everything else.
   */
  const loaded: THREE.Object3D[] = [];
  /**
   * Gives back everything a character was holding, and stops the world's
   * teardown list from pinning it.
   *
   * Swapping a character or a companion removed the old rig from the scene
   * and nothing else. A removed rig is invisible, which is why this was
   * never obvious — but its geometry, its materials and its three KTX2
   * textures were all still on the GPU, and the decoded images behind those
   * textures sit outside the JS heap where no collector reaches them.
   *
   * So every change of character leaked a whole character. After dark the
   * scene already carries roughly twice the cast (every villager has a
   * skeleton twin), so that is where the ceiling is hit first: enough swaps
   * and the driver takes the WebGL context away, which looks exactly like
   * the 3-D pane freezing and needs a reload to come back.
   *
   * Safe to free, because `loadModel` parses a fresh scene per call — two
   * companions of the same character do not share geometry.
   */
  function releaseRig(rig: DinoRig | null): void {
    if (rig == null) return;
    rig.mixer.stopAllAction();
    rig.mixer.uncacheRoot(rig.mixer.getRoot() as THREE.Object3D);
    scene.remove(rig.wrap);
    // Out of the teardown list first: `dispose()` walks it at the end, and a
    // rig freed here must not be walked again, nor held until then.
    for (let i = loaded.length - 1; i >= 0; i--) {
      const model = loaded[i]!;
      let inside: THREE.Object3D | null = model;
      while (inside != null && inside !== rig.wrap) inside = inside.parent;
      if (inside === rig.wrap) loaded.splice(i, 1);
    }
    disposeScene(rig.wrap);
  }

  async function loadModel(url: string) {
    // EVERY MODEL IS FETCHED ONCE, NOT ONCE PER USE.
    //
    // Without this the loader re-downloads a file for every spawn: the
    // network log for one village night showed Buffalo.glb — 1.8 MB —
    // requested eight times, Explorer6 four, Peeli three. That is tens of
    // megabytes of identical bytes, and it is also what put the dev server
    // over: a burst of concurrent asset requests during a world build had it
    // answering 503, at which point `loadModel` quietly skipped the props it
    // could not get and the village simply did not appear.
    //
    // three's Cache holds the raw ArrayBuffer, not the parsed result, so
    // GLTFLoader still parses per call and every caller gets its own scene
    // to weld, tint and dispose. It is a pure saving.
    THREE.Cache.enabled = true;
    // ONE RETRY, because the failures here are transient.
    //
    // A world build asks for thirty-odd files in a burst and the server
    // answers some of them 503. `loadModel` treats a failure as "skip this
    // one", which is right for a single companion and catastrophic for a
    // temple — the village simply is not there, and from the outside that is
    // indistinguishable from the loader hanging. A 503 means "not now", so
    // asking again shortly is the correct response to it, and one retry is
    // enough: if the second also fails, something is actually wrong and the
    // caller's fallback should run.
    //
    // The pause matters as much as the retry. Going straight back at a
    // server that just said it was overloaded is what caused the overload.
    let gltf;
    try {
      gltf = await withDeadline(loader.loadAsync(url), url);
    } catch (first) {
      if (disposed) {
        throw first;
      }
      await new Promise((r) => setTimeout(r, 400));
      if (disposed) {
        throw first;
      }
      // three caches a FAILED fetch nowhere, but it does keep the in-flight
      // entry: clear this URL so the retry is a real request rather than a
      // second subscription to the one that already failed.
      THREE.Cache.remove(url);
      gltf = await withDeadline(loader.loadAsync(url), url);
    }
    if (disposed) {
      // The world was torn down while this model was in flight. It never
      // entered `loaded`, so dispose() already ran and will never see it —
      // free it here instead of leaving it pinned in this closure forever.
      disposeScene(gltf.scene);
      return null;
    }
    loaded.push(gltf.scene);
    // Said once per FILE, not once per thing placed: the scatter plants forty
    // of the same plant off one load, and a loading card that says
    // "the undergrowth" forty times running is a stutter, not a story.
    opts.onLoadStep?.(sceneName(url));
    // Kids app: death, attack and bite clips never make it in.
    gltf.animations = (gltf.animations ?? [])
      .filter((c) => !/death|attack|bite/i.test(c.name))
      .map(stripScaleTracks);
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        try {
          const before = m.geometry;
          m.geometry = mergeVertices(m.geometry, 1e-4);
          m.geometry.computeVertexNormals();
          // Welding returns a new geometry; without this the parsed one is
          // orphaned still holding its buffers, once per mesh per load.
          before.dispose();
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
        // MEASURED, NEVER TAKEN ON TRUST.
        //
        // `expandByObject` uses `geometry.boundingBox` and only computes one
        // if it is missing — and GLTFLoader always supplies one, built from
        // the accessor's own `min`/`max`. For most of this world's models
        // that is the same answer and cheaper.
        //
        // The AK pack's buildings ship POSITION as a NORMALISED Uint16
        // (`KHR_mesh_quantization` + `EXT_meshopt_compression`) and declare
        // the accessor's min/max in the normalised [0,1] units rather than in
        // the raw integers the flag says they are. The loader normalises them
        // again, so the cached box comes back 65,535 times too small — and
        // `fitToHeight`, dividing by it, scaled a market to a million units
        // across. Every face then sat outside the camera's -100..300 range
        // and was clipped, so the whole village loaded, placed itself
        // correctly and drew nothing at all.
        //
        // Recomputing reads the attribute through `getX/getY/getZ`, which
        // apply the normalisation exactly once and give the unit cube these
        // meshes really occupy. It costs one pass over the positions at load
        // time and nothing per frame.
        const m2 = o as THREE.Mesh;
        m2.geometry.computeBoundingBox();
        if (m2.geometry.boundingBox != null) {
          tmp.copy(m2.geometry.boundingBox).applyMatrix4(m2.matrixWorld);
          box.union(tmp);
        }
      }
    });
    return box;
  }
  /**
   * Scale a model to a height and stand it on the wrap's own origin.
   *
   * ALL THREE AXES, and the two that were missing are why the village was
   * invisible for so long. This used to re-base y alone — feet on the floor —
   * and leave x and z wherever the file happened to put them. For a model
   * authored around its origin that is a difference of nothing, which is what
   * every character in this world is, so it held for a long time.
   *
   * The AK pack's BUILDINGS are not authored that way. They ship quantized
   * (`KHR_mesh_quantization` + `EXT_meshopt_compression`) with POSITION
   * normalised into the unit cube and the real size and placement carried on
   * the node — a market's node reads scale [1.88, 0.43, 0.44] against a
   * translation of [-0.94, -0.22, -0.23]. Measured here they come back about
   * 65,535 times smaller than that, so `s` lands around three hundred
   * thousand instead of ten — and THE OFFSET IS MULTIPLIED BY IT TOO. The
   * height came out perfectly right, because that is the one axis this
   * normalised; the market was then planted six hundred thousand units off
   * the map. Every building in the village was standing correctly, in a
   * field beyond the horizon, which is why the models fetched 200 and nothing
   * appeared and why nothing ever threw.
   *
   * Centring x and z is the same promise the y re-base makes — "this is where
   * the thing stands" — and for anything already centred it is a shift of
   * approximately zero, so the cast is untouched.
   */
  /**
   * HOW MUCH SMALLER A THING IS FOR BEING FURTHER BACK.
   *
   * This camera is ORTHOGRAPHIC, which means it has no perspective at all: a
   * house forty units behind the road is drawn exactly the size of one
   * standing on it, and a companion walking a lane further out is the size of
   * the child beside them. That is why setting anything back made it look
   * wrong rather than distant — higher in the picture, same size, which the
   * eye reads as "enormous and close" instead of "normal and far".
   *
   * A perspective camera would give this for nothing and cost a great deal:
   * the skyline solve, the lane alignment, the word row and the shadows are
   * all written against an orthographic projection. So the cue is applied
   * where it is missed instead — by SIZE, which is the only channel an ortho
   * camera leaves open.
   *
   * Apparent size goes as 1/distance and THE ROAD IS THE REFERENCE: anything
   * standing in the child's own lane is its true size, whatever the lane's z
   * happens to be, so none of the castHeight figures shift under this.
   * Things behind shrink from there and the few things in front grow a
   * little, which is what distance does.
   *
   * Softened to seven tenths of the true falloff, because the full curve over
   * this depth range takes the far houses down to half and they stop reading
   * as houses.
   *
   * Applied at PLACEMENT, not per frame. Every mover here already writes its
   * own `scale` for its own reasons — the scare loom, the celebration hop,
   * the girth override — and a second writer every frame would fight all of
   * them. A companion holds its lane, so its factor is a constant anyway; an
   * animal that wanders a few units in z changes size by less than a per
   * cent, which is well under noticing and far cheaper than the alternative.
   */
  function perspective(z: number): number {
    const eye = V.camZ;
    const dist = Math.max(1, eye - z);
    const lane = Math.max(1, eye - (theme.laneZ ?? 0));
    return 1 - 0.7 * (1 - lane / dist);
  }
  function fitToHeight(root: THREE.Object3D, targetH: number) {
    const box = measureBox(root);
    const size = box.getSize(new THREE.Vector3());
    const s = targetH / (size.y || 1);
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
   * Drops the character until its feet are back on the ground.
   *
   * `fitToHeight` measures the mesh in its BIND pose — a T-pose with straight
   * legs — and offsets it so the lowest point sits at zero. That is the right
   * reference for how tall to draw somebody, but not for where their feet
   * are once a clip is playing: the idle pose stands with softer knees and
   * the body a little higher, so the character hovered with its shadow still
   * printed on the ground beneath it.
   *
   * This measures the same quantity the bind-pose fit did — the lowest point
   * of the character — but with the idle pose actually applied, and moves it
   * back to zero.
   *
   * It walks the skinned vertices rather than the foot bones. Bones were the
   * cheaper thing to measure and gave the wrong answer: a bone is a point,
   * and how far the sole of the shoe hangs below that point depends on how
   * the ankle is rotated, which is exactly what changes between the T-pose
   * and a standing pose. Correcting by the bone delta therefore overshot and
   * buried the feet. Skinned vertices carry the rotation with them, so the
   * number is the real silhouette either way.
   *
   * It samples every gait through its cycle rather than the idle pose alone.
   * Idle looked like the right reference — it is the resting one — but a walk
   * and a run drop the hips and swing a foot lower than a standstill ever
   * does, so planting on idle left him correct while still and sunk into the
   * path for most of a stride. The lowest point across all of them is the one
   * that has to sit on the ground.
   */
  /**
   * Puts the character's feet on the ground, and hands back a probe for
   * asking how far any OTHER pose sits above it.
   *
   * One root offset cannot serve every pose. It is computed from the gaits —
   * the poses the character spends almost all its time in — and a pose whose
   * feet sit higher in model space then floats by the difference. The
   * Explorer never showed it because his crouch happens to land close to his
   * idle; the six-year-old's does not, and he hovered while crouching.
   *
   * The probe measures a pose AFTER planting, so its answer is exactly the
   * gap to close: 0 for a pose already on the ground, positive for one
   * floating above it.
   */
  function plantFeet(
    root: THREE.Object3D,
    mixer: THREE.AnimationMixer,
    gaits: readonly (THREE.AnimationAction | null)[],
  ): (pose: THREE.AnimationAction | null) => number {
    const v = new THREE.Vector3();

    // Only the vertices that can possibly be the lowest point.
    //
    // Skinning all 6,643 of them at every sampled frame measured at 19.4
    // SECONDS on the Explorer, which is most of what made the kids world take
    // the best part of a minute to open. Almost all of that work was wasted:
    // the lowest point of a character standing or walking is on a foot, so
    // hair, hands and rucksack are computed and thrown away 36 times over.
    //
    // Collecting the vertices actually weighted to a foot bone cuts the set to
    // a few hundred and the cost to milliseconds, and cannot change the answer
    // — a vertex with no weight on a foot bone was never going to be the one
    // touching the ground.
    const meshes: { mesh: THREE.SkinnedMesh; verts: number[] }[] = [];
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      // Two passes, because not every character is a biped.
      //
      // The names below are a human's: toes, feet, ankles. The puppy is a
      // quadruped whose lowest bones are `backleg2` and `frontleg2`, so it
      // matched NOTHING and dropped straight to the every-vertex fallback —
      // 46,333 of them, on a path this function's own comment measured at
      // 19.4 SECONDS for 6,643. That is a main thread wedged for minutes
      // while the world "loads", which is not a slow load, it is a hang.
      //
      // So: ask for feet, then settle for legs, and only give up after that.
      // A leg bone is a worse guess than a foot — it drags in the thigh —
      // but it is a few hundred vertices against forty-six thousand, and
      // the lowest point of a standing animal is still on one of them.
      const footBones = new Set<number>();
      const collect = (re: RegExp) => {
        m.skeleton.bones.forEach((b, i) => {
          if (re.test(b.name)) footBones.add(i);
        });
      };
      collect(/toe|foot|ankle|paw|hoof/i);
      if (footBones.size === 0) {
        // THE TIPS OF THE LEGS, NOT THE LEGS.
        //
        // This rung of the ladder was matching /leg/ against the whole
        // skeleton and keeping every hit, which on the buffalo is SIXTEEN OF
        // ITS TWENTY-NINE BONES: backleg, backleg0, backleg1, backleg2 and
        // the same four again on each remaining limb. Every vertex weighted
        // to any of them counts as a foot vertex, so "a few hundred" became
        // most of the animal's lower body — and the buffalo has thirteen
        // clips, each sampled twelve times, three animals to a road. It
        // measured at 3.3 SECONDS PER BUFFALO and nine and a half seconds of
        // the village's load.
        //
        // A limb is a chain, and only its LAST link touches the ground: the
        // thigh cannot be the lowest point of anything standing on its feet.
        // So the matched bones are narrowed to the ones that are not a
        // parent of another matched bone — the tips, which for this rig is
        // exactly the four hooves. Same answer, a fraction of the vertices.
        collect(/leg|shin|calf/i);
        const tips = new Set(footBones);
        for (const i of footBones) {
          const b = m.skeleton.bones[i];
          for (const child of b?.children ?? []) {
            const ci = m.skeleton.bones.indexOf(child as THREE.Bone);
            if (ci >= 0 && footBones.has(ci)) {
              tips.delete(i);
              break;
            }
          }
        }
        if (tips.size > 0) {
          footBones.clear();
          for (const i of tips) footBones.add(i);
        }
      }
      const skinIndex = m.geometry.attributes.skinIndex;
      const skinWeight = m.geometry.attributes.skinWeight;
      const verts: number[] = [];
      if (footBones.size === 0 || skinIndex == null || skinWeight == null) {
        // Nothing recognisable to stand on. Every vertex is the honest
        // answer and an unbounded one, so it is sampled instead: a stride
        // long enough to keep the work flat no matter how dense the mesh.
        // A ground height measured from 4,000 spread-out vertices is not
        // meaningfully worse than one from 46,000, and it cannot hang.
        const total = m.geometry.attributes.position.count;
        const stride = Math.max(1, Math.ceil(total / 4000));
        for (let i = 0; i < total; i += stride) verts.push(i);
      } else {
        for (let i = 0; i < skinIndex.count; i++) {
          for (let c = 0; c < 4; c++) {
            if (
              skinWeight.getComponent(i, c) > 0.05 &&
              footBones.has(skinIndex.getComponent(i, c))
            ) {
              verts.push(i);
              break;
            }
          }
        }
        // A CEILING, whatever the rig turns out to look like.
        //
        // The narrowing above is the right answer for every skeleton seen so
        // far, and the next character is free to be shaped in a way nobody
        // anticipated — a bone called `legwrap` covering a whole haunch, a
        // mesh with no joints where this expects them. The every-vertex
        // branch already protects itself with a stride for exactly that
        // reason; this branch had nothing, so one oddly named bone could put
        // tens of thousands of vertices back into a loop that runs twelve
        // times per clip. The lowest point of a foot is not measured better
        // by six hundred samples than by six thousand.
        if (verts.length > FOOT_SAMPLE_CAP) {
          const stride = Math.ceil(verts.length / FOOT_SAMPLE_CAP);
          const thinned: number[] = [];
          for (let i = 0; i < verts.length; i += stride)
            thinned.push(verts[i]!);
          verts.length = 0;
          verts.push(...thinned);
        }
      }
      meshes.push({ mesh: m, verts });
    });

    const lowestNow = (): number => {
      root.updateMatrixWorld(true);
      let low = Infinity;
      for (const { mesh, verts } of meshes) {
        mesh.skeleton.update();
        const pos = mesh.geometry.attributes.position;
        for (const i of verts) {
          v.fromBufferAttribute(pos, i);
          mesh.applyBoneTransform(i, v);
          mesh.localToWorld(v);
          if (v.y < low) low = v.y;
        }
      }
      return low;
    };

    // Sample every gait he actually spends time in, across the whole cycle.
    // Planting on the idle pose alone leaves him correct at a standstill and
    // sunk into the path for most of a stride, because a walk and a run drop
    // the hips and swing a foot lower than standing ever does.
    const live = gaits.filter((a): a is THREE.AnimationAction => a != null);
    let lowest = Infinity;
    for (const action of live) {
      const saved = live.map((a) => a.weight);
      for (const a of live) a.weight = a === action ? 1 : 0;
      const dur = action.getClip().duration || 1;
      for (let i = 0; i < SAMPLES_PER_GAIT; i++) {
        action.time = (dur * i) / SAMPLES_PER_GAIT;
        mixer.update(0);
        lowest = Math.min(lowest, lowestNow());
      }
      action.time = 0;
      live.forEach((a, k) => (a.weight = saved[k]!));
    }
    if (live.length === 0) {
      mixer.update(0);
      lowest = lowestNow();
    }
    if (Number.isFinite(lowest)) {
      root.position.y -= lowest;
    }
    mixer.update(0);

    return (pose) => {
      if (pose == null) {
        return 0;
      }
      const others = [...live, pose];
      const saved = others.map((a) => a.weight);
      const wasPlaying = pose.isRunning();
      const t0 = pose.time;
      for (const a of others) a.weight = a === pose ? 1 : 0;
      pose.play();
      let low = Infinity;
      const dur = pose.getClip().duration || 1;
      for (let i = 0; i < SAMPLES_PER_GAIT; i++) {
        pose.time = (dur * i) / SAMPLES_PER_GAIT;
        mixer.update(0);
        low = Math.min(low, lowestNow());
      }
      pose.time = t0;
      if (!wasPlaying) {
        pose.stop();
      }
      others.forEach((a, k) => (a.weight = saved[k]!));
      mixer.update(0);
      return Number.isFinite(low) ? low : 0;
    };
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
    /** The model file's name — only pose corrections solved for one rig use it. */
    name = "",
  ): DinoRig {
    const wrap = fitToHeight(gltf.scene, targetH);
    // The same head this character has when they walk as a companion — see
    // castHeadScale. Before this, only companions got it.
    scaleHead(gltf.scene, castHeadScale(name));
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const clips = clipsFor(gltf);
    const pick = (re: RegExp) =>
      clips.find((c) => re.test(c.name.toLowerCase())) ?? null;
    // Front and back legs, and no human foot bones: that is a quadruped.
    // Asked of the bones so a future animal needs nothing added here.
    const boneNames: string[] = [];
    gltf.scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) boneNames.push(o.name);
    });
    const quadruped =
      !boneNames.some((b) => /toe|foot|ankle/i.test(b)) &&
      boneNames.some((b) => /frontleg|foreleg/i.test(b)) &&
      boneNames.some((b) => /backleg|hindleg|rearleg/i.test(b));
    /**
     * How much quicker this character's legs must cycle to cover the same
     * ground.
     *
     * Everything on the trail travels at one speed — the trail decides it,
     * from how much has been typed — so the only thing that keeps feet from
     * sliding is the cycle length. `TUNED_*` are the Explorer's, measured
     * against his stride at 4.8 units tall. A puppy drawn 1.5 units tall has
     * roughly a third of that stride, so it needs roughly three times the
     * steps, and at the human rate it looks exactly like what was reported:
     * trotting gamely and falling behind.
     *
     * Quadrupeds only. Every biped here has a hand-tuned gait that has been
     * looked at and approved, and stride does not track height for them
     * nearly as cleanly — Little Drew is 82% of Dave's height and does not
     * take 82% strides. Applying this to them would be changing settled work
     * on the strength of a proportion.
     */
    //
    // The ratio is taken as a SQUARE ROOT, not straight.
    //
    // Straight stride-over-height said 0.31, which put the puppy's run at
    // 7.6x playback — and its Running clip carries an authored 0.85-unit
    // vertical bound, so what that produced was not a quicker trot but a
    // dog vibrating. Legs are pendulums: cycle time goes with the square
    // root of their length, which is also why a small dog's steps are
    // quicker than a child's but nothing like three times quicker.
    //
    // 0.56 for the puppy: a little over half the cycle length, which is a
    // brisk trot beside a walking child and reads as one.
    const gaitScale = quadruped ? Math.max(0.5, Math.sqrt(targetH / 4.8)) : 1;
    // A real run beats a walk when a character ships both.
    //
    // `pick` takes the first match, and the Explorer's clips are ordered
    // Idle, Walk, Run — so a single alternation quietly chose Walk for
    // running and he ambled through the whole trail. The KayKit heroes
    // carry one move clip each and are unaffected either way.
    // `\b` is the wrong boundary here, because `_` counts as a word
    // character to it. Meshy names the six-year-old's clips `Run_Cute` and
    // `Walk_Cute`, so `\brun\b` matched neither and the fallback below —
    // which takes the FIRST of run/walk in file order — handed him Walk_Cute
    // as his run. He would have ambled through the whole trail at a sprint's
    // WPM. Matching on "not a letter" instead reads both naming styles.
    // Peeli's "Cute" pair was tried here and reverted: both clips are 2.03s,
    // so reaching the trail's tuned cycle meant running them at 3.2x, and a
    // bouncy gait played at three times its authored speed reads as frantic
    // rather than cute. Her `_InPlace` pair is already authored at 1.03s and
    // 0.70s — all but exactly the rates the trail was tuned against — so it
    // is both the better-looking gait and the one that needs no retiming.
    const runClip =
      pick(/(?:^|[^a-z])(?:run|gallop)(?:ning|s)?(?:[^a-z]|$)/) ??
      pick(/run|gallop|walk/);
    // Only a clip that is genuinely a second, slower gait. Where the fallback
    // above already claimed the walk as the run — the KayKit heroes carry one
    // move clip each — there is no walk to blend to and the gait stays binary.
    // `-ing` and `-s` are part of the word, not the end of it.
    //
    // The boundary here is "not a letter", which is right for `Walk_Cute`
    // and wrong for `Walking_A` — and the KayKit heroes ship exactly that.
    // They matched no walk at all and ran everywhere, which the comment
    // above rationalised as "they carry one move clip each". They carry
    // two; the pattern could not see the second.
    const walkClipRaw = pick(/(?:^|[^a-z])walk(?:ing|s)?(?:[^a-z]|$)/);
    const walkClip = walkClipRaw !== runClip ? walkClipRaw : null;
    // A name that STARTS with idle, before anything merely containing it.
    //
    // The shared clip list puts `anims-move` first, so `/idle|stand/` found
    // `Jump_Idle` — the pose held in mid-air — and gave it to the Knight and
    // the Skeleton as their standing idle. `Idle_A` was two files later and
    // never reached. This also keeps Peeli's `Idle_Calm` ahead of her
    // `Standing` gesture without relying on clip order.
    const idleClip = pick(/^idle/) ?? pick(/idle|stand/);
    const joyClip = pick(/joy|celebrat|victory|cheer/);
    let run: THREE.AnimationAction | null = null;
    let walk: THREE.AnimationAction | null = null;
    let idle: THREE.AnimationAction | null = null;
    let joy: THREE.AnimationAction | null = null;
    // A gait cycle is retimed to the rate the trail actually moves at.
    //
    // How far along the path the character belongs is decided by how much of
    // the passage is typed — never by the clip — so every character travels
    // at the same speed and only their legs differ. The Explorer's clips are
    // what that speed was tuned against: a 1.03s walk and a 0.63s run.
    // Meshy authored the six-year-old's at 2.70s and 2.34s, two and a half to
    // nearly four times longer, so his feet cycled once for every three
    // strides of ground he covered. He was not moving too fast; his legs were
    // moving too slowly for the distance, which looks the same and is fixed
    // by a rate rather than by different animation.
    //
    // Derived from the clips rather than tabled per model, so the next
    // character needs nothing.
    const rate = (clip: THREE.AnimationClip, tuned: number) =>
      clip.duration > 0 ? clip.duration / tuned : 1;
    if (runClip) {
      run = mixer.clipAction(runClip);
      run.timeScale = rate(runClip, TUNED_RUN_SECONDS * gaitScale);
      run.play();
      run.weight = 0;
    }
    if (walkClip) {
      walk = mixer.clipAction(walkClip);
      walk.timeScale = rate(walkClip, TUNED_WALK_SECONDS * gaitScale);
      walk.play();
      walk.weight = 0;
    }
    if (idleClip && idleClip !== runClip && idleClip !== walkClip) {
      idle = mixer.clipAction(idleClip);
      idle.play();
      idle.weight = 1;
    }
    // EVERY calm loop, not just the first one that matched.
    //
    // `pick` returns a single clip, so a character shipping three idles stood
    // in one of them for the whole visit. Abee carries Idle_A, Idle_B and
    // Interact and is on screen for minutes at a time as the guide, which is
    // exactly the case a single three-second loop cannot carry: it stops
    // reading as somebody waiting and starts reading as scenery.
    //
    // Ordered with the showing one first so the cycler starts from what is
    // already on screen. Gaits are excluded -- a walk is not something to do
    // while standing still -- and so is anything one-shot, which would end
    // and leave him frozen on its last frame.
    const idles: THREE.AnimationAction[] = [];
    if (idle != null) idles.push(idle);
    for (const c of clips) {
      if (c === idleClip || c === runClip || c === walkClip) continue;
      // Anchored, and nothing that is really a settle. A loose /idle|stand/
      // also matches `sit_crosslegged_idle`, which is a SEATED pose, and
      // `stand_from_crosslegged`, which is a one-shot transition -- either
      // one in the standing pool puts him in a chair that is not there.
      if (!/^(idle|interact)/i.test(c.name)) continue;
      if (/sit|crouch|lie|sleep|_from_|from_/i.test(c.name)) continue;
      const extra = mixer.clipAction(c);
      extra.play();
      extra.weight = 0;
      idles.push(extra);
    }
    if (joyClip) {
      // Played on demand and held on its last frame rather than looping: a
      // celebration that restarts behind the finish banner reads as a stutter.
      joy = mixer.clipAction(joyClip);
      joy.setLoop(THREE.LoopOnce, 1);
      joy.clampWhenFinished = true;
      joy.weight = 0;
    }
    // The baseline every standing clip is brought onto: wherever this
    // character's own idle puts its hips.
    const idleHips = firstHips(idleClip);
    const oneShot = (
      re: RegExp,
      fix?: (c: THREE.AnimationClip) => THREE.AnimationClip,
    ) => {
      const found = pick(re);
      if (found == null) return null;
      const clip = fix ? fix(found) : found;
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.weight = 0;
      return a;
    };
    const looping = (
      re: RegExp,
      fix?: (c: THREE.AnimationClip) => THREE.AnimationClip,
    ) => {
      const found = pick(re);
      if (found == null) return null;
      const clip = fix ? fix(found) : found;
      const a = mixer.clipAction(clip);
      a.weight = 0;
      return a;
    };
    // Anchored on the base name, open at the tail.
    //
    // These were exact (`/^wave$/`), which is fine for one character and
    // breaks on the next: Meshy names the six-year-old's clips `Wave_Cute`,
    // `Walk_Cute`, `Run_Cute`. He silently had no wave at all — `oneShot`
    // returns null and the beckon simply never plays, with nothing to say
    // why. The tail is bounded to `_word` groups so `crouch_down` still
    // cannot match `crouch_idle`.
    const pose = (name: string) => new RegExp(`^${name}(?:_[a-z0-9]+)*$`);
    // The sitting arm correction is solved for ONE rig — see
    // SIT_ARM_CORRECTION, whose angles were searched against the Explorer's
    // own `Sit_CrossLegged_Idle` and his arm lengths. Applied to a different
    // character it is not a correction, it is a random rotation: on the
    // six-year-old, whose arms are shorter and whose sit is authored
    // differently, it lifted both hands off his knees into the air.
    // Applied only to the model it was solved on; anything else sits as its
    // animator posed it.
    // Gated on where the CLIP came from, not on who is wearing it. The
    // correction was solved against the Explorer's sit; a character borrowing
    // that sit needs it too, and a character with its own does not.
    const fixSit = WEARS_EXPLORER_CLIPS.has(name)
      ? (ramp: "full" | "in" | "out") => (c: THREE.AnimationClip) =>
          correctSittingArms(c, ramp)
      : () => undefined;
    const rest: RestClips = {
      wave: oneShot(pose("wave"), (c) => alignHipsToIdle(c, idleHips)),
      crouchDown: oneShot(pose("crouch_down")),
      crouchIdle: looping(pose("crouch_idle")),
      standFromCrouch: oneShot(pose("stand_from_crouch")),
      // Two naming conventions for one pose. Meshy named Peeli's transitions
      // for where they GO ("Stand_To_CrossLegged") where the Explorer's are
      // named for where they LAND ("Sit_CrossLegged_Down"), and the anchored
      // `pose()` sees only its own. She has a perfectly good sit; without the
      // alias she simply never sat, silently — the third time a new naming
      // convention has cost a clip here, after `\brun\b` and `^wave$`.
      sitDown:
        oneShot(pose("sit_crosslegged_down"), fixSit("in")) ??
        oneShot(pose("stand_to_crosslegged")),
      sitIdle:
        looping(pose("sit_crosslegged_idle"), fixSit("full")) ??
        looping(pose("crosslegged_idle")),
      standFromSit:
        oneShot(pose("stand_from_crosslegged"), fixSit("out")) ??
        oneShot(pose("crosslegged_to_stand")),
      jump: oneShot(pose("jump")),
    };
    // Only the clips this character actually has; a rig without them gets an
    // empty list and the reaction below never fires for it.
    const brave = BRAVE_CLIPS.flatMap(({ re, weight }) => {
      const action = oneShot(re, (c) => alignHipsToIdle(c, idleHips));
      return action == null ? [] : [{ action, weight }];
    });
    const fidget = FIDGET_CLIPS.flatMap((re) => {
      const a = oneShot(re, (c) => alignHipsToIdle(c, idleHips));
      return a == null ? [] : [a];
    });
    // A full-body clip, so it stands in for the idle while it plays rather
    // than layering over it.
    //
    // "The paws stay planted" was the reason given for swapping it in at full
    // weight, and it is not true. Zero ROOT travel is not planted paws:
    // measured on the shipped clip, `frontleg0` swings 26.5 degrees,
    // `R_frontleg2` 19.6 and `frontleg2` 12.7 — the front end moves a long
    // way. Dropped in at full weight on one frame, that is a visible jolt
    // every time the tail starts and stops, which is why the wag is faded
    // rather than switched; see wagW in the tick.
    const wag = looping(/^tail_wag$/, (c) => alignHipsToIdle(c, idleHips));
    if (wag != null) {
      // MEASURED OFF THE CLIP, twice, because the first measurement was also
      // wrong. This said for a long time that the clip ran three seconds and
      // completed ONE sweep in it — 0.33 Hz — and that a timeScale of 9 was
      // therefore needed to reach a dog-like 3 Hz.
      //
      // Both halves are wrong. The clip is TWO seconds, and it contains
      // THREE full cycles: tail1 traces 41, -29, 47, -8, 6 and repeats that
      // pattern three times over. So the authored wag is already about
      // 1.5 Hz, and playing it at 9 was running the tail at NINE hertz —
      // along with the front legs and ears, which the clip also keys. That
      // is not a wag, it is a blur, and it is why the tail never looked
      // right however the blending was adjusted.
      //
      // Played at its AUTHORED speed, 1.5 Hz. 2.0 was tried first, on the
      // reasoning that a pleased dog runs 2-5 Hz, and at this scale it still
      // read as too fast — the puppy is a small thing beside a walking child
      // and a tail moving that quickly reads as a blur rather than as a wag.
      // The animator's own timing is the one that looks right.
      wag.timeScale = 1;
    }
    // What this animal can do while it waits. Anything it does not have
    // simply drops out of the list, so a robot companion gets an empty one
    // and the behaviour below never fires for it.
    const DOG_TRICKS: readonly {
      readonly re: RegExp;
      readonly weight: number;
    }[] = [
      // A dog's nose is busy far more of the time than anything else it owns.
      { re: /^sniff_ground$/, weight: 6 },
      { re: /^idle_alert$/, weight: 4 },
      { re: /^shake_off$/, weight: 3 },
      { re: /^play_bow$/, weight: 3 },
      { re: /^beg$/, weight: 2 },
      // Rarest. A bark is an event, and one that happens every few seconds
      // is a nuisance rather than a dog.
      { re: /^bark$/, weight: 1 },
    ];
    const tricks = DOG_TRICKS.flatMap(({ re, weight }) => {
      const action = oneShot(re, (c) => alignHipsToIdle(c, idleHips));
      return action == null ? [] : [{ action, weight }];
    });
    // SIT IS DELIBERATELY NOT BOUND. The clip exists and is a good one; it
    // simply is not what this dog does. Settling goes straight from pottering
    // about to lying down, which is also the shorter and more readable
    // progression on screen.
    const settle = {
      lie: oneShot(/^lie_down$/, (c) => alignHipsToIdle(c, idleHips)),
      sleep: looping(/^sleep$/, (c) => alignHipsToIdle(c, idleHips)),
      // The turns, for facing back down the road when it has run ahead.
      turnLeft: oneShot(/^turn_left_90$/, (c) => alignHipsToIdle(c, idleHips)),
      turnRight: oneShot(/^turn_right_90$/, (c) =>
        alignHipsToIdle(c, idleHips),
      ),
    };
    const probe = plantFeet(gltf.scene, mixer, [idle, walk, run]);
    // Measured once per pose, AFTER planting, so each number is exactly the
    // gap that pose leaves between its lowest point and the ground.
    //
    // THE GAITS NEED THIS TOO, and not measuring them is why the characters
    // floated while standing. `plantFeet` deliberately plants on the LOWEST
    // point across idle, walk and run together — a run swings a foot lower
    // than standing ever does, and planting on the idle alone would sink that
    // foot into the road for most of every stride. The cost is the other
    // side of the same coin: planted on the run's reach, the character stands
    // that far ABOVE the ground whenever he is not running.
    //
    // It went unnoticed because the two poses that WERE measured — the crouch
    // and the sit — came out grounded, so the only poses that looked right
    // were the ones nobody walks around in.
    const lifts = {
      crouch: probe(rest.crouchIdle),
      sit: probe(rest.sitIdle),
      idle: probe(idle),
      walk: probe(walk),
      run: probe(run),
    };
    return {
      wrap,
      mixer,
      run,
      walk,
      idle,
      idles,
      hair: makeHairSim(gltf.scene),
      joy,
      rest,
      lifts,
      brave,
      fidget,
      wag,
      quadruped,
      tricks,
      settle,
    };
  }

  // ── the companion ──────────────────────────────────────────────────────
  //
  // A friend who copies what you are doing, a moment after you do it.
  //
  // The delay is the whole idea: with none, two characters move as one object
  // and the second reads as a mirror or a rendering fault. A beat behind, the
  // same movement reads as a child noticing what their friend is doing and
  // joining in — which is why it is measured in frames of "having seen it"
  // rather than tuned until it looks nice.
  //
  // It is a REPLAY, not a simulation. Every frame the player's state goes into
  // a ring buffer and the companion plays back the entry from FOLLOW_FRAMES
  // ago, so the two can never drift apart or disagree: whatever the player
  // did, the companion does, later, once.
  const FOLLOW_FRAMES = 24; // 0.4s at 60fps — a glance, not a lag
  /**
   * How far behind along the trail, on top of the delay.
   *
   * 3.3 rather than 2.6. At the old spacing the group read as a huddle: with
   * a 4.7-unit child and a 4.35-unit guide two and a half units apart, the
   * near one's shoulder overlapped the far one's for most of a stride, and
   * three characters plus a dog looked like one wide object rather than
   * several people walking together.
   */
  const FOLLOW_GAP = 3.3;
  /**
   * THE MOST PEOPLE WHO MAY WALK WITH YOU.
   *
   * Two. Each one is a full rig — its own skeleton, its own mixer, its own
   * pass through the follow logic every frame — and each one is another body
   * between the camera and the road on a view only fourteen units tall.
   * Three was tried on paper and the line reaches past the letter tiles.
   */
  const MAX_FOLLOWERS = 2;
  /** How much further back each one walks than the one in front. */
  const FOLLOW_STAGGER = 2.4;
  /**
   * Where the first companion walks once a GUIDE is on the road too.
   *
   * In band 2 he falls in at 1.6 behind the child, which is the space the
   * companions were using. Rather than have him stand in them, they shuffle
   * back and leave him the gap -- and go back to their ordinary spacing the
   * moment the guide is turned off, because without him there is nothing
   * there to make room for.
   */
  const FOLLOW_GAP_GUIDED = 4.6;
  /**
   * And how much further out, so they are a line rather than a file.
   *
   * Widened with the gap: depth alone separates them for the camera looking
   * along the road, but this one is what stops the second and third reading
   * as the first one's shadow.
   */
  const FOLLOW_SPREAD = 0.8;
  /** To one side, so they walk together rather than in single file. */
  const FOLLOW_SIDE = 1.9;
  /** Which half of the road the pair walk on, and how far apart. */
  const LANE = theme.laneZ ?? 0;
  const SIDE = theme.followSide ?? FOLLOW_SIDE;
  type FollowSample = {
    x: number;
    y: number;
    moveW: number;
    runShare: number;
    celebrating: boolean;
    /** The player is down — crouching or sitting — not merely standing still. */
    resting: boolean;
  };
  const followBuffer: FollowSample[] = [];
  /**
   * SOMEBODY WALKING WITH YOU, and there may be two of them.
   *
   * Each carries its own place in the line and its own running state. The
   * state used to be four module-level variables — one rig, one name, one
   * dust counter, one celebrating flag — which is exactly as many as one
   * companion needs and no more; a second would have quietly shared the
   * first's dust and its celebration. Per-follower is the only arrangement
   * that cannot do that.
   */
  type Follower = {
    readonly rig: DinoRig;
    readonly name: string;
    /**
     * How far BEHIND the player this one walks. Negative means ahead, which
     * only the guide ever is.
     *
     * Mutable for him alone: a companion's place in the line is fixed, but the
     * guide's whole characterisation is that his distance along the road
     * changes — three units ahead when he is showing them the way, one when he
     * is accompanying them, and anywhere at all once he has stopped
     * performing. Rewriting this each frame lets the five-hundred-line follow
     * body below drive him without knowing he is different.
     */
    gap: number;
    /** The local boy. See `setGuide` and `guideGap`. */
    readonly guide: boolean;
    /** Which z it holds, already including the lane. */
    readonly z: number;

    lastX: number;
    dust: number;
    celebrating: boolean;
    /** Its own timers, offsets and poses — see freshFollowState. */
    readonly s: FollowState;
  };
  const followers: Follower[] = [];
  let companionNames: readonly string[] = [];

  // ── the guide ──────────────────────────────────────────────────────────
  //
  // Section 00c of the voice script, in the world rather than in the text:
  // "the same arc, in the world — and it says more than the lines do, because
  // a child sees it every second of every lesson without anybody having to
  // narrate it."
  //
  // He is on the road, in their lane, always. Only his position ALONG the road
  // changes with the band; how far ACROSS it never does.
  let guideName: string | null = null;
  let guideStones = 0;
  let guidePrevPlayerX: number | null = null;

  /**
   * One walking step, in world units along the road. Only used to turn "two
   * to five steps" into a distance; the walk cycle is rate-matched to ground
   * speed elsewhere, so this need only be about right.
   */
  const GUIDE_STEP = 0.55;

  /** Milestones ever passed. Decides which of the three bands he is in. */
  function setGuideBand(stones: number): void {
    guideStones = Math.max(0, Math.floor(stones));
  }

  /**
   * How much room the companions are currently making for the guide, 0..1.
   *
   * Not a yes/no on whether a guide EXISTS -- he is only in their way when he
   * is actually standing in the space behind the child, which is band 2 and
   * the moments either side of it. In band 1 he is three units up the road
   * and in band 3 he is off wandering, and both times the friends should be
   * back at their ordinary spacing rather than holding a gap for somebody who
   * is nowhere near it.
   *
   * Eased rather than switched, so they open up and close as he arrives and
   * leaves instead of teleporting a unit and a half the frame he crosses.
   */
  let companionRoom = 0;

  /**
   * The gap each band settles him at, so SPAWN and the per-frame easing agree.
   *
   * They did not: he was always placed at -3 (band 1) and then eased to
   * wherever his band actually wanted him, so a child loading into band 2
   * watched him walk 4.6 units backwards into position before the game had
   * started. Band 3 has no fixed place, so it borrows band 2's as an opening
   * position and drifts off it from there.
   */
  function guideBandGap(): number {
    if (guideStones <= 5) {
      return -3;
    }
    return 1.6;
  }

  /** Where the guide has to be before the friends bother making room. */
  function guideInTheirSpace(): boolean {
    const g = followers.find((f) => f.guide);
    return g != null && g.gap > 0.4 && g.gap < FOLLOW_GAP_GUIDED - 0.3;
  }

  /**
   * Re-space the companions.
   *
   * Walks them in order rather than trusting the index they were spawned
   * with: turning a companion off leaves the rest renumbered, and spacing
   * them by a stale index puts a gap where nobody is standing.
   */
  function respaceCompanions(): void {
    const base = FOLLOW_GAP + companionRoom * (FOLLOW_GAP_GUIDED - FOLLOW_GAP);
    let i = 0;
    for (const f of followers) {
      if (f.guide) {
        continue;
      }
      f.gap = base + i * FOLLOW_STAGGER;
      i += 1;
    }
  }

  /**
   * Where the guide should be, this frame, as a gap behind the player.
   *
   * Negative is ahead. Written straight onto `follower.gap` so the ordinary
   * follow body walks, turns and animates him without knowing he is the guide.
   */
  function guideGap(
    f: Follower,
    dt: number,
    advanceX: number,
    moving: boolean,
  ): void {
    const s = f.s;
    const ease = (want: number, rate: number) => {
      f.gap += (want - f.gap) * Math.min(1, dt * rate);
    };
    // THE ROADSIDE REST BELONGS TO EVERY BAND.
    //
    // This used to sit below the two band returns, which quietly meant it
    // only existed once the child had passed eighteen milestones -- so for a
    // whole first session the guide just stood there while the hero sat. The
    // bands decide WHERE he walks. They have no business deciding whether he
    // is allowed to sit down.
    if (s.sitPhase === "up") {
      // Getting to his feet. He holds the ground he is on until he is up --
      // drifting away mid-stand slides him along on his backside.
      f.gap += advanceX;
      return;
    }
    if (s.dogTravel === "guideStroll") {
      // A FEW STEPS ON, THEN SIT. Standing motionless while a child works out
      // where the K is reads as a paused game. Walking a little way up the
      // road and sitting down reads as a boy who has decided this will take a
      // minute -- and it leaves him somewhere they have to reach, which is
      // what he is for.
      f.gap += advanceX;
      f.gap -= dt * 1.25;
      if (f.gap <= s.guideStrollTo) {
        s.dogTravel = "guideWait";
        s.guideRest = true;
      }
      return;
    }
    if (s.dogTravel === "guideWait" && s.guideRest) {
      // HE KEEPS THE GROUND HE WALKED TO.
      //
      // Getting up is not the same as coming back. This used to hand straight
      // to the drift the moment they typed, and the drift eases him toward
      // his usual place -- so the five to seventeen steps he had just taken
      // up the road were undone in front of them, sliding backwards while
      // they walked forwards.
      //
      // He stands (the sit chain watches the same movement) and then simply
      // stops there. The gap closes because THEY advance into it, which is
      // the whole point of having walked on ahead, and the rule below hands
      // him back to the drift once they have drawn level.
      f.gap += advanceX;
      if (moving && f.gap > -0.8) {
        s.guideRest = false;
        s.dogTravel = "guideDrift";
        s.dogNextRun = dogWait(60 + Math.random() * 60);
      }
      return;
    }
    // ONLY ONCE THE CHILD HAS SAT DOWN, AND NOT SOON.
    //
    // A pause is not the same as having stopped. Children break off for a few
    // seconds constantly -- to find a key, to look at the road -- and a guide
    // who wanders off and sits every time reads as bored of them. So he waits
    // for the hero's own sit, which is the game saying this is a real rest,
    // and then he waits again.
    //
    // Both numbers are drawn, never fixed: the delay once per settle, and the
    // step count when he finally goes.
    const heroSat = restStage === "sitDown" || restStage === "sitIdle";
    // ── EXCEPT FROM THE LITTLE ONE. HE DOES NOT LEAVE HIM. ───────────────
    //
    // Everything below is the guide getting bored of a long rest and
    // wandering a few steps up the road to wait, which is right for a child
    // of nine: they have stopped, he has somewhere to be, and he will be in
    // sight when they look up.
    //
    // Little Drew is six. The same behaviour reads completely differently
    // beside a six-year-old who has sat down on a road in 1930 — the person
    // showing him the way strolls off and leaves him sitting there. So with
    // Drew the guide simply never goes: he stays where he is, and the
    // look-back and the sit-with-them below carry the whole rest.
    if (playerIsLittle()) {
      s.guideIdleT = 0;
      s.guideRestWait = 0;
      return;
    }
    if (moving || !heroSat) {
      s.guideIdleT = 0;
      s.guideRestWait = 0;
    } else if (s.sitPhase === "none") {
      if (s.guideRestWait <= 0) {
        s.guideRestWait = 45 + Math.random() * 45; // 45s to a minute and a half
        s.guideIdleT = 0;
      }
      s.guideIdleT += dt;
      if (s.guideIdleT >= s.guideRestWait) {
        s.guideIdleT = 0;
        s.guideRestWait = 0;
        // TWELVE TO TWENTY-FOUR, and the FLOOR is the point.
        //
        // Two to five was a shuffle; five to seventeen fixed the top of the
        // range and left the bottom of it wrong. At five steps — under three
        // units — he sits down almost at their elbow, which is not a guide
        // who has walked on ahead to wait, it is a guide who stood up, took a
        // couple of paces and sat back down next to them. Sitting close is
        // the one thing this behaviour must never read as.
        //
        // At 0.55 a step the floor is now about six and a half units and the
        // top about thirteen: far enough up the road that he is plainly
        // somewhere else, near enough to still be in frame and to be worth
        // looking back at. Drawn fresh every time, so where he ends up is
        // never the same spot twice.
        //
        // None of this applies to Little Drew — see the guard above. He does
        // not go at all.
        const steps = 12 + Math.floor(Math.random() * 13); // 12 to 24
        s.guideStrollTo = f.gap - steps * GUIDE_STEP;
        s.dogTravel = "guideStroll";
        return;
      }
    }
    if (guideStones <= 5) {
      // Band 1 — leading, about three units up the road, and he does not fall
      // back. He is showing them the way and the arrangement says so.
      ease(-3, 1.4);
      return;
    }
    if (guideStones <= 18) {
      // Band 2 — FALLEN IN BEHIND THEM, between the child and the friends.
      //
      // He led in band 1 because they did not know the road; by here they do,
      // and a guide still walking in front of somebody who knows the way is
      // in front of them rather than with them. Positive gap, so he is behind
      // -- and at 1.6 against the companions' 3.3 he sits in the space
      // between, which is the one place on the road nobody else stands.
      ease(1.6, 1.4);
      return;
    }
    // Band 3 — no fixed place at all.
    if (s.dogTravel === "guideWait") {
      // Holding station while the trail comes to him. The gap closes by
      // exactly the distance the child covers, which is what makes it read as
      // waiting for THEM rather than counting to a number.
      f.gap += advanceX;
      // A REST ENDS THE MOMENT THEY START. If he sat down because they had
      // stopped, there is no reason to stay down once they are typing again;
      // waiting for them to draw level would leave him sitting as they walk
      // past. A wait he took by running on ahead still ends on the gap,
      // because there the whole point is that they catch him up.
      if (s.guideRest && moving) {
        s.guideRest = false;
        s.dogTravel = "guideDrift";
        s.dogNextRun = dogWait(60 + Math.random() * 60);
        return;
      }
      if (f.gap > -0.8) {
        s.guideRest = false;
        s.dogTravel = "guideDrift";
        s.dogNextRun = dogWait(60 + Math.random() * 60);
      }
      return;
    }
    if (s.dogTravel === "guideDash") {
      // Faster than the child, which is what makes it a run rather than a
      // drift. Twelve units is the cap: past that the camera loses him and he
      // is simply gone, which reads as a bug rather than as a boy running on.
      f.gap -= dt * 3.4;
      if (f.gap <= s.dogLeadTarget) {
        s.dogTravel = "guideWait";
      }
      return;
    }
    // ONLY ONCE THE CHILD HAS SAT DOWN, AND NOT SOON.
    //
    // A pause is not the same as having stopped. Children break off for a few
    // seconds constantly -- to find a key, to look at the road -- and a guide
    // who wanders off and sits every time reads as bored of them. So he waits
    // for the hero's own sit, which is the game's way of saying this has
    // become a proper rest, and then he waits again.
    //
    // Both numbers are drawn, not fixed: the delay once per settle, and the
    // step count when he finally goes. A boy who always waits the same minute
    // and always paces the same distance is a mechanism; the whole point of
    // him is that he is not.
    // Drifting: between about four units behind and six ahead, over twenty or
    // thirty seconds, crossing through the group — what somebody does on a
    // road they have walked their whole life.
    s.dogWander += dt;
    // NEVER BACKWARDS IN WORLD SPACE. The drift can swing him ten units over
    // twenty-six seconds, which at a slow walk is quicker than the child is
    // travelling — so easing him rearward faster than they advance moves him
    // backwards up the road while his walk cycle plays forwards. He may fall
    // behind, but only ever by standing still relative to the ground.
    const was = f.gap;
    ease(-1 + 5 * Math.sin((s.dogWander * 2 * Math.PI) / 26), 0.9);
    if (f.gap - was > advanceX) {
      f.gap = was + Math.max(0, advanceX);
    }
    if (!moving) {
      return;
    }
    // Never on a timer a child could learn.
    s.dogNextRun -= dt;
    if (s.dogNextRun <= 0) {
      s.dogTravel = "guideDash";
      s.dogLeadTarget = -(8 + Math.random() * 4);
    }
  }

  // ── standing about ─────────────────────────────────────────────────────
  //
  // It once had legs of its own and wandered while the player sat: a leash, a
  // keep-clear radius, a step length, an arrival threshold, the lot. All gone.
  // Chasing a goal that drifts with the player meant it was always mid-journey
  // and never arrived, so it walked without pause — and no tuning of speeds or
  // distances fixed a problem that was really "it has somewhere to be at all".
  //
  // What is left is turning. Standing and looking about needs no walk cycle,
  // so it cannot slide, cannot cycle its legs on the spot, and cannot end up
  // anywhere it should not be.
  /** Where it is facing, and how long before it looks somewhere else. */
  /**
   * EVERYTHING ONE FOLLOWER REMEMBERS BETWEEN FRAMES.
   *
   * Thirty variables, and every one of them used to be a module-level `let`.
   * That is exactly right for one companion and silently wrong for two: the
   * body below runs once per follower, so the pair shared a single fidget
   * timer, a single tail wag, one dog-wander offset and one "have I settled
   * yet" flag. Each frame the second follower read the first's half-written
   * state, which is why two companions came out walking when one would have
   * been resting, and why they made unrelated little movements while the
   * child sat down instead of settling with them.
   *
   * There is no clever fix for shared mutable state. There is only not
   * sharing it.
   */
  const freshFollowState = () => ({
    lookTarget: Math.PI / 2,
    lookHold: 0,
    compFidget: null as THREE.AnimationAction | null,
    compFidgetT: 0,
    compFidgetCool: 4,
    wagT: 0,
    wagCool: 3 + Math.random() * 6,
    wagW: 0,
    dogAct: null as THREE.AnimationAction | null,
    /** Seconds into this rest at which the dog next lies down. Moves each
     *  time it gets up again, so one settle cannot chain into the next. */
    dogSettleAt: 75,
    dogT: 0,
    dogRested: 0,
    dogSettled: -1,
    dogW: 0,
    dogOffX: 0,
    dogOffZ: 0,
    dogWander: 0,
    dogGap: 0,
    dogOrbit: 0,
    dogOrbitDir: 1,
    dogLead: 0,
    dogTravel: "heel" as string,
    dogLeadTarget: 0,
    dogNextRun: 8 + Math.random() * 14,
    dogPrevSeenX: null as number | null,
    dogTurn: null as THREE.AnimationAction | null,
    dogTurnT: 0,
    /**
     * The calm loop being faded IN, how far in it is, and how long until the
     * next swap. Null when he is simply standing in the one he has.
     */
    idleAlt: null as THREE.AnimationAction | null,
    idleFade: 0,
    idleNext: 6 + Math.random() * 10,
    /** Radians the guide's running turn clip will hand to the wrap when it ends. */
    turnBy: 0,
    /**
     * Radians of a turn the CLIP does not cover, spun under it un-animated.
     *
     * The clip is worth a quarter turn and no more. Playing it twice for a
     * 180 read as two turns, because it is two turns: the second copy
     * restarts from its own first frame, so the pose resets halfway round,
     * and it loads the same leg both times -- he steps off the right foot,
     * lands, and steps off the right foot again.
     *
     * So the clip runs once and the wrap turns the remainder at the same
     * time, underneath it. The footwork is only right for ninety of the
     * hundred and eighty; the rest is a glide wearing a step-turn. That is
     * the trade, and it is deliberate.
     */
    turnSpin: 0,
    /** How much of `turnSpin` has already been handed to the wrap. */
    turnSpun: 0,
    /** Seconds left of the spin, and how long it was given. */
    turnSpinT: 0,
    turnSpinDur: 0,
    /** Seconds until the guide next glances back down the road at them. */
    guideLookBack: 3 + Math.random() * 5,
    /** Whether this child has ever set off. Until they have, the guide has
     *  nobody to look back AT. */
    guideEverMoved: false,
    /** The guide's roadside sit: which clip is up, and how long is left of it. */
    sitAct: null as THREE.AnimationAction | null,
    sitPhase: "none" as string,
    sitT: 0,
    /** How long the child has been settled, and where a stroll is heading. */
    guideIdleT: 0,
    guideStrollTo: 0,
    /** The wait drawn for THIS settle. Zero means one has not been drawn. */
    guideRestWait: 0,
    /**
     * True when he sat down because they STOPPED, rather than because he ran
     * on ahead. The two waits end differently: one ends when they draw level,
     * the other the moment they start typing again.
     */
    guideRest: false,
    dogAhead: 0,
    dogSpeed: 0,
    dogPrevX: 0,
    dogPrevZ: 0,
  });
  type FollowState = ReturnType<typeof freshFollowState>;
  /** The standing gesture a companion is playing, and what is left of it. */
  /** Seconds until it may play another. */
  /**
   * The tail wag: how much of this burst is left, and how long until the
   * next one may start.
   *
   * A dog does not wag on a timer. It wags when it is pleased with you, for
   * as long as it feels like, and then gets on with being a dog — so a burst
   * has its own random length and is followed by a silence long enough that
   * the next one reads as a decision rather than a cycle. Continuous wagging
   * is the one thing this must never look like.
   */
  /**
   * How much of the wag is mixed in, 0..1, eased.
   *
   * The wag clip keys the front legs and the ears as well as the tail, so
   * cutting to it at full weight moves the whole front of the dog on a single
   * frame. Blended in over a fifth of a second the tail simply starts, which
   * is what a tail does.
   */
  // ── THE DOG'S OWN LIFE ────────────────────────────────────────────────
  //
  // What the companion does while the child is sitting on the trail. It used
  // to be one thing: wag. The puppy has eighteen clips and five of them were
  // ever reachable, so a child who stopped to think watched a dog stand
  // perfectly still and move its tail.
  //
  // Now it has somewhere to put the rest. The shape is a dog's, not a
  // playlist's: mostly nose-down pottering about, a bark now and then, and —
  // if the wait goes on — sitting, then lying, then asleep, which only ever
  // goes one way and is undone the moment the child gets up.
  /** The trick playing now, and how long is left of it. */
  /** How long the child has been down. Drives the settling progression. */
  /** 0 sitting, 1 lying, 2 asleep; -1 not settled. */
  /** Blend weight of whatever the dog is doing instead of its idle. */
  /** Where it has pottered to, relative to its place at the child's heel. */
  /** The pause after a trick, during which the dog simply stands. */
  /** Where it is round its circle of the child, and which way it is going. */
  // ── RUNNING AHEAD ─────────────────────────────────────────────────────
  //
  // The companion is otherwise a strict REPLAY of the child's own path, a
  // fixed distance behind. That is right for keeping the pair together and
  // wrong for a dog, which does not walk to heel: it goes on ahead, stops,
  // and looks back to see whether you are coming.
  //
  // So the excursion rides on the replay as a lead offset. "Waiting" is not
  // a separate position system — the dog simply holds its ground while the
  // replay advances underneath it, and the lead shrinks on its own until the
  // child has caught up.
  /** How far ahead of its place at heel the dog currently is. */
  /** "heel" | "ahead" | "wait" */
  /** Last frame's replayed x, to know how far the trail moved under it. */
  /** A turn-on-the-spot clip, playing. */
  /** How far in front of its heel position the dog is being drawn. */
  /** Its own measured speed over the ground, for driving the legs. */

  // ── population ─────────────────────────────────────────────────────────
  // Showcase (opts.showcaseModel): a dedicated mixer that cycles
  // every clip, driven straight off the frame delta so it keeps playing even
  // when the learner is idle and nothing else on the trail is moving.
  let buffaloMixer: THREE.AnimationMixer | null = null;
  let buffaloActions: THREE.AnimationAction[] = [];
  let buffaloWrap: THREE.Group | null = null;
  let buffaloFootLift = 0; // measured, so the hooves sit ON the ground
  let buffaloStarted = false;
  let idleShowMixer: THREE.AnimationMixer | null = null;
  let idleShowWrap: THREE.Group | null = null;
  let idleShowFootLift = 0;
  let buffaloIdx = -1;
  let buffaloHold = 0;
  // Which clips REPEAT. Everything else plays once and holds its last frame -
  // looping them meant Death restarted from standing before you ever saw it lie
  // down, and the puppy's Sit sprang back up mid-sit.
  const SHOWCASE_LOOPS =
    /^(Walk|Walk_Backward|Idle|Idle_Alert|Run|Trot|Charge_Loop|Sleep|Beg|Sniff_Ground|Tail_Wag)$/;
  const SHOWCASE_H: Record<string, number> = { Buffalo: 5.9, Puppy: 2.1 };
  function advanceBuffalo(i: number) {
    if (!buffaloMixer || buffaloActions.length === 0) return;
    const next = buffaloActions[i];
    const prev = buffaloActions[buffaloIdx];
    next.reset();
    // One-shots play ONCE and hold their last frame; only the gaits and idles
    // repeat. Looping everything meant Death restarted from standing before
    // you ever saw it lie down — the collapse was there, the showcase just
    // never let it finish.
    const loops = SHOWCASE_LOOPS.test(next.getClip().name);
    next.setLoop(
      loops ? THREE.LoopRepeat : THREE.LoopOnce,
      loops ? Infinity : 1,
    );
    next.clampWhenFinished = !loops;
    next.setEffectiveWeight(1);
    next.play();
    if (prev && prev !== next) next.crossFadeFrom(prev, 0.25, false);
    buffaloIdx = i;
    buffaloHold = 0;
    opts.onShowcaseClip?.(next.getClip().name, i, buffaloActions.length);
  }
  let player: DinoRig | null = null;
  let playerH = 2.6; // fitted height of the current player model
  /**
   * WHO THE CHILD IS PLAYING AS, by model id.
   *
   * Read by the cast to decide how to treat them. Little Drew is six, and the
   * road behaves differently around a six-year-old than it does around a
   * nine-year-old: the guide does not leave him, the buffalo mostly keeps him
   * company instead of charging, and the puppy plays. None of that is a
   * difficulty setting the child can see — it is the village knowing how
   * small he is.
   */
  let playerWho = theme.defaultPlayer;
  /** Little Drew is six. Dave and Peeli are nine. */
  const LITTLE = "Explorer6";
  const playerIsLittle = () => playerWho === LITTLE;
  /**
   * HOW LONG THE PUPPY WAITS BEFORE IT RUNS OFF AND LOOKS BACK AGAIN.
   *
   * The dash — tear ahead, stop, turn, wait for them to catch up — is the
   * puppy's whole personality, and how OFTEN it does it is the difference
   * between a dog that happens to be walking the same way and a dog that is
   * playing with somebody. With Little Drew it is playing: the gap between
   * dashes is a little over a third of what it is for the older two.
   *
   * The wait is never a fixed number anywhere — a child learns a metronome
   * in an afternoon — so this scales whatever was drawn rather than
   * replacing it.
   */
  const dogWait = (secs: number) => secs * (playerIsLittle() ? 0.38 : 1);
  let playerX = -6;
  let targetX = -6;
  let runStart = -6;
  /** This run's length — see runLengthFor. Full until a passage says otherwise. */
  let runLen = RUN_LEN;
  let runEnd = runStart + runLen;
  let flagPole: THREE.Mesh | null = null;
  let flagCone: THREE.Mesh | null = null;
  /**
   * Builds one milestone, carved with its own number. Set once the stone
   * geometry and material exist (see the world build).
   */
  let makeMilestone: ((n: number) => THREE.Object3D) | null = null;
  /** Rebuilds the stones already standing behind the child. Set once they
   *  are first planted, and called again when the carved model lands. Held on
   *  an object because a `let` gets narrowed to `never` at the call site,
   *  which sits earlier in the file than the assignment. */
  const rebuild: { behind: (() => void) | null } = { behind: null };
  /**
   * WORK THAT MAY ARRIVE LATE, SPREAD OVER THE FRAMES AFTER IT IS ASKED FOR.
   *
   * Starting a lesson plants a milestone, and planting a milestone is not one
   * object: it is a stone, a carved number drawn to a canvas and uploaded as
   * a texture, a lamp with its own weathered materials, and three to five
   * rocks around each of their feet. All of it ran inside the single frame
   * that began the passage, and that frame measured at up to 74ms — a
   * visible lurch at the exact moment a child starts typing again, which is
   * the worst possible moment for one.
   *
   * None of it is urgent. The stone itself goes in at once, because it is
   * what the child is looking at; the furniture around it is built over the
   * next few frames at three milliseconds a frame, which is under a fifth of
   * a frame's budget and invisible. By the time they have walked far enough
   * to see any of it, it has been standing there for seconds.
   */
  const slices: (() => void)[] = [];
  const SLICE_MS = 3;
  const later = (fn: () => void): void => {
    slices.push(fn);
  };
  const runSlices = (): void => {
    if (slices.length === 0) {
      return;
    }
    const until = performance.now() + SLICE_MS;
    while (slices.length > 0 && performance.now() < until) {
      // Shifted before running: a task that throws must not be retried
      // forever, and one that queues more work must land behind what is
      // already waiting rather than in front of it.
      slices.shift()!();
    }
  };
  /**
   * A few loose stones round the foot of something standing at the roadside.
   *
   * A post set in the ground has stones packed round its base — that is how
   * it was made to stand up — and ninety years of a cart road washes more
   * against it. Without them a milestone reads as an object placed on the
   * grass rather than one planted in it, which is the difference between
   * scenery and a place.
   */
  let makeBaseRocks: ((x: number, z: number) => void) | null = null;
  /**
   * Plants the greenery round a milestone, at the stone's OWN position.
   *
   * It has to be a callback for the same reason the base rocks are: the
   * stones are not placed when the world is built, they are placed as the
   * child reaches them -- see `stoneXFor`, which follows their progress and
   * is not a multiple of anything. Planting
   * at build time put the greenery at 26, 52, 78... and the stones somewhere
   * else entirely, so the two never met.
   */
  let makeBasePlants: ((x: number, z: number) => void) | null = null;

  /**
   * NINETY YEARS OF WEATHER, applied to a stone that came out of the
   * generator looking like it was cut yesterday.
   *
   * Three things separate old roadside stone from new, and none of them is
   * the model:
   *
   *   1. IT IS DIRTY AT THE BOTTOM AND BLEACHED AT THE TOP. Rain splashes
   *      soil up the foot and moss grows where it stays damp; the sun takes
   *      the colour out of everything above that. A single flat tint cannot
   *      say this, which is why these read as new however dark they are
   *      made — it is the GRADIENT that reads as age.
   *   2. NO TWO ARE ALIKE. A row of identical stones is a row of props. Each
   *      gets its own tone and its own damp line.
   *   3. IT IS COMPLETELY MATT. Any sheen at all reads as polished, and
   *      polished granite is a headstone, not a milestone.
   *
   * Materials are CLONED first. The models are cloned per instance but three
   * shares their materials, so tinting in place would age every stone on the
   * road identically — and then re-age them on the next one.
   */
  function weatherStone(root: THREE.Object3D, seed: number): void {
    const tone = 0.62 + (((seed * 9301 + 49297) % 233280) / 233280) * 0.3;
    const damp = 0.22 + (((seed * 4177 + 7919) % 100) / 100) * 0.22;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.material == null) {
        return;
      }
      const src = Array.isArray(m.material) ? m.material[0] : m.material;
      // The lamp's flame is a mesh like any other, and ageing it would grey
      // out the one part of the stone that is supposed to look new.
      const lit = src as THREE.MeshStandardMaterial;
      if (lit.emissive != null && lit.emissive.getHex() !== 0x000000) {
        return;
      }
      const mat = lit.clone();
      mat.roughness = 1;
      mat.metalness = 0;
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      const lo = bb?.min.y ?? 0;
      const hi = bb?.max.y ?? 1;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uLo = { value: lo };
        shader.uniforms.uHi = { value: hi };
        shader.uniforms.uTone = { value: tone };
        shader.uniforms.uDamp = { value: damp };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
             varying float vStoneY;`,
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             vStoneY = position.y;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
             varying float vStoneY;
             uniform float uLo;
             uniform float uHi;
             uniform float uTone;
             uniform float uDamp;`,
          )
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
             {
               float t = clamp((vStoneY - uLo) / max(0.001, uHi - uLo), 0.0, 1.0);
               // The damp line, with a wobble so it is not a ruled band.
               float wob = sin(vStoneY * 37.0) * 0.03 + cos(vStoneY * 13.0) * 0.02;
               float up = smoothstep(uDamp - 0.06, uDamp + 0.34 + wob, t);
               // Dirty green-grey at the foot, sun-bleached bone at the head.
               vec3 foot = vec3(0.34, 0.38, 0.28);
               vec3 head = vec3(1.04, 1.02, 0.94);
               diffuseColor.rgb *= mix(foot, head, up) * uTone;
               // Streaks where water has run down it, over the whole height.
               float run = 0.94 + 0.06 * sin(vStoneY * 61.0 + uTone * 30.0);
               diffuseColor.rgb *= run;
             }`,
          );
      };
      // One program for every weathered stone: the uniforms differ per
      // material, the code does not, so they share a compile.
      mat.customProgramCacheKey = () => "weathered-stone";
      m.material = mat;
    });
  }
  /**
   * Every milestone planted this session, by the round it marks.
   *
   * A milestone is not a marker that follows you - it is a stone somebody set
   * in the ground, and the whole point of passing one is that it is still
   * there behind you. The camp flag was a single object moved to each new
   * `runEnd`, which meant the one you had just reached vanished the moment you
   * reached it. These are planted and left.
   */
  const milestones = new Map<number, THREE.Object3D>();
  /**
   * HOW CLOSE A TONNE OF ANIMAL MAY GET TO A SET STONE.
   *
   * The milestones stand on the FAR verge — `meander(x) - roadClear * 0.92` —
   * and the buffalo's fence holds it at `roadClear * 0.95` on that same side.
   * The two are three hundredths of the clearance apart, which is to say the
   * animal charges down the exact line the stones are planted on, and before
   * this it went straight through them: a stone lamp passing through a
   * buffalo's ribs, in a game whose whole subject is a road somebody built.
   */
  const STONE_CLEAR = 1.7;
  /**
   * How far along x something may travel from `fromX` towards `toX` without
   * walking into a milestone. Returns `toX` when the way is clear.
   *
   * X only, and deliberately: the stones and the charge lane are the same
   * line, so what decides whether the way is blocked is how far up the road
   * the stone is, not its distance as the crow flies. `z` is used only to
   * ignore stones on the other verge entirely.
   */
  const stoneLimitX = (fromX: number, toX: number, z: number): number => {
    const dir = Math.sign(toX - fromX);
    if (dir === 0) {
      return toX;
    }
    let limit = toX;
    const consider = (o: THREE.Object3D | null) => {
      if (o == null) {
        return;
      }
      if (Math.abs(o.position.z - z) > 2.2) {
        return; // a stone on the other side of the road is not in the way
      }
      if ((o.position.x - fromX) * dir <= 0) {
        return; // already past it
      }
      // Pull up short of the stone — or, if it is already inside the
      // clearance, do not move at all rather than reverse out of it.
      let stop = o.position.x - dir * STONE_CLEAR;
      if ((stop - fromX) * dir < 0) {
        stop = fromX;
      }
      if ((stop - fromX) * dir < (limit - fromX) * dir) {
        limit = stop;
      }
    };
    for (const o of milestones.values()) {
      consider(o);
    }
    // The one being walked TOWARDS is not in the map until it has been
    // passed, and it is the one most likely to be standing in a charge.
    consider(pendingStone);
    return limit;
  };
  /**
   * Every carved number on the road, so it can light as it is approached.
   *
   * A milestone at night is a dark stone with a dark number on it — the one
   * piece of information the marker exists to carry, and the only hours when
   * a child cannot read it. This is not a lamp: it comes up as they get near
   * and goes out behind them, the way a number catches the light as you draw
   * level with it.
   */
  const milestoneGlow: {
    readonly mat: THREE.MeshStandardMaterial;
    readonly obj: THREE.Object3D;
  }[] = [];
  /**
   * The x a roadside object needs so it LOOKS level with the lane.
   *
   * The milestones stand on the far verge, about ten units further from the
   * camera than the child walking the near one — and this camera is offset
   * along x, so its right vector carries a z component of 0.23. Depth
   * therefore leaks into screen-x: measured, a stone planted at exactly the
   * finish appeared 2.2 units to the LEFT of the child who had just reached
   * it, which reads as the milestone arriving early.
   *
   * The stone was never in the wrong place. It was in the right place and
   * drawn somewhere else, which is why moving it by eye would have been
   * wrong for the next camera. Solved from the camera's own right vector, it
   * follows any change to the view.
   */
  const laneAlignedX = (x: number, z: number, laneZ: number): number => {
    cam.updateMatrixWorld(true);
    const r = _tmpRight.setFromMatrixColumn(cam.matrixWorld, 0);
    if (Math.abs(r.x) < 1e-4) {
      return x;
    }
    return x + ((laneZ - z) * r.z) / r.x;
  };
  const _tmpRight = new THREE.Vector3();
  /**
   * The number cut into the NEXT stone to be planted.
   *
   * Starts from what the child has already walked past, not from zero.
   */
  let milestoneNo = Math.max(0, Math.floor(opts.stonesPassed ?? 0));
  // `MIN_STONE_GAP` and the lead cap live in stone-x.ts, with the arithmetic
  // they belong to — see `stoneXFor`, and the note there on why the gap is a
  // preference rather than a promise.
  /**
   * THE STONE STANDING AHEAD, AND NOT YET EARNED.
   *
   * A milestone is the flag now, and a flag is one marker that moves with the
   * run — not a new marker every time the run is set up.
   *
   * `startRun` is called far more often than a lesson is finished: once per
   * passage, and again whenever the passage is regenerated under the child
   * because a key joined the practice set, or a setting changed, or the words
   * were rerolled. Every one of those calls used to plant a permanent stone
   * AND take the next number with it, so a child who had finished three
   * lessons met a stone reading 4 in the middle of the fourth and then the
   * real one reading 5 at the end of it. The numbers were not wrong; there
   * were simply more stones than lessons.
   *
   * So the stone ahead is held here rather than committed. A second
   * `startRun` moves it instead of planting another, and only the page saying
   * the lesson is finished — see `passStone` — makes it permanent and lets
   * the number move on.
   */
  let pendingStone: THREE.Object3D | null = null;
  let pendingX = 0;
  /** Where the last stone went in, so the next one can keep its distance. */
  let lastStoneX = -Infinity;
  /**
   * When the wave starts, so that it finishes exactly as the crouch begins.
   *
   * Timing it from the pause instead left a gap: the wave ran 5.0s to 8.3s and
   * he stood in `Idle` for the next 1.7 seconds before crouching, which is the
   * one moment in the chain where nothing is happening and the return to idle
   * is visible as a change rather than a continuation. Backing the start off
   * the crouch closes the gap entirely — the wave runs straight into it.
   *
   * `REST_WAVE_S` survives as a floor, so a very long wave clip could not pull
   * the gesture forward into the first few seconds of a pause.
   */
  function waveAt(r: RestClips): number {
    const dur = r.wave?.getClip().duration ?? 0;
    return Math.max(REST_WAVE_S, REST_CROUCH_S - dur);
  }

  /** How much longer he waits before reacting, given how often they pause. */
  function patience(): number {
    return 1 + Math.min(pauses, PATIENCE_CAP) * PATIENCE_STEP;
  }

  /**
   * Says a line, if the budget allows. One per pause, and never two inside
   * the cooldown — so a run of short pauses produces poses and silence.
   */
  function maybeSay(stage: "wave" | "crouch" | "sit"): void {
    const now = clock.elapsedTime;
    if (spokeThisPause || now - lastSpokeAt < SPEAK_COOLDOWN_S) return;
    spokeThisPause = true;
    lastSpokeAt = now;
    opts.onRest?.(stage);
  }

  /** Starts a one-shot rest clip and records how long it runs for. */
  function startRest(stage: RestStage, action: THREE.AnimationAction): void {
    if (restAction != null && restAction !== action) {
      restPrev = restAction;
      restBlend = 0;
    }
    action.reset();
    action.play();
    restAction = action;
    restStage = stage;
    restHold = action.getClip().duration;
  }

  /** Switches to the looping pose that holds after a one-shot finishes. */
  function hold(stage: RestStage, action: THREE.AnimationAction | null): void {
    if (stage === "crouchIdle") maybeSay("crouch");
    if (stage === "sitIdle") maybeSay("sit");
    if (action == null) {
      restStage = "none";
      return;
    }
    if (restAction != null && restAction !== action) {
      restPrev = restAction;
      restBlend = 0;
    }
    action.reset();
    action.play();
    restAction = action;
    restStage = stage;
    restHold = Infinity;
  }

  /**
   * How far to lower the character this frame so a crouch or a sit reaches
   * the ground.
   *
   * Measured on the settled poses only (see DinoRig.lifts). The transitions
   * are ramped by how far through their own clip they are, so he goes down
   * with the movement instead of snapping at the end of it — and standing up
   * ramps the same way in reverse.
   */
  function restLift(): number {
    const r = player?.rest;
    const l = player?.lifts;
    if (r == null || l == null) {
      return 0;
    }
    const through = (a: THREE.AnimationAction | null): number => {
      if (a == null) return 1;
      const dur = a.getClip().duration || 1;
      return Math.max(0, Math.min(1, a.time / dur));
    };
    switch (restStage) {
      case "crouchIdle":
        return l.crouch;
      case "sitIdle":
        return l.sit;
      case "crouchDown":
        return l.crouch * through(r.crouchDown);
      case "sitDown":
        return l.sit * through(r.sitDown);
      case "upToSit":
        // Crouched, on the way to sitting: between the two.
        return l.crouch + (l.sit - l.crouch) * through(r.sitDown);
      case "standing":
        // Which pose he is leaving decides which lift is ramping away.
        return restAction === r.standFromSit
          ? l.sit * (1 - through(r.standFromSit))
          : restAction === r.standFromCrouch
            ? l.crouch * (1 - through(r.standFromCrouch))
            : 0;
      default: {
        // Standing, walking or running: take back exactly what the shared
        // plant gave away, blended the same way the gaits themselves are, so
        // the correction follows the pose rather than snapping between them.
        const moving = l.walk * (1 - runShare) + l.run * runShare;
        return l.idle * (1 - moveW) + moving * moveW;
      }
    }
  }

  /**
   * Gets him back on his feet.
   *
   * Crouching and sitting both have a stand-up clip, and using it is the whole
   * difference between a character who was resting and one who teleported into
   * a run. A wave needs none — he is already standing — so it just stops.
   */
  function leaveRest(): void {
    const r = player?.rest;
    if (r == null) return;
    // Already on his way up — let the clip he is playing finish rather than
    // restarting a stand from a pose he has half left.
    if (restStage === "upToSit") {
      restStage = "standing";
      return;
    }
    const up =
      restStage === "crouchDown" || restStage === "crouchIdle"
        ? r.standFromCrouch
        : restStage === "sitDown" || restStage === "sitIdle"
          ? r.standFromSit
          : null;
    if (up != null) {
      startRest("standing", up);
      return;
    }
    // No stand-up clip needed (a wave). The fade-out in the loop releases the
    // action; clearing it here would strand it at its clamped final frame.
    restStage = "none";
  }

  function placeFlag() {
    if (flagPole != null && flagCone != null) {
      if (theme.village != null) {
        // The marker pair is kept only as an invisible position holder, so the
        // celebration and anything else that asks where the goal is still gets
        // an answer. What the child actually sees is planted below.
        const mz0 = meander(runEnd) - roadClear * 0.92;
        flagPole.position.set(runEnd, surfaceY(runEnd, mz0), mz0);
        flagCone.position.set(runEnd, surfaceY(runEnd, mz0), mz0);
        // Plant a NEW stone here, once, and leave every earlier one standing.
        //
        // Not always exactly at `runEnd`: a lesson shorter than
        // `MIN_STONE_GAP` puts its stone a little way up the road, so two of
        // them do not end up in one view reading as broken. The child still
        // stops at the finish and the next stretch opens by walking past the
        // stone, which is how a marker at a roadside is met anyway — but how
        // far "a little way" may go is capped, because the shortfall used to
        // be carried into every following lesson and the youngest band's
        // markers walked off up the road. See `stoneXFor`.
        const stoneX = stoneXFor(runEnd, lastStoneX);
        const key = Math.round(stoneX);
        if (pendingStone != null) {
          // Already standing for this lesson. If the run was rebuilt at a new
          // length, the finish has moved and the stone marking it has to move
          // with it — it is the flag. Its number does not change: the same
          // lesson is still being walked.
          pendingX = stoneX;
          const pz = meander(stoneX) - roadClear * 0.92;
          const px = laneAlignedX(stoneX, pz, LANE);
          pendingStone.position.set(px, surfaceY(px, pz), pz);
          return;
        }
        if (!milestones.has(key) && makeMilestone != null) {
          // `milestoneNo + 1`, not `++milestoneNo`: this stone is the one
          // being walked TOWARDS. It is not passed until it is passed, and
          // the count must not move before it is.
          const stone = makeMilestone(milestoneNo + 1);
          pendingStone = stone;
          pendingX = stoneX;
          // The FAR verge. On the near side it sat between the camera and the
          // child, and a waist-high stone in the foreground crosses the one
          // thing the eye is meant to be following. `roadClear` is the same
          // number that keeps trees off the track, so it stands exactly at the
          // road's edge.
          const mz = meander(stoneX) - roadClear * 0.92;
          // Placed where it LOOKS like the finish, not where the finish is —
          // see laneAlignedX. This is the one stone whose alignment a child
          // actually checks, because they stop right beside it.
          const mx = laneAlignedX(stoneX, mz, LANE);
          stone.position.set(mx, surfaceY(mx, mz), mz);
          makeBaseRocks?.(mx, mz);
          makeBasePlants?.(mx, mz);
          // AND A LAMP AHEAD OF THE STONE, not behind it.
          //
          // It used to go at the midpoint of the stretch just started, which
          // put it behind the child by the time they reached the milestone —
          // so the last half of every lesson was walked towards an empty
          // road with nothing in it but the stone at the end. Planting it
          // BEYOND the milestone means the lamp for the next lesson is
          // already standing there as they come up to this one: something to
          // walk towards rather than a gap to cross.
          //
          // ONE LAMP, AT THE STONE. Nowhere else — and now it IS the stone.
          //
          // Lamps out in the middle of the stretches were tried and dropped:
          // scattered along an empty road they read as street lighting, which
          // a 1930s cart track does not have. A lamp standing WITH the marker
          // is a different object — it is there so the stone can be read, the
          // way a shrine lamp is there for the shrine.
          //
          // It stood beside the marker for a while, a metre off, because they
          // were two models. They are one model now: the vazhivilakku's head
          // is welded onto the milestone from the lamp niche up, so the light
          // comes with the stone and there is nothing to place, nothing to
          // line up, and no way for the pair to arrive apart.
          // Turned a little off square to the road, the way a stone set by
          // hand ninety years ago never quite is - and each one differently,
          // so a row of them does not look machined.
          stone.rotation.y = 0.08 + Math.random() * 0.16;
          scene.add(stone);
          // Lit now it is standing — see `lightTheNiche`.
          lightTheNiche(stone);
        }
      } else {
        flagPole.position.set(runEnd, groundY(runEnd) + 1.7, 0);
        flagCone.position.set(runEnd + 0.55, groundY(runEnd) + 3, 0);
      }
    }
  }
  /** Distance walked since the last puff of dust - see the tick. */
  let footDust = 0;

  /** Does this land's surface raise dust underfoot? */
  const dustyRoad = land.path === "mud";
  let jumpV = 0;
  let jumpY = 0;
  let jumpCount = 0; // jumps used since last touchdown (max 2 = double jump)
  /**
   * Forward speed carried by the current jump, spent over its arc.
   *
   * A jump straight up on the spot reads as the trail ignoring the space bar.
   * This is deliberately additive to the eased walk toward `targetX` rather
   * than a change to `targetX` itself: how far along the trail the character
   * belongs is decided by how much of the passage is typed, and a jump must
   * not be able to argue with that. The lunge decays to nothing, so the eased
   * position always wins in the end.
   */
  let jumpFwdV = 0;
  /**
   * Frames since the last jump started, for the double-tap window.
   *
   * The big jump used to require the second press while still in the air. The
   * small hop this change introduces is airborne for about a fifth of a
   * second, which is a demanding window for a seven-year-old and would have
   * made the leap feel random. Counting from the press instead means a
   * deliberate double tap works whether or not they are still off the ground.
   */
  let framesSinceJump = 999;
  let playerGhostly = false; // skeleton hero: floats and glides like a ghost
  // Every character root in the scene, so the dark can reach all of their eyes.
  const characterRoots = new Set<THREE.Object3D>();
  /** Scenery that comes and goes with the light — thinned trees, dead groves. */
  const moodScenery: THREE.Object3D[] = [];

  /**
   * Every scattered TREE, so the village can clear a space round the banyan.
   *
   * The scatter runs long before a village is placed and spreads trees
   * evenly down the whole trail, so the roadside the banyan is planted on
   * already had three or four of them standing in it — and a banyan with a
   * palm growing through its crown is not a banyan, it is a thicket.
   */
  const scatterTrees: THREE.Object3D[] = [];
  let nightNow = false;

  // ── the nightfall cross-fade ───────────────────────────────────────────
  //
  // Flipping the light used to snap the cast: villagers gone, skeletons
  // there, one frame to the next. Now the day folk fade like ghosts — thin to
  // nothing and drift gently upward — and the Lost Travellers rise out of the
  // ground from transparent to solid, staggered a few at a time, so nightfall
  // is a scene and not a switch. Materials are cloned per character on first
  // fade, because the models share materials and one character's fade would
  // otherwise thin every twin it has.
  type Fade = {
    readonly root: THREE.Object3D;
    readonly from: number;
    readonly to: number;
    readonly dur: number;
    readonly rise: number;
    readonly baseY: number;
    delay: number;
    t: number;
  };
  const fades: Fade[] = [];
  const fadeReady = new WeakSet<THREE.Object3D>();

  function prepFade(root: THREE.Object3D): void {
    if (fadeReady.has(root)) {
      return;
    }
    fadeReady.add(root);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        const clones = mats.map((m) => {
          const c = m.clone();
          c.transparent = true;
          c.userData.o0 = c.opacity;
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
      }
    });
  }

  function applyFadeOpacity(root: THREE.Object3D, v: number): void {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const m of mats) {
          m.opacity = v * ((m.userData.o0 as number) ?? 1);
        }
      }
    });
  }

  /**
   * Shadow maps ignore opacity, so a character thinned to nothing still threw
   * a full shadow until the moment it vanished — a shadow outliving its owner.
   * Ghosts cast no shadows: it cuts out the moment a fade begins, and comes
   * back only once a body is fully solid.
   */
  function setFadeShadow(root: THREE.Object3D, on: boolean): void {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        if (mesh.userData.hadShadow == null) {
          mesh.userData.hadShadow = mesh.castShadow;
        }
        mesh.castShadow = on && mesh.userData.hadShadow === true;
      }
    });
  }

  function startFade(
    root: THREE.Object3D,
    to: 0 | 1,
    delay: number,
    rise: number,
    dur = 0.9,
  ): void {
    prepFade(root);
    setFadeShadow(root, false);
    // A fade already in flight for this root is superseded, not stacked.
    const at = fades.findIndex((f) => f.root === root);
    if (at !== -1) {
      fades.splice(at, 1);
    }
    root.visible = true;
    applyFadeOpacity(root, to === 1 ? 0 : 1);
    fades.push({
      root,
      from: to === 1 ? 0 : 1,
      to,
      dur,
      rise,
      baseY: root.position.y,
      delay,
      t: 0,
    });
  }

  function stepFades(dt: number): void {
    for (let i = fades.length - 1; i >= 0; i--) {
      const f = fades[i];
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.t * f.t * (3 - 2 * f.t); // smoothstep
      applyFadeOpacity(f.root, f.from + (f.to - f.from) * e);
      f.root.position.y =
        f.to === 0
          ? f.baseY + f.rise * e // the day folk drift up as they thin
          : f.baseY - f.rise * (1 - e); // the Travellers rise from the ground
      if (f.t >= 1) {
        if (f.to === 0) {
          f.root.visible = false;
          applyFadeOpacity(f.root, 1);
        } else {
          setFadeShadow(f.root, true);
        }
        f.root.position.y = f.baseY;
        fades.splice(i, 1);
      }
    }
  }
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
  function applyEyeGlow(
    root: THREE.Object3D,
    on: boolean,
    /**
     * A WILD ANIMAL, whose eyes are dark by day.
     *
     * The catchlight is right for the children — a small warm point in the
     * eye is most of what makes a face read as alive — and wrong for a
     * buffalo standing in full sun, where the same flare on a big dark head
     * reads as the animal glowing. It keeps its eyeshine after dark, which
     * is a real thing a buffalo does and the whole point of it.
     */
    wild = false,
  ): void {
    const skeletal = /skeleton|skull|undead/i.test(root.name);
    if (skeletal) {
      // Bright after dark, still clearly lit by day.
      setEyeFlare(root, 1, on ? 3.2 : 1.2, 0x7fe3ff);
    } else if (wild) {
      setEyeFlare(root, 1, on ? 0.5 : 0, 0xffe8b0);
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
  function refreshPopulation(dramatic = false): void {
    const roots: {
      root: THREE.Object3D;
      character: boolean;
    }[] = [
      ...friends.map((f) => ({ root: f.wrap, character: true })),
      ...moodScenery.map((root) => ({ root, character: false })),
    ];
    // The drama costs material clones and per-frame traversals, so it is only
    // paid in the world whose night deserves it, and never for somebody who
    // asked for a calm scene.
    const fade = dramatic && trueNight && motionScale >= 0.15;
    let leaving = 0;
    let arriving = 0;
    let morphing = 0;
    const handled = new Set<THREE.Object3D>();
    for (const { root, character } of roots) {
      if (handled.has(root)) {
        continue;
      }
      const ud = root.userData as {
        nightOnly?: boolean;
        dayOnly?: boolean;
        scary?: boolean;
        twinWrap?: THREE.Object3D;
      };
      // On the extra-spooky night the road belongs entirely to the watch: no
      // villagers, no fellow heroes — only the hero's own lantern, the eyes,
      // and the Lost Travellers. Everyone ordinary goes home at dark.
      // Hero world only: Dino Run's dark is a dusk, and dusk empties nothing —
      // without this guard a child whose age resolves to the full night was
      // losing every dinosaur and sheep the moment the light dimmed.
      const banishedAfterDark =
        trueNight && character && nightStyle === "full" && ud.scary !== true;
      const want =
        ud.nightOnly === true
          ? nightNow
          : ud.dayOnly === true || banishedAfterDark
            ? !nightNow
            : root.visible;
      if (want === root.visible) {
        continue;
      }
      if (!fade) {
        root.visible = want;
        continue;
      }
      // A linked pair morphs in place: the villager dissolves exactly as the
      // skeleton condenses, same spot, same stance, no drift — one figure
      // changing, not one leaving and another arriving. Choreographing them
      // separately read as a gap where the person used to be.
      if (ud.twinWrap != null) {
        const delay = morphing++ * 0.14;
        startFade(root, want ? 1 : 0, delay, 0);
        startFade(ud.twinWrap, want ? 0 : 1, delay, 0);
        handled.add(root);
        handled.add(ud.twinWrap);
        continue;
      }
      if (character) {
        // The cast is few, so it can afford choreography: leavers thin one
        // after another, arrivals rise a beat behind them.
        if (want) {
          startFade(root, 1, 0.5 + arriving++ * 0.12, 0.35);
        } else {
          startFade(root, 0, leaving++ * 0.08, 0.55);
        }
      } else {
        // The forest is many, so it breathes as one: every tree dissolves
        // into the dark over the same long moment, each offset by no more
        // than a blink. An accumulating stagger here had trees popping one by
        // one for seconds after the night had already arrived.
        startFade(
          root,
          want ? 1 : 0,
          (want ? 0.35 : 0) + Math.random() * 0.4,
          0,
          1.4,
        );
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
  let calmMode = false; // no shake, no shiver, no sparks
  let beckonT = 0;
  let wasAirborne = false;
  let roarT = 0;
  // Reaching the camp flag. Runs 1 -> 0; the dino spends the first half
  // roaring and the second half hopping, the hero spins the whole way.
  let celebT = 0;
  /**
   * How much of the celebration elapses per frame.
   *
   * The scripted celebrations are authored against the default; a character
   * playing its own clip gets a rate that makes the countdown last exactly as
   * long as the clip, so a two-second animation is not cut off by a
   * one-and-a-half-second timer.
   */
  let celebRate = 0.012;
  /** Latest typing speed, in WPM, as reported by the page. */
  let paceWpm = 0;
  /** 0 = walking, 1 = running. Eased, so the gait changes without a snap. */
  let runShare = 0;
  /** 0 = standing, 1 = fully in motion. Eased the same way. */
  let moveW = 0;

  // ── what he does while nobody is typing ──────────────────────────────
  //
  // A character who stands perfectly still is the thing that makes a scene
  // look switched off. The chain below gives the wait a shape: a wave first,
  // as though checking someone is still there; then sitting down to wait
  // properly. Every step is interruptible on the next keystroke, and standing
  // back up uses the rig's own transition rather than a cut.
  type RestStage =
    | "none"
    | "wave"
    | "crouchDown"
    | "crouchIdle"
    | "upToSit"
    | "sitDown"
    | "sitIdle"
    | "brave"
    | "fidget"
    | "standing";
  let restStage: RestStage = "none";
  /** Seconds since the last keystroke or the last step along the trail. */
  let idleT = 0;
  /**
   * How far along the chain this idle period has already gone: 0 none,
   * 1 waved, 2 crouched, 3 sat. Each step happens once per wait, and the
   * counter resets the moment he moves.
   */
  let restStep = 0;
  /** Seconds left in the one-shot currently playing, if any. */
  let restHold = 0;
  /**
   * Seconds until she may square up again. A countdown rather than a
   * timestamp, because the tick carries a frame delta and no absolute clock
   * — the same shape `restHold` above already uses.
   */
  let braveCool = 0;
  /** The action carrying the rest pose right now. */
  let restAction: THREE.AnimationAction | null = null;
  /** The one it is replacing, still fading out. */
  let restPrev: THREE.AnimationAction | null = null;
  /** 0 to 1 across the crossfade between two rest clips. */
  let restBlend = 1;
  /** How many times they have gone quiet in this world. Drives the backoff. */
  let pauses = 0;
  /** One line per pause, at most. */
  let spokeThisPause = false;
  /** When the last line was spoken, on the world clock. */
  let lastSpokeAt = -Infinity;
  /** Eases the rest pose in and out over the gait, so nothing snaps. */
  let restW = 0;
  /** Seconds left of the jump clip. Weight follows it, not the arc height. */
  let jumpAnimHold = 0;
  let celebHops = 0;
  let growTarget = 1;
  // 0 = just-hatched baby, 1 = fully-grown adult. Drives real proportion,
  // colour and gait changes on top of the overall size growth.
  let dinoAge = 1;
  const boneBase = new WeakMap<THREE.Object3D, THREE.Vector3>();
  const friends: DinoRig[] = [];

  // ══ WILD BEHAVIOUR ═══════════════════════════════════════════════════
  //
  // The buffalo is not a companion. A companion walks with the child and is
  // safe; a buffalo stands out in the paddy minding its own business, and
  // has opinions about being ignored.
  //
  // Thirteen clips, and every one of them is used.
  //
  // The authored master holds sixteen. `loadModel` strips anything matching
  // death, attack or bite from every character in this app, which took
  // Death, Attack_Horn and Attack_Stomp before they ever got here — so the
  // shipped buffalo no longer carries them at all (see
  // scripts/buffalo-shipped.mjs). They were a fifth of its animation data,
  // downloaded on every visit and thrown away on arrival.
  //
  // That rule is older than this animal and it is the right rule, so the
  // behaviour is built from what survives it rather than around it — and it
  // costs nothing, because a buffalo that THREATENS and a buffalo that
  // ATTACKS are the same animation problem and only one of them belongs in
  // front of a six-year-old.
  //
  // Every one of the thirteen is spent, and none of them decoratively:
  //
  //   Graze / Idle / Idle_Alert     what it does when nothing is happening
  //   Walk / Turn_*                 how it moves around its own patch
  //   Idle_Alert -> Charge_Start    it has noticed the child has stopped
  //   Charge_Loop                   coming
  //   Aggressive_Threat             the pull-up, and an idle display by day
  //   Supernatural_Rear_Stomp       the big one — rare, and rarer by day
  //   Hit_Reaction                  the child typed. It flinches and quits.
  //   Walk_Backward                 backing off, still facing them
  //   Run                           going home, faster than it came
  //
  // THE CHARGE NEVER ARRIVES. That is the whole design, and it is enforced
  // three separate ways rather than trusted to one:
  //
  //   1. The target is not the child. It is a stand-off point computed on
  //      the line between them at WILD_STOP_D, so the destination itself is
  //      six units short.
  //   2. The advance is clamped every frame — if the gap is already inside
  //      WILD_STOP_D the step is zero, whatever the target says.
  //   3. It may not leave the field. Its whole path is clamped to its own
  //      side of the road, so even a bug in the first two cannot put it in
  //      the lane the child is walking down.
  //
  // A child who has wandered off and come back to find a buffalo bearing
  // down on them should feel a jolt and then relief, and never a hit.
  //
  // And the way out is the lesson: typing makes it flinch and leave. The
  // charge is a prompt to come back to the keyboard, so the keyboard has to
  // be what answers it.

  /**
   * How long the child must be away before a buffalo takes an interest.
   *
   * Deliberately longer than the player's own rest chain, which has him
   * sitting down at thirteen seconds. The buffalo arrives at somebody who
   * has already settled in — which is the moment a nudge back to the
   * keyboard is worth anything, and well past a pause for thought.
   */
  const WILD_CHARGE_IDLE_S = wildReview ? 5 : 22;
  /**
   * Nearest it may ever come to the child, in world units.
   *
   * Nine, not six. Six was arrived at from the geometry — comfortably
   * outside arm's reach of an animal this size — and it was wrong on
   * screen: this is a buffalo nearly five units tall and six long, and at
   * six units away it fills the frame beside a child a third its height.
   * The charge is supposed to read as "it pulled up short", and a stop that
   * close reads as "it arrived". Nine puts roughly two body lengths between
   * them, which is near enough to be startling and far enough to be plainly
   * a bluff.
   */
  const WILD_STOP_D = 9;
  /** How far off it can be and still notice. */
  const WILD_NOTICE_D = 30;
  /** Quiet time after a charge before that buffalo may do it again. */
  const WILD_COOLDOWN_S = 40;
  /** How long the hand-off out of a turn takes. See the turn case. */
  const WILD_TURN_FADE = 0.22;
  /**
   * How far a wild animal rides ABOVE the planted ground.
   *
   * `surfaceY` sinks everything it places by 6cm, which is right for a child
   * whose shoes should bed into a soft road and wrong for a heavy animal on
   * hard ground: the buffalo's hooves are broad and flat, and sunk by even
   * that much its legs read as cut off at the fetlock.
   *
   * This is also the largest animal in the world by some way, and the ground
   * cover out in the paddy is not short — at 0.24 its hooves were still lost
   * in the grass. The brief is that the feet should be visible with only a
   * little of them under the blades, so it rides high enough for the whole
   * hoof to clear and lets the grass overlap the very bottom of it.
   */
  const WILD_LIFT = 0.86;
  /**
   * The smallest turn worth using the whole body for.
   *
   * Below this the animal turns its HEAD and leaves its feet where they are,
   * which is what a real one does and what stops the turn clips from firing
   * constantly over a few degrees. Above it, it actually turns round.
   */
  // ~11 degrees. It was 0.7 rad (~40), and every heading change under that
  // was handed to the silent yaw drift in `face()`: the animal pivoted with
  // no turn clip playing, which is the rotation that kept being reported.
  // Anything a viewer would call "turning left" or "turning right" now plays
  // a turn clip; below this it is a drift to hold a line, not a turn.
  /**
   * THE SMALLEST HEADING CHANGE WORTH A TURN CLIP — and there is no other
   * kind of heading change.
   *
   * Lowered from 0.2 rad. At eleven degrees, everything under that was
   * handed to the yaw slew instead, which is precisely the slide: a body
   * rotating with no step under it. Now that nothing slews, the threshold is
   * only asking "is this worth getting up for", and three degrees is about
   * where a herd animal stops caring. `wildTurn` plays the fraction of the
   * ninety-degree clip the angle is worth, so a small correction is a short
   * clip rather than a full pivot.
   */
  const WILD_TURN_MIN = 0.055;
  /**
   * How much room a milestone and its lamp are given.
   *
   * The stone is about 0.7 across and the lamp stands 1.1 beyond it, so the
   * pair occupy a couple of units; this is that plus the animal's own width
   * and then some, because what looks wrong is not the overlap but the near
   * miss — a buffalo grazing with its shoulder against a marker.
   */
  const MARKER_CLEAR = 5.5;
  /**
   * HOW OFTEN A BUFFALO DECIDES TO RUN WITH YOU.
   *
   * Per second of being passed at a run, so a child who sprints the length
   * of a field has roughly a one-in-six chance of being joined — often
   * enough that it happens, rare enough that it is never the thing the
   * buffalo does. An animal that ran alongside every single time would be a
   * mechanic; one that does it now and then is an animal with a mood.
   */
  const WILD_ESCORT_CHANCE = 0.06;
  /**
   * THE BUFFALO KNOWS THE LITTLE ONE.
   *
   * A water buffalo on a village road is not wildlife, it is somebody's
   * animal, and it has opinions about who is walking past. With Little Drew —
   * six years old and half its height at the shoulder — it mostly just falls
   * in beside him and walks, the way a big dog does with a child it has
   * decided is its own.
   *
   * It has not been declawed. The charge is still there and still lands
   * without warning, roughly one time in six that it would otherwise have
   * come; what changes is that the DEFAULT is company rather than a threat.
   * That is the point — a six-year-old who is charged every third stretch
   * stops walking the road, and one who is never charged at all is not on a
   * road with a buffalo on it.
   */
  const LITTLE_CHARGE_ODDS = 1 / 6;
  /** How much likelier it is to simply walk with him instead. */
  const LITTLE_ESCORT_X = 4;
  /** How long it keeps pace before it loses interest and turns for home. */
  const WILD_ESCORT_SECS = [4, 10] as const;
  /** How far ahead of the child it aims, so it runs level rather than behind. */
  const WILD_ESCORT_LEAD = 6;
  /**
   * How far off a heading the animal tolerates before it turns to correct.
   *
   * This was the neck's limit, when small corrections were made by yawing
   * the head and only larger ones turned the body. That is gone: the yaw was
   * applied about the head bone's BIND-pose up axis but composed onto its
   * CURRENT animated pose, so the moment a clip moved the head — Graze puts
   * it on the ground, the rear-up throws it skyward — the axis was no longer
   * up and the "look" became a roll. It read as the head spinning.
   *
   * It survives as the dead-band on the BODY's turning, which is what it was
   * really doing: below this the animal lets the error stand rather than
   * grinding round after a moving target.
   */
  const WILD_HEAD_MAX = 0.8; // ~46 degrees
  /** How close the child has to be for a grazing animal to look up at them. */
  const WILD_LOOK_D = 20;
  /**
   * Clips that loop; everything else plays once and holds its last frame.
   *
   * GRAZE IS NOT IN HERE, and that is measured rather than chosen. Its hips
   * finish 16 degrees round from where they started, so looping it snapped
   * the whole animal back a sixteenth of a turn every six seconds. Played
   * once and crossfaded into something else, the same 16 degrees unwinds
   * smoothly across the fade and nobody sees it.
   */
  const WILD_LOOPS = /^(Walk|Idle|Idle_Alert|Run|Charge_Loop)$/;

  type WildState =
    | "graze" // ambient: whatever clip the repertoire picked
    | "wander" // walking to a fresh patch of its own field
    | "turn" // turning on the spot, yaw driven by the clip
    | "notice" // head up, looking straight at the child
    | "windup" // Charge_Start
    | "charge" // Charge_Loop, closing on the stand-off point
    | "bluff" // horn or stomp at the stop point, hitting nothing
    | "flinch" // the child typed
    | "backoff" // reversing, still facing them
    | "escort" // running the field beside the child, keeping pace
    | "gohome" // Run, back to its own patch
    | "threat"; // a night display, in place

  type WildRig = {
    readonly wrap: THREE.Group;
    readonly mixer: THREE.AnimationMixer;
    readonly act: Map<string, THREE.AnimationAction>;
    /** How far each pose floats above the planted ground — see plantFeet. */
    readonly lift: Map<string, number>;
    readonly homeX: number;
    readonly homeZ: number;
    /** Which side of the road it is on. It may cross — see wildCanCross. */
    side: number;
    /** Half the body's length and width, measured, for standing on slopes. */
    readonly halfLen: number;
    readonly halfWid: number;
    /** Pitch and roll currently applied, eased. */
    pitch: number;
    roll: number;
    cur: string;
    state: WildState;
    /** Seconds left in the current state. */
    t: number;
    /** Where it is walking, when it is walking somewhere. */
    tx: number;
    tz: number;
    /** Yaw it is turning towards, and how fast. */
    yaw: number;
    /**
     * The hand-off at the end of a turn, in progress.
     *
     * `yawT` counts down through the crossfade; the wrap's heading is ramped
     * from `yawFrom` to `yawTo` across it. See the turn case.
     */
    yawFrom: number;
    yawTo: number;
    yawT: number;
    cooldown: number;
    scareCool: number;
    /** The foot lift currently applied, eased — see settle. */
    liftNow: number;
    /** What this turn is FOR. A turn is never its own reason. */
    after: WildState | null;
    /**
     * HOW FAR EACH TURN CLIP ACTUALLY TURNS THIS ANIMAL, in radians, signed.
     *
     * Measured off the clip rather than assumed from its name, and that is
     * the whole point: `Turn_Left_90` and `Turn_Right_90` are not ninety
     * degrees and are not even mirror images of each other. Measured on the
     * shipped file, the left clip carries the hips +78.6° and the right one
     * −101.4°.
     *
     * The code used to add exactly ninety degrees to the body at the
     * hand-off. So a left turn left the animal standing at 78.6° and then
     * snapped it to 90 — eleven degrees, in one frame, at the end of every
     * single left turn. That is the flicker, and it is why it had a side.
     */
    readonly arc: Map<string, number>;
  };
  const wilds: WildRig[] = [];
  /**
   * Pose lifts, worked out ONCE PER MODEL rather than once per animal.
   *
   * How far a given clip floats above the planted ground is a fact about the
   * clip and the mesh, not about which of the three buffaloes on this road
   * is playing it: same skeleton, same animation, same number. It was being
   * measured from scratch for each one — thirteen clips sampled twelve times
   * over, three times a road, for three identical answers.
   *
   * The PLANT still happens per animal, because that moves a particular
   * root; only the measuring is shared.
   */
  const wildLifts = new Map<string, Map<string, number>>();
  let wildBeat = 0;
  /** Said once per nightfall, and armed again by the next dawn. */
  let nightSaid = false;
  /** Where this trail's village stands, if it has one at all. */
  let villageX: number | null = null;
  /**
   * The x of the village the child is currently walking through, or null.
   *
   * Kept so the arrival is announced once per village rather than once per
   * frame spent inside one — the child walks through it for the best part of a
   * lesson, and the line belongs at the edge of it.
   */
  let insideVillage: number | null = null;
  /** The child's ground speed, smoothed — see heroRunning in the tick. */
  let heroSpeed = 0;
  let heroLastX = 0;

  /**
   * The head bone's own frame, so the animal can look at things.
   *
   * This began as a way to hang two glowing eyes on an animal that has none
   * — the buffalo is a single mesh with its eyes painted into the texture,
   * so `applyEyeGlow`, which lights meshes named "eye", silently did nothing
   * on it. The glowing eyes are gone now: a buffalo with lit eyes reads as a
   * monster rather than as livestock, which is the wrong note entirely for a
   * village at dusk.
   *
   * The FRAME survives, because it turned out to be the more useful half.
   * Yawing the head about its own up axis is what lets the animal watch a
   * child walk past without shuffling its whole body round, and getting that
   * axis right took three attempts. The head bone's frame:
   *
   *   forward  where the `headend` bone sits relative to `head` — the rig's
   *            own statement of which way the muzzle points
   *   across   the line between a LEFT/RIGHT PAIR of bones, checked to be
   *            genuinely far apart before it is believed
   *   up       the cross product, with its sign taken from the ears — the
   *            one this function exists to return
   *
   * Both directions are read out of the SKELETON rather than assumed, and
   * that is the whole lesson of getting this wrong three times. Deriving
   * across from an assumed up put the eyes low on the jaw. Taking up from
   * the bone's world matrix moved them and still reported a skull 0.235
   * high and 0.078 wide, which no bovine has ever had. And the obvious fix
   * — the two ear bones, which are definitionally on opposite sides —
   * failed in the most misleading way available: `earend` and `R_earend`
   * sit 2mm apart on a head 241mm long, co-located at bind, so the
   * direction between them is rounding noise, and it produced a frame that
   * looked entirely plausible.
   *
   * Hence the separation test. A pair that is not far apart is not evidence,
   * however well named it is. The legs pass it at 94mm and give a lateral
   * axis within 3% of the model's own X, and the head then measured 241 long
   * by 176 high by 135 wide, which is a buffalo — which is how the frame was
   * known to be right at last.
   *
   * The WIDTH is then measured in a thin slice of the head at the eye line,
   * not across the whole head — horns are weighted to the head bone and they
   * are the widest thing on the animal by a long way, so a whole-head
   * half-width puts the eyes out on the horn tips.
   */
  /**
   * May this animal cross the road right now?
   *
   * Only with the child well out of the way. "Well" is generous on purpose:
   * the crossing takes several seconds and the child is walking towards it
   * the whole time, so a margin that is merely safe at the moment of the
   * decision is not safe by the time the animal is in the lane.
   */
  const WILD_CROSS_CLEAR = 55;
  function wildCanCross(w: WildRig): boolean {
    if (player == null) {
      return true;
    }
    return (
      Math.abs(player.wrap.position.x - w.wrap.position.x) > WILD_CROSS_CLEAR
    );
  }

  /**
   * Ground height for a wild animal — ANALYTIC, never a raycast.
   *
   * `surfaceY` casts a ray at the ground mesh, which is the right answer and
   * an expensive one: it tests every triangle of a 400-unit plane. The
   * stance needs four samples per animal per frame on top of the one for its
   * height, and at three buffalo that is fifteen full-mesh raycasts every
   * frame. It wedged the renderer — the tab stopped responding altogether,
   * and with the timers frozen the animals looked like they had broken
   * rather than like the page had.
   *
   * `terrainY` is the function the ground mesh is BUILT from, so it gives
   * the same surface for nothing, and without the triangle-edge jitter a
   * raycast picks up as the animal walks across facets. The raycast is kept
   * for the one-off placement at spawn, where it costs nothing and where
   * matching the mesh exactly is worth having.
   */
  const wildGroundY = (x: number, z: number) =>
    terrainY(x, z) - 0.06 + WILD_LIFT;

  /** Shortest signed angle from a to b. */
  const angTo = (a: number, b: number) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  /**
   * Play a clip on a wild animal, crossfading from whatever it was doing.
   *
   * The lift matters more here than it does anywhere else in the world. A
   * buffalo rearing onto its hind legs has its hooves a long way above where
   * they are when it grazes, and a single root offset that suits the gaits
   * leaves the rear hanging in the air. `plantFeet`'s probe measured each
   * pose at load; this is where that measurement is spent.
   */
  function wildPlay(w: WildRig, name: string, fade = 0.25): boolean {
    if (name === w.cur && WILD_LOOPS.test(name)) {
      return true; // already looping this; restarting it would stutter
    }
    const next = w.act.get(name);
    if (next == null) {
      // A clip this code asks for and does not get is a silent hole: the
      // state advances, the timer runs on a guessed duration, and the animal
      // charges home still playing its charge loop. It cost an hour to find
      // once. It says so out loud now.
      if (wildReview) {
        console.warn(`[wild] no clip "${name}" — state will run with no pose`);
      }
      return false;
    }
    const prev = w.act.get(w.cur);
    next.reset();
    const loops = WILD_LOOPS.test(name);
    next.setLoop(
      loops ? THREE.LoopRepeat : THREE.LoopOnce,
      loops ? Infinity : 1,
    );
    next.clampWhenFinished = !loops;
    next.setEffectiveWeight(1);
    next.play();
    if (prev && prev !== next) {
      if (fade > 0) {
        next.crossFadeFrom(prev, fade, false);
      } else {
        // A ZERO-LENGTH FADE IS NOT AN INSTANT FADE. `crossFadeFrom(prev, 0)`
        // schedules a weight interpolant over an interval of no duration, and
        // what that evaluates to is undefined-ish — it can leave the incoming
        // action sitting at weight 0, which drops the model to its bind pose
        // for a frame. That is the other flash, and it fires on every turn,
        // because the turn hand-off asks for exactly this.
        //
        // What was wanted was a hard cut, so this does a hard cut.
        prev.stop();
        prev.setEffectiveWeight(0);
        next.setEffectiveWeight(1);
      }
    }
    // NOTHING ELSE MAY CONTRIBUTE, AND `stop()` IS NOT ENOUGH.
    //
    // Thirteen actions share one mixer. `stop()` deactivates an action but
    // does NOT clear its weight — and a fresh clipAction starts at weight 1,
    // so all thirteen sit at full weight for the life of the world. Logged
    // mid-turn, every frame read:
    //
    //   weightSum=13.00  Walk=1.00(off) Idle=1.00(off) Graze=1.00(off) ...
    //
    // A deactivated action should not be sampled, but any of them becoming
    // active for even one frame — which is what a transition does — brings a
    // whole second pose in at full strength rather than at the fade's weight.
    // That is the flash when the animal turns, and it is why the earlier
    // "stop the others" fix did not cure it: stopping them was right and
    // insufficient.
    //
    // So the weight goes to zero explicitly. An action that is not the
    // incoming or outgoing pose now contributes nothing whatever the mixer
    // does with it.
    for (const a of w.act.values()) {
      if (a !== next && a !== prev) {
        a.stop();
        a.setEffectiveWeight(0);
      }
    }
    w.cur = name;
    return true;
  }

  /**
   * Turn the body, using the rig's own 90-degree turn clips.
   *
   * Which clip is which was measured rather than assumed: Turn_Left_90
   * rotates the hips 90 degrees about the Hips' local -Z, and that axis maps
   * to model +Y — world up — so it is a left turn in the same sense as
   * `rotation.y +=`, and Turn_Right_90 is its mirror. Guessing this wrong
   * would have shown as the animal turning one way on screen and then
   * snapping to the other heading.
   *
   * A clip is worth 90 degrees. A turn larger than that is taken 90 at a
   * time, and `after` — the thing this turn is FOR — is carried across each
   * leg, so the animal finishes facing where it meant to and then does what
   * it turned round to do.
   */
  function wildTurn(w: WildRig, need: number, after: WildState | null) {
    const sign = need >= 0 ? 1 : -1;
    const clip = sign > 0 ? "Turn_Left_90" : "Turn_Right_90";
    // WHAT THIS CLIP IS ACTUALLY WORTH, not what its name claims — see
    // WildRig.arc. Falls back to a quarter turn only if the clip does not
    // move the hips at all, which would be a broken export.
    const arc = Math.abs(w.arc.get(clip) ?? Math.PI / 2) || Math.PI / 2;
    const leg = Math.min(Math.abs(need), arc);
    // The body is turned by exactly what the legs delivered, so there is
    // nothing left over to snap at the hand-off.
    w.yaw = w.wrap.rotation.y + sign * leg;
    w.after = after;
    // A smaller turn plays the matching FRACTION of the clip. Playing the
    // whole thing for a 15-degree correction swung the animal a full quarter
    // turn and then unwound it across the hand-off.
    wildEnter(w, "turn", clip, undefined, undefined, leg / arc);
  }

  /**
   * The net yaw a clip puts on a bone, first keyframe to last, in radians.
   *
   * Read straight off the quaternion track. Returns null when the clip does
   * not drive that bone at all, which is the honest answer and lets the
   * caller keep its old assumption rather than inventing a number.
   */
  function clipYaw(clip: THREE.AnimationClip, bone: string): number | null {
    const track = clip.tracks.find(
      (t) =>
        t.name === `${bone}.quaternion` ||
        t.name.endsWith(`/${bone}.quaternion`),
    );
    const v = track?.values;
    if (v == null || v.length < 8) {
      return null;
    }
    const yawOf = (i: number) => {
      const x = v[i]!,
        y = v[i + 1]!,
        z = v[i + 2]!,
        w = v[i + 3]!;
      return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
    };
    let d = yawOf(v.length - 4) - yawOf(0);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /**
   * Slide an x along the road until it is clear of every milestone and lamp.
   *
   * Only checks the marker line — they all stand at the same distance from
   * the centre, so anything well off that line is clear whatever its x.
   */
  function clearOfMarkers(x: number, z: number): number {
    if (Math.abs(z - (meander(x) - roadClear * 0.92)) > 3.2) {
      return x; // nowhere near the line the markers stand on
    }
    let out = x;
    for (let guard = 0; guard < 8; guard++) {
      let hit: number | null = null;
      for (const key of milestones.keys()) {
        if (Math.abs(key - out) < MARKER_CLEAR) {
          hit = key;
          break;
        }
      }
      if (hit == null) {
        return out;
      }
      // Push it PAST the stone on the side it is already nearer, so an animal
      // that was heading down the road keeps heading down the road.
      out = out >= hit ? hit + MARKER_CLEAR : hit - MARKER_CLEAR;
    }
    return out;
  }

  /** Duration of a clip, or a sensible default if it is missing. */
  const wildDur = (w: WildRig, name: string, fallback = 2) =>
    w.act.get(name)?.getClip().duration || fallback;

  /**
   * Enter a state, play the clip that state means, and set its clock.
   *
   * States are timed rather than driven by the mixer's `finished` event: the
   * sequencing is a handful of durations, and keeping it on the clock means
   * one place to read when the timing needs tuning — the same reason the
   * player's rest chain is built this way.
   */
  function wildEnter(
    w: WildRig,
    state: WildState,
    clip: string,
    secs?: number,
    fade?: number,
    /** Play only this fraction of a one-shot — see wildTurn. */
    frac = 1,
  ) {
    wildPlay(w, clip, fade);
    w.state = state;
    const dur = wildDur(w, clip);
    // A ONE-SHOT IS NEVER CUT SHORT.
    //
    // The state clock and the mixer both advance by `dt * motionScale`, so
    // they stay in step with each other by construction — but a state given
    // an explicit duration could still be told to move on before its clip
    // had played out, and a rear-and-stomp abandoned two seconds in is a
    // buffalo that lurches. Loops may be held for any length, because
    // stopping a loop at an arbitrary point is what a loop is for; a
    // one-shot is held for at least as long as it lasts.
    w.t = WILD_LOOPS.test(clip)
      ? (secs ?? dur)
      : Math.max(secs ?? dur * frac, dur * frac);
    if (wildReview) {
      // `?wild` only: every transition, so the sequence can be read back out
      // of the console instead of inferred from stills.
      console.log(
        `[wild] ${state} ${clip} t=${w.t.toFixed(1)} idle=${idleT.toFixed(1)} gap=${(player
          ? Math.hypot(
              player.wrap.position.x - w.wrap.position.x,
              player.wrap.position.z - w.wrap.position.z,
            )
          : -1
        ).toFixed(1)}`,
      );
    }
  }

  /**
   * Pick the next ambient thing to do.
   *
   * Weighted, and the weights are a real buffalo's day: mostly eating, some
   * standing, a little walking, and — after dark, when it is the one thing
   * out there that is awake — rather more attitude.
   */
  function wildAmbient(w: WildRig, night: boolean) {
    // Leaving a turn, the swap is faded across exactly the window the
    // heading ramp uses, so the two cancel. See the turn case.
    const fade = w.state === "turn" ? WILD_TURN_FADE : undefined;
    // Walk_Backward is deliberately absent. It is a real clip and it is used
    // — see "backoff" — but as an ambient it would step backwards on the
    // spot without going anywhere, which reads as a glitch rather than as an
    // animal. A clip belongs in the repertoire only where it has somewhere
    // to put its feet.
    //
    // The TURN clips are absent for the same reason, and it is the stronger
    // case: a turn drawn at random is a pose, not a decision. They are
    // reached from "wander" below, where the animal has somewhere to go and
    // has to come round to face it first, and from "notice", where it has to
    // come round to face the child. That is the only way they fire.
    const bag: [WildState, string, number][] = [
      ["graze", "Graze", 5],
      ["graze", "Idle", 3],
      ["graze", "Idle_Alert", 2],
      ["wander", "Walk", 4],
      ["threat", "Aggressive_Threat", night ? 4 : 1],
    ];
    if (night) {
      // The rear-and-stomp is the biggest thing this animal does, so it is
      // kept rare: seen once on a dark road it is memorable, and seen every
      // thirty seconds it is wallpaper.
      bag.push(["threat", "Supernatural_Rear_Stomp", 1]);
    }
    const total = bag.reduce((a, b) => a + b[2], 0);
    const draw = () => {
      let r = Math.random() * total;
      for (const b of bag) {
        r -= b[2];
        if (r <= 0) {
          return b;
        }
      }
      return bag[0]!;
    };
    // Drawn twice if the first draw repeats what it is already doing: a
    // one-shot restarting itself is the snap the loop set above exists to
    // avoid, and an animal that grazes, grazes, then grazes reads as stuck.
    let pick = draw();
    if (pick[1] === w.cur) {
      pick = draw();
    }
    const [state, clip] = pick;
    if (state === "wander") {
      // A fresh patch, a few steps away, never far from the patch it calls
      // home — and never ON the road, whichever side of it ends up on.
      const ang = Math.random() * Math.PI * 2;
      const dist = 4 + Math.random() * 6;
      w.tx =
        w.homeX +
        Math.max(
          -14,
          Math.min(14, w.wrap.position.x + Math.cos(ang) * dist - w.homeX),
        );
      let nz =
        w.homeZ +
        Math.max(
          -8,
          Math.min(8, w.wrap.position.z + Math.sin(ang) * dist - w.homeZ),
        );
      const centre = meander(w.tx);
      const verge = roadClear * 0.95;
      const here = w.wrap.position.z - centre;
      // ONE WANDER IN FOUR IS A CROSSING, when there is nobody to cross in
      // front of. It has to be chosen deliberately: the ordinary wander band
      // is eight units either side of home and home is eleven off the road,
      // so a random draw can reach the verge and never the far side — the
      // crossing would have been unreachable code that read as a feature.
      if (wildCanCross(w) && Math.random() < 0.25) {
        const other = here >= 0 ? -1 : 1;
        nz = centre + other * (verge + 1.5 + Math.random() * 5);
      } else if (Math.abs(nz - centre) < verge) {
        // The draw landed on the road. Push it to the nearer verge rather
        // than redrawing, so a patch by the roadside stays a likely place to
        // graze — it just grazes beside the road instead of on it.
        nz = centre + (nz >= centre ? verge : -verge);
      }
      // An accidental crossing — one that fell out of the numbers rather
      // than being chosen — is folded back to this side when the child is
      // about. A deliberate one already checked, and is not re-checked: a
      // buffalo halfway over must finish crossing, not turn back in the
      // middle of the road because the child has caught up.
      if ((nz - centre) * here < 0 && !wildCanCross(w)) {
        nz = centre + Math.sign(here || 1) * Math.abs(nz - centre);
      }
      // AND NEVER UP AGAINST A MILESTONE.
      //
      // The markers stand on the far verge, which is exactly where a buffalo
      // that has decided to cross ends up — so it would wander over and stand
      // grazing with its head through a numbered stone, or shoulder up
      // against the lamp beside it. Nothing in the wander knew they were
      // there; `onRoad` keeps the scatter off the road and has nothing to say
      // about an animal walking to a spot.
      //
      // Pushed along the road rather than redrawn: the patch it picked is
      // still where it wanted to be, it just stands a little further down it.
      // A charge is deliberately exempt — that is aimed at the child, it
      // stops short of them anyway, and an animal that broke off a charge to
      // avoid a stone would look like it had changed its mind.
      w.tx = clearOfMarkers(w.tx, nz);
      w.tz = nz;
      // Come round to face it first if it is properly behind — an animal
      // does not set off sideways. A small correction it just walks into.
      const need = angTo(
        w.wrap.rotation.y,
        Math.atan2(w.tx - w.wrap.position.x, w.tz - w.wrap.position.z),
      );
      if (Math.abs(need) > WILD_TURN_MIN) {
        wildTurn(w, need, "wander");
      } else {
        wildEnter(w, "wander", clip, 9, fade); // 9s cap: never walks forever
      }
    } else {
      // Idles loop, so they are held for a few cycles; Graze and the threat
      // display play once (see WILD_LOOPS) and are held exactly as long as
      // they last.
      const held = WILD_LOOPS.test(clip)
        ? wildDur(w, clip) * (1 + Math.floor(Math.random() * 2)) + Math.random()
        : wildDur(w, clip);
      // `state`, not a hard-coded "graze": a threat drawn from the bag has to
      // reach the threat case, which is what turns it to face the child and
      // sets the quiet time afterwards. Collapsing it to "graze" played the
      // clip at nobody and skipped the cooldown entirely.
      wildEnter(w, state, clip, held, fade);
    }
  }

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
    // 256 rather than 160, in step with the card it is printed on. A letter
    // drawn at 160 and shown on a card a third larger is a letter with soft
    // edges, and these are the one thing on screen a child has to read.
    // Cached per character, so the extra pixels are paid for once.
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = "#31405a";
    g.font =
      "700 195px 'Arial Rounded MT Bold', ui-rounded, 'Trebuchet MS', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(ch.toUpperCase(), 128, 150);
    t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    letterTexCache.set(ch, t);
    return t;
  };
  /**
   * The same letter, as a braille cell, for the reveal on the first passage.
   *
   * Grade 1, as a six-dot bitmask — dot 1 = 1, dot 2 = 2, dot 3 = 4, dot 4 =
   * 8, dot 5 = 16, dot 6 = 32 — drawn rather than set as a U+28xx character,
   * because the canvas has whatever fonts the machine has and a missing
   * glyph would put the same empty box on every card.
   */
  const BRAILLE_DOTS: Readonly<Record<string, number>> = {
    "a": 0b000001,
    "b": 0b000011,
    "c": 0b001001,
    "d": 0b011001,
    "e": 0b010001,
    "f": 0b001011,
    "g": 0b011011,
    "h": 0b010011,
    "i": 0b001010,
    "j": 0b011010,
    "k": 0b000101,
    "l": 0b000111,
    "m": 0b001101,
    "n": 0b011101,
    "o": 0b010101,
    "p": 0b001111,
    "q": 0b011111,
    "r": 0b010111,
    "s": 0b001110,
    "t": 0b011110,
    "u": 0b100101,
    "v": 0b100111,
    "w": 0b111010,
    "x": 0b101101,
    "y": 0b111101,
    "z": 0b110101,
    "1": 0b000001,
    "2": 0b000011,
    "3": 0b001001,
    "4": 0b011001,
    "5": 0b010001,
    "6": 0b001011,
    "7": 0b011011,
    "8": 0b010011,
    "9": 0b001010,
    "0": 0b011010,
  };
  const brailleTexCache = new Map<string, THREE.Texture>();
  const brailleTexture = (ch: string): THREE.Texture | null => {
    const mask = BRAILLE_DOTS[ch.toLowerCase()];
    if (mask == null) {
      return null;
    }
    const key = String(mask);
    let t = brailleTexCache.get(key);
    if (t != null) return t;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = "#31405a";
    // Two columns of three, on the same card the letter will be printed on.
    // Dots 1-3 down the left, 4-6 down the right — swap that pair and every
    // cell still looks plausible and spells something else.
    const R = 19,
      X = [88, 168],
      Y = [72, 128, 184];
    for (let d = 0; d < 6; d++) {
      const on = (mask & (1 << d)) !== 0;
      g.globalAlpha = on ? 1 : 0.13;
      g.beginPath();
      g.arc(X[d < 3 ? 0 : 1], Y[d % 3], R, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    brailleTexCache.set(key, t);
    return t;
  };
  /**
   * THE FIRST PASSAGE ARRIVES IN BRAILLE AND RESOLVES INTO LETTERS. Once.
   *
   * The letters are the one thing on this screen a child has to READ in order
   * to act — obscuring them, even for a moment, is putting a delay between
   * "which key next?" and being able to see the answer, and it costs the
   * slowest readers the most. So it happens exactly once, on the first
   * passage of a session, while nobody is yet typing, and never again: after
   * that every card is a letter from the moment it appears.
   */
  let revealDone = false;
  let revealLeft = -1;
  let revealT = 0;
  const REVEAL_PER_TILE = 0.075;
  /**
   * Turn the next card over, left to right, on a clock of its own.
   *
   * Driven from the tick rather than from a timer so it stops with the rest
   * of the world when a tab is hidden or motion is stilled — a reveal that
   * ran on wall-clock time would be over before a returning child saw it.
   */
  const stepReveal = (dt: number): void => {
    if (revealLeft <= 0) {
      return;
    }
    revealT += dt;
    while (revealT >= REVEAL_PER_TILE && revealLeft > 0) {
      revealT -= REVEAL_PER_TILE;
      const i = wordTiles.length - revealLeft;
      revealLeft -= 1;
      const tile = wordTiles[i];
      const ch = wordText[i];
      if (tile == null || ch == null || ch === " ") {
        continue;
      }
      const fm = tile.face.material as THREE.MeshStandardMaterial;
      fm.map = letterTexture(ch);
      fm.needsUpdate = true;
    }
  };

  const TILE_C = new THREE.Color(0xf3ead6); // warm stone card
  // The current letter wears the learner's colour, paled towards the stone it
  // is carved into: full-strength accent reads as a UI chip dropped into the
  // scene, where the trail wants something that looks weathered.
  const TILE_CUR_C = new THREE.Color(0x53d98b);
  // The scene renders through ACES filmic tone mapping at an exposure above 1,
  // which desaturates and rolls off anything bright — a colour handed to it
  // unchanged comes back noticeably paler than it went in. So the tile colour
  // is pushed the other way first: saturation up, and lightness pulled back
  // where the accent is already light, which is exactly the case the roll-off
  // hurts most. Paling it towards the stone as well (an earlier attempt) only
  // compounded the problem, so that is gone.
  const setTileAccent = (hex: string) => {
    try {
      TILE_CUR_C.set(hex);
      const hsl = { h: 0, s: 0, l: 0 };
      TILE_CUR_C.getHSL(hsl);
      TILE_CUR_C.setHSL(
        hsl.h,
        Math.min(1, hsl.s * 1.45),
        Math.min(0.62, hsl.l * 0.86),
      );
      // …then a whisper back towards the stone, so the tile still belongs to
      // the trail rather than sitting on it. Small on purpose: the saturation
      // boost above is doing the work, and this only takes the edge off.
      TILE_CUR_C.lerp(TILE_C, 0.08);
    } catch {
      // An unparseable colour leaves the tile as it was.
    }
  };
  type WordTile = {
    grp: THREE.Group;
    base: THREE.Mesh;
    face: THREE.Mesh;
    shadow: THREE.Mesh;
  };
  let wordTiles: WordTile[] = [];
  /**
   * How hard a letter card sits on the road, before cloud is taken off it.
   *
   * Deeper than it was. These cards float above a bright red-brown track in
   * full sun and the shadow is the only thing holding them down; at 0.32 they
   * read as printed ON the road rather than standing over it.
   *
   * A TYPED CARD CASTS NOTHING. It fades to 30% once it is behind the caret,
   * and a card you can see through does not throw a shadow — leaving it a
   * faint one made the letters already done look like they were still sitting
   * on the road. Gone entirely, the passage reads as a line of cards standing
   * ahead of the child and a trail of flat marks behind them, which is what
   * the fade was for in the first place.
   */
  const tileShadowBase = 0.46;
  const tileShadowTyped = 0;
  let wordIdx = 0;
  let wordText = ""; // the whole passage currently laid out as tiles
  let wordSnap = false; // snap the ribbon into place (new passage) vs. glide
  // BIGGER, and everything that makes a tile goes with it.
  //
  // The card, its printed face, its shadow and this spacing are four
  // separate numbers; scaling one without the others either crowds the
  // letters together or leaves them adrift on their own shadows. All four
  // are up 31% from where they started, and so is the letter canvas — see
  // letterTexture, where a fixed 160px would have gone soft the moment the
  // card outgrew it.
  //
  // There is room: the view is 14.4 half-height and about twice that across,
  // so even at this spacing the ribbon carries twenty-odd cards before it
  // reaches an edge.
  // TRIMMED A LITTLE. Everything below is one set of proportions — the gap,
  // the block, the printed face and the shadow it casts — so they all come
  // down by the same 6%, or the letters stop sitting centred on their cards.
  const TILE_GAP = 1.97;
  const buildWordTiles = (n: number) => {
    for (const t of wordTiles) wordGroup.remove(t.grp);
    wordTiles = [];
    for (let i = 0; i < n; i++) {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.67, 1.67, 0.49),
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
        new THREE.PlaneGeometry(1.6, 1.6),
        new THREE.MeshBasicMaterial({
          color: 0x1f2a13,
          transparent: true,
          opacity: 0.46,
          depthTest: false,
          depthWrite: false,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      // Where it lands is set in the tick — see the word ribbon — because it
      // depends on how high the card is floating and on the group's scale,
      // and both of those move.
      shadow.renderOrder = 19;
      base.castShadow = false;
      base.receiveShadow = false;
      base.renderOrder = 20;
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(1.42, 1.42),
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
  let lastWord = "";
  let lastIndex = 0;
  const setWordImpl = (text: string, index: number) => {
    lastWord = text;
    lastIndex = index;
    if (!text) {
      wordGroup.visible = false;
      wordText = "";
      return;
    }
    wordGroup.visible = true;
    if (text !== wordText) {
      if (text.length !== wordTiles.length) buildWordTiles(text.length);
      // ARMED BEFORE THE CARDS ARE PRINTED, not after.
      //
      // This ran below the loop, which got it wrong in both directions: the
      // first passage was printed as letters because the reveal had not been
      // armed yet, and every passage after it was printed as BRAILLE because
      // the counter was still standing at whatever the first one left behind
      // — and with the reveal already spent, nothing ever turned those cards
      // over. Decided first, once, and the loop simply reads the answer.
      if (revealDone) {
        revealLeft = 0;
      } else {
        revealDone = true;
        revealLeft = text.length;
        revealT = 0;
      }
      for (let i = 0; i < wordTiles.length; i++) {
        const { base, face } = wordTiles[i];
        const ch = text[i] ?? " ";
        const isSpace = ch === " ";
        // Spaces are small flat stones so the gap is visible and the child
        // learns to press it; letters are full cards.
        face.visible = !isSpace;
        if (!isSpace) {
          const fm = face.material as THREE.MeshStandardMaterial;
          // On the very first passage the cards come up as braille and are
          // turned over one at a time by the tick — see revealLeft.
          const cell = revealLeft > 0 ? brailleTexture(ch) : null;
          fm.map = cell ?? letterTexture(ch);
          fm.needsUpdate = true;
        }
        base.scale.set(isSpace ? 0.5 : 1, isSpace ? 0.32 : 1, 1);
        base.position.y = isSpace ? -0.42 : 0;
      }
      if (!revealDone) {
        // Armed on the first passage this world ever shows, and disarmed the
        // moment it is spent. `revealLeft` counts the cards still to turn.
        revealDone = true;
        revealLeft = wordTiles.length;
        revealT = 0;
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
      // Kept on the mesh, not just applied: the cloud pass below runs every
      // frame and used to write one base over every tile, which quietly threw
      // this away and gave typed cards a full shadow again a frame later.
      const sh = wordTiles[i].shadow;
      sh.userData.shadowBase = typed ? tileShadowTyped : tileShadowBase;
      (sh.material as THREE.MeshBasicMaterial).opacity = sh.userData
        .shadowBase as number;
      if (i === index) {
        bm.color.copy(TILE_CUR_C);
        bm.emissive.copy(TILE_CUR_C);
        // Enough glow to lift the tile off the trail, and no more: emissive
        // adds light *before* tone mapping, so pushing it hard drives the
        // whole tile into the highlight roll-off and it comes out white.
        // Saturation, not brightness, is what makes this read by day.
        //
        // After dark there is no daylight competing with it, so the same
        // figure reads as flat. A small lift is all it takes for the tile to
        // glow rather than merely be a lighter grey — and it has to stay
        // small for the reason above: the roll-off is unforgiving.
        // 0.8 after dark, not 0.62. The card the child is ON has to be the
        // one their eye goes to, and at night the whole ribbon is already
        // lifted to stay legible -- which narrows the gap between "next" and
        // "the rest" exactly when it matters most. Widening it at the top
        // rather than dimming the others keeps the row readable ahead.
        bm.emissiveIntensity = nightBlend > 0.5 ? 0.62 : 0.3;
      } else {
        bm.color.copy(TILE_C);
        // THE WHOLE RIBBON LIFTS AFTER DARK, not only the tile being typed.
        //
        // The card is a pale stone lit by the scene, and the scene is now a
        // properly dark night — so at 0.10 twilight the letters a child is
        // reading ahead went the colour of the road they lie on. The lift is
        // deliberately flat and gentle: enough to keep the ribbon legible as
        // a row of cards, not enough to compete with the current tile, which
        // is twice this and coloured.
        bm.emissive.copy(TILE_C);
        bm.emissiveIntensity = 0.34 * nightBlend;
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

  /**
   * Characters who do not grow.
   *
   * The size curve above is a hatchling's: a dino arrives as a baby and grows
   * into an adult as letters are unlocked, and its size IS its progress. The
   * two Explorers are not hatchlings. They are a ten-year-old and a
   * six-year-old, they are those ages for good, and the difference between
   * their heights is the only thing telling a child which is which.
   *
   * Left to grow, that broke in the way you would least expect to notice: the
   * PLAYER was scaled by progress and the companion never was, so the pair's
   * heights said nothing about age and everything about how far through the
   * alphabet somebody happened to be — the six-year-old could stand taller
   * than the ten-year-old beside him.
   */
  /**
   * How much longer than usual this character waits before sitting down.
   *
   * Peeli would rather be on her feet, so she sits later than her brothers
   * — but only a little, and the reason is arithmetic rather than taste.
   *
   * She has no crouch, so her chain is wave → sit where theirs is
   * wave → crouch → sit, and the wave itself stops after the second pause
   * (WAVE_UNTIL_PAUSE). From the third pause on, whatever this number says
   * is the whole length of time she stands doing nothing. At 2.2 that was
   * 44s, and 141s once the patience stretch had run — long enough to read
   * as a character who had stopped working rather than one who is restless.
   *
   * 1.3 puts her at 26s against the boys' 20s: still visibly the one who
   * stays on her feet, without a dead minute in the middle of it.
   */
  const sitPatience = (name: string) => (name === "Peeli" ? 1.3 : 1);

  // The three siblings are the ages they are — Dave nine, Peeli nine, Little
  // Drew six — so the trail's baby-to-adult growth curve is not theirs to
  // ride. It stays what it was built for: a dino hatching and growing up.
  const growsWithAge = (name: string) =>
    !/^(?:Explorer6?|Peeli|Robot|Puppy)$/.test(name);
  let playerGrows = true;
  /** Captured at load, like `playerGrows` — see `sitPatience`. */
  let playerSitsLate = 1;

  /**
   * The tinted character, when the current one can be tinted.
   *
   * Rebuilt on every character swap because the handle closes over that
   * model's own materials — keeping the old one would write uniforms
   * into a character no longer on screen.
   */
  let playerTint: CharacterTint | null = null;
  /** What was asked for before a model that could take it was loaded. */
  let pendingColours: ClothingColours = {};

  /**
   * Bring a friend along, or send them home.
   *
   * Deliberately thin: it loads a rig and parks it. Everything the companion
   * DOES happens in the frame loop, replaying what the player already did.
   */
  /**
   * WHO WALKS WITH YOU — nobody, one, or two.
   *
   * Given in the order they should LINE UP, nearest first, which the page
   * decides from the cast order rather than from the order the pills were
   * tapped: a child who picks Little Drew and then Peeli gets the same line
   * as one who picks them the other way round, because the line is a fact
   * about the characters and not about the clicking.
   *
   * Rebuilt wholesale rather than diffed. A diff would have to reason about
   * one character moving from first place to second while another leaves,
   * which is three cases and a reshuffle of the lamp; rebuilding is one case
   * and costs a model load that `THREE.Cache` has already paid for.
   */
  async function setCompanions(names: readonly string[]): Promise<void> {
    const want = names.slice(0, MAX_FOLLOWERS);
    if (
      want.length === companionNames.length &&
      want.every((n, i) => n === companionNames[i])
    ) {
      return;
    }
    companionNames = want;
    // THE GUIDE IS NOT A COMPANION and must survive this.
    //
    // This rebuilds the whole line from scratch — cheaper than reshuffling —
    // but he lives in the same array and was being released along with them,
    // and nothing put him back: `setGuide` early-returns when his name has not
    // changed. So changing a friend in settings made him vanish until the page
    // was reloaded, which re-ran init.
    const keepGuide = followers.filter((f) => f.guide);
    for (const f of followers) {
      if (!f.guide) {
        releaseRig(f.rig);
      }
    }
    followers.length = 0;
    followers.push(...keepGuide);
    // The lamp belonged to whoever just left.
    companionLamp.intensity = 0;
    for (const [i, name] of want.entries()) {
      const gltf = await loadModel(modelUrl(theme.modelDir, name)).catch(
        (err: unknown) => {
          // A missing friend must never cost anybody their game.
          console.warn(`kids: companion "${name}" could not be loaded`, err);
          return null;
        },
      );
      // Disposed, or switched again, while this was in flight.
      if (gltf == null || disposed || companionNames !== want) {
        return;
      }
      // Exactly the height this character always has — `theme.playerHeight`
      // and nothing else.
      //
      // A character's height belongs to the CHARACTER, never to the role it
      // is playing. The ten-year-old is the ten-year-old's height whether he
      // is being played or walking alongside, and the same for the
      // six-year-old: that difference is the whole reason a child can tell
      // which of them is which, and it is the one cue that must not be spent
      // on anything else. This briefly carried a 0.94 factor to mark out
      // "the one you are not playing", which made a ten-year-old companion
      // shorter than a ten-year-old player — a size difference that meant
      // nothing about age, sitting right next to one that did.
      const rig = rigOf(gltf, theme.playerHeight(name), name);
      rig.wrap.rotation.y = Math.PI / 2;
      // A LINE, not a huddle. Each one walks a little further back and a
      // little further out than the one in front, so the three of them read
      // as a group going somewhere together rather than as a stack.
      const gap = FOLLOW_GAP + i * FOLLOW_STAGGER;
      const z = LANE + SIDE + i * FOLLOW_SPREAD;
      rig.wrap.position.set(playerX - gap, terrainY(playerX, z), z);
      // Lit like the player, but with no pointer ring.
      //
      // The ring marks whose turn it is and that is never the companion's —
      // but the LIGHT is not a marker, it is how a character reads at night.
      // Without it the companion stood in the dark beside somebody carrying
      // a lantern, which is what a piece of scenery does.
      rig.wrap.traverse((n) => {
        n.layers.enable(COMPANION_LIGHT_LAYER);
      });
      scene.add(rig.wrap);
      followers.push({
        rig,
        name,
        gap,
        guide: false,
        z,
        lastX: playerX - gap,
        dust: 0,
        celebrating: false,
        s: freshFollowState(),
      });
    }
    // The line was just rebuilt, so re-space it: with a guide on the road the
    // companions stand further back to leave him the place behind the child.
    respaceCompanions();
  }

  /**
   * The local boy who shows them the village, or nobody.
   *
   * He is a FOLLOWER, not a herd bystander. That matters for more than
   * tidiness: `spawnCompanion` builds its friends with the whole rest chain
   * hardcoded null — "scenery, not the player: it never crouches or sits" —
   * so a guide spawned that way could never sit down at the roadside, which
   * is the one thing section 00c asks him to do. Coming through `rigOf` he
   * gets the real chain.
   */
  async function setGuide(name: string | null): Promise<void> {
    if (name === guideName) {
      return;
    }
    guideName = name;
    for (const f of followers.filter((x) => x.guide)) {
      releaseRig(f.rig);
      followers.splice(followers.indexOf(f), 1);
    }
    // Straight away, not after the model loads: turning the guide OFF has to
    // close the gap immediately, and there is nothing left to wait for.
    respaceCompanions();
    if (name == null) {
      return;
    }
    const gltf = await loadModel(modelUrl(theme.modelDir, name)).catch(
      (err: unknown) => {
        // A missing guide must never cost anybody their game.
        console.warn(`kids: guide "${name}" could not be loaded`, err);
        return null;
      },
    );
    if (gltf == null || disposed || guideName !== name) {
      return;
    }
    const rig = rigOf(gltf, theme.playerHeight(name), name);
    rig.wrap.rotation.y = Math.PI / 2;
    // IN THEIR LANE, BUT ON THE OTHER SIDE FROM THE COMPANIONS.
    //
    // He used to share their side, which put the guide, the friends and the
    // dog all on one worn strip with the other half of the road empty -- and
    // at the follower spacing that reads as a queue rather than as people
    // walking together. Across from them he frames the child instead: one
    // ahead on the left, the rest behind on the right.
    //
    // A FULL OFFSET, mirroring the companions rather than halving it. At half
    // he was barely off the child's own centre line -- across the road on
    // paper, still overlapping them on screen, because the camera looks along
    // the road and it is the SIDEWAYS distance that separates two people in
    // that view. Matched to the companions' 1.9 so the child walks down the
    // middle with the guide out to one side and the friends to the other.
    const z = LANE - SIDE * 1.1;
    // Band 1 until told otherwise: three units up the road, leading.
    // His band's own distance, not band 1's -- see `guideBandGap`.
    const gap = guideBandGap();
    rig.wrap.position.set(playerX - gap, terrainY(playerX, z), z);
    rig.wrap.traverse((n) => {
      n.layers.enable(COMPANION_LIGHT_LAYER);
    });
    scene.add(rig.wrap);
    followers.push({
      rig,
      name,
      gap,
      guide: true,
      z,
      lastX: playerX - gap,
      dust: 0,
      celebrating: false,
      s: freshFollowState(),
    });
    followers[followers.length - 1].s.dogTravel = "guideDrift";
    followers[followers.length - 1].s.dogNextRun = dogWait(
      40 + Math.random() * 50,
    );
  }

  /** One companion, or none — the old shape, kept for callers that mean it. */
  async function setCompanion(name: string | null): Promise<void> {
    await setCompanions(name == null ? [] : [name]);
  }

  async function setPlayer(name: string) {
    /**
     * A character that will not load must not take the game with it.
     *
     * The Explorer's textures are Basis-compressed, and transcoding them
     * needs a format the GPU will accept. Where that fails — an old
     * machine, a driver that reports nothing usable — the model rejects,
     * and before this the rejection travelled up through world creation
     * and left a child looking at an empty trail with no way back: the
     * character picker is inside a game that never started.
     *
     * So a failure falls back to the character this world ships with,
     * which is plain glTF and always loads. The game runs; they are
     * simply not playing as the one they picked.
     */
    let gltf = await loadModel(modelUrl(theme.modelDir, name)).catch(
      (err: unknown) => {
        console.warn(`kids: could not load "${name}", falling back`, err);
        return null;
      },
    );
    if (gltf == null && name !== theme.defaultPlayer) {
      gltf = await loadModel(
        modelUrl(theme.modelDir, theme.defaultPlayer),
      ).catch(() => null);
    }
    if (gltf == null) {
      return;
    }
    playerH = theme.playerHeight(name);
    playerWho = name;
    const rig = rigOf(gltf, playerH, name);
    // Recolouring is a nicety; being able to play is not.
    //
    // This used to be awaited here, which put a texture lookup and a
    // transcoder worker between a child and their game: anything slow or
    // stuck in it did not fail the character, it simply never finished,
    // and the trail sat empty with nothing on screen to say why. It runs
    // alongside now — the character appears either way, and the clothes
    // take their colour a moment later if they can.
    playerTint = null;
    const forThisModel = gltf;
    void attachTint(gltf)
      .then((tint) => {
        // A slow model that lost the race must not tint whoever replaced
        // it, so the result is dropped unless it is still the one on
        // screen.
        if (disposed || player?.wrap !== rig.wrap || forThisModel !== gltf) {
          return;
        }
        playerTint = tint;
        if (tint != null && Object.keys(pendingColours).length > 0) {
          // Colours chosen before this model finished loading — set last
          // session, or changed with the panel already open.
          tint.setColors(pendingColours);
        }
      })
      .catch((err: unknown) => {
        // Said out loud, because a character silently refusing to take a
        // colour is a bug report nobody can describe.
        console.warn(
          "kids: clothing colours unavailable for this character",
          err,
        );
      });
    rig.wrap.position.set(playerX, terrainY(playerX, LANE), LANE);
    rig.wrap.rotation.y = Math.PI / 2;
    playerGrows = growsWithAge(name);
    playerSitsLate = sitPatience(name);
    growTarget = playerGrows ? sizeForAge(dinoAge) : 1;
    if (player) {
      // The outgoing character's scale is only inherited when the incoming one
      // is governed by the same rule. Carrying a grown dino's 1.38 onto a
      // six-year-old is how he ended up taller than the ten-year-old.
      if (playerGrows) {
        rig.wrap.scale.copy(player.wrap.scale);
      }
      // Freed, not merely hidden — see releaseRig. The scale above is read
      // off the outgoing rig first, so this stays after it.
      releaseRig(player);
    }
    rig.wrap.scale.setScalar(playerGrows ? rig.wrap.scale.x : 1);
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
    // THE NEW CHARACTER PICKS UP THE POSE THE OLD ONE WAS HOLDING.
    //
    // Swapping characters builds a fresh rig, and a fresh rig starts in idle
    // — while `restStage` and the coach line still say the child is waving,
    // or crouched, or sitting in the grass. So changing who you play as in
    // the middle of a rest stood everybody up: the position carried over,
    // the pose did not, and the panel had apparently reset the game.
    //
    // The rest chain is a property of the MOMENT — nobody has typed for a
    // while — not of whoever happens to be standing there, so it survives
    // the swap. The looping holds are re-entered from their own clip; the
    // one-shots that lead into them are not replayed, because a character
    // who is already sitting should not sit down again.
    {
      const r = rig.rest;
      const resume =
        restStage === "sitIdle" || restStage === "sitDown"
          ? r.sitIdle
          : restStage === "crouchIdle" || restStage === "crouchDown"
            ? r.crouchIdle
            : restStage === "fidget" || restStage === "brave"
              ? r.wave
              : null;
      if (resume != null) {
        // Held on its own loop rather than run through `startRest`, which
        // would blend from the outgoing character's action — an action that
        // belongs to a rig that has just been released.
        restPrev = null;
        restBlend = 1;
        resume.reset();
        resume.play();
        restAction = resume;
      } else {
        restAction = null;
        restPrev = null;
      }
    }
  }

  // Declared before `ready` (rather than down by tick()/dispose(), where it
  // conceptually belongs) so the checks inside `ready` and its helpers —
  // reached only after an await, always after this whole function's
  // synchronous body including this line has run — don't trip TypeScript's
  // same-scope temporal-dead-zone check.
  let disposed = false;
  const warmModels = (urls: readonly string[], limit = 6): void => {
    THREE.Cache.enabled = true;
    const file = new THREE.FileLoader();
    file.setResponseType("arraybuffer");
    const seen = new Set<string>();
    const queue = urls.filter((u) => !seen.has(u) && seen.add(u));
    let i = 0;
    const pump = (): void => {
      if (disposed) {
        return;
      }
      const url = queue[i++];
      if (url == null) {
        return;
      }
      // Both arms continue: a file that is missing here is a file the
      // build will discover is missing in its own way, and warming is
      // never allowed to be the thing that reports it.
      file.load(
        url,
        () => pump(),
        undefined,
        () => pump(),
      );
    };
    for (let k = 0; k < limit; k++) {
      pump();
    }
  };

  /**
   * EVERY FILE THIS WORLD WILL ASK FOR, REQUESTED AT ONCE, FIRST.
   *
   * This is the loading screen's single biggest cost, and it was an ordering
   * mistake rather than a slow anything.
   *
   * The build's head is sequential by necessity — the shared clips, then the
   * player, each awaited — and this warm-up used to sit AFTER it, down in the
   * herd section. So for the first three and a half seconds exactly one file
   * was ever in flight: the network sat idle behind a single request while
   * twenty-odd other files, all of whose URLs were already known, waited
   * their turn. Measured on this machine, the six-wide batch did not start
   * until 7.0s, by which time the player had been downloaded and parsed
   * alone.
   *
   * Nothing here needs the build to have got anywhere: every URL comes from
   * theme and land data that exists before the first byte is fetched. So it
   * goes first, six at a time, into three's own cache — and every `await`
   * below then finds its file already there instead of starting a round trip.
   *
   * Fire-and-forget on purpose. A warm-up that fails is a file the build will
   * fetch itself in a moment; it must never be the thing that reports an
   * error, and it must never be awaited.
   */
  function warmEverything(): void {
    const want: string[] = [];
    // The head of the chain: the shared clips and the default player are the
    // two things the build blocks on before anything else can start.
    for (const url of theme.animationUrls ?? []) {
      want.push(`${ASSETS}/models/${theme.modelDir}/${url}`);
    }
    want.push(modelUrl(theme.modelDir, theme.defaultPlayer));

    for (const spot of theme.herd) {
      want.push(
        modelUrl(
          theme.modelDir,
          spot.model === "$friend" ? land.friend : spot.model,
        ),
      );
    }
    // The scatter reads a name containing "/" as a full path under models/
    // and anything else as a file in the theme's scenery folder; the same
    // rule has to hold here or the warm-up misses and the build refetches.
    const sceneryUrl = (file: string) =>
      file.includes("/")
        ? `${ASSETS}/models/${file}.glb`
        : `${ASSETS}/models/${theme.sceneryDir}/${file}.glb`;
    want.push(sceneryUrl(String(land.trees)));
    for (const g of theme.ground) {
      want.push(sceneryUrl(String(g[0])));
    }
    const v = theme.village;
    if (v != null) {
      const villageUrl = (name: string) =>
        name.includes("/")
          ? `${ASSETS}/models/${name}.glb`
          : `${ASSETS}/models/${v.dir}/${name}.glb`;
      for (const h of v.heart) {
        want.push(villageUrl(h.model));
      }
      for (const h of v.houses) {
        want.push(villageUrl(h));
      }
      want.push(villageUrl(v.wall));
      for (const st of v.strays ?? []) {
        want.push(villageUrl(st.model));
      }
    }
    // The road's own furniture, which no theme field declares: it is asked
    // for by name where the milestones and lamps are planted.
    for (const n of [
      "Milestone_Vazhivilakku",
      "Laterite_Rock",
      "Granite_Boulder",
      "Mossy_Stone",
      "River_Stone",
    ]) {
      want.push(`${ASSETS}/models/village-stone/${n}.glb`);
    }
    warmModels(want);
  }

  const ready = (async () => {
    // Before anything is awaited — see `warmEverything`.
    warmEverything();
    // Load the shared movement/idle clips first so every hero can play them.
    if (theme.animationUrls) {
      for (const url of theme.animationUrls) {
        try {
          const g = await loader.loadAsync(
            `${ASSETS}/models/${theme.modelDir}/${url}`,
          );
          sharedClips = sharedClips.concat(
            (g.animations ?? [])
              .filter((c) => !/death|attack|bite|hit/i.test(c.name))
              .map(stripScaleTracks),
          );
        } catch {
          // A missing clip file just means no animation — still playable.
        }
      }
    }
    await setPlayer(theme.defaultPlayer);
    if (disposed) {
      // Torn down mid-load: setPlayer already no-opped, and every step below
      // (herd, travellers, sheep, scenery, sky) only ever adds to a scene
      // that's already been disposed. Stop here rather than churn through it.
      return;
    }

    // Showcase: load it RAW through the shared loader, not loadModel, so its
    // attack, death and sleep clips survive (loadModel drops those) and all its
    // moves can be reviewed. Positioned beside the player each frame in `tick`,
    // so it stays in view whether or not the learner is walking.
    if (opts.showcaseModel) {
      try {
        const bg = await loader.loadAsync(
          modelUrl(theme.modelDir, opts.showcaseModel),
        );
        if (!disposed) {
          bg.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.castShadow = true;
              m.frustumCulled = false;
            }
          });
          // 5.9 against Dave's 4.8 — clearly taller on all fours, and it towers
          // when the rear-stomp lifts it to full height. The grounding does not
          // need retuning for this: the foot lift is MEASURED off the posed
          // mesh after the fit, so it scales with whatever height is set here.
          // Drawn at the size the animal actually is relative to Dave's 4.8:
          // the buffalo towers, the puppy comes up to his knee. Sizing them the
          // same would make the puppy's gaits unreadable and is the first thing
          // that gives away a showcase built for one animal.
          buffaloWrap = fitToHeight(
            bg.scene,
            SHOWCASE_H[opts.showcaseModel] ?? 5.9,
          );
          buffaloWrap.rotation.y = Math.PI / 2; // broadside to the camera, as the player is
          scene.add(buffaloWrap);
          characterRoots.add(buffaloWrap);
          buffaloMixer = new THREE.AnimationMixer(bg.scene);
          buffaloActions = (bg.animations ?? []).map((c) =>
            buffaloMixer!.clipAction(c),
          );
          // Put its feet on the ground. `fitToHeight` measures the BIND pose
          // and zeroes that, but the hoof geometry hangs below the last bone,
          // so the animal stood buried to the fetlocks in every clip.
          // `plantFeet` measures the skinned vertices with each clip actually
          // playing and drops the model by the lowest it ever gets. Handing it
          // ALL the clips is right here rather than wasteful: every clip was
          // authored against one shared floor, so they agree on the answer,
          // and passing them all means no single clip can sink.
          if (buffaloActions.length) {
            // `plantFeet` measures skinned vertices in WORLD space, so the
            // wrap's matrices have to be current before it runs — it was
            // called on a group added to the scene moments earlier, whose
            // matrixWorld three.js had not refreshed yet, and the offset it
            // computed left the animal buried to the knees.
            buffaloWrap.updateMatrixWorld(true);
            plantFeet(bg.scene, buffaloMixer, buffaloActions);
            advanceBuffalo(0);
            // Then MEASURE where the feet actually ended up, and lift by that.
            //
            // `plantFeet` was leaving the animal buried to the knees here, and
            // rather than keep guessing at why, this reads the answer off the
            // skinned mesh: pose it, refresh the matrices, find the lowest
            // vertex in world space, and that distance is the correction. It
            // is a one-off over every seventh vertex, and it is right whatever
            // the cause was.
            buffaloMixer.update(0);
            buffaloWrap.updateMatrixWorld(true);
            let lowest = Infinity;
            const _v = new THREE.Vector3();
            bg.scene.traverse((o) => {
              const sm = o as THREE.SkinnedMesh;
              if (
                !sm.isSkinnedMesh ||
                typeof sm.getVertexPosition !== "function"
              )
                return;
              const pos = sm.geometry.attributes.position;
              for (let i = 0; i < pos.count; i += 7) {
                sm.getVertexPosition(i, _v);
                _v.applyMatrix4(sm.matrixWorld);
                if (_v.y < lowest) lowest = _v.y;
              }
            });
            if (Number.isFinite(lowest)) buffaloFootLift = -lowest;
          }
        }
      } catch {
        // Best-effort review aid; the game is unaffected if it fails to load.
      }
    }

    // Second showcase slot: loaded the same way, grounded the same way, but put
    // on its idle loop and left there.
    if (opts.showcaseIdleModel) {
      try {
        const ig = await loader.loadAsync(
          modelUrl(theme.modelDir, opts.showcaseIdleModel),
        );
        if (!disposed) {
          ig.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.castShadow = true;
              m.receiveShadow = true;
            }
          });
          idleShowWrap = fitToHeight(
            ig.scene,
            SHOWCASE_H[opts.showcaseIdleModel] ?? 5.9,
          );
          idleShowWrap.rotation.y = Math.PI / 2;
          scene.add(idleShowWrap);
          characterRoots.add(idleShowWrap);
          idleShowMixer = new THREE.AnimationMixer(ig.scene);
          const clips = ig.animations ?? [];
          const pick =
            clips.find((c) => /^Idle$/i.test(c.name)) ??
            clips.find((c) => /idle/i.test(c.name)) ??
            clips[0];
          if (pick) {
            console.log(
              `kids: showcase idle model "${opts.showcaseIdleModel}" -> clip "${pick.name}"`,
            );
            const act = idleShowMixer.clipAction(pick);
            act.setLoop(THREE.LoopRepeat, Infinity);
            act.play();
          }
          // Grounded by MEASUREMENT, exactly as the cycling slot is: pose it,
          // then find the lowest skinned vertex and lift by that. Anything less
          // leaves it shin-deep, which is what the buffalo did originally.
          idleShowMixer.update(0);
          idleShowWrap.updateMatrixWorld(true);
          let lowest = Infinity;
          const _iv = new THREE.Vector3();
          ig.scene.traverse((o) => {
            const sm = o as THREE.SkinnedMesh;
            if (!sm.isSkinnedMesh || typeof sm.getVertexPosition !== "function")
              return;
            const pos = sm.geometry.attributes.position;
            for (let i = 0; i < pos.count; i += 7) {
              sm.getVertexPosition(i, _iv);
              _iv.applyMatrix4(sm.matrixWorld);
              if (_iv.y < lowest) lowest = _iv.y;
            }
          });
          if (Number.isFinite(lowest)) idleShowFootLift = -lowest;
        }
      } catch {
        // Best-effort review aid; the game is unaffected if it fails to load.
      }
    }

    const calm = (clips: THREE.AnimationClip[]) =>
      clips.find((c) => /idle|stand|eat|graze/i.test(c.name)) ??
      clips.find((c) => /walk/i.test(c.name)) ??
      null;
    // Each companion gets a different loop so they don't all bob in unison —
    // some stand, some gesture, some fidget; skeletons twitch eerily.
    /**
     * Every calm loop a character has to stand about in, not just one.
     *
     * This used to match three EXACT names — Idle_A, Idle_B, Interact — which
     * is what the KayKit pack calls them and nothing else does. A character
     * with idles of its own was invisible to it: the Abee of the day shipped
     * three (`ABEE_IDLE_Neutral_01`, `_Curious_01`, `_ListeningAlert_01`) and
     * none were reachable, so he stood in the pack's generic `Idle_A`, whose
     * hips move four degrees end to end. Animated, technically. Standing
     * still, to look at.
     *
     * Abee's village build now uses the exact names deliberately, and carries
     * only those three: his authored close-up idles peak at 40 mm of vertex
     * motion, about 2 px at the size he renders here, so letting them into
     * the pool would have made half the rotation look like a freeze-frame.
     *
     * The exact names stay FIRST, because the pack's own idles are the ones
     * the scary/calm distinction was tuned against; anything else matching
     * "idle" comes after, which picks up bespoke sets without needing a list
     * of them. Combat clips are not idles and are still excluded — a
     * roundhouse kick is not a thing to do while waiting by a road.
     */
    const idlePool = (clips: THREE.AnimationClip[], scary: boolean) => {
      const names = scary
        ? ["Idle_B", "Idle_A"]
        : ["Idle_A", "Idle_B", "Interact"];
      const exact = names
        .map((n) => clips.find((c) => c.name === n))
        .filter((c): c is THREE.AnimationClip => c != null);
      const own = clips.filter(
        (c) => /idle/i.test(c.name) && !exact.includes(c),
      );
      const pool = [...exact, ...own];
      return pool.length > 0 ? pool : [calm(clips)].filter((c) => c != null);
    };
    const pickIdle = (clips: THREE.AnimationClip[], scary: boolean) => {
      const pool = idlePool(clips, scary);
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
      forceGuard?: boolean,
      faceY?: number,
      girth?: number,
      headScale?: number,
    ) => {
      let gltf;
      try {
        gltf = await loadModel(modelUrl(theme.modelDir, model));
      } catch {
        return; // a single missing companion never breaks the world
      }
      if (gltf == null) {
        return;
      }
      // NO DEPTH CUE ON THE CAST. The hero, the companion and the guide all
      // travel the road — they are at the reference distance by definition,
      // so the factor would be 1 for them anyway — and the roadside villagers
      // this same function spawns stand close enough to it that shrinking
      // them would read as a different, smaller person rather than as the
      // same person further off. The party has to stay one size: a child
      // compares themselves to Dave, and Dave must not change.
      const wrap = fitToHeight(gltf.scene, h);
      if (girth != null && girth !== 1) {
        // Across and through only; the height was already fitted and must not
        // move, or the character stops matching the number that set it.
        wrap.scale.x *= girth;
        wrap.scale.z *= girth;
      }
      // The placement may override, but the character's own head comes from
      // the shared table, so a companion and a player of the same character
      // are the same person.
      scaleHead(gltf.scene, headScale ?? castHeadScale(model));
      wrap.position.set(x, surfaceY(x, z), z);
      // A random home facing — the crowd looks every which way, not all one
      // way — unless the placement asked for a particular one.
      const homeY = faceY ?? Math.random() * Math.PI * 2;
      wrap.rotation.y = homeY;
      // A rare few are "guards" who pace back and forth over their patch.
      // A twin inherits its villager's duty, so a pacing guard morphs into a
      // pacing skeleton rather than a stander who forgot the job.
      const guard =
        forceGuard ?? (!scary && Math.random() < (theme.guardRate ?? 0));
      // Only some companions are "smilers" who give a happy bob; the rest just
      // stop and stare when the hero passes.
      wrap.userData = {
        homeY,
        // An explicitly placed facing is a decision, not a starting point:
        // `companionsWatch` otherwise swings anyone standing near the hero
        // round to watch them, which quietly undoes it.
        fixedFace: faceY != null,
        homeX: x,
        homeZ: z,
        scary,
        guard,
        phase: Math.random() * Math.PI * 2,
        smiler: Math.random() < 0.35,
        // "Some of the crowd goes home after dark" is a night idea; at a
        // dusk everyone stays out.
        dayOnly: trueNight && !scary && Math.random() < 0.4,
      };
      scene.add(wrap);
      characterRoots.add(wrap);
      applyEyeGlow(wrap, nightNow);
      const mixer = new THREE.AnimationMixer(gltf.scene);
      const clips = clipsFor(gltf);
      // Guards get a walking loop so their legs move while patrolling; everyone
      // else gets a calm, friendly idle.
      const pool = guard ? [] : idlePool(clips, scary);
      const clip = guard
        ? (clips.find((c) => /walk|run|gallop|march/i.test(c.name)) ??
          pickIdle(clips, scary))
        : (pool[Math.floor(Math.random() * pool.length)] ?? null);
      // A character with several idles CYCLES them rather than holding one
      // for the whole visit. Standing by a road for four minutes in a single
      // three-second loop is what makes a bystander read as scenery; three
      // loops, swapped every twenty seconds or so, read as somebody waiting.
      if (!guard && pool.length > 1) {
        wrap.userData.idlePool = pool.map((c) => mixer.clipAction(c));
        wrap.userData.idleNext = 12 + Math.random() * 14;
      }
      if (clip) {
        const a = mixer.clipAction(clip);
        // Slow motion is what reads as eerie: a skeleton idling at half
        // speed looks like it is underwater; at a third it looks like it has
        // been standing there for a hundred years.
        a.timeScale = guard
          ? 0.9
          : scary
            ? 0.32 + Math.random() * 0.12
            : 0.85 + Math.random() * 0.4;
        a.play();
        // Start each one at a random point in its loop so companions sharing
        // a clip are never bobbing in unison.
        a.time = Math.random() * (clip.duration || 1);
      }
      friends.push({
        wrap,
        mixer,
        run: null,
        walk: null,
        idle: null,
        idles: [],
        hair: null,
        joy: null,
        rest: {
          wave: null,
          crouchDown: null,
          crouchIdle: null,
          standFromCrouch: null,
          sitDown: null,
          sitIdle: null,
          standFromSit: null,
          jump: null,
        },
        // Scenery, not the player: it never crouches or sits.
        lifts: { crouch: 0, sit: 0, idle: 0, walk: 0, run: 0 },
        // Scenery, not a sibling: the villagers and their skeletons have no
        // opinion about each other.
        brave: [],
        fidget: [],
        wag: null,
        quadruped: false,
        tricks: [],
        settle: { lie: null, sleep: null, turnLeft: null, turnRight: null },
      });
    };
    /**
     * Who each of the day folk turns out to be after dark.
     *
     * The change is in place: the villager thins to a ghost and their
     * skeleton rises exactly where they stood, facing the same way — the
     * same mage, the same spot, a different hour. Skeleton_Warrior is
     * reserved as a selectable hero, so the matches draw from the rest.
     */
    const SKELETON_OF: Readonly<Record<string, string>> = {
      Mage: "Skeleton_Mage",
      Ranger: "Skeleton_Rogue",
      Rogue: "Skeleton_Rogue",
      Rogue_Hooded: "Skeleton_Rogue",
      Knight: "Skeleton_Minion",
      Barbarian: "Skeleton_Minion",
    };
    /**
     * A wild animal: its own clips, its own state machine, its own mind.
     *
     * Deliberately NOT a `friend`. Everything in that array is ticked by the
     * villager loop, which decides facing, wandering and reaction to the
     * hero — and a buffalo mid-charge must not have a villager's opinion
     * applied on top of its own. Keeping it in `wilds` means one owner for
     * its position and one owner for its pose.
     */
    const spawnWild = async (
      model: string,
      x: number,
      z: number,
      h: number,
    ) => {
      let gltf;
      try {
        gltf = await loadModel(modelUrl(theme.modelDir, model));
      } catch {
        return; // a missing animal never breaks the world
      }
      if (gltf == null) {
        return;
      }
      // THE FLASHES. A SkinnedMesh is frustum-culled against the bounding
      // sphere of its BIND pose, which knows nothing about what the clips do
      // — and this animal's clips are extreme. The rear-and-stomp lifts it to
      // 173% of its body height (measured; see the QA report), far outside
      // the sphere three computed from a standing buffalo. The renderer
      // decides it is off screen and skips it, so it vanishes for exactly as
      // long as the pose is large, and reappears: a flash.
      //
      // The showcase buffalo already had this, with a comment about towering
      // on the rear-stomp. The herd one never did, and it is the herd one
      // that rears at a child on a dark road.
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.frustumCulled = false;
        }
      });
      const wrap = fitToHeight(gltf.scene, h * perspective(z));
      // Measured BEFORE it is turned, so the box's own axes are the
      // animal's: z along the body, x across it. Used to sample the ground
      // under each end when it is standing on a slope.
      const box = measureBox(wrap);
      const size = box.getSize(new THREE.Vector3());
      wrap.position.set(x, surfaceY(x, z) + WILD_LIFT, z);
      // Yaw, then pitch, then roll — so the slope tilt is applied in the
      // animal's own frame rather than the world's, and a buffalo facing
      // along a hill leans sideways instead of nose-down.
      wrap.rotation.order = "YXZ";
      // Broadside to the road to start with, facing out across its field.
      wrap.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
      scene.add(wrap);
      characterRoots.add(wrap);
      const mixer = new THREE.AnimationMixer(gltf.scene);
      const act = new Map<string, THREE.AnimationAction>();
      for (const clip of clipsFor(gltf)) {
        // Death, Attack_Horn and Attack_Stomp are already gone twice over:
        // the shipped file does not contain them, and `loadModel` would drop
        // them anyway. Nothing is filtered again here, because a third rule
        // in a third place is how rules drift apart.
        act.set(clip.name, mixer.clipAction(clip));
      }
      // Plant on the GAITS — the poses it spends its time in. A root offset
      // taken from the rear-up would bury it while it grazed.
      const gaits = ["Graze", "Idle", "Walk", "Charge_Loop"]
        .map((n) => act.get(n) ?? null)
        .filter((a) => a != null);
      const probe = plantFeet(gltf.scene, mixer, gaits);
      // Then measure every OTHER pose against that plant, so the ones that
      // lift the body — the rear, the stomp, the horn swing — can be dropped
      // back onto the ground by exactly the gap they float by.
      let lift = wildLifts.get(model);
      if (lift == null) {
        lift = new Map<string, number>();
        for (const [name, a] of act) {
          lift.set(name, probe(a));
        }
        wildLifts.set(model, lift);
      }
      const y0 = wrap.position.y;
      if (wildReview) {
        console.log(`[wildclips] ${model}: ${[...act.keys()].join(", ")}`);
      }
      const w: WildRig = {
        wrap,
        mixer,
        act,
        lift,
        homeX: x,
        homeZ: z,
        side: z >= 0 ? 1 : -1,
        halfLen: Math.max(0.5, size.z / 2),
        halfWid: Math.max(0.3, size.x / 2),
        pitch: 0,
        roll: 0,
        cur: "",
        state: "graze",
        t: 0,
        tx: x,
        tz: z,
        yaw: wrap.rotation.y,
        yawFrom: wrap.rotation.y,
        yawTo: wrap.rotation.y,
        yawT: 0,
        // Staggered, so three buffalo on one road never all start at once.
        cooldown: Math.random() * 12,
        // Measured off this animal's own clips — see WildRig.arc.
        arc: new Map(
          [...act.keys()]
            .filter((n) => /^Turn_/.test(n))
            .map((n) => [
              n,
              clipYaw(act.get(n)!.getClip(), "Hips") ?? Math.PI / 2,
            ]),
        ),
        scareCool: Math.random() * 20,
        liftNow: 0,
        after: null,
      };
      wrap.userData.wildBaseY = y0;
      wilds.push(w);
      wildAmbient(w, nightNow);
      // Wild: no catchlight in daylight — see applyEyeGlow.
      applyEyeGlow(wrap, nightNow, true);
    };
    /**
     * FETCH THE WHOLE WORLD AT ONCE, INSTEAD OF ONE FILE AT A TIME.
     *
     * The build is written as a sequence — spawn the herd, then the
     * travellers, then the scatter, then the villages — and every step of it
     * awaits its own model before the next step asks for one. So the network
     * sat idle through all the CPU work and the CPU sat idle through all the
     * fetches, twenty-six times over, and the measured waterfall was a
     * staircase: a request, a gap, a request, a gap.
     *
     * This asks for every file the road is going to need, up front and in
     * parallel, and throws the results away. `THREE.Cache` keeps the bytes
     * under the URL, and three's FileLoader subscribes a second request for
     * a URL already in flight to the first rather than issuing it again — so
     * by the time each build step gets round to its own model, the bytes are
     * either already there or already coming, and the staircase collapses.
     *
     * FileLoader rather than GLTFLoader on purpose: this wants the BYTES. A
     * warm-up that parsed as well would do every model's welding twice and
     * hand the saving straight back.
     *
     * Bounded, because a burst of thirty concurrent requests is what put the
     * dev server into 503s in the first place — the thing `loadModel`'s
     * retry exists to survive. Six at a time keeps the pipe full without
     * ever being the reason it breaks.
     *
     * Deliberately NOT awaited: the build carries on into its own first step
     * while this runs behind it.
     */
    let firstWild = true;
    for (const spot of theme.herd) {
      const model = spot.model === "$friend" ? land.friend : spot.model;
      if (spot.wild === true) {
        // `?wild` drags the first one into view of the start; see wildReview.
        const near = wildReview && firstWild;
        firstWild = false;
        await spawnWild(
          model,
          near ? runStart + 15 : spot.x,
          near ? -10 : spot.z,
          spot.h,
        );
        continue;
      }
      await spawnCompanion(
        model,
        spot.x,
        spot.z,
        spot.h,
        false,
        undefined,
        spot.faceY,
        spot.girth,
        spot.headScale,
      );
      const day = friends[friends.length - 1];
      // ONLY A CAST THAT HAS AN UNDEAD COUNTERPART TRANSFORMS.
      //
      // This used to fall back to `Skeleton_Minion` for anybody not in the
      // table, which is every single villager on the Kerala road — Peeli,
      // Abee, the potter, the buffalo herder. The skeletons live in the
      // `hero` folder and the village's models live in `ak-3d-pack`, so what
      // that fallback actually did on every village night was request a file
      // that does not exist, take a 404, sleep 400ms, take a second 404, and
      // give up: nearly a second of the world's load spent finding out that
      // a feature which cannot work here does not work here. It was also
      // invisible, because `loadModel` treats a missing companion as one to
      // skip.
      //
      // The transform is a KayKit-hero idea and the table IS the guest list.
      // Nobody outside it turns.
      const undead = SKELETON_OF[model];
      if (
        trueNight &&
        day != null &&
        undead != null &&
        Math.random() < plan.transformShare
      ) {
        day.wrap.userData.dayOnly = true;
        day.wrap.visible = !nightNow;
        await spawnCompanion(
          undead,
          spot.x,
          spot.z,
          spot.h,
          true,
          day.wrap.userData.guard === true,
        );
        const twin = friends[friends.length - 1];
        if (twin != null && twin !== day) {
          twin.wrap.userData.nightOnly = true;
          twin.wrap.visible = nightNow;
          // The same stance, so the swap reads as a change of hour and not a
          // change of cast.
          twin.wrap.rotation.y = day.wrap.rotation.y;
          twin.wrap.userData.homeY = day.wrap.userData.homeY;
          // And the same point in the patrol, so a guard pair morphs at the
          // same spot on the beat instead of two places along it.
          twin.wrap.userData.phase = day.wrap.userData.phase;
          // Linked both ways, so the population swap can morph the pair in
          // place instead of choreographing them separately.
          day.wrap.userData.twinWrap = twin.wrap;
          twin.wrap.userData.twinWrap = day.wrap;
          // Somebody the hero KNOWS turning out to be a skeleton is the one
          // who gets to be frightening; the strangers out in the dark only
          // watch. See the loom in the tick.
          twin.wrap.userData.scarer = true;
          twin.wrap.userData.baseScale = twin.wrap.scale.x;
        }
      }
    }
    // The Lost Travellers. Night only, every one of them — by day the road
    // is clean and pleasant, and the two that used to stand watch in full
    // sunlight are gone. How many come out, and how close to the trail they
    // may stand, is the night plan's decision: none at all on a quiet night,
    // a few far-off ones on a mild one, the full watch otherwise. They stand,
    // they sway, they turn to look as the hero passes. They never approach.
    if (theme.flagGuard && theme.flagGuard.length > 0 && plan.travellers > 0) {
      const pickGuard = () =>
        theme.flagGuard![Math.floor(Math.random() * theme.flagGuard!.length)];
      const near = Math.max(3, plan.keepDistance);
      const spawnTraveller = async (gx: number, gz: number) => {
        await spawnCompanion(pickGuard(), gx, gz, 3.0, true);
        const last = friends[friends.length - 1];
        if (last != null) {
          last.wrap.userData.nightOnly = true;
          last.wrap.visible = nightNow;
        }
      };
      // One near the camp flag and one near the start, so the watch is met
      // early in a run; the rest are spread along the road.
      await spawnTraveller(runEnd - 3, -near);
      await spawnTraveller(runStart + 10, -(near + 0.5));
      const extra = plan.travellers - 2 + (new Date().getMonth() === 9 ? 3 : 0);
      for (let i = 0; i < extra; i++) {
        const gx = 18 + Math.random() * (TRAIL_END - 26);
        const gz = (Math.random() > 0.5 ? -1 : 1) * (near + Math.random() * 6);
        await spawnTraveller(gx, gz);
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
          friends.push({
            wrap,
            mixer,
            run: null,
            walk: null,
            idle: null,
            idles: [],
            hair: null,
            joy: null,
            rest: {
              wave: null,
              crouchDown: null,
              crouchIdle: null,
              standFromCrouch: null,
              sitDown: null,
              sitIdle: null,
              standFromSit: null,
              jump: null,
            },
            // Trailside company — they stand and idle, nothing more.
            lifts: { crouch: 0, sit: 0, idle: 0, walk: 0, run: 0 },
            // Scenery, not a sibling: the villagers and their skeletons have no
            // opinion about each other.
            brave: [],
            fidget: [],
            wag: null,
            quadruped: false,
            tricks: [],
            settle: { lie: null, sleep: null, turnLeft: null, turnRight: null },
          });
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

    /** The last variant each collection handed out, so it can avoid repeating. */
    const lastVariant = new Map<readonly THREE.Object3D[], number>();
    /** Five shades per source material, built on demand and shared. */
    const TINT_STEPS = [0.94, 0.97, 1.0, 1.03, 1.06] as const;
    const tintPool = new Map<
      THREE.MeshStandardMaterial,
      THREE.MeshStandardMaterial[]
    >();

    const placeVariant = (
      variants: readonly THREE.Object3D[],
      i: number,
      x: number,
      z: number,
      scaleMul: number,
    ): THREE.Group => {
      // RANDOM, AND NOT THE ONE BEFORE IT.
      //
      // This was `variants[i % variants.length]`, which is not variety, it is
      // a cycle: a six-variant collection lays down v0,v1,v2,v3,v4,v5,v0,v1
      // in planting order, and anywhere two of them land near each other the
      // repeat is plain to see. Drawing at random fixes the pattern; refusing
      // the previous draw stops the one thing random does that a cycle never
      // does, which is hand you the same plant twice in a row.
      let pick = Math.floor(Math.random() * variants.length);
      if (variants.length > 1 && pick === lastVariant.get(variants)) {
        pick =
          (pick + 1 + Math.floor(Math.random() * (variants.length - 1))) %
          variants.length;
      }
      lastVariant.set(variants, pick);
      const v = variants[pick].clone();
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
      wrap.position.set(x, surfaceY(x, z), z);
      wrap.rotation.y = Math.random() * Math.PI * 2;
      // NOTHING GROWS PLUMB.
      //
      // Yaw alone leaves every plant standing to attention, and a row of
      // upright copies reads as a row of copies however they are turned --
      // turning a symmetrical thing about its own axis changes nothing you
      // can see. A few degrees of lean is the cheapest tell that these grew
      // rather than being placed.
      wrap.rotation.x = (Math.random() - 0.5) * 0.17; // ~+-5 degrees
      wrap.rotation.z = (Math.random() - 0.5) * 0.17;
      // AND THE SILHOUETTE CHANGES, not just the size.
      //
      // A uniform scale is the same plant seen from further away: the outline
      // is identical, which is exactly what the eye picks up in a cluster.
      // Letting height run separately from girth gives stocky ones and leggy
      // ones, which are different plants at a glance.
      const base = (0.8 + Math.random() * 0.8) * theme.sceneryScale * scaleMul;
      const tall = 0.85 + Math.random() * 0.4;
      wrap.scale.set(base, base * tall, base);
      // A LITTLE COLOUR BETWEEN NEIGHBOURS.
      //
      // Two identical meshes side by side stay identical through any amount
      // of rotating and scaling, because they are the same green. A few per
      // cent either way is below the threshold of looking wrong and above the
      // one where a cluster stops reading as one object cloned.
      //
      // FROM A SHARED POOL, not a clone each. Cloning per plant would give
      // sixty-odd unique materials where there were two, and every distinct
      // material is another state change for the GPU on exactly the machines
      // this has to run on. Five shades, made once and handed round, buy the
      // whole of the effect for five materials instead of sixty.
      wrap.traverse((n) => {
        const mesh = n as THREE.Mesh;
        const m = mesh.material;
        if (m == null || Array.isArray(m)) {
          return;
        }
        const std = m as THREE.MeshStandardMaterial;
        if (std.color == null) {
          return;
        }
        let shades = tintPool.get(std);
        if (shades == null) {
          shades = TINT_STEPS.map((k) => {
            const dup = std.clone();
            dup.color.multiplyScalar(k);
            return dup;
          });
          tintPool.set(std, shades);
        }
        mesh.material = shades[Math.floor(Math.random() * shades.length)]!;
      });
      scene.add(wrap);
      return wrap;
    };

    /** Five shades per source material, built on demand and shared. */
    const GROUND_TINTS = [0.94, 0.97, 1.0, 1.03, 1.06] as const;
    const groundTint = new Map<
      THREE.MeshStandardMaterial,
      THREE.MeshStandardMaterial[]
    >();
    // EVERY SCENERY FILE AT ONCE.
    //
    // These were fetched one at a time, each awaited before the next was even
    // asked for -- and with the Kerala planting that is sixteen round trips
    // laid end to end before the last plant is in the ground. They do not
    // depend on each other in any way, so the wait was pure sequencing. The
    // browser still limits how many it runs at once; this just stops us
    // limiting it to one.
    //
    // A name containing "/" is a full path under models/, not a file in this
    // theme's scenery folder. Village Road needs it: its scenery is the
    // nature set but its buildings live in the licensed pack folder, and a
    // theme has only one sceneryDir.
    const groundSpecs = [
      [land.trees, theme.treeCount ?? 30, 6, 26, "back"] as const,
      ...theme.ground,
    ];
    const groundGltfs = await Promise.all(
      groundSpecs.map(async ([file]) => {
        try {
          return await loadModel(
            String(file).includes("/")
              ? `${ASSETS}/models/${file}.glb`
              : `${ASSETS}/models/${theme.sceneryDir}/${file}.glb`,
          );
        } catch {
          return null; // skip a missing scenery set rather than break the build
        }
      }),
    );
    for (let gi = 0; gi < groundSpecs.length; gi++) {
      const [file, count, minD, maxD, side, scaleMul = 1] = groundSpecs[gi]!;
      const gltf = groundGltfs[gi];
      if (gltf == null) {
        continue;
      }
      const variants = [...gltf.scene.children];
      let lastPick = -1;
      for (let i = 0; i < count; i++) {
        // RANDOM, AND NOT THE ONE BEFORE IT.
        //
        // This was `variants[i % variants.length]`, which is not variety, it
        // is a cycle: a six-variant collection lays down v0,v1,v2,v3,v4,v5,
        // v0,v1 in planting order, and wherever two of them land near each
        // other the repeat is plain. Drawing at random fixes the pattern;
        // refusing the previous draw stops the one thing random does that a
        // cycle never does, which is give you the same plant twice running.
        let pick = Math.floor(Math.random() * variants.length);
        if (variants.length > 1 && pick === lastPick) {
          pick =
            (pick + 1 + Math.floor(Math.random() * (variants.length - 1))) %
            variants.length;
        }
        lastPick = pick;
        const v = variants[pick]!.clone();
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
        const scl = (0.8 + Math.random() * 0.8) * theme.sceneryScale * scaleMul;
        // How far this particular plant sticks out sideways, once scaled.
        // The wrap is spun to a random heading below, so the worst case is
        // the larger of its two horizontal half-extents, whichever way round
        // it ends up facing. Two thirds of it: a leaf tip crossing the verge
        // is a roadside tree, a trunk crossing it is a tree in the road.
        const reach =
          (Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2) *
          scl *
          0.66;
        // Keep it off the road. Tried up to a handful of times rather than
        // pushed to the verge, so the scatter stays random instead of growing
        // a suspicious line of bushes exactly one road-width out.
        let x = 0;
        let z = 0;
        for (let attempt = 0; attempt < 8; attempt++) {
          x = -26 + Math.random() * (TRAIL_END + 26);
          const depth = minD + Math.random() * (maxD - minD);
          z = side === "back" ? -depth : Math.random() > 0.65 ? depth : -depth;
          if (!onRoad(x, z, String(file), reach)) {
            break;
          }
        }
        if (onRoad(x, z, String(file), reach)) {
          continue; // eight tries and still in the way: drop this one
        }
        // ROCKS SIT IN THE GROUND, NOT ON IT.
        //
        // A boulder resting exactly on the surface reads as a prop dropped
        // there, because a real one has been there long enough for the soil
        // to come up around it -- and the ones that have not are the ones
        // somebody moved. A quarter to a half of it goes under, drawn per
        // stone so a line of them is not a line of the same stone.
        //
        // Height, not a fixed distance: a pebble and a laterite block want
        // the same FRACTION buried, not the same number of units.
        const buried = /rock|stone|boulder|laterite/i.test(String(file))
          ? (box.max.y - box.min.y) * scl * (0.25 + Math.random() * 0.25)
          : 0;
        wrap.position.set(x, surfaceY(x, z) - buried, z);
        // Trees only, and only so the village can clear a space round the
        // banyan — see `scatterTrees` where it is planted.
        if (file === land.trees) {
          scatterTrees.push(wrap);
        }
        wrap.rotation.y = Math.random() * Math.PI * 2;
        // NOTHING GROWS PLUMB.
        //
        // Yaw alone leaves every plant standing to attention, and turning a
        // roughly symmetrical thing about its own axis changes very little
        // you can see -- which is why a row of them still read as a row of
        // copies. A few degrees of lean is the cheapest tell that these grew
        // rather than being placed.
        wrap.rotation.x = (Math.random() - 0.5) * 0.17; // about +-5 degrees
        wrap.rotation.z = (Math.random() - 0.5) * 0.17;
        // AND THE SILHOUETTE CHANGES, not merely the size.
        //
        // A uniform scale is the same plant seen from further away: the
        // outline is identical, and the outline is what the eye picks up in a
        // cluster. Letting height run separately from girth gives stocky ones
        // and leggy ones, which read as different plants at a glance.
        {
          // The depth cue rides on top of the per-plant variation, so a tree
          // on the far verge is smaller than the same tree on the near one.
          const d = perspective(z);
          wrap.scale.set(
            scl * d,
            scl * d * (0.85 + Math.random() * 0.4),
            scl * d,
          );
        }
        // NO PER-PLANT TINT ON THIS PATH.
        //
        // It was here, from a five-shade pool, and it is why the world went
        // from 195 materials to 430 -- and every distinct material is a
        // shader the renderer compiles before the first frame, which turned
        // the build into a minutes-long stall. The instanced thickets below
        // still get their colour variation, because `instanceColor` carries
        // it per copy without a single extra material. Here, the lean and the
        // stretch do the work instead.
        // GROUND CLUTTER DOES NOT CAST.
        //
        // `loadModel` turns castShadow on for every mesh of every model it
        // touches, which is right for a house and absurd for a pebble: a
        // shadow pass is a second render of every caster in the world, and
        // MEASURED on this road it was 237 casters, of which 162 were under
        // a knee high — flowers, grass tufts, pebbles, the little stones.
        // Together they cost 49 of the frame's 179 draw calls to draw
        // shadows nobody can see at this camera height, because a shadow
        // that small is a couple of dark pixels under an object already
        // sitting on the ground.
        //
        // Measured after: 179 draw calls -> 130.
        //
        // They still RECEIVE — clutter standing in a tree's shadow is most
        // of what makes the shade read as shade.
        if ((box.max.y - box.min.y) * scl < SHADOW_MIN_HEIGHT) {
          wrap.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.castShadow = false;
            }
          });
        }
        tintFoliage(wrap);
        scene.add(wrap);
        characterRoots.add(wrap);
        applyEyeGlow(wrap, nightNow);
        // A tiny lantern before every doorway after dark — the village stays
        // warm through the ordinary nights. Not on the extra-spooky one: on
        // that night the houses go dark too, and the hero's own light is the
        // only warmth on the road.
        if (
          trueNight &&
          nightStyle !== "full" &&
          /building/i.test(String(file))
        ) {
          const mat = new THREE.SpriteMaterial({
            map: glowTexture("rgba(255,214,138,1)", "rgba(255,190,90,0)"),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const lantern = new THREE.Sprite(mat);
          lantern.scale.setScalar(0.55);
          // In front of the door: toward the trail from wherever the house
          // stands, at hip height.
          lantern.position.set(x, surfaceY(x, z) + 0.8, z + 2.2);
          nightLayer.add(lantern);
          lanternMats.push(mat);
        }
        // After dark a share of the leafy forest goes with the daylight, so
        // the woods themselves change and not merely the light on them. The
        // bare trees that stand in their place are planted below — unless
        // this world keeps its trees, in which case neither happens.
        if (
          trueNight &&
          theme.nightTrees !== "keep" &&
          file === land.trees &&
          Math.random() < plan.treeThin
        ) {
          wrap.userData.dayOnly = true;
          wrap.visible = !nightNow;
          moodScenery.push(wrap);
        }
      }
    }

    // ── dense planting where the milestones fall ────────────────────────
    //
    // The scatter above spreads things EVENLY, because it draws a distance
    // for each one independently -- and evenly spread is the one thing
    // vegetation never is. Taro, fern and grass grow in thickets: a dozen
    // together in the damp, then nothing for twenty metres.
    //
    // Put those thickets where the milestones land. Their exact positions are
    // not known here (they are placed as the child reaches them, at a spacing
    // of MIN_STONE_GAP), but the spacing IS -- so a clump every 26 units
    // falls where the stones do, and a stone standing in deep planting reads
    // as something the road grew around rather than a marker dropped on it.
    // ALL AT ONCE, not one after another.
    //
    // Each of these was awaited in turn, so ten plants meant ten round trips
    // laid end to end before the first thicket appeared -- and they are
    // independent, so there was never a reason to wait. The browser caps its
    // own parallelism; asking for them together simply lets it.
    const clusterSpecs = theme.groundClusters ?? [];
    const clusterGltfs = await Promise.all(
      clusterSpecs.map(async (spec) => {
        try {
          return await loadModel(
            spec.file.includes("/")
              ? `${ASSETS}/models/${spec.file}.glb`
              : `${ASSETS}/models/${theme.sceneryDir}/${spec.file}.glb`,
          );
        } catch {
          return null; // a missing plant must not cost the world its road
        }
      }),
    );
    for (let ci = 0; ci < clusterSpecs.length; ci++) {
      const spec = clusterSpecs[ci]!;
      const gltf = clusterGltfs[ci];
      if (gltf == null) {
        continue;
      }
      // ONE DRAW CALL PER PLANT, NOT ONE PER PLANT.
      //
      // A thicket is only a thicket if there are a lot of them, and at the
      // counts below that is two to five hundred objects -- which as ordinary
      // meshes would more than triple the draw calls in the whole world,
      // measured at 155. They are all the same geometry and the same
      // material, which is exactly what instancing is for: the road's loose
      // stones are already drawn this way. Per-instance colour survives it
      // (`setColorAt`), and so do the lean and the stretch, because both are
      // in the matrix.
      let src: THREE.Mesh | null = null;
      gltf.scene.traverse((n) => {
        if (src == null && (n as THREE.Mesh).isMesh) {
          src = n as THREE.Mesh;
        }
      });
      if (src == null) {
        continue;
      }
      const proto = src as THREE.Mesh;
      // Baked into the geometry: the mesh may sit under a transform of its
      // own inside the file, and an InstancedMesh has no parent chain to
      // inherit it from.
      gltf.scene.updateMatrixWorld(true);
      const geo = proto.geometry.clone().applyMatrix4(proto.matrixWorld);
      geo.computeBoundingBox();
      const gb = geo.boundingBox!;
      geo.translate(
        -(gb.min.x + gb.max.x) / 2,
        -gb.min.y,
        -(gb.min.z + gb.max.z) / 2,
      );
      const half = Math.max(gb.max.x - gb.min.x, gb.max.z - gb.min.z) / 2;
      const mat = (
        Array.isArray(proto.material) ? proto.material[0] : proto.material
      ) as THREE.MeshStandardMaterial;

      const mats: THREE.Matrix4[] = [];
      const tints: THREE.Color[] = [];
      let rejected = 0;
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const pos = new THREE.Vector3();
      const scl3 = new THREE.Vector3();
      // Two ways to lay a clump down: at the milestones, or as a continuous
      // band along the whole road. `stride` picks the second.
      const step = spec.stride ?? MIN_STONE_GAP;
      for (let stone = 1; stone * step < TRAIL_END + 26; stone++) {
        const cx = stone * step;
        // Both verges, drawn separately: a thicket that matches across the
        // road is a hedge somebody planted.
        const verges =
          spec.verge === "near"
            ? ([1] as const)
            : spec.verge === "far"
              ? ([-1] as const)
              : ([-1, 1] as const);
        for (const sideSign of verges) {
          // A SMALLHOLDING, not a clump.
          //
          // Banana and tapioca are crops: somebody dug them in, in rows, and
          // that is the one thing about them that reads instantly as farmed
          // rather than wild. Straight enough to be deliberate, never straight
          // enough to be a fence -- each plant wobbles off its mark by a few
          // tenths, and each ROW starts at its own offset, because a plot dug
          // by hand does not line up end to end.
          if (spec.plot != null) {
            if (Math.random() > spec.plot.chance) {
              continue;
            }
            const z0 = spec.near + Math.random() * (spec.far - spec.near);
            // `rowZ` below is a signed offset; the meander is added per plant
            // so a row follows the road's curve instead of cutting across it.
            const along = spec.spread / Math.max(1, spec.plot.perLine - 1);
            for (let row = 0; row < spec.plot.lines; row++) {
              const rowZ = sideSign * (z0 + row * spec.plot.rowGap);
              const start = cx - spec.spread / 2 + (Math.random() - 0.5) * 1.2;
              for (let c = 0; c < spec.plot.perLine; c++) {
                const px =
                  start + c * along + (Math.random() - 0.5) * spec.plot.wobble;
                const pz =
                  (spec.roadRelative ? meander(px) : 0) +
                  rowZ +
                  (Math.random() - 0.5) * spec.plot.wobble;
                const plo = spec.lo ?? 0.8;
                const phi = spec.hi ?? 1.25;
                const scl =
                  (plo + Math.random() * (phi - plo)) * theme.sceneryScale;
                if (onRoad(px, pz, spec.file, half * scl * 0.66)) {
                  rejected += 1;
                  continue;
                }
                e.set(
                  (Math.random() - 0.5) * 0.12,
                  Math.random() * Math.PI * 2,
                  (Math.random() - 0.5) * 0.12,
                );
                q.setFromEuler(e);
                // terrainY, NOT surfaceY.
                //
                // `surfaceY` raycasts the ground mesh -- sixteen thousand
                // triangles a call -- and this pass asks for a height nine
                // hundred times. That was most of the load time on its own.
                // The analytic height is the same shape of ground and costs
                // arithmetic; a plant is not a character and does not need
                // the mesh's exact answer.
                pos.set(px, terrainY(px, pz) - 0.06, pz);
                scl3.set(scl, scl * (0.88 + Math.random() * 0.3), scl);
                mats.push(m4.clone().compose(pos, q, scl3));
                const tp = 0.94 + Math.random() * 0.12;
                tints.push(new THREE.Color(tp, tp, tp));
              }
            }
            continue;
          }
          if (spec.chance != null && Math.random() > spec.chance) {
            continue;
          }
          const n =
            spec.min + Math.floor(Math.random() * (spec.max - spec.min + 1));
          for (let k = 0; k < n; k++) {
            // Tight, so they touch and overlap rather than dotting a line.
            const x = cx + (Math.random() - 0.5) * spec.spread;
            const depth = spec.near + Math.random() * (spec.far - spec.near);
            const z = spec.roadRelative
              ? meander(x) + sideSign * depth
              : sideSign * depth;
            const lo = spec.lo ?? 0.7;
            const hi = spec.hi ?? 1.4;
            const scl = (lo + Math.random() * (hi - lo)) * theme.sceneryScale;
            if (onRoad(x, z, spec.file, half * scl * 0.66)) {
              rejected += 1;
              continue;
            }
            e.set(
              (Math.random() - 0.5) * 0.22, // lean: nothing grows plumb
              Math.random() * Math.PI * 2,
              (Math.random() - 0.5) * 0.22,
            );
            q.setFromEuler(e);
            pos.set(x, terrainY(x, z) - 0.06, z);
            // Height apart from girth, so the cluster has stocky ones and
            // leggy ones rather than one outline at several sizes.
            scl3.set(scl, scl * (0.8 + Math.random() * 0.5), scl);
            mats.push(m4.clone().compose(pos, q, scl3));
            const t = 0.94 + Math.random() * 0.12;
            tints.push(new THREE.Color(t, t, t));
          }
        }
      }
      if (
        typeof window !== "undefined" &&
        window.location.search.includes("perf")
      ) {
        // Counted rather than eyeballed: a spec that plants nothing looks
        // exactly like one that was never reached, and the difference is the
        // whole of the bug.
        const w = window as unknown as Record<string, unknown>;
        const log = (w.__plants ??= []) as string[];
        log.push(
          `${spec.file}: ${mats.length} placed, ${rejected} refused by onRoad`,
        );
      }
      if (mats.length === 0) {
        continue;
      }
      const inst = new THREE.InstancedMesh(geo, mat, mats.length);
      for (let k = 0; k < mats.length; k++) {
        inst.setMatrixAt(k, mats[k]!);
        inst.setColorAt(k, tints[k]!);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor != null) {
        inst.instanceColor.needsUpdate = true;
      }
      inst.castShadow = false; // ground clutter, as above
      inst.receiveShadow = true;
      // Its instances span the whole trail, so the default bounds (taken from
      // the geometry alone) would cull the lot the moment the origin left the
      // frustum.
      inst.frustumCulled = false;
      scene.add(inst);
    }

    // ── the village ─────────────────────────────────────────────────────
    //
    // Not scatter. Every other piece of scenery in this game is a collection
    // of variants sprinkled along the trail, and a village cannot be built
    // that way: a temple that lands wherever the random number generator put
    // it, at whatever angle, is a prop rather than a place. So the cluster is
    // arranged by hand around a single centre, and the only thing chance
    // decides is where that centre falls and which houses stand in it.
    //
    // There is at most ONE per trail, and often none - see `everyFlags`. The
    // page counts the flags and tells the world when a village is due, because
    // the world is rebuilt per session and cannot count rounds itself.
    if (theme.village != null && villageDue) {
      const V = theme.village;
      // Far enough along that the child walks to it rather than starting in
      // it, and short of the end so they get to pass through and out again.
      // `?village` puts it within sight of the start. 34 was far enough that
      // reviewing it meant typing a whole passage to walk there first, which
      // is a slow way to look at a building; 14 has the market in frame the
      // moment the world opens.
      const vx = villageNear ? 14 : 78 + Math.random() * 118;
      // Remembered so the tick can say when the child reaches it — see
      // `insideVillage`. There is at most one per trail, so one number does.
      villageX = vx;
      // ── AND NOTHING WITH HORNS INSIDE IT ─────────────────────────────
      //
      // The herd stands at three fixed points on the trail and the village
      // lands somewhere random along it, so sooner or later a water buffalo
      // was going to be grazing between somebody's house and the shrine. It
      // is not a frightening sight, it is a nonsensical one: a tonne of
      // animal is kept in a yard or out in the paddy, never loose in the
      // lane, and the charge this road is built around only reads as a
      // charge because it happens in the open.
      //
      // The village cannot dodge them — its houses reach from vx-46 to
      // vx+72, which is wider than the gaps between the herd — so the herd
      // moves instead. Walked off down the road rather than deleted: the
      // buffalo is a thing this road promises and losing one to a village
      // would quietly cost a child the encounter.
      {
        const near = (x: number) => x > vx - 56 && x < vx + 82;
        for (const w of wilds) {
          const p = w.wrap.position;
          if (!near(p.x)) {
            continue;
          }
          // Out past whichever end of the village it is nearer to, and back
          // onto its own verge.
          const out = p.x < vx ? vx - 70 : vx + 96;
          p.x = Math.max(12, Math.min(TRAIL_END - 12, out));
          p.z = meander(p.x) - roadClear * 1.4;
          p.y = surfaceY(p.x, p.z);
          (w.wrap.userData as { wildBaseY?: number }).wildBaseY = p.y;
        }
      }
      const propCache = new Map<string, THREE.Object3D | null>();
      const prop = async (name: string) => {
        if (!propCache.has(name)) {
          try {
            // A name with a "/" is a full path under models/, the same rule
            // the scatter uses — the stone set lives in its own folder
            // rather than in the licensed character pack.
            const g = await loadModel(
              name.includes("/")
                ? `${ASSETS}/models/${name}.glb`
                : `${ASSETS}/models/${V.dir}/${name}.glb`,
            );
            propCache.set(name, g?.scene ?? null);
          } catch {
            propCache.set(name, null);
          }
          if (propCache.get(name) == null) {
            // SAY SO. A missing companion is a companion nobody misses, and
            // the silent skip is right for those. A missing TEMPLE is the
            // village not being there at all, and in review that is
            // indistinguishable from the village code never having run —
            // which cost a long time to tell apart when the dev server
            // started answering 503 under the load of a world build.
            console.warn(
              `[village] "${name}" did not load — the village will be built without it`,
            );
          }
        }
        return propCache.get(name) ?? null;
      };
      const stand = async (
        name: string,
        x: number,
        z: number,
        h: number,
        turn: number,
      ) => {
        const src = await prop(name);
        if (src == null) {
          return null;
        }
        const wrap = fitToHeight(src.clone(true), h * perspective(z));
        wrap.position.set(x, surfaceY(x, z), z);
        wrap.rotation.y = turn;
        scene.add(wrap);
        characterRoots.add(wrap);
        applyEyeGlow(wrap, nightNow);
        if (trueNight) {
          lightBuilding(name, wrap);
        }
        return wrap;
      };

      /**
       * Light a building the way its own people would.
       *
       * Placed from the building's MEASURED box rather than from offsets per
       * model. Three houses, a market and a temple are five different shapes
       * at five different scales, and a table of hand-tuned lamp positions
       * for each would be five things to get wrong again the next time one
       * of them is swapped. The box gives the front face, the width and the
       * eaves; a lamp goes where those say a lamp goes.
       *
       * WHICH SIDE IS THE FRONT depends on which side of the road the
       * building stands. Most of the village is behind the road, so +z faces
       * it — but some houses are deliberately put on the far side and turned
       * round, and for those the front is -z. Lighting the geometric max in
       * every case would have hung a lamp on the back wall of every house
       * across the road, lighting nothing and visible to nobody.
       */
      function lightBuilding(name: string, wrap: THREE.Object3D): void {
        const box = measureBox(wrap);
        const cx = (box.min.x + box.max.x) / 2;
        const cz = (box.min.z + box.max.z) / 2;
        const wide = box.max.x - box.min.x;
        const tall = box.max.y - box.min.y;
        const foot = box.min.y;
        // Towards the road, whichever side of it this one is on.
        const faces = cz >= 0 ? -1 : 1;
        const front = faces > 0 ? box.max.z : box.min.z;
        /** A point on the front of this building: across, up, and out. */
        const on = (across: number, up: number, out: number) =>
          [cx + across, foot + tall * up, front + faces * out] as const;

        if (/^Temple$/i.test(name)) {
          // "Lots of oil lamps inside and outside." A temple at dusk is the
          // brightest thing for a mile, and it is lit in ROWS — a line of
          // small flames along a step reads as a temple in a way that one
          // big glow never does, however bright.
          const n = 7;
          for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n;
            makeLamp(...on((t - 0.5) * wide * 0.86, 0.09, 0.35), {
              size: 1.15,
              peak: 0.8,
            });
          }
          // A second, shorter row up on the plinth, so the front has depth
          // rather than a single lit line across it.
          for (let i = 0; i < 4; i++) {
            makeLamp(...on((i / 3 - 0.5) * wide * 0.52, 0.34, -0.2), {
              size: 0.95,
              peak: 0.7,
            });
          }
          // INSIDE. Set back behind the front face and low, so what escapes
          // is a doorway full of light rather than a lamp you can see. This
          // is the one that carries a real light: the inside of a temple
          // spilling onto its own steps is the whole picture.
          makeLamp(...on(0, 0.3, -2.6), { size: 3.4, peak: 0.92, lit: 5.5 });
          // THE MIRROR. Kerala temples keep a polished metal mirror by the
          // sanctum, and what you actually see from outside is the lamps
          // caught in it — a tall warm smear that moves when they move, not
          // a light of its own. Hence the stretched sprite, and a wick value
          // between the flame and the mantle: a reflection inherits some of
          // the flicker and averages away the rest.
          makeLamp(...on(wide * 0.16, 0.42, -1.1), {
            kind: "mirror",
            size: 0.8,
            aspect: 2.6,
            peak: 0.75,
          });
          return;
        }

        if (/^Market$/i.test(name)) {
          // SOME STALLS HAVE SHUT, and a shut stall has no light in it.
          //
          // At eight the market is winding down rather than closed: the
          // petromax is still up over whoever is still trading, and the oil
          // lamps at the ends of the counter go out one at a time as their
          // stalls pack away. A market where every lamp burns until the
          // village sleeps is a market nobody actually works in.
          makeLamp(...on(0, 0.82, -0.4), {
            kind: "petromax",
            size: 3.2,
            peak: 0.95,
            lit: 6,
          });
          for (const sgn of [-1, 1]) {
            if (Math.random() < 0.4) {
              continue; // that end has packed up for the night
            }
            makeLamp(...on(sgn * wide * 0.36, 0.42, 0.25), { size: 1.3 });
          }
          return;
        }

        if (/Althara/i.test(name)) {
          return; // a platform, not a dwelling: nothing to light
        }

        if (/^House/i.test(name)) {
          // NOT EVERY HOUSE IS AWAKE AT EIGHT.
          //
          // A lamp at every single door is a village where nobody has gone to
          // bed, and it flattens the row into a line of identical dots — the
          // same failure as every house having the same lamp, one level up.
          // About a quarter are dark, and that is what gives the lit ones
          // something to mean: somebody is still up in THAT one.
          if (Math.random() < 0.26) {
            return;
          }
          // One at the door: "oil lamps in every home" — every home that is
          // still awake.
          makeLamp(...on(wide * 0.2, 0.36, 0.3), { size: 1.4, peak: 0.78 });
          // And a second one in a window, in about half of them, so the row
          // of houses is not a row of identical dots.
          if (Math.random() < 0.5) {
            makeLamp(...on(-wide * 0.24, 0.55, 0.15), { size: 1.0, peak: 0.6 });
          }
          // Very rarely a petromax on the porch — somebody in this village
          // is doing well, and one house in ten saying so is worth more
          // than every house having the same lamp.
          if (Math.random() < 0.12) {
            makeLamp(...on(-wide * 0.1, 0.72, 0.5), {
              kind: "petromax",
              size: 2.2,
              peak: 0.9,
            });
          }
          return;
        }

        if (/^Cart$/i.test(name)) {
          // A lamp hung off the cart while it is being unloaded.
          makeLamp(...on(0, 0.9, 0.1), { size: 1.0, peak: 0.7 });
        }
      }

      // The heart: temple, market, banyan, and the cart parked at the market.
      // Fixed offsets, because their arrangement relative to each other is the
      // whole point - the market fronts the road and the temple stands behind
      // it, which is how you actually meet a village from its road.
      for (const h of V.heart) {
        const w = await stand(h.model, vx + h.dx, h.dz, h.h, h.turn ?? 0);
        // ── AND NOTHING ELSE GROWING THROUGH THE BANYAN ──────────────────
        //
        // The scatter runs long before a village exists and spreads trees
        // evenly down the whole trail, so the roadside the banyan is planted
        // on already had three or four palms standing in it. A banyan with a
        // coconut coming out of its crown is not a banyan, it is a thicket —
        // and the banyan is the one tree here that is meant to be looked AT
        // rather than walked past.
        //
        // Cleared from the tree's own measured footprint rather than from a
        // guessed radius, so it stays right if the tree is ever resized: a
        // little wider than the canopy, which is where its roots would be.
        if (w != null && /banyan/i.test(h.model)) {
          const box = measureBox(w);
          const cx = (box.min.x + box.max.x) / 2;
          const cz = (box.min.z + box.max.z) / 2;
          const reach =
            Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.62;
          for (const t of scatterTrees) {
            if (Math.hypot(t.position.x - cx, t.position.z - cz) < reach) {
              t.visible = false;
              t.parent?.remove(t);
            }
          }
        }
      }

      // Dwellings around it, on both sides of the road but mostly the far
      // side, drawn without repeating until the list runs out.
      const pool = [...V.houses].sort(() => Math.random() - 0.5);
      // Some right on the road, some set well back. A row of houses all at the
      // same depth reads as a stage flat; what makes a village look lived-in
      // is that somebody built close to the road and somebody else built
      // behind them.
      // SET BACK IN PROPORTION TO THEIR SIZE.
      //
      // These offsets were drawn around houses 4.6 units tall — about a
      // nine-year-old — and a house is 14 now that the village is measured
      // against the child (see `heart`). The models scale uniformly, so a
      // house that is three times taller is also three times deeper: at the
      // old setbacks the first one stood in the middle of the road with the
      // children inside its porch. Everything is pushed out by the same
      // factor the buildings grew by, which keeps the arrangement — somebody
      // built close to the road, somebody else built behind them — and gives
      // it the room it now needs.
      // EVERY ONE OF THEM BEHIND THE ROAD, and none on the child's side.
      //
      // There used to be one across the road at +z, which is the verge the
      // child walks and the side the camera is on — so the house stood
      // between the viewer and the entire village, and at the honest size it
      // filled the frame and hid the party walking past it. The far verge is
      // where a village is met from a road anyway: you walk along it and it
      // is over there.
      // SET FURTHER BACK, but not past where they can be seen. The houses
      // are 60 per cent of the size they were, so they can afford more ground
      // between them and the road — and the ceiling on that is the fog, not
      // the terrain: it goes solid 92 units from the camera, which stands at
      // z = 42, so anything past about -44 is gone whatever is drawn there.
      const spots: readonly (readonly [number, number])[] = [
        [-46, -26], // nearest the road
        [50, -40], // well back behind the others
        [-28, -36], // and one more set back, still behind
        [72, -30],
      ];
      for (let i = 0; i < Math.min(3, pool.length); i++) {
        const [ox, oz] = spots[i];
        await stand(
          pool[i % pool.length],
          vx + ox + (Math.random() - 0.5) * 5,
          oz + (Math.random() - 0.5) * 3,
          V.houseHeight,
          // No `oz > 0` half-turn any more: nothing stands on the near side,
          // so every house already faces the road it fronts.
          (Math.random() - 0.5) * 0.7,
        );
      }

      // Wall segments along the road, enclosing the yards. Laid end to end
      // with a gap where the market fronts the road, so the child can see in.
      // The wall model is five and a half times wider than it is tall, so a
      // segment grew from 8 units long to 23 when the wall itself went from
      // knee-high to chest-high on an adult. Laid at the old 7.5 they now sit
      // three deep inside each other.
      const seg = 23;
      for (let i = -4; i <= 4; i++) {
        if (i >= -1 && i <= 1) {
          continue; // the way in
        }
        const wx = vx + i * seg;
        await stand(V.wall, wx, -10, V.wallHeight, 0);
      }
    }

    // A lone house or a forgotten cart, out on the empty stretches. Rare on
    // purpose: the road between villages is meant to feel like open country,
    // and the point of a village is that you arrive somewhere.
    if (theme.village != null) {
      const V = theme.village;
      for (const stray of V.strays) {
        if (Math.random() > 0.34) {
          continue;
        }
        try {
          const g = await loadModel(
            `${ASSETS}/models/${V.dir}/${stray.model}.glb`,
          );
          if (g == null) {
            continue;
          }
          const x = 20 + Math.random() * (TRAIL_END - 40);
          const z = -(16 + Math.random() * 10);
          const wrap = fitToHeight(
            g.scene.clone(true),
            stray.h * perspective(z),
          );
          wrap.position.set(x, surfaceY(x, z), z);
          wrap.rotation.y = Math.random() * Math.PI * 2;
          scene.add(wrap);
          characterRoots.add(wrap);
          applyEyeGlow(wrap, nightNow);
          // A single lamp in a house miles from anywhere is the best light
          // in this world — it is the only thing out there, and it says
          // somebody is home. Placed from the box like the village ones,
          // but never given a real light: these are far from the road and a
          // point light out there would be spent on empty paddy.
          if (trueNight && /^House/i.test(stray.model)) {
            const box = measureBox(wrap);
            const cz = (box.min.z + box.max.z) / 2;
            const faces = cz >= 0 ? -1 : 1;
            makeLamp(
              (box.min.x + box.max.x) / 2,
              box.min.y + (box.max.y - box.min.y) * 0.38,
              (faces > 0 ? box.max.z : box.min.z) + faces * 0.3,
              { size: 1.5, peak: 0.8 },
            );
          }
        } catch {
          // a missing stray is not worth failing the world for
        }
      }
    }

    // The skeleton forest. Bare, leafless trees from the nature set: a few
    // dense stands along stretches of the road where the woods close in, and
    // the odd lone trunk between them. Night only, like the Travellers.
    if (
      trueNight &&
      theme.nightTrees !== "keep" &&
      plan.deadGroves + plan.deadScatter > 0
    ) {
      try {
        const dead = await loadModel(`${ASSETS}/models/nature/MegaDead.glb`);
        if (dead == null) {
          throw new Error("disposed");
        }
        const variants = [...dead.scene.children];
        const plant = (x: number, z: number, big: boolean) => {
          const wrap = placeVariant(
            variants,
            Math.floor(Math.random() * variants.length),
            x,
            z,
            (big ? 1.15 : 0.9) * (theme.sceneryScale > 1 ? 1 : 1.1),
          );
          wrap.userData.nightOnly = true;
          wrap.visible = nightNow;
          moodScenery.push(wrap);
        };
        for (let g = 0; g < plan.deadGroves; g++) {
          // A stretch of trail where the dead wood crowds in on both sides.
          const cx = 26 + Math.random() * (TRAIL_END - 60);
          const trees = 7 + Math.floor(Math.random() * 6);
          for (let i = 0; i < trees; i++) {
            const gx = cx + (Math.random() - 0.5) * 22;
            const back = Math.random() < 0.7;
            const gz = back ? -(7 + Math.random() * 14) : 6 + Math.random() * 6;
            plant(gx, gz, true);
          }
        }
        for (let i = 0; i < plan.deadScatter; i++) {
          const x = 8 + Math.random() * (TRAIL_END - 16);
          const z = (Math.random() > 0.7 ? 1 : -1) * (6 + Math.random() * 16);
          plant(x, z, false);
        }
      } catch {
        // The night stands without its dead wood rather than failing to fall.
      }
    }

    if (theme.village != null) {
      // A MILESTONE, not a flag.
      // (The stones already passed are planted at the end of this block —
      // see "THE ROAD ALREADY WALKED".)
      //
      // A banner on a pole is a thing an expedition plants; a village road has
      // milestones, and they are what actually tells you how far you have
      // come. It is also a practical fix: the flag stood in the middle of the
      // track, and nothing stands in the middle of a road that carts use.
      //
      // A KERALA MILESTONE: a flat granite slab with an arched top, stood on
      // end at the roadside and left to weather. Not a cylinder and not
      // painted - both were tried and both were wrong. The real ones are bare
      // stone gone green with moss, with the distances cut into the face, and
      // the arch is the whole silhouette: it is what makes the thing read as a
      // marker somebody carved rather than a post somebody planted.
      //
      // Extruded from a profile rather than assembled from primitives, so the
      // arch is genuinely continuous with the sides instead of a cap balanced
      // on a post.
      // Wide enough for four digits with room either side.
      //
      // A milestone is read at a glance from the road, so the number must not
      // shrink away as a child racks up rounds — the stone gets wider once,
      // to a proportion that still reads as a Kerala roadside slab. Past four
      // digits the auto-fit in carveFace takes over and the digits shrink
      // rather than the stone growing absurd.
      const halfW = 0.56;
      const straight = 1.5;
      const profile = new THREE.Shape();
      profile.moveTo(-halfW, 0);
      profile.lineTo(-halfW, straight);
      // the arched head, drawn as a true half-circle across the full width
      profile.absarc(0, straight, halfW, Math.PI, 0, true);
      profile.lineTo(halfW, 0);
      profile.closePath();
      const slabGeo = new THREE.ExtrudeGeometry(profile, {
        depth: 0.2,
        bevelEnabled: true,
        bevelSize: 0.025,
        bevelThickness: 0.025,
        bevelSegments: 2,
        curveSegments: 12,
      });
      // Extrusion runs along +z from the profile plane; centre it so the slab
      // stands on the spot it is placed at rather than beside it.
      slabGeo.translate(0, 0, -0.1);

      // Wearing the stone wall's own material, so the moss on it is the same
      // moss as on every wall in every village - one weathered stone family
      // rather than a marker that looks imported.
      let stoneMat: THREE.Material = new THREE.MeshStandardMaterial({
        color: 0x8f9184,
        roughness: 0.96,
        metalness: 0,
      });
      try {
        const wall = await loadModel(
          `${ASSETS}/models/${theme.village.dir}/${theme.village.wall}.glb`,
        );
        wall?.scene.traverse((n) => {
          const mesh = n as THREE.Mesh;
          if (mesh.isMesh && mesh.material != null) {
            stoneMat = (
              Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
            ).clone();
          }
        });
      } catch {
        // the fallback grey is a stone too
      }
      // One factory, many stones. The geometry and the stone material are
      // built once and shared; only the carved face differs per milestone.
      const carvedStone = (n: number): THREE.Object3D => {
        const slab = new THREE.Mesh(slabGeo, stoneMat);
        slab.castShadow = true;
        slab.receiveShadow = true;
        slab.add(carveFace(n));
        return slab;
      };
      // ── THE CARVED STONE, AND THE ROADSIDE LAMP ────────────────────
      //
      // Both are real models now. They load in the background: until they
      // arrive `makeMilestone` keeps the extruded slab below, because a
      // milestone that fails to appear is worse than one that is not the
      // final art.
      makeMilestone = carvedStone;
      // AWAITED, not fired and forgotten.
      //
      // These were background loads with the slab kept as a fallback, and the
      // fallback is exactly what shipped: `placeFlag` plants the first
      // milestone — and with it the first lamp — the instant the world is
      // ready, which is before a detached load has come back. So run one got
      // the old slab and no lamp at all, every time, and only the second
      // stretch of road ever showed the real thing.
      //
      // They are 85 KB and 127 KB. Waiting for them costs a fraction of a
      // second on a build that already loads several megabytes, and it makes
      // the first thing the child sees the same as the rest.
      // The loose stones, for the feet of the markers and the lamps. Already
      // fetched by the scatter, so the cache makes these free.
      {
        const pool: THREE.Object3D[] = [];
        // Assigned NOW, filled later. The loader is detached — these are
        // decoration and must not hold the world up — so the function has to
        // exist before it has anything to place, and simply does nothing
        // until the pool is stocked. Assigning it from inside the async
        // closure instead left the compiler unable to see that it was ever
        // set, which it reports as calling a value of type `never`.
        // ── the greenery at each milestone ──────────────────────────
        //
        // Loaded once here, planted per stone below. Taro BEHIND the marker
        // (further from the road, where the tallest of the three frames it),
        // fern and grass IN FRONT of it, and one hibiscus at about a third of
        // the stones so the flower is a thing you come across rather than a
        // fixture.
        //
        // Nothing is placed between the stone and the road: the stone stands
        // 7.54 out and the carriageway is 8.2, so "in front" means a little
        // further out than the stone, on its road side. The number faces back
        // down the road and the nearest thing to it is knee-high.
        {
          const kinds: {
            readonly file: string;
            readonly min: number;
            readonly max: number;
            /**
             * Offset across the road from the stone.
             *
             * The camera looks from +z, so POSITIVE is toward it -- in front
             * of the stone -- and negative is away behind it. I had this the
             * wrong way round: the taro and the hibiscus were standing in
             * front of the marker and the grass behind it.
             *
             * How far forward is limited, and not by taste: the carriageway
             * is clear to 8.2 and the stone already stands at 7.54, so the
             * front row sits at the very edge of the verge. Any further and
             * the grass is growing in the cart track.
             */
            readonly out: number;
            readonly chance?: number;
            /** Size range, drawn per plant. */
            readonly lo: number;
            readonly hi: number;
          }[] = [
            // BACK, tallest furthest out, so the group reads as depth rather
            // than as a row. Taro takes a wide size range because a stand of
            // it is always a few big leaves and several half-grown ones --
            // all one size is what made it look stamped.
            // A SHRUB, standing to about the stone's own shoulder.
            //
            // The milestone measures 2.24 tall and the hibiscus model 1.40,
            // so at the village's 1.15 scenery scale a factor of 1.15-1.55
            // puts it at 1.85 to 2.50 -- level with the marker or a little
            // over it. It was 1.13 to 1.61, which is half the height of the
            // thing it stands behind and reads as another bit of undergrowth
            // rather than as the one flowering plant on the road.
            //
            // And at one stone in five, not one in three. It is the only
            // colour in the group, so it earns its place by being the stone
            // you did not expect it at.
            {
              file: "Hibiscus_Chemparathi",
              min: 1,
              max: 1,
              out: -2.3,
              chance: 0.2,
              lo: 1.15,
              hi: 1.55,
            },
            // Taller, and across a wider span than anything else here: the
            // big leaves want to stand over the stone rather than beside it,
            // and the gap between the smallest and the largest is what makes
            // a stand of taro read as grown rather than placed.
            {
              file: "Taro_Chembu",
              min: 1,
              max: 4,
              out: -1.4,
              lo: 0.8,
              hi: 2.1,
            },
            // FRONT, at the foot of the stone and low enough to leave the
            // carved face clear.
            {
              file: "Kerala_Fern",
              min: 4,
              max: 8,
              out: 0.25,
              lo: 0.75,
              hi: 1.15,
            },
            {
              file: "Kerala_Grass_Tuft",
              min: 7,
              max: 14,
              out: 0.55,
              lo: 0.7,
              hi: 1.2,
            },
          ];
          const loaded = await Promise.all(
            kinds.map(async (k) => {
              try {
                return await loadModel(
                  `${ASSETS}/models/village-plants/${k.file}.glb`,
                );
              } catch {
                return null;
              }
            }),
          );
          // PLANTED ONCE PER STONE, wherever the call comes from.
          //
          // `raise()` re-runs -- it clears the standing stones and puts them
          // back -- and the greenery is added straight to the scene rather
          // than tracked alongside them, so without this every re-raise would
          // lay another thicket on top of the last one.
          const plantedAt = new Set<number>();
          makeBasePlants = (x: number, z: number) => {
            const key = Math.round(x);
            if (plantedAt.has(key)) {
              return;
            }
            plantedAt.add(key);
            for (let ki = 0; ki < kinds.length; ki++) {
              const kind = kinds[ki]!;
              const src = loaded[ki];
              if (src == null) {
                continue;
              }
              if (kind.chance != null && Math.random() > kind.chance) {
                continue;
              }
              const n =
                kind.min +
                Math.floor(Math.random() * (kind.max - kind.min + 1));
              for (let i = 0; i < n; i++) {
                // One per frame, like the base rocks: a dozen clones landing
                // in one frame is what a child feels as the world catching.
                later(() => {
                  const v =
                    src.scene.children[
                      Math.floor(Math.random() * src.scene.children.length)
                    ]?.clone(true);
                  if (v == null) {
                    return;
                  }
                  // Gathered at the foot of the stone, not ringed round it:
                  // spread along the road, tight across it.
                  const px = x + (Math.random() - 0.5) * 3.0;
                  // Tighter across the road than along it: the group gathers
                  // at the stone in a band rather than a blob, which is what
                  // keeps the back row behind and the front row in front.
                  const pz = z + kind.out + (Math.random() - 0.5) * 0.5;
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
                  const scl =
                    (kind.lo + Math.random() * (kind.hi - kind.lo)) *
                    theme.sceneryScale;
                  wrap.position.set(px, surfaceY(px, pz), pz);
                  wrap.rotation.set(
                    (Math.random() - 0.5) * 0.2,
                    Math.random() * Math.PI * 2,
                    (Math.random() - 0.5) * 0.2,
                  );
                  {
                    // The depth cue rides on top of the per-plant variation, so a tree
                    // on the far verge is smaller than the same tree on the near one.
                    const d = perspective(z);
                    wrap.scale.set(
                      scl * d,
                      scl * d * (0.85 + Math.random() * 0.4),
                      scl * d,
                    );
                  }
                  wrap.traverse((nd) => {
                    const mesh = nd as THREE.Mesh;
                    if (mesh.isMesh) {
                      mesh.castShadow = false;
                      mesh.receiveShadow = true;
                    }
                  });
                  scene.add(wrap);
                });
              }
            }
          };
        }

        makeBaseRocks = (x: number, z: number) => {
          if (pool.length === 0) {
            return;
          }
          // Three to five, tight in, and never evenly spread: an even ring is
          // the one arrangement that reads as placed. Banked round two thirds
          // of a turn, the way washed stones gather on one side.
          const n = 3 + Math.floor(Math.random() * 3);
          const face = Math.random() * Math.PI * 2;
          for (let i = 0; i < n; i++) {
            // One rock per slice — see `later`. Cloning a mesh and weathering
            // its materials is a millisecond each, and five of them landing
            // together is what a child feels as the world catching.
            later(() => {
              const src = pool[Math.floor(Math.random() * pool.length)]!;
              const a = face + (Math.random() - 0.5) * 4.2;
              const d = 0.34 + Math.random() * 0.62;
              const rx = x + Math.cos(a) * d;
              const rz = z + Math.sin(a) * d;
              const rock = src.clone(true);
              // Small: stones somebody could kick, beside a marker the height
              // of a child. The scatter's own are five times this.
              rock.scale.setScalar(0.12 + Math.random() * 0.16);
              // Sunk a little, so they sit IN the ground rather than on it.
              rock.position.set(rx, surfaceY(rx, rz) - 0.04, rz);
              rock.rotation.set(
                (Math.random() - 0.5) * 0.5,
                Math.random() * Math.PI * 2,
                (Math.random() - 0.5) * 0.5,
              );
              // Weathered with the marker they lie against — new stones at the
              // foot of an old one make the old one look like a prop.
              weatherStone(rock, Math.round(Math.abs(rx) * 5) + i);
              scene.add(rock);
              characterRoots.add(rock);
            });
          }
        };
        void (async () => {
          // Already fetched by the scatter, so the cache makes these free.
          for (const n of [
            "Laterite_Rock",
            "Granite_Boulder",
            "Mossy_Stone",
            "River_Stone",
          ]) {
            try {
              const g = await loadModel(
                `${ASSETS}/models/village-stone/${n}.glb`,
              );
              if (g != null && !disposed) {
                pool.push(g.scene);
              }
            } catch {
              // One missing kind simply narrows the mix.
            }
          }
        })();
      }
      await (async () => {
        try {
          const g = await loadModel(
            `${ASSETS}/models/village-stone/Milestone_Vazhivilakku.glb`,
          );
          if (g == null || disposed) {
            return;
          }
          const src = g.scene;
          makeMilestone = (n: number) => {
            // TALLER, BECAUSE IT IS NOW TWO STONES IN ONE.
            //
            // The marker used to be fitted to 2.0 and the lamp beside it to
            // 2.6. Welded, the milestone shaft is the bottom 56% of the
            // model, so fitting the whole thing to 2.0 would have shrunk the
            // face the number is carved on to just over a unit — the number
            // is the entire point of a milestone, and it would have been the
            // part that paid for the lamp.
            //
            // 4.2 against a nine-year-old's 4.55 (see `castHeight`): the
            // number sits at a child's chest and the flame just above their
            // head, which is where a lamp lit so the stone can be read has to
            // be. At 3.0 it came barely past their waist and the whole thing
            // read as a kerbstone.
            const wrap = fitToHeight(src.clone(true), 4.2);
            // WIDENED TO THE DESIGN'S PROPORTION.
            //
            // The extruded slab this replaces is 0.54 as wide as it is tall,
            // which is what makes it read as a milestone and what gives four
            // digits somewhere to sit. The model is 0.34 — a narrow post — so
            // dropping it in swapped the slab for a bollard and squeezed the
            // number down with it. Stretched on X to the slab's proportion;
            // a weathered stone carries a little anisotropy without
            // complaining, and the alternative is re-cutting the asset.
            // NO STRETCHING HERE ANY MORE. The blank was a narrow post and
            // the code widened it on X at runtime to give four digits a face
            // to sit on. That trick cannot survive the lamp: the same scale
            // would take the head with it and flatten the carved opening into
            // a letterbox. The width is cut into the asset instead -- the
            // slab flares out below the lamp -- so what loads is already the
            // right shape and nothing here has to distort it.
            // The plate is measured onto THIS stone rather than sized by
            // hand — and AFTER the widening, so it fills the face it is cut
            // into instead of the one the model shipped with.
            const box = measureBox(wrap);
            const w = box.max.x - box.min.x;
            const h = box.max.y - box.min.y;
            // AGED ON ITS OWN NUMBER, so a given stone weathers the same way
            // every time the world is built. A marker that changes its moss
            // on reload is a different marker, and the number on it is what
            // the child is meant to recognise.
            weatherStone(wrap, n + 7);
            const plate = carveFace(n);
            plate.scale.setScalar((w * 0.78) / 0.96);
            plate.position.set(
              (box.min.x + box.max.x) / 2 - wrap.position.x,
              // LOW ON THE SLAB, where the stone is still at its full width.
              // 0.56 was the fraction that sat the number high on a plain
              // marker's face; on the welded stone that lands in the lamp
              // niche, and anything above about a quarter of the height is
              // into the flare, where the face is narrowing away behind the
              // carving. Measured against the profile: the stone holds 94% of
              // its width to z=0.26 and is down to 88% by z=0.29.
              box.min.y + h * 0.26 - wrap.position.y,
              box.max.z + 0.012 - wrap.position.z,
            );
            // Flagged so the lamp search skips it — see `lightTheNiche`.
            plate.userData.carving = true;
            wrap.add(plate);
            // The lamp is NOT lit here. `lightTheNiche` measures the flame in
            // world space, and a stone fresh out of this factory has not been
            // positioned yet — every caller sets `position` on what it gets
            // back. Lighting it here put all of them at the world origin: a
            // pool of lamplight in the middle of the road and every niche
            // dark. It is lit at each call site, once the stone is standing.
            return wrap;
          };
          // The stones already standing behind the child were built from the
          // fallback slab before this landed. Rebuild them, or the road opens
          // with one kind of milestone behind you and another ahead.
          rebuild.behind?.();
        } catch {
          // Keep the slab. Nothing to say: it already works.
        }
      })();
      // THE ROADSIDE LAMP USED TO BE LOADED HERE, as its own model, with a
      // retry loop of its own and a list of places it owed a lamp to if the
      // fetch was still in flight when a stone went in. All of that is gone:
      // the vazhivilakku's head is welded onto the milestone from the lamp
      // niche up, so the lamp arrives with the marker, in the same fetch, and
      // cannot be late, missing, or a metre out of line with it.
      // The pair still exists for anything that asks where the goal is, but is
      // never seen - the planted stones are what the child looks at.
      flagPole = new THREE.Mesh(slabGeo, stoneMat);
      flagPole.visible = false;

      // ── THE ROAD ALREADY WALKED ──────────────────────────────────────
      //
      // Stand the last few stones the child has already passed BEHIND the
      // start, so the road they are standing on visibly continues back the
      // way they came. Without this a returning child opens the world at the
      // head of an empty road with stone 8 somewhere ahead, which reads as
      // the number being arbitrary; with it, 5, 6 and 7 are standing behind
      // them and 8 is obviously the next one.
      //
      // Only a few: they are behind the camera within a step or two, and
      // planting a hundred stones to represent a hundred rounds would cost
      // real geometry for something nobody will ever look at.
      {
        // THE ONE AT YOUR SHOULDER comes first, and it is always there — even
        // for a child who has never played, when it reads 0. It is how you
        // know which lesson you are on: the number you have reached is
        // standing beside you at the start, and the next one is somewhere
        // down the road. Without it the road opens with no number anywhere
        // and the first stone you meet seems to come from nothing.
        //
        // Just BEHIND the start, so it reads as one already passed rather
        // than one waiting to be reached.
        // `makeMilestone`, not `carvedStone`: EVERY milestone comes from the
        // one factory, so the stone at your shoulder is the stone down the
        // road. This called the fallback slab directly, which is why widening
        // the carved model changed the road ahead and left the first one
        // behind you as it was.
        const behind: THREE.Object3D[] = [];
        const spots: { n: number; sx: number; spin: number }[] = [
          {
            n: milestoneNo,
            sx: runStart - 2.5,
            spin: 0.08 + Math.random() * 0.16,
          },
        ];
        // Only two more: they are behind the camera within a step, and
        // planting one stone per round ever played would cost real geometry
        // for something nobody can look at.
        for (let i = 1; i <= Math.min(2, milestoneNo); i++) {
          spots.push({
            n: milestoneNo - i,
            sx: runStart - 2.5 - i * MIN_STONE_GAP,
            // Turned a little off square, and each one differently, so a row
            // does not look machined. Kept, not redrawn, so a rebuild stands
            // them exactly where they were.
            spin: 0.08 + Math.random() * 0.16,
          });
        }
        const raise = () => {
          if (makeMilestone == null) return;
          for (const o of behind.splice(0, behind.length)) scene.remove(o);
          for (const at of spots) {
            const sz = meander(at.sx) - roadClear * 0.92;
            const stone = makeMilestone(at.n);
            const ax = laneAlignedX(at.sx, sz, LANE);
            stone.position.set(ax, surfaceY(ax, sz), sz);
            stone.rotation.y = at.spin;
            scene.add(stone);
            lightTheNiche(stone);
            behind.push(stone);
            makeBaseRocks?.(ax, sz);
            // The stones already standing when the session opens get the same
            // planting as the ones reached later -- the first one especially,
            // because it is in the opening frame and a bare marker there sets
            // the tone for every one after it.
            makeBasePlants?.(ax, sz);
            milestones.set(Math.round(at.sx), stone);
            // The road ahead measures from the last stone actually standing,
            // which is the one at the child's shoulder — without this the
            // first stone of the session ignores it and lands beside it.
            lastStoneX = Math.max(lastStoneX, at.sx);
          }
        };
        raise();
        rebuild.behind = raise;
      }

      // THE NUMBER, CUT INTO THE FACE.
      //
      // Drawn to a canvas and laid on the front of the slab rather than
      // modelled, because a cut deep enough to read at this distance would
      // need geometry finer than the whole stone has, and at a fixed camera
      // angle nobody can tell the difference.
      //
      // What sells it as carved is not the colour, it is the LIGHT: a groove
      // is dark along its upper lip, where the stone overhangs, and catches
      // the sun on the lower face of the cut. So the glyph is drawn twice -
      // a dark copy offset up and left for the shaded lip, then the pale
      // yellow slightly down and right for the lit face. Drawn once in flat
      // yellow it reads as painted on, which is what it looked like first.
      function carveFace(chapterNo: number): THREE.Object3D {
        // Higher resolution than the plate needs on screen, because the letter
        // shapes are what carry the illusion: at 128px the groove's edges were
        // one pixel wide and the number read as printed rather than cut.
        const cvs = document.createElement("canvas");
        // Wider than it was, in the same proportion as the slab, so the
        // carving keeps its texel density instead of being stretched.
        cvs.width = 352;
        cvs.height = 320;
        const g2 = cvs.getContext("2d");
        if (g2 != null) {
          g2.clearRect(0, 0, cvs.width, cvs.height);
          g2.textAlign = "center";
          g2.textBaseline = "middle";
          const label = String(chapterNo);
          // A CUT is three things, and drawing only the last of them is what
          // made the first attempt look like a sticker:
          //   1. the shaded upper lip, where the stone overhangs the groove,
          //   2. the lit lower face the sun reaches,
          //   3. a soft dark core between them, because a groove is a hole.
          //
          // CUT DEEPER THAN IT LOOKS IT NEEDS TO BE. By day the stone is pale
          // granite and the lit face of the groove is nearly the same value
          // as it, so the number came down to a faint shadow a child had to
          // already know was there. What carries a carving at a distance is
          // the DARK — the overhang and the floor — so both are taken down
          // most of the way to black and the lip is thrown a little further,
          // which is the same thing a deeper chisel would have done.
          const cut = (text: string, cx: number, cy: number, font: string) => {
            g2.font = font;
            // 3 - the depth, blurred, so the cut has a floor rather than an
            // outline
            g2.save();
            g2.filter = "blur(3px)";
            g2.fillStyle = "rgba(16,19,14,0.9)";
            g2.fillText(text, cx, cy);
            g2.restore();
            // 1 - the shaded lip
            g2.fillStyle = "rgba(20,24,18,0.98)";
            g2.fillText(text, cx - 3.6, cy - 3.6);
            // 2 - the lit face
            g2.fillStyle = "rgba(246,238,202,1)";
            g2.fillText(text, cx + 1.8, cy + 1.8);
          };
          // A carved rule under the arch, the way the real ones separate the
          // place from the distance.
          g2.save();
          g2.filter = "blur(1.5px)";
          g2.fillStyle = "rgba(20,24,18,0.88)";
          g2.fillRect(cvs.width / 2 - 96, 78, 192, 7);
          g2.restore();
          g2.fillStyle = "rgba(246,238,202,0.92)";
          g2.fillRect(cvs.width / 2 - 95, 80, 190, 3);
          // The word, small and weathered, then the number large enough to
          // read from the road.
          const mid = cvs.width / 2;
          cut("ROAD", mid, 56, "bold 42px Georgia, 'Times New Roman', serif");
          // FIT THE NUMBER TO THE STONE rather than trusting one font size.
          //
          // 150px suits one or two digits and runs a four-digit number clean
          // off the edge: "1000" measures about 330px in this face, on a
          // canvas that used to be 256 wide. The stone is wider now, and the
          // size is measured down from the ideal until it fits inside the
          // padding — so a child on round 7 gets big confident digits and one
          // on round 1207 gets smaller ones on the same stone, rather than a
          // number with its ends cut off.
          const face = "Georgia, 'Times New Roman', serif";
          const maxW = cvs.width - 60;
          let size = 150;
          g2.font = `bold ${size}px ${face}`;
          while (size > 48 && g2.measureText(label).width > maxW) {
            size -= 4;
            g2.font = `bold ${size}px ${face}`;
          }
          cut(label, mid, 190, `bold ${size}px ${face}`);
          const tex = new THREE.CanvasTexture(cvs);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 8;
          const plate = new THREE.Mesh(
            // Matched to the wider slab, keeping the same margin of bare
            // stone around the carving as before.
            new THREE.PlaneGeometry(0.96, 0.88),
            new THREE.MeshStandardMaterial({
              map: tex,
              // The carving lights up as somebody comes to read it — see
              // `milestoneGlow`. The map doubles as the emissive map so only
              // the cut letters glow: the bare stone around them has nothing
              // in that channel and stays dark, which is what makes it read
              // as light coming out of the groove rather than a lit panel
              // stuck on the front.
              emissiveMap: tex,
              emissive: new THREE.Color(0xffd89a),
              emissiveIntensity: 0,
              transparent: true,
              roughness: 0.95,
              metalness: 0,
              polygonOffset: true,
              polygonOffsetFactor: -2,
              polygonOffsetUnits: -2,
            }),
          );
          plate.position.set(0, 1.05, 0.101);
          milestoneGlow.push({
            mat: plate.material as THREE.MeshStandardMaterial,
            obj: plate,
          });
          return plate;
        }
        return new THREE.Group();
      }
      // The marker is one piece now. `flagCone` still has to exist because
      // placeFlag and the dispose path both expect the pair, so it is kept and
      // hidden rather than special-cased in three more places.
      flagCone = new THREE.Mesh(
        new THREE.BoxGeometry(0.01, 0.01, 0.01),
        stoneMat,
      );
      flagCone.visible = false;
      flagPole.castShadow = flagCone.castShadow = true;
      scene.add(flagPole, flagCone);
    } else {
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
    }
    placeFlag();

    // ── the Western Ghats ───────────────────────────────────────────────
    //
    // Two ridges on the horizon, the far one paler and higher, drawn as flat
    // silhouettes rather than modelled: they are 90 units away under an
    // orthographic camera, where a mountain with real geometry on it would
    // cost thousands of triangles to deliver exactly the shape a cut-out
    // already gives. Aerial perspective does the rest of the work - the far
    // ridge is closer to the fog colour, which is what makes it read as
    // further away rather than merely smaller.
    //
    // They sit BEHIND the fog's far plane deliberately, so the land dissolves
    // into them instead of ending at a line.
    if (theme.mountains != null) {
      const ridge = (
        dist: number,
        height: number,
        colour: number,
        seed: number,
        opacity: number,
        /** Where its peaks reach, as a fraction of the frame above the aim. */
        peakAt: number,
      ) => {
        const span = TRAIL_END + 420;
        const steps = 90;
        const shape = new THREE.Shape();
        shape.moveTo(-span / 2, 0);
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = -span / 2 + span * t;
          // Three octaves: the range, the peaks on it, and the roughness on
          // those. Sines rather than noise so the profile is stable between
          // sessions - a horizon that reshuffles on every reload reads as the
          // land itself being unreliable.
          const h =
            height *
            (0.55 +
              0.3 * Math.sin(x * 0.006 + seed) +
              0.12 * Math.sin(x * 0.021 + seed * 2.3) +
              0.05 * Math.sin(x * 0.06 + seed * 5.1));
          shape.lineTo(x, Math.max(0, h));
        }
        shape.lineTo(span / 2, 0);
        shape.closePath();
        const mesh = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({
            color: colour,
            transparent: opacity < 1,
            opacity,
            depthWrite: false,
            fog: false,
          }),
        );
        // PUT IT ON THE SKYLINE, by asking the camera where that is.
        //
        // Every previous attempt guessed a height and every one was wrong,
        // because the guess has to track the camera and the camera has been
        // moved repeatedly. Measured: anchored at y=1.5, the near ridge sat
        // THIRTY units above a frame that ended at 7.2 — it rendered
        // perfectly, every session, and has never once been on screen. The
        // note about the far bank was a real bug and a real fix, and it was
        // nowhere near enough.
        //
        // Under an orthographic camera the screen height of a point is just
        // its dot product with the camera's up vector, so the position that
        // puts a ridge on the skyline can be SOLVED rather than tuned:
        //
        //   screen(p) = p . camUp,  p = (TRAIL_END/2, y + height, -dist)
        //
        // set that equal to the height we want it to reach and rearrange for
        // y. It then follows the camera by construction — tilt it, raise it,
        // pull it back, and the mountains stay on the horizon.
        // `lookAt` sets the camera's quaternion but leaves matrixWorld stale
        // until the first render — reading the column without this gives the
        // identity, and the whole solve silently collapses to y = -height.
        cam.updateMatrixWorld(true);
        const camUp = new THREE.Vector3().setFromMatrixColumn(
          cam.matrixWorld,
          1,
        );
        const aimUp = new THREE.Vector3(0, V.lookY, 0).dot(camUp);
        // Peaks a little under the top of the frame, so there is sky above
        // them rather than a range jammed against the edge — and the two
        // ranges are given DIFFERENT heights on purpose.
        //
        // Solving both to the same peak was the obvious thing and it hid the
        // far range completely: two silhouettes reaching exactly the same
        // line, one drawn over the other, is one silhouette. The far one now
        // stands higher, which is also what distance does to a bigger range.
        const wantPeak = V.frustum * V.topF * peakAt;
        const y =
          (aimUp + wantPeak + dist * camUp.z - (TRAIL_END / 2) * camUp.x) /
            camUp.y -
          height;
        mesh.position.set(TRAIL_END / 2, y, -dist);
        mesh.renderOrder = -10;
        scene.add(mesh);
        return mesh;
      };
      // Far range first so the near one draws over it, and higher, so it
      // shows above rather than hiding behind.
      //
      // SKIPPED ENTIRELY where a painted horizon is going up: that art has
      // its own hills in it, and a sine-drawn range behind a photographed one
      // is two horizons at two different levels of detail.
      if (theme.horizon == null) {
        ridge(150, 15, theme.mountains.colorFar, 1.7, 0.5, 0.94);
        ridge(120, 11, theme.mountains.colorNear, 4.2, 0.75, 0.74);
      }
    }

    // ── THE PAINTED HORIZON ────────────────────────────────────────────
    //
    // "We need to change the camera angle to see the horizon" — we do not,
    // and that is the whole point of the solve above. Under an orthographic
    // camera the screen height of a point is its dot product with the
    // camera's up vector, so the y that puts a given line on the skyline can
    // be solved instead of guessed. Tilt the camera, raise it, pull it back,
    // widen it for a village: the horizon stays on the horizon, because it is
    // placed from wherever the camera is now rather than from a number
    // somebody measured once.
    //
    // What is solved is the SKYLINE INSIDE THE ART, not the edge of the file
    // — the image is mostly transparent sky above the hills, and putting the
    // top of the plane on the horizon would have hung the treeline somewhere
    // under the road.
    //
    // It follows the camera along x and is never fogged. Both are the same
    // statement: this is the far distance, and the far distance neither slides
    // past you as you walk nor gets hazier as you approach it. The haze is
    // painted into it already.
    if (theme.horizon != null) {
      const H = theme.horizon;
      // BOTH STRIPS, LAID END TO END. The art comes in two cuts of the same
      // country, and alternating them across the width is what makes a wide
      // horizon out of a 3:1 image without stretching it and without the
      // mirror seam a simple repeat leaves. Two different hills next to each
      // other read as more country; the same hill reflected reads as a fold.
      // KTX2, through the transcoder this world already stands up for its
      // models. The art is 2172x724 with a soft mist gradient and a cut-out
      // sky, and at that size four PNGs were 2.1 MB for what is, in the
      // frame, a band a few hundred pixels tall. Halved to 1088x364 and
      // encoded ETC1S they are 164 KB for the set — a twelfth of the bytes,
      // with the silhouette and the gradient intact. GPU memory is the
      // bigger win: a block-compressed texture stays compressed on the card,
      // where a PNG is decoded to raw RGBA.
      // THE KTX2 IS ENCODED Y-FLIPPED, and it has to be.
      //
      // three.js cannot apply `flipY` to a CompressedTexture — the flag is
      // ignored, because there is no cheap way to turn block-compressed data
      // upside down after the fact. A KTX2 built from a top-left-origin PNG
      // therefore renders inverted, hills at the bottom and mist in the sky,
      // which is exactly how this first went in. The flip is done once at
      // encode time instead (`basisu -y_flip`), so what arrives is already
      // the right way up.
      const load = (half: "day" | "night", v: string) =>
        new Promise<THREE.Texture>((res) => {
          ktx2.load(
            `${ASSETS}/horizon/${H.name}_${half}_${v}.ktx2`,
            (t) => {
              t.colorSpace = THREE.SRGBColorSpace;
              res(t);
            },
            undefined,
            // A horizon that fails to load must not take the road with it —
            // an empty texture on a transparent plane is simply no horizon.
            () => res(new THREE.Texture()),
          );
        });
      const tex = await Promise.all(
        (["day", "night"] as const).flatMap((half) =>
          H.variants.map((v) => load(half, v).then((t) => ({ half, v, t }))),
        ),
      );
      const byHalf = (half: "day" | "night") =>
        tex.filter((e) => e.half === half);
      /**
       * How far to lift this cut so its own ridge lands on the common line.
       *
       * The four files are not drawn to a shared baseline — see `ridge` on
       * the theme — so each strip is nudged by the difference between where
       * its hills actually are and where `skyline` says they should be. With
       * that done, day and night are registered to each other whichever pair
       * of cuts a strip happens to be showing, and the crossing reads as the
       * light changing rather than as the land moving.
       */
      const lift = (half: string, v: string) =>
        (H.skyline - (H.ridge?.[`${half}_${v}`] ?? H.skyline)) * H.height;

      // SMALL, FAR, AND NEVER STRETCHED.
      //
      // The art is 3:1, so a band short enough to read as a distant treeline
      // is also too narrow to reach across the frame — 20 units tall is only
      // 60 wide at its own proportion, against 57.6 units of ordinary view
      // and 86 once a village opens it out. Scaling the plane to fit would
      // squash the hills, which is the one thing not to do to a painting.
      //
      // So the plane is made generously wide and the IMAGE repeats across it
      // at exactly its own aspect: `repeat.x` is how many natural-width
      // copies fit. Mirrored rather than plain repeat, so consecutive copies
      // meet as a reflection and there is no seam to find — on a soft misty
      // ridge that reads as more of the same country, which is what it is.
      const aspect = 2172 / 724;
      // One strip, at its own proportion. Never scaled to fit anything.
      const natural = H.height * aspect;
      // Wide enough for the widest this view ever opens — an ordinary frame
      // is 57.6 units across and a village pulls it out to about 86 — with
      // room to spare either side so the ends are never hunted for.
      const span = 320;
      cam.updateMatrixWorld(true);
      const camUp = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const aimUp = new THREE.Vector3(0, V.lookY, 0).dot(camUp);
      // A shade under the top of the frame, so there is sky over the hills.
      // WHERE THE HILLS SIT IN THE FRAME, as a fraction of the way up.
      //
      // 0.45, not 0.8. At 0.8 the solve was right and the result was useless:
      // measured, the painted skyline landed at 0.96 in clip space, which is
      // the top two per cent of the picture, behind the card's own rounded
      // corner. A horizon wants air above it and land below it, and a little
      // under halfway up is where a real one sits when you are walking a
      // road.
      // ON THE LINE THE FOG DRAWS, and it cannot be moved on its own.
      //
      // The band takes the depth test now, so it is hidden wherever the
      // ground covers it: drop the skyline below the ground's far edge and it
      // simply disappears behind it. Moving the horizon down means moving the
      // ground's edge down too, which is why `FAR` above came in from 121 to
      // 116 at the same time. 0.797 of the frame top is exactly where 116
      // units of ground now ends.
      // A SHADE BELOW THE GROUND'S EDGE, NOT LEVEL WITH IT.
      //
      // 0.848 puts the ridge exactly on the line and that is too exact: this
      // is solved from `aimUp`, which is the look-at point, so any change to
      // `lookY` lifts the band while the ground's edge — fixed by
      // `FAR * sin(pitch)` — stays where it is. Raising the camera by two
      // units did precisely that and opened a strip of sky between them.
      //
      // 0.83 tucks the ridge a fifth of a unit under the ground line, so the
      // two overlap rather than meet. The band draws over the skirt anyway,
      // so the overlap costs nothing and the gap cannot come back the next
      // time the camera moves.
      // 0.90, and it is free to move now. While the band sat behind the
      // terrain's far edge this number was pinned to it — drop below and the
      // ground simply ate the hills. At 80 units the band is IN FRONT of that
      // edge, so where it sits is a choice again rather than a constraint.
      // 0.68, so the band's MIST reaches the terrain's edge rather than its
      // ridge sitting level with it. With the skirt gone the ground stops at
      // about 2.9 units of screen height and the art is transparent below its
      // mist, so a ridge set too high leaves a strip of sky between the two.
      // Dropping it puts the mist on the ground and buys four units of real
      // sky above the hills — more than the skirt was ever hiding.
      // 0.45, AND THE UNITS ARE THE TRAP HERE.
      //
      // This is a screen height measured from the LOOK-AT POINT, not a
      // fraction of the visible frame, and those stopped being the same thing
      // once the window went bottom-heavy: at 0.90 over 1.50 the frame runs
      // from -18.3 to +10.98, so its centre is at -3.66 and the top is only
      // a third of the way up from there. Read as a fraction, 0.92 sounds
      // like "near the top". Measured, it put the ridge at 0.94 in clip space
      // — the top three per cent of the picture, which is why the hills kept
      // coming out as a sliver however the number was nudged.
      //
      // 0.90 — the ridge sits a little under the top edge of the frame, which is
      // what "all the way up, and not much sky" means: the hills run off the
      // top and what fills the band is treeline and mist rather than air.
      // Over 1.0 on purpose; this is a height from the look-at point, not a
      // fraction of anything, so it is allowed past the frame's own top.
      const wantPeak = V.frustum * V.topF * 0.9;
      // The plane's centre, given that the painted skyline sits `skyline` of
      // the way up from its bottom edge.
      const fromCentre = (H.skyline - 0.5) * H.height;
      const baseY =
        (aimUp + wantPeak + H.dist * camUp.z) / camUp.y - fromCentre;
      for (const half of ["day", "night"] as const) {
        const isNight = half === "night";
        const strips = byHalf(half);
        if (strips.length === 0) {
          continue;
        }
        // A GROUP, so the tick moves one thing and the strips keep their
        // places inside it.
        const group = new THREE.Group();
        // ── HOW TWO DIFFERENT HILLS ARE MADE INTO ONE COUNTRY ────────────
        //
        // Butted end to end the strips meet in a hard vertical line: the two
        // cuts have different ridges at different heights, so the seam is
        // exactly where a horizon must not have one.
        //
        // Each strip carries an alpha ramp down its LEFT third and is opaque
        // the rest of the way, and they are spaced so that ramp lands on its
        // neighbour's opaque tail — a twenty-unit dissolve from one treeline
        // into the next, which at this distance reads as haze rather than as
        // a join.
        //
        // The ramp is on ONE edge only, and that is the whole trick. Fading
        // both and overlapping them looks symmetrical and is wrong: two
        // half-transparent layers over a background let a quarter of the
        // background through in the middle, and the seam comes back as a
        // pale bar. With one opaque and one fading over it the blend is
        // exactly `a * new + (1 - a) * old`, with nothing behind showing.
        //
        // Which means the draw ORDER matters, so each strip is given its own
        // `renderOrder`: left to right, so every strip dissolves over the one
        // it overlaps rather than under it.
        const fade = natural / 3; // the geometry below puts the ramp here
        const step = natural - fade;
        const n = Math.ceil(span / step) + 1;
        for (let i = 0; i < n; i++) {
          // Four columns, so the alpha can hold at 1 across the body and fall
          // to 0 over the last third. A plain two-triangle plane has no
          // vertices to ramp between.
          const geo = new THREE.PlaneGeometry(natural, H.height, 3, 1);
          const cols = geo.attributes.position.count;
          const rgba = new Float32Array(cols * 4);
          for (let v = 0; v < cols; v++) {
            const x = geo.attributes.position.getX(v);
            // 0 at the left edge, 1 by a third of the way in.
            const a = Math.min(1, (x + natural / 2) / fade);
            rgba[v * 4] = 1;
            rgba[v * 4 + 1] = 1;
            rgba[v * 4 + 2] = 1;
            rgba[v * 4 + 3] = i === 0 ? 1 : a;
          }
          geo.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
          const mesh = new THREE.Mesh(
            geo,
            new THREE.MeshBasicMaterial({
              // Alternating, so no two neighbours are the same cut.
              map: strips[i % strips.length].t,
              transparent: true,
              depthWrite: false,
              // IT TAKES THE DEPTH TEST, and it has to.
              //
              // It ran with `depthTest: false` while the ground's own far
              // edge was the thing in the way — a horizon solved onto the
              // skyline lost to it every time. But ignoring depth means
              // ignoring the banyan too, and the hills came out painted
              // across the front of the trees.
              //
              // The skirt fixed the original problem properly (the ground now
              // fades into fog instead of ending in a line), so the band can
              // stand in the world where it belongs: 200 units out, behind
              // everything, correctly occluded by every tree and roof in
              // front of it, with only the part above the fog line showing.
              depthTest: true,
              // IT HAZES LIKE EVERYTHING ELSE OUT THERE.
              //
              // This ran unfogged, on the reasoning that the art has its own
              // mist painted in and the far distance should not change as you
              // walk towards it. True, and it made the band the only thing at
              // that range drawn at full contrast — crisp hills behind trees
              // that the fog had already half dissolved, which reads as a
              // picture hung at the end of the road rather than as country
              // beyond it.
              //
              // Fogged, it sits at the same remove as the far trees by
              // construction, and follows the hour without being told: the
              // fog colour is the one `applySky` is already moving.
              fog: true,
              opacity: isNight ? 0 : 1,
              // The per-vertex alpha above rides on top of `opacity`, so the
              // day/night crossing and the strip dissolve multiply cleanly.
              vertexColors: true,
            }),
          );
          // Laid with their ramps overlapping, and centred on the group —
          // each on its own measured ridge, so the row is level.
          const cut = strips[i % strips.length];
          // ONLY A SHARE OF THE FOG — see `HORIZON_HAZE`. The shader chunk is
          // patched rather than the material faded, so the picture stays solid
          // and it is the haze over it that thins. Linear fog, which is what
          // this scene uses, so the factor is the smoothstep between near and
          // far; scaling that changes nothing else about the fog.
          {
            const hm = mesh.material as THREE.MeshBasicMaterial;
            hm.onBeforeCompile = (shader) => {
              shader.fragmentShader = shader.fragmentShader.replace(
                "#include <fog_fragment>",
                `#ifdef USE_FOG
                   float hzFog = smoothstep( fogNear, fogFar, vFogDepth ) * ${HORIZON_HAZE.toFixed(3)};
                   gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, hzFog );
                 #endif`,
              );
            };
            // Or three reuses the unpatched program it compiled for every other
            // MeshBasicMaterial in the world.
            hm.customProgramCacheKey = () => "horizon-haze";
          }
          mesh.position.x = (i - (n - 1) / 2) * step;
          mesh.position.y = lift(half, cut.v);
          mesh.renderOrder = i;
          mesh.frustumCulled = false;
          group.add(mesh);
        }
        // THE TWO ROWS MUST LAND ON EXACTLY THE SAME SPOT.
        //
        // Day and night are the same painting under different light — the
        // same ridge, the same palms, the same silhouette — so the crossing
        // only reads as the hour changing if the two are registered to the
        // pixel. A unit out and the hills would slide sideways as the sun
        // went down.
        //
        // Nothing here is per-half: the same `baseY`, the same distance, the
        // same strip width and count, the same alternation of A and B in the
        // same order, and one formula in the tick moving both groups. The
        // registration is a consequence of that rather than something
        // maintained, which is the only way it stays true.
        horizonCamX0 = cam.position.x;
        group.position.set(0, baseY, -H.dist);
        group.renderOrder = -100;
        scene.add(group);
        horizonBand.push({ group, night: isNight });
      }
    }

    await applySky(land.mood);

    // ── THE SHADERS, NOW THAT THERE ARE SOME ────────────────────────────
    //
    // `renderer.compile` used to run during construction, at the bottom of
    // this file — which is BEFORE any of the above has happened. The chain
    // you are reading is an async IIFE: it suspends at its first `await` and
    // construction carries straight on, so that compile walked an empty
    // scene, did nothing worth doing, and every model's program was still
    // built lazily on the frame it first appeared. The stutter it was written
    // to prevent was happening anyway, a little later.
    //
    // Here there is a whole world to compile, and the loading screen is still
    // up — which is the entire point of prepaying.
    //
    // `compileAsync`, not `compile`: the blocking form hands the driver every
    // program at once and can hold the main thread for hundreds of
    // milliseconds on a world this size. The async form yields between them,
    // so the loader keeps animating while it works.
    if (!disposed) {
      await renderer.compileAsync(scene, cam).catch(() => {
        // A driver that will not precompile still renders; it just pays for
        // each program on the frame that needs it, which is where it was.
      });
    }
  })();

  function burst(
    x: number,
    y: number,
    z: number,
    colors: readonly number[],
    n = 10,
    up = 0.22,
  ) {
    if (calmMode) {
      return;
    }
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
      m.userData.gravity = 0.012;
      m.userData.decay = 0.02;
      m.userData.spin = 1;
      scene.add(m);
      sparks.push(m);
    }
  }

  /**
   * The puff under a foot on landing.
   *
   * Not `burst`. Burst is celebration — big tumbling chips of colour thrown
   * high, which is right for a finished trail and wrong for a shoe touching
   * a path. Used for both, it read as the character kicking up clods of mud:
   * eight cubes at 0.16, four per cent of his own height, thrown a third of a
   * unit into the air, spinning at nearly two turns a second and taking most
   * of a second to die.
   *
   * Real dust does the opposite of all of that. It is small, there is not much
   * of it, it goes sideways rather than up, it expands as it thins, and it is
   * gone almost at once. So: quarter the size, half the number, a fifth of the
   * lift, a third of the life — and it fades by going transparent and
   * spreading rather than by shrinking, because dust disperses, it does not
   * retract.
   */
  function dust(x: number, y: number, z: number, n = 3) {
    if (calmMode) {
      return;
    }
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.025, 0.025),
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0xcfc4ae : 0xb8ab90,
          transparent: true,
          opacity: 0.5,
        }),
      );
      m.position.set(
        x + (Math.random() - 0.5) * 0.12,
        y,
        z + (Math.random() - 0.5) * 0.12,
      );
      // Outward and barely up: a foot pushes dust sideways, it does not throw
      // it. The backward bias is the direction of travel.
      m.userData.v = new THREE.Vector3(
        (Math.random() - 0.7) * 0.05,
        0.012 + Math.random() * 0.02,
        (Math.random() - 0.5) * 0.05,
      );
      m.userData.life = 1;
      m.userData.gravity = 0.0015;
      m.userData.decay = 0.055; // about a third of a second
      m.userData.spin = 0.15;
      m.userData.grow = true;
      scene.add(m);
      sparks.push(m);
    }
  }

  // ── loop ───────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  // ── CLOUD CROSSING THE SUN: the schedule ───────────────────────────────
  //
  // One cloud at a time, with a beginning and an end, rather than a tide.
  //
  // The first version of this was two slow sine waves — a 16% dip spread
  // across seventy-seven seconds. That is not a subtle effect, it is an
  // invisible one: the eye adapts to a change that slow long before it has
  // finished happening, so the light was genuinely moving the whole time and
  // nobody could ever have seen it. What the eye actually detects is the
  // RATE, which is why a cloud edge crossing the sun is obvious in life and a
  // sunset is not.
  //
  // So the same depth arrives over about two and a half seconds instead, sits
  // for a while, and leaves a little more slowly than it came — which is the
  // shape of a real cloud shadow, whose leading edge is always sharper than
  // its trailing one. Then open sun for a good half-minute, so that when the
  // next one comes it reads as weather arriving rather than as a flicker.
  //
  // Every number is randomised per pass, including how thick the cloud is:
  // a sky where each cloud dims by exactly as much as the last is a rhythm,
  // and the eye finds rhythms and stops watching them.
  /**
   * Nothing moves until the page says the road is on screen.
   *
   * The world used to start running the instant it was constructed, which is
   * several seconds before the loading screen comes down — so the characters
   * did their waiting animations, the buffalo wandered and the weather turned
   * behind a curtain, and the child was handed a scene already in motion.
   */
  let held = true;

  /** Seconds of open sun left before the next cloud. */
  let cloudWait = 5 + Math.random() * 9;
  /** Seconds into the current pass, or < 0 when the sun is clear. */
  let cloudAt = -1;
  let cloudIn = 0;
  let cloudHold = 0;
  let cloudOut = 0;
  /** How thick this one is, 0..1 of the theme's full depth. */
  let cloudDeep = 1;
  /** Smoothstep: no corner where the shadow's edge arrives or leaves. */
  const ease = (t: number) => t * t * (3 - 2 * t);

  function tick() {
    runSlices();
    if (disposed) {
      return;
    }
    // ── HELD UNTIL THE LOADING SCREEN HAS GONE ─────────────────────────────
    //
    // The clock is still read — dropping the frames instead would hand the
    // world one enormous delta the moment it was released, and everything
    // would jump a second and a half into the future at once — but nothing is
    // given any of it. Every mixer, the run, the weather and the animals all
    // take `dt`, so zero freezes the lot in one place rather than needing a
    // pause flag threaded through each of them.
    //
    // `runSlices` is deliberately above this: it is the incremental BUILDER,
    // and holding that would mean the world never finished loading at all.
    // AND NEVER MORE THAN A FIFTEENTH OF A SECOND IN ONE FRAME.
    //
    // `getDelta` reports real time since the last frame, and there are two
    // ordinary ways for that to come back enormous: the tab was in the
    // background, where the browser stops calling `requestAnimationFrame`
    // altogether, or the machine hitched on a GLB finishing its upload.
    // Either way the next frame arrives holding ten or twenty seconds.
    //
    // Everything timed on this road divides by a duration and clamps, so one
    // huge delta does not slow anything down — it SKIPS it. Nightfall is
    // `min(gap, dt / 4.5)`, so a single twenty-second frame crosses the whole
    // thing at once: the child comes back to the tab, or the world finishes
    // loading, and the four-and-a-half-second sunset they were meant to watch
    // has already happened. The same frame completes every cast cross-fade
    // and every tree dissolve, which is the rest of the effect.
    //
    // So the clock is read in full and SPENT at up to a 15fps step. A world
    // that was not being looked at resumes where it was rather than fast-
    // forwarding to where it would have been, which is what the hold below
    // already does for the loading screen and what a typing game wants: the
    // child was not typing while the tab was hidden either.
    const elapsed = Math.min(clock.getDelta(), 1 / 15);
    const dt = held ? 0 : elapsed;
    // Turn the next card over — see stepReveal. On the world's own clock, so
    // it stops with everything else when the tab is hidden.
    stepReveal(dt);
    // ── CLOUD CROSSING THE SUN ───────────────────────────────────────────
    //
    // See theme.cloudDrift. Two slow waves at a ratio that does not resolve,
    // so the light never settles into a rhythm — the same trick the lamp
    // flames use, at a hundredth of the speed. Dims only, never brighter
    // than open sun: what passes over is cloud, and cloud takes light away.
    //
    // The sky fill moves the other way, by a third as much. That is what
    // actually happens under cloud — less direct sun, relatively more of the
    // soft light from everywhere — and it is the half that keeps a dimmed
    // frame from just looking underexposed.
    //
    // Held still when motion is stilled: a child who has asked for less
    // movement has not asked for less movement except the weather.
    // HOW OFTEN SOMETHING CROSSES THE SUN follows today's cover. On a clear
    // day almost nothing does; on a half-clouded one it is steady; under
    // overcast there is no separate shadow to cast, because the sun is
    // already behind the whole sky — which is why this FALLS again at the
    // top of the range rather than climbing.
    const drift =
      (theme.cloudDrift ?? 0) * (1 - Math.abs(cloudCover - 0.5) * 1.6);
    if (drift > 0 && driftLit && motionScale > 0) {
      if (cloudAt < 0) {
        cloudWait -= dt;
        if (cloudWait <= 0) {
          // The leading edge is quicker than the trailing one, because a
          // cloud's windward side is the sharp one.
          cloudIn = 2 + Math.random() * 1.4;
          cloudHold = 5 + Math.random() * 13;
          cloudOut = 3 + Math.random() * 2.2;
          cloudDeep = 0.5 + Math.random() * 0.5;
          cloudAt = 0;
        }
      } else {
        cloudAt += dt;
      }
      let shade = 0;
      if (cloudAt >= 0) {
        const over = cloudIn + cloudHold;
        if (cloudAt >= over + cloudOut) {
          cloudAt = -1;
          cloudWait = 20 + Math.random() * 28;
        } else if (cloudAt < cloudIn) {
          shade = ease(cloudAt / cloudIn);
        } else if (cloudAt < over) {
          shade = 1;
        } else {
          shade = ease(1 - (cloudAt - over) / cloudOut);
        }
        shade *= drift * cloudDeep;
      }
      sun.intensity = sunLit * (1 - shade);
      hemi.intensity = hemiLit * (1 + shade * 0.34);
      // The letter cards drift with everything else — their box and their
      // printed face are both lit, so the two real lights above carry them.
      // Their PAINTED shadow is not lit by anything, so it is dimmed by hand:
      // a shadow that stayed hard black while the sun went behind cloud is
      // the one thing that would give the whole effect away.
      for (const t of wordTiles) {
        const sm = t.shadow.material as THREE.MeshBasicMaterial;
        const own = (t.shadow.userData.shadowBase as number) ?? tileShadowBase;
        sm.opacity = own * (1 - shade * 1.6);
      }
    } else if (cloudAt >= 0) {
      // Stilled, or night fell, part-way through a pass. Without this the
      // world keeps whatever dimming it happened to be holding at the moment
      // the weather stopped, for as long as it stays stopped.
      cloudAt = -1;
      cloudWait = 20 + Math.random() * 28;
      sun.intensity = sunLit;
      hemi.intensity = hemiLit;
      for (const t of wordTiles) {
        (t.shadow.material as THREE.MeshBasicMaterial).opacity =
          (t.shadow.userData.shadowBase as number) ?? tileShadowBase;
      }
    }

    // ── the sky, crossing over ───────────────────────────────────────────
    //
    // Colour, fog and exposure walk to whatever the last `applySky` asked
    // for, over the same second and a half the rest of nightfall takes. The
    // three intensities are eased on their own numbers rather than through a
    // colour lerp, and the colours go through `lerp` in linear space, which
    // is what stops a blue-to-amber crossing passing through grey.
    {
      const k = Math.min(1, dt / NIGHTFALL_S);
      skyNow.sun.lerp(skyTo.sun, k);
      skyNow.hemi.lerp(skyTo.hemi, k);
      skyNow.ground.lerp(skyTo.ground, k);
      skyNow.fog.lerp(skyTo.fog, k);
      skyNow.exposure += (skyTo.exposure - skyNow.exposure) * k;
      skyNow.env += (skyTo.env - skyNow.env) * k;
      skyNow.bg += (skyTo.bg - skyNow.bg) * k;
      skyNow.top.lerp(skyTo.top, k);
      skyNow.bottom.lerp(skyTo.bottom, k);
      skyNow.stars += (skyTo.stars - skyNow.stars) * k;
      writeSky(skyNow);
      // And the backdrop with them. Guarded inside: for all but the few
      // seconds of a crossing the two gradient stops are standing still and
      // this costs one hex comparison each.
      drawFlatSky();
      // The painted horizon crosses over with everything else, and rides
      // along with the camera. Following in x is what makes it read as
      // distance: the far hills do not slide past a child who is walking,
      // and an orthographic camera gives no parallax to do it for us.
      if (horizonBand.length > 0) {
        // WHERE IT LOOKS CENTRED, NOT WHERE THE CAMERA IS.
        //
        // This camera is offset along x and tilted, so its right vector
        // carries a z component — and depth therefore leaks into screen-x.
        // Parking the band at `cam.position.x` looked obviously correct and
        // put a 186-unit backdrop 190 units away almost entirely off the left
        // of the frame: measured, its centre projected to -1.86 in clip space
        // and its right edge reached only -0.25, so the horizon covered the
        // quarter of the screen hidden behind the score card and nothing
        // else. The milestones hit this years earlier and it is solved the
        // same way there — see `laneAlignedX`.
        //
        // Solved from the camera's own right vector rather than nudged by
        // eye, so it survives the village widening the view and anything
        // later doing the same.
        _tmpRight.setFromMatrixColumn(cam.matrixWorld, 0);
        for (const h of horizonBand) {
          // THE HORIZON CHANGES HOUR FASTER THAN THE ROAD DOES.
          //
          // It rode `nightLook` straight, which is the four-and-a-half second
          // crossing everything else takes — and for most of it the two
          // paintings were both half there, which on the same silhouette
          // reads as a smear rather than as dusk. The far distance is also
          // the part of a landscape that turns first: the hills go blue while
          // the road you are on is still lit.
          //
          // Steepened around the middle, so it is mostly one picture or the
          // other and spends only the centre of the crossing between them. It
          // still starts and ends exactly with the rest of nightfall — this
          // bends the curve, it does not shorten it.
          // ON THE SAME CLOCK AS THE SHADOWS.
          //
          // `nightBlend` is what swings the sun vector from its day rig to
          // its night one, so it IS the shadow transition — the shadows sweep
          // across the road exactly as this number runs. The horizon was
          // reading `nightLook` instead, which is the canvas grade: a
          // different curve entirely, exponential where this one is linear,
          // so the hills changed hour on their own schedule.
          //
          // It also had a steepening on it, to stop the two paintings smearing
          // through each other at half opacity. That has to go: a faster
          // curve is precisely a curve out of step, and being out of step
          // with the light is the more visible fault by far. One number, one
          // nightfall.
          const op = h.night ? nightBlend : 1 - nightBlend;
          for (const strip of h.group.children) {
            const m = (strip as THREE.Mesh).material as THREE.MeshBasicMaterial;
            m.opacity = op;
          }
          // Follows the camera, but keeps a little of the journey for itself
          // — see `HORIZON_DRIFT`. The depth correction is unchanged: this
          // camera is yawed, so a plane this far back has to be offset along
          // x to LOOK centred (the same solve `laneAlignedX` does).
          const follow =
            horizonCamX0 +
            (cam.position.x - horizonCamX0) * (1 - HORIZON_DRIFT);
          h.group.position.x =
            Math.abs(_tmpRight.x) < 1e-4
              ? follow
              : follow -
                ((h.group.position.z - cam.position.z) * _tmpRight.z) /
                  _tmpRight.x;
        }
      }
      // The canvas grade rides with it. Re-applied only when it has actually
      // moved: it writes a CSS filter string, and setting one every frame
      // buys a style recalculation a frame for a number that is not changing.
      if (Math.abs(nightLookTo - nightLook) > 0.004) {
        nightLook += (nightLookTo - nightLook) * k;
        applyLook();
      }
    }

    // ── the night, breathing ─────────────────────────────────────────────
    // The key light walks to whatever the last sky asked for, at the rate
    // the night blend runs — see `sunLit`. Linear and clamped rather than an
    // exponential approach, so it actually arrives instead of creeping at
    // the last per cent for the rest of the session.
    {
      const rate = dt / NIGHTFALL_S;
      for (const [now, want, set] of [
        [sunLit, sunBase, (v: number) => (sunLit = v)],
        [hemiLit, hemiBase, (v: number) => (hemiLit = v)],
      ] as const) {
        const gap = want - now;
        // Scaled by the size of the whole change, or a small adjustment
        // would crawl and a large one would still take 1.8s.
        set(
          now +
            Math.sign(gap) *
              Math.min(Math.abs(gap), Math.abs(want) * rate + 0.02),
        );
      }
    }

    // One eased blend drives the whole layer — mist, stars, moon, fireflies,
    // eyes — so nightfall arrives over a couple of seconds as the cast
    // cross-fades, instead of everything snapping at once.
    stepFades(dt);
    if (trueNight) {
      const target = nightNow ? 1 : 0;
      nightBlend +=
        Math.sign(target - nightBlend) *
        Math.min(Math.abs(target - nightBlend), dt / NIGHTFALL_S);
      // ONCE, PART-WAY INTO THE FADE. Not when the flag flips — the world is
      // still broad daylight at that instant and a line about the lamps being
      // lit would arrive before any of them were. A third of the way through
      // the cross-fade the change is plainly happening and the sentence is
      // true when it is read.
      if (nightNow && !nightSaid && nightBlend > 0.34) {
        nightSaid = true;
        opts.onEvent?.("nightfall");
      }
      if (!nightNow) {
        nightSaid = false;
      }
      const on = nightBlend > 0.001;
      nightLayer.visible = on;
      if (on) {
        const calm = 0.25 + 0.75 * motionScale;
        const t = clock.elapsedTime * calm;
        for (const m of mistMats) {
          m.uniforms.uTime.value = t;
          m.uniforms.uOpacity.value =
            plan.mist * nightBlend * (theme.mistScale ?? 1);
        }
        for (const m of lanternMats) {
          m.opacity = 0.95 * nightBlend;
        }
        // The carved numbers, lighting as the child comes up to them.
        //
        // Proximity in X only. The stones stand on the far verge and the
        // child walks the near one, so their straight-line distance never
        // falls below about nine units — measure that and the number would
        // never reach full brightness. What matters is drawing LEVEL with
        // it, which is a question about x alone.
        if (milestoneGlow.length > 0) {
          const px = player?.wrap.position.x ?? 0;
          // HALFWAY IS WHEN IT CATCHES THE LIGHT, ARRIVING IS WHEN IT IS LIT.
          //
          // The distance was a fixed 8 units either side, which made the glow
          // a property of the stone rather than of the walk: on a short
          // passage the number was already burning at the start line, and on
          // a long one it stayed dark until the last few steps. Measured
          // against the stretch instead, it means the same thing every time —
          // nothing until the child is half way to the next stone, then a
          // steady climb, and full brightness as they draw level with it.
          //
          // BEHIND THEM IT GOES OUT IN HALF THAT AGAIN — the stone they have
          // just passed keeps its number readable for a quarter of the
          // stretch and is dark by the end of it. The number is what the
          // marker is for, so it does not blink out the moment they draw
          // level: they walk on past a stone that is still legible over their
          // shoulder, and it fades as they leave it.
          //
          // Both distances come off `runLen` rather than being fixed, because
          // a fixed 8 units made the glow a property of the stone instead of
          // the walk: on a short passage the number was already burning at
          // the start line, and on a long one it stayed dark until the last
          // few steps. Measured against the stretch it means the same thing
          // every time, whatever length the passage turns out to be.
          //
          // Twice as long coming as going, on purpose. A number you are
          // walking towards is an announcement and wants the approach; one
          // you have passed is a receipt, and lingering on it would have the
          // road behind lit as brightly as the road ahead.
          const half = Math.max(4, runLen / 2);
          for (const g of milestoneGlow) {
            const ahead = g.obj.matrixWorld.elements[12] - px;
            const near =
              ahead > 0
                ? 1 - Math.min(1, ahead / half)
                : 1 - Math.min(1, -ahead / (half / 2));
            // STEADY, not guttering. It was tied to the lamp's own flicker
            // for a while — same rate, same phase, on the argument that the
            // light falling on the number comes out of the niche above it.
            // It reads worse than it sounds: the carving is the one thing on
            // the road a child is trying to READ, and a number that breathes
            // while they are reading it is a number that will not sit still.
            // The flame above it still gutters; the figure it lights does not.
            //
            // Eased on approach, so it comes up as they walk rather than
            // switching on at a threshold.
            g.mat.emissiveIntensity = nightBlend * near * near * 1.5;
          }
        }
        // Oil lamps. Two waves at a ratio that does not resolve, so the
        // flame never finds a beat — a single sine reads as a pulse, which
        // is a machine rather than a flame, and it is the one thing that
        // gives a painted glow away.
        // Lend the cones to the nearest lamps — see `aimed`. Cheap: a few
        // dozen absolute differences and two matrix writes, against a road
        // that would otherwise be lit only at its very beginning.
        if (spotPool.length > 0 && aimed.length > 0) {
          const near = [...aimed].sort(
            (a, b) => Math.abs(a.x - playerX) - Math.abs(b.x - playerX),
          );
          for (let i = 0; i < spotPool.length; i++) {
            const spot = spotPool[i]!;
            const at = near[i];
            if (at == null) {
              spot.intensity = 0;
              continue;
            }
            spot.position.set(at.x, at.y, at.z);
            spot.target.position.copy(at.aim);
            spot.target.updateMatrixWorld();
            // Fades out as the lamp it is standing in leaves the frame, so a
            // cone moving from one lamp to the next is never seen to jump.
            const d = Math.abs(at.x - playerX);
            // Held at full for longer, and let go over a longer run, so the
            // pool is established well before the child walks into it.
            const fade = Math.max(0, 1 - Math.max(0, d - 16) / 14);
            // THE SAME FLAME THE SPRITE IS DRAWING.
            //
            // Two waves at a ratio that does not resolve, so the light never
            // finds a beat — a single sine reads as a pulse, and a pulse is
            // a machine rather than a flame. Dips only, never brighter than
            // its peak: what you see in a lamp is the flame guttering, not
            // the flame flaring. The numbers are the ones the sprite uses,
            // and the phase is this lamp's own, so the pool on the ground
            // and the flame in the niche move together — which is the whole
            // point, because they are one object.
            const n =
              Math.sin(t * at.rate + at.phase) * 0.62 +
              Math.sin(t * at.rate * 2.37 + at.phase * 1.7) * 0.38;
            const gutter = 1 - 0.3 * (0.5 - 0.5 * n);
            // 5.1, not 6.4. It is a wick in a stone niche lighting a stretch
            // of road, and at 6.4 -- twice what the child's own lamp carries,
            // over a range thirteen times longer -- it stopped being that and
            // became the only light in the frame, flattening everybody who
            // walked into it. Down a fifth: still reads the road, no longer
            // overrules the lamp in her hand.
            // 5.1, not 6.4: a wick in a stone niche lighting a stretch of
            // road, not the only light in the frame.
            spot.intensity = 5.1 * nightBlend * fade * gutter;
          }
        }
        for (const L of lamps) {
          const n =
            Math.sin(t * L.rate + L.phase) * 0.62 +
            Math.sin(t * L.rate * 2.37 + L.phase * 1.7) * 0.38;
          // Dips only, never brightens past its peak: a flame guttering is
          // what you see, not a flame flaring.
          const f = 1 - L.wick * 0.26 * (0.5 - 0.5 * n);
          L.mat.opacity = L.peak * nightBlend * f;
          if (L.light != null) {
            L.light.intensity = L.lightPeak * nightBlend * f;
          }
        }
        if (fireflies != null) {
          fireflies.mat.opacity = 0.9 * nightBlend;
          const pos = fireflies.points.geometry.getAttribute(
            "position",
          ) as THREE.BufferAttribute;
          for (let i = 0; i < fireflies.phase.length; i++) {
            const ph = fireflies.phase[i];
            pos.setX(i, fireflies.base[i * 3] + Math.sin(t * 0.35 + ph) * 2.6);
            pos.setY(
              i,
              fireflies.base[i * 3 + 1] +
                Math.sin(t * 0.8 + ph * 2) * 0.7 +
                Math.sin(t * 0.13 + ph) * 0.3,
            );
          }
          pos.needsUpdate = true;
        }
        for (const cluster of eyeClusters) {
          // The watch keeps pace with the lanterns: each knot holds its
          // offset from the hero and drifts lazily after them, always a beat
          // behind, never any closer to the trail than it was planted.
          const want = playerX + cluster.offsetX;
          cluster.x +=
            (want - cluster.x) * Math.min(1, dt * cluster.followRate);
          for (let i = 0; i < cluster.pairs.length; i++) {
            const pair = cluster.pairs[i];
            const w = Math.sin(t * pair.speed + pair.phase);
            const open = Math.max(0, w) ** 1.6;
            for (const m of pair.mats) {
              m.opacity = pair.baseO * open * nightBlend;
            }
            pair.group.position.x =
              cluster.x + i * 1.1 + Math.sin(t * 0.08 + pair.phase) * 0.6;
          }
        }
      }
    }

    if (player) {
      const p = player.wrap.position;
      framesSinceJump += 1;
      const dx = targetX - p.x;
      p.x += dx * 0.06;
      if (jumpFwdV > 0) {
        // Only while there is trail to cover. A jump on the spot must stay on
        // the spot: nudging x would make the next frame see a gap between the
        // character and its target, which is the same signal running uses, so
        // a plain space press at a standstill played a stride and a half of
        // walking under the hop. Standing still, space is a jump and nothing
        // else.
        if (Math.abs(dx) > 0.08) {
          p.x += jumpFwdV;
        }
        jumpFwdV = Math.max(0, jumpFwdV - 0.0016);
      }
      playerX = p.x;
      jumpY = Math.max(0, jumpY + jumpV);
      jumpV -= 0.03;
      // STAND ON THE ROAD, NOT ON THE FIELD BESIDE IT.
      //
      // `groundY` is the trail's height and takes no z at all — it is the
      // height of the FIELD. Village Road then sinks its road up to 0.22
      // below that (ROAD_SINK; a cart road worn down by use, which is a thing
      // this world deliberately has), so a character placed at groundY stands
      // that far above the surface they are walking on. On the puppy, all of
      // 1.5 units tall, 0.22 is a seventh of the animal: it floated.
      //
      // `terrainY` is the same function the ground MESH is built from, so
      // this is the height of the ground actually under their feet, ruts and
      // all.
      p.y = terrainY(p.x, p.z) + jumpY - restLift();
      // Just above and in front of the runner — unless they are passing a
      // milestone, in which case the light is coming out of its niche and
      // the lamp slides over to it. See `lampFrom`.
      const lit = lampFrom(TMP_HERO.set(p.x + 0.9, p.y + 2.1, p.z + 1.6), p);
      heroLamp.position.copy(TMP_HERO);
      // SQUARED, so the flame gets there first.
      //
      // The niche and its pool on the ground come up linearly with the blend;
      // the light on the cast comes up behind them. Half way through the
      // fade the lamp is already burning at half and the road is only a
      // quarter lit, which is the order it happens in — somebody lights a
      // lamp, and then there is light.
      // NOT SQUARED ANY MORE, once the milestone is involved.
      //
      // The square was there so the niche flame arrives before the light on
      // the cast -- somebody lights a lamp, and THEN there is light -- and
      // that reading is right at the moment it is lit. It is wrong for the
      // rest of the time: at dusk, nightBlend 0.7 gave the child's lamp 0.49
      // while the niche got the full 0.7, so the one light meant to show her
      // face was the one being held back. The square now applies only to the
      // part of the lamp that is NOT the milestone lift.
      // The square is kept for the lamp's own light -- the niche flame should
      // arrive before the light on the cast -- but NOT for the milestone
      // lift. At dusk (0.7) the squared term gave her lamp 0.49 while the
      // niche got the full 0.7, holding back the one light meant to show her.
      heroLamp.intensity =
        heroLampBase * (nightBlend * nightBlend + lit * LAMP_LIFT * nightBlend);
      // 5.2 to match the lamp as it is BUILT. This line is evaluated every
      // frame and used to rebuild the range from a hardcoded 3.4, quietly
      // overriding the constructor -- so raising the reach there did nothing
      // at all until this agreed with it. A 4.7-unit child needs more than
      // 3.4 of range before the light reaches her head.
      // 5.2 to match the lamp as it is BUILT. This line runs every frame and
      // rebuilt the range from a hardcoded 3.4, quietly overriding the
      // constructor -- so raising the reach there did nothing until this
      // agreed with it.
      heroLamp.distance = 5.2 + lit * LAMP_REACH;
      // Amber as it arrives, so she is lit by the same fire as the road she
      // is standing on — see `LAMP_AMBER`.
      heroLamp.color.copy(LAMP_WHITE).lerp(LAMP_AMBER, lit * 0.85);
      // The skeleton hero still runs on its feet, but with a faint hover and
      // bob so it reads as a little spooky — not fully floating.
      if (playerGhostly) {
        p.y += 0.12 + Math.sin(clock.elapsedTime * 2.2) * 0.08;
      }
      if (jumpY > 0.05) {
        wasAirborne = true;
      } else if (wasAirborne) {
        wasAirborne = false; // touchdown — kick up a puff of dust
        // Back on the ground, jumps refresh — but not while the double-tap
        // window is still open, or landing early would cancel the leap the
        // second press was about to make.
        if (framesSinceJump > DOUBLE_TAP_FRAMES) {
          jumpCount = 0;
        }
        dust(p.x, p.y + 0.04, p.z);
      }
      const moving = Math.abs(dx) > 0.08;
      if (moving) {
        beckonT = 0;
      }
      // FOOTFALL DUST, on the unmade road only.
      //
      // A dusty laterite road is the reason this exists: feet raise dust off
      // dry earth and raise nothing off flagstones, so it is keyed to the road
      // surface rather than to the world - if a future land here is paved, it
      // stops by itself.
      //
      // Paced by DISTANCE rather than by time, so it lands on strides instead
      // of drifting out of step when the child types faster. One puff per
      // stride walking, two running, and running strides are shorter - which
      // is the whole difference between "a bit of dust" and "kicking it up"
      // without needing a second effect.
      if (dustyRoad && jumpY < 0.05) {
        footDust += Math.abs(dx);
        const running = runShare > 0.5;
        if (moving && footDust > (running ? 0.5 : 0.95)) {
          footDust = 0;
          dust(p.x - 0.12, p.y + 0.03, p.z, running ? 2 : 1);
        }
      }
      if (player.run && player.idle) {
        // Legs move when moving (skeleton included) — the ghostly feel comes
        // from the faint hover above, not from stiff gliding.
        //
        // Two independent blends: `moveW` is how much of the character is in
        // motion at all, and `runShare` splits that motion between the two
        // gaits. Keeping them separate is what lets the gait change mid-stride
        // without the character stopping first.
        moveW += ((moving ? 1 : 0) - moveW) * 0.12;
        if (player.walk) {
          // Hysteresis: start running at RUN_WPM, drop back below WALK_WPM.
          if (paceWpm >= RUN_WPM) {
            runShare += (1 - runShare) * 0.06;
          } else if (paceWpm < WALK_WPM) {
            runShare += (0 - runShare) * 0.06;
          }
          player.walk.weight = moveW * (1 - runShare);
        } else {
          // One move clip: it is the run, and it carries all the motion.
          runShare = 1;
        }
        player.run.weight = moveW * runShare;
        player.idle.weight = 1 - moveW;
      }

      // ── the companion ─────────────────────────────────────────────────
      //
      // Recorded every frame whether or not anyone is following, so that
      // switching a friend on mid-lesson does not start them from a standstill
      // while the player is already running.
      followBuffer.push({
        x: p.x,
        y: p.y,
        moveW,
        runShare,
        celebrating: celebT > 0,
        resting:
          restStage === "crouchDown" ||
          restStage === "crouchIdle" ||
          restStage === "sitDown" ||
          restStage === "sitIdle" ||
          restStage === "upToSit",
      });
      if (followBuffer.length > FOLLOW_FRAMES + 2) {
        followBuffer.shift();
      }
      // ONE LAMP OVER THE WHOLE GROUP, not one per person.
      //
      // Everybody walking with the child has to be lit — a companion standing
      // in the dark beside somebody carrying a lantern is a piece of scenery,
      // and that is as true of the second one as of the first. But a lamp
      // each is a light each, in a scene with a hard budget of eight, so this
      // is hung over the CENTRE of the group instead: they walk about two
      // units apart and the lamp reaches three and a half, so one pool covers
      // the pair with light to spare.
      let lampAtX = 0;
      let lampAtY = 0;
      let lampAtZ = 0;
      const guideAdvance =
        guidePrevPlayerX == null ? 0 : playerX - guidePrevPlayerX;
      guidePrevPlayerX = playerX;
      // Make room for the guide, or take it back, before anybody is placed.
      {
        const want = guideInTheirSpace() ? 1 : 0;
        companionRoom += (want - companionRoom) * Math.min(1, dt * 1.2);
        respaceCompanions();
      }
      for (const follower of followers) {
        if (follower.guide) {
          guideGap(follower, dt, guideAdvance, moveW > 0.25);
        }
        // ONE BODY, RUN ONCE PER FOLLOWER.
        //
        // Everything below was written for a single companion and is correct
        // as it stands; what changes per follower is only WHICH rig it is
        // driving, how far back it walks and which z it holds. So those are
        // bound here under the names the body already uses, and the body is
        // left exactly as it was — a five-hundred-line block rewritten to
        // thread a parameter through it is a five-hundred-line block full of
        // new mistakes.
        const companion = follower.rig;
        const FOLLOW_GAP = follower.gap;
        const SIDE = follower.z - LANE;
        let companionLastX = follower.lastX;
        let companionDust = follower.dust;
        let companionCelebrating = follower.celebrating;
        // Bound under the names the body already uses, and written back at
        // the end — see freshFollowState for why these cannot be shared.
        let lookTarget = follower.s.lookTarget;
        let lookHold = follower.s.lookHold;
        let compFidget = follower.s.compFidget;
        let compFidgetT = follower.s.compFidgetT;
        let compFidgetCool = follower.s.compFidgetCool;
        let wagT = follower.s.wagT;
        let wagCool = follower.s.wagCool;
        let wagW = follower.s.wagW;
        let dogAct = follower.s.dogAct;
        let dogSettleAt = follower.s.dogSettleAt;
        let dogT = follower.s.dogT;
        let dogRested = follower.s.dogRested;
        let dogSettled = follower.s.dogSettled;
        let dogW = follower.s.dogW;
        let dogOffX = follower.s.dogOffX;
        let dogOffZ = follower.s.dogOffZ;
        let dogWander = follower.s.dogWander;
        let dogGap = follower.s.dogGap;
        let dogOrbit = follower.s.dogOrbit;
        let dogOrbitDir = follower.s.dogOrbitDir;
        let dogLead = follower.s.dogLead;
        let dogTravel = follower.s.dogTravel;
        let dogLeadTarget = follower.s.dogLeadTarget;
        let dogNextRun = follower.s.dogNextRun;
        let dogPrevSeenX = follower.s.dogPrevSeenX;
        let dogTurn = follower.s.dogTurn;
        let dogTurnT = follower.s.dogTurnT;
        let idleAlt = follower.s.idleAlt;
        let idleFade = follower.s.idleFade;
        let idleNext = follower.s.idleNext;
        let turnBy = follower.s.turnBy;
        let turnSpin = follower.s.turnSpin;
        let turnSpun = follower.s.turnSpun;
        let turnSpinT = follower.s.turnSpinT;
        let turnSpinDur = follower.s.turnSpinDur;
        let guideLookBack = follower.s.guideLookBack;
        let guideEverMoved = follower.s.guideEverMoved;
        let sitAct = follower.s.sitAct;
        let sitPhase = follower.s.sitPhase;
        let sitT = follower.s.sitT;
        const guideRest = follower.s.guideRest;
        let dogAhead = follower.s.dogAhead;
        let dogSpeed = follower.s.dogSpeed;
        let dogPrevX = follower.s.dogPrevX;
        let dogPrevZ = follower.s.dogPrevZ;
        // The oldest entry we have, which is FOLLOW_FRAMES back once the
        // buffer has filled and simply the earliest before that — so a
        // freshly-added companion falls in beside the player rather than
        // teleporting to where they were half a second ago.
        const seen = followBuffer[0]!;
        const cw = companion.wrap;

        // ── it moves only when you do, and looks around when you stop ───
        //
        // The walking of its own is gone, and this is why.
        //
        // It had its own legs for a while: it aimed at a spot near the player
        // and travelled there at its own speed, so the two would not move in
        // lockstep. That worked, and traded the problem for a worse one. The
        // player advances in bursts — a keystroke at a time, stopping between
        // them — so a companion chasing a goal that drifts with them is always
        // mid-journey and never arrives. It walked without pause. Tuning the
        // speeds, the distances and the rests only moved the symptom, because
        // the cause was that it had a destination of its own at all.
        //
        // Position and gait are the player's again, a beat late. When the
        // player stops, the sample says stopped and it stops — not because
        // something decided to, but because there is nothing else it can do.
        //
        // The variety that was lost comes back as turning rather than
        // travelling. Standing and looking about needs no walk cycle, so it
        // cannot slide, cannot cycle its legs on the spot, and cannot end up
        // anywhere it should not be. A child waiting for a friend looks
        // around; it does not pace.
        // The replay decides where the companion belongs; `dogOff*` is the
        // few steps it has taken off that spot while the child sits, and it
        // eases back to nothing when they move. Added here rather than
        // written into the replay so the replay stays the one truth about
        // where the pair are on the trail.
        cw.position.x = seen.x - FOLLOW_GAP + dogOffX + dogAhead;
        // The guide keeps his own side -- see `setGuide`. Without this the
        // line below put every follower, him included, on the companions'
        // side at their FULL offset, quietly overriding the half-offset he
        // was spawned on.
        cw.position.z = follower.guide
          ? LANE - SIDE * 1.1 + dogOffZ
          : LANE + SIDE + dogOffZ;
        // Same as the player: the ground under IT, which is not the same
        // height as the ground under them once it has pottered off to one
        // side of the lane — and minus the same gait lift, or the companion
        // floats exactly as the hero did. On the puppy this matters most:
        // planted on the reach of its own run, a dog 1.5 units tall stands
        // visibly off the road whenever it is not running.
        {
          const l = companion.lifts;
          const moving = l.walk * (1 - seen.runShare) + l.run * seen.runShare;
          const lift = l.idle * (1 - seen.moveW) + moving * seen.moveW;
          // AND BEDDED IN, at least the 0.06 every prop gets from `surfaceY`.
          //
          // Characters read the terrain directly and so sit exactly ON it,
          // while every stone and plant around them is sunk slightly into
          // it. On a child that difference is nothing; on a dog it reads as
          // the animal hovering just clear of the road it is walking on. A
          // light animal on soft mud should sit into it, not perch on top.
          //
          // A QUADRUPED NEEDS MORE OF IT THAN A CHILD DOES, for two reasons.
          // Its contact patches are four paws rather than two shoes, so each
          // one is small and a gap under it is easy to see against the road
          // behind. And the dog has since grown from 1.5 units to 1.9, so a
          // flat 0.06 is a smaller share of it than when that number was
          // chosen -- it was four per cent of the animal and is now three.
          const bed = companion.quadruped ? 0.13 : 0.06;
          cw.position.y = terrainY(cw.position.x, cw.position.z) - lift - bed;
        }
        // How far it travelled this frame, for next frame's gait. One frame
        // of lag, which at sixty a second is invisible, and it means the legs
        // can never disagree with the ground going past them.
        {
          const dxm = cw.position.x - dogPrevX;
          const dzm = cw.position.z - dogPrevZ;
          dogPrevX = cw.position.x;
          dogPrevZ = cw.position.z;
          const inst = dt > 1e-4 ? Math.hypot(dxm, dzm) / dt : 0;
          // Eased, or a single long frame reads as a sprint.
          dogSpeed += (inst - dogSpeed) * Math.min(1, dt * 12);
        }
        // ── ON AHEAD, THEN WAITING ────────────────────────────────────
        //
        // A dog does not walk to heel. It goes on in front, stops, and looks
        // back to see whether you are coming — and this is the one part of
        // the companion that is allowed off the replay.
        //
        // "Waiting" needs no position code of its own: the dog holds its
        // ground while the replayed trail advances underneath it, so the lead
        // shrinks by exactly the distance the child covers, and reaches zero
        // at the moment they draw level. That is also what makes it read as
        // waiting for THEM rather than counting to a number.
        if (companion.quadruped) {
          const advanceX = dogPrevSeenX == null ? 0 : seen.x - dogPrevSeenX;
          dogPrevSeenX = seen.x;
          const onTheMove = seen.moveW > 0.25;
          if (!onTheMove) {
            // They have stopped. Whatever it was doing, it comes back — a dog
            // that stays out in front of a child who has sat down has lost
            // interest in them, which is the opposite of the point.
            dogTravel = "heel";
            dogLead -= dogLead * Math.min(1, dt * 1.5);
          } else if (dogTravel === "heel") {
            dogLead -= dogLead * Math.min(1, dt * 1.2);
            dogNextRun -= dt;
            if (dogNextRun <= 0) {
              dogTravel = "ahead";
              dogLeadTarget = 3.5 + Math.random() * 3.5;
            }
          } else if (dogTravel === "ahead") {
            // Faster than the child, which is what makes it a dash rather
            // than a drift.
            dogLead += dt * 3.2;
            if (dogLead >= dogLeadTarget) {
              dogTravel = "wait";
              // Turns on the spot to look back for them. Left or right at
              // random, because a dog that always spins the same way is a
              // turntable.
              const t =
                Math.random() < 0.5
                  ? companion.settle.turnLeft
                  : companion.settle.turnRight;
              if (t != null) {
                t.reset();
                t.play();
                dogTurn = t;
                dogTurnT = t.getClip().duration;
              }
            }
          } else {
            // Waiting: holding station while the trail comes to it.
            dogLead -= advanceX;
            if (dogLead <= 0.5) {
              dogTravel = "heel";
              dogNextRun = dogWait(12 + Math.random() * 22);
            }
          }
          dogAhead = Math.max(0, dogLead);
          if (dogTurn != null) {
            dogTurnT -= dt;
            if (dogTurnT <= 0) {
              dogTurn.stop();
              dogTurn = null;
            }
          }
        }
        if (companion.run && companion.idle) {
          // THE GAIT COMES FROM HOW FAR IT ACTUALLY MOVED.
          //
          // Taking it from the replay alone was what made the dog slide: the
          // replay describes the CHILD, and this animal now leaves that path
          // — it runs ahead, it waits while the trail comes to it, it potters
          // in a circle while they rest, and its lead eases away when they
          // stop. In every one of those the position changes and the replay
          // says "standing", so the feet stood still while the dog travelled.
          //
          // Measured displacement cannot disagree with itself. Whatever moves
          // the animal — lead, orbit, decay, or the replay — shows up here as
          // speed, and the legs answer it.
          const ownMove = Math.max(seen.moveW, Math.min(1, dogSpeed / 1.9));
          const ownRun = dogTravel === "ahead" ? 1 : seen.runShare;
          if (companion.walk) {
            companion.walk.weight = ownMove * (1 - ownRun);
          }
          companion.run.weight = ownMove * ownRun;
          companion.idle.weight = 1 - ownMove;
          // Reset here, so the two blocks below (gesture, tail) can each
          // claim the body by simply setting their own weight. Without this
          // a wag that ended still holds its last frame at full weight.
          if (companion.wag != null && wagT <= 0) companion.wag.weight = 0;
        }

        // ── the guide, sat at the roadside ─────────────────────────────
        //
        // "He breaks into a run, gets a good way up the road, and sits down
        // at the edge of the road on their side to wait. When they catch up
        // he gets up and falls back in."
        //
        // Laid OVER the weights above rather than before them, for the same
        // reason the fidget is: that block reassigns walk/run/idle every
        // frame from measured movement, and a sitting boy measures as
        // standing still — so without claiming the body here he would sit
        // and stand in the same instant, every frame.
        if (follower.guide) {
          const R = companion.rest;
          // FACING THEM FIRST. He has stopped for this child, so he waits
          // looking at them rather than at the road -- and he turns before he
          // goes down, not after. Sitting first and rotating afterwards spins
          // him on his backside, and the turn clip and the sit both claim the
          // whole body, so they cannot run together anyway.
          const faceChild = follower.gap < 0 ? Math.PI * 1.5 : Math.PI / 2;
          let toChild = faceChild - cw.rotation.y;
          while (toChild > Math.PI) toChild -= Math.PI * 2;
          while (toChild < -Math.PI) toChild += Math.PI * 2;
          if (
            sitPhase === "none" &&
            dogTravel === "guideWait" &&
            // NOT WHILE THEY ARE COMING.
            //
            // He now holds `guideWait` after standing up, so that he keeps
            // the ground he walked to rather than sliding back -- but that
            // left this condition still true the frame after he stood, and
            // it sat him straight back down. From outside, a guide who never
            // got up at all. He may only sit while the child is still.
            seen.moveW < 0.2 &&
            (!guideRest || Math.abs(toChild) < 0.35)
          ) {
            const a = R.sitDown ?? R.sitIdle;
            if (a != null) {
              a.reset();
              a.setLoop(THREE.LoopOnce, 1);
              a.clampWhenFinished = true;
              a.play();
              sitAct = a;
              sitPhase = "down";
              sitT = a.getClip().duration;
            }
          } else if (sitPhase === "down") {
            sitT -= dt;
            if (sitT <= 0) {
              // Hold the sit. If he has no held pose the last frame of the
              // descent is already clamped, which is the same picture.
              if (R.sitIdle != null) {
                R.sitIdle.reset();
                R.sitIdle.setLoop(THREE.LoopRepeat, Infinity);
                R.sitIdle.play();
                sitAct?.stop();
                sitAct = R.sitIdle;
              }
              sitPhase = "sat";
            }
          } else if (sitPhase === "sat") {
            // UP THE INSTANT THEY TYPE, and off the LIVE movement.
            //
            // `seen` is the follow buffer — where the child was, some frames
            // ago — and that is the right thing for anybody walking BEHIND
            // them, which is what it was written for. The guide waits AHEAD.
            // There is no future in a buffer of the past, so the sample he
            // reads while holding station is not the child starting to move;
            // he stayed sitting until his travel state changed, which only
            // happens once they have walked all the way up to him. So he sat
            // there while they came, which is the opposite of a guide.
            //
            // `moveW` is the player's own, this frame. Everything else about
            // him still keys off the buffer — only standing up had to be
            // immediate, because it is a reaction to them rather than a thing
            // he does in their footsteps.
            if (dogTravel !== "guideWait" || moveW > 0.2) {
              const a = R.standFromSit;
              if (a != null) {
                a.reset();
                a.setLoop(THREE.LoopOnce, 1);
                a.clampWhenFinished = true;
                a.play();
                sitAct?.stop();
                sitAct = a;
                sitPhase = "up";
                sitT = a.getClip().duration;
              } else {
                sitAct?.stop();
                sitAct = null;
                sitPhase = "none";
              }
            }
          } else if (sitPhase === "up") {
            sitT -= dt;
            if (sitT <= 0) {
              sitAct?.stop();
              sitAct = null;
              sitPhase = "none";
            }
          }
          if (sitAct != null) {
            sitAct.weight = 1;
            if (companion.idle) companion.idle.weight = 0;
            if (companion.walk) companion.walk.weight = 0;
            if (companion.run) companion.run.weight = 0;
          }
        }

        // ── a companion with something to do while you are sat down ──
        //
        // The player resting is the longest the companion ever stands
        // still, and turning its head is all it had. A character that
        // ships standing gestures can use them here — the one place where
        // there is time for a whole gesture and nothing competing for the
        // body.
        //
        // Written after the weights above on purpose: that block reassigns
        // idle every frame from the player's sampled movement, so a
        // gesture has to be laid over the top of it rather than before.
        if (compFidgetT > 0) {
          compFidgetT -= dt;
          if (compFidgetT <= 0 && compFidget != null) {
            compFidget.stop();
            compFidget = null;
          } else if (compFidget != null && companion.idle) {
            compFidget.weight = 1;
            companion.idle.weight = 0;
          }
        } else if (
          seen.resting &&
          companion.fidget.length > 0 &&
          companion.idle
        ) {
          compFidgetCool -= dt;
          if (compFidgetCool <= 0) {
            const f =
              companion.fidget[
                Math.floor(Math.random() * companion.fidget.length)
              ]!;
            f.reset();
            f.play();
            compFidget = f;
            compFidgetT = f.getClip().duration;
            // Long and uneven, so two companions never fall into step and
            // one child never sees the same beat on a rhythm.
            compFidgetCool = 6 + Math.random() * 10;
          }
        } else {
          // Back on their feet: forget the countdown so the next rest does
          // not open with a gesture already half-owed.
          compFidgetCool = Math.max(compFidgetCool, 3);
        }

        // ── the dog's own life ────────────────────────────────────────
        //
        // Runs BEFORE the tail, and takes precedence over it: a dog that is
        // mid-bow is not also wagging on the same bones, and the wag block
        // below stands down while `dogW` is up.
        const dogAlive =
          companion.quadruped &&
          companion.idle != null &&
          (companion.tricks.length > 0 || companion.settle.lie != null);
        if (dogAlive) {
          const still = seen.moveW < 0.15;
          const down = still && seen.resting;
          if (!down) {
            // Up and moving: everything unwinds. The dog does not finish its
            // nap because it was halfway through one.
            dogRested = 0;
            dogSettled = -1;
            dogSettleAt = 75 + Math.random() * 30;
            dogT = 0;
            dogGap = 0;
            dogWander = 0;
          } else {
            dogRested += dt;
            // SETTLING IS AN INTERLUDE, NOT THE DESTINATION.
            //
            // It used to take over at eighteen seconds and never let go, so
            // a child who sat for two minutes watched their dog lie down
            // after eighteen of them and do nothing else for the rest — the
            // tail was the only thing still moving, which is exactly how it
            // looked. Pottering IS the behaviour; lying down is one of the
            // things a pottering dog occasionally does.
            //
            // So: over a minute of sniffing and stretching first, and the
            // pose itself is timed rather than held (see `dogT` below), after
            // which it gets up and carries on. Sleep is kept for a genuinely
            // long sit, where a dog really would be out.
            const wantStage =
              dogRested > 150 ? 1 : dogRested > dogSettleAt ? 0 : -1;
            if (wantStage > dogSettled) {
              dogSettled = wantStage;
              const next =
                wantStage === 1
                  ? (companion.settle.sleep ?? companion.settle.lie)
                  : companion.settle.lie;
              if (next != null) {
                if (dogAct != null && dogAct !== next) dogAct.stop();
                next.reset();
                next.play();
                dogAct = next;
                // TIMED, not held. Sleep still runs until they get up -- a
                // dog that wakes itself every half minute is not asleep --
                // but lying down is a rest the animal takes and then leaves,
                // so it runs half a minute to a minute and hands back to the
                // pottering above.
                dogT = wantStage === 1 ? 9e9 : 30 + Math.random() * 30;
                dogGap = 0;
                dogWander = 0;
              }
            } else if (dogSettled === 0) {
              // LYING DOWN, AND GETTING UP AGAIN.
              //
              // Without this the dog was stuck: with the stage reached and
              // nothing left wanting a higher one, neither branch ran, so the
              // timer never ticked and the pose held whatever it was set to.
              // Here the rest runs out and the animal goes back to pottering,
              // with the next lie-down pushed well forward so it cannot drop
              // straight back down again.
              dogT -= dt;
              if (dogT <= 0) {
                if (dogAct != null) {
                  dogAct.stop();
                  dogAct = null;
                }
                dogSettled = -1;
                dogSettleAt = dogRested + 60 + Math.random() * 40;
                dogT = 0;
                dogGap = 1.5 + Math.random() * 2;
              }
            } else if (dogSettled < 0) {
              // Pottering. The CLIP and the PAUSE are two different clocks,
              // and conflating them is what froze the animal: `dogT` used to
              // run for the clip's length plus several seconds of gap, while
              // the blend keyed off `dogT` — so a one-shot that had finished
              // sat clamped on its last frame, with the idle held at zero,
              // for up to five seconds. From outside that is a dog whose
              // animations have stopped.
              //
              // Now `dogT` is exactly the clip and `dogGap` is the wait after
              // it, during which the dog goes back to its idle like anything
              // else standing about.
              if (dogT > 0) {
                dogT -= dt;
              } else if (dogGap > 0) {
                dogGap -= dt;
              } else if (companion.tricks.length > 0) {
                const total = companion.tricks.reduce(
                  (a, t) => a + t.weight,
                  0,
                );
                let r = Math.random() * total;
                let pickT = companion.tricks[0]!;
                for (const t of companion.tricks) {
                  r -= t.weight;
                  if (r <= 0) {
                    pickT = t;
                    break;
                  }
                }
                // One in three is a potter instead of a trick: no clip at
                // all, just a few steps round them, with the walk cycle
                // coming from the measured speed below.
                if (Math.random() < 0.34) {
                  dogWander = 1.6 + Math.random() * 1.8;
                  dogOrbitDir = Math.random() < 0.5 ? -1 : 1;
                  dogGap = dogWander + 0.8 + Math.random() * 2;
                } else {
                  if (dogAct != null && dogAct !== pickT.action) dogAct.stop();
                  pickT.action.reset();
                  pickT.action.play();
                  dogAct = pickT.action;
                  dogT = pickT.action.getClip().duration;
                  dogGap = 1.2 + Math.random() * 3.5;
                }
              } else {
                dogGap = 2 + Math.random() * 3;
              }
            }
          }
          // The blend. Eased like the wag, and for the same reason: these are
          // full-body clips, and cutting to one moves the whole animal on a
          // single frame.
          const wantW = down && dogAct != null && dogT > 0 ? 1 : 0;
          dogW += (wantW - dogW) * Math.min(1, dt * 5);
          if (dogW < 0.002) {
            dogW = 0;
            if (dogAct != null && wantW === 0) {
              dogAct.stop();
              dogAct = null;
            }
          }
          if (dogAct != null) {
            dogAct.weight = dogW;
          }
          if (dogW > 0 && companion.idle != null) {
            companion.idle.weight = 1 - dogW;
          }
          // POTTERING. The companion's position is a replay of the child's
          // path, so it cannot simply be walked somewhere — this rides on top
          // as an offset and eases back to nothing the moment they set off
          // again, which is what keeps the replay the single source of truth.
          if (dogWander > 0) {
            dogWander -= dt;
            // AROUND the child, not at random. A dog circles somebody it is
            // waiting for; a random walk reads as drift. The orbit is wider
            // than it is deep because the road is, and it is slow enough to
            // be a potter rather than a lap.
            dogOrbit += dt * 0.55 * dogOrbitDir;
            dogOffX = Math.cos(dogOrbit) * 1.9 - 1.9;
            dogOffZ = Math.sin(dogOrbit) * 1.1;
          } else {
            const back = Math.min(1, dt * (down ? 0.8 : 3));
            dogOffX -= dogOffX * back;
            dogOffZ -= dogOffZ * back;
          }
        }

        // ── the tail ──────────────────────────────────────────────────
        //
        // Only while it is standing with them, never mid-run: a wag is
        // something a dog does AT somebody, and the companion is only
        // really with the child when neither is moving.
        if (companion.wag != null && companion.idle && dogW < 0.05) {
          const still = seen.moveW < 0.15;
          // Down on the ground with them, the tail does not stop.
          //
          // `resting` is the child crouched or sat cross-legged — the moment
          // they are at the dog's own height rather than walking above it,
          // and a dog is simply pleased about that for as long as it lasts.
          // The random bursts below are for the other kind of stillness:
          // standing about, waiting to get going again.
          // Where the wag WANTS to be this frame; the blend follows it.
          let wagWant = 0;
          const running = companion.wag.isRunning();
          if (still && seen.resting) {
            if (wagT <= 0) {
              companion.wag.reset();
              companion.wag.play();
            }
            // Topped up rather than set once, so standing up ends it by
            // letting this run out — a tail that stops dead the frame they
            // move is a tail that was switched off, not one that settled.
            wagT = Math.max(wagT, 0.6);
            wagWant = 1;
          } else if (wagT > 0) {
            wagT -= dt;
            wagWant = still ? 1 : 0;
          } else if (still && !running) {
            // Between bursts. Counted down only when nothing is wagging, so
            // the gap is a gap and not a clock running under the tail.
            wagCool -= dt;
            if (wagCool <= 0) {
              // Short bursts are the common case — two or three sweeps —
              // and a proper delighted one now and then.
              wagT =
                Math.random() < 0.65
                  ? 1.2 + Math.random() * 1.8
                  : 4 + Math.random() * 6;
              companion.wag.reset();
              companion.wag.play();
            }
          }
          // EASED BOTH WAYS. The clip keys the front legs and ears as well as
          // the tail, so cutting to it at full weight moved the whole front of
          // the dog on one frame. The idle takes exactly what the wag does
          // not, so the two always sum to one and the dog is never partly
          // posed by nothing.
          wagW += (wagWant - wagW) * Math.min(1, dt * 6);
          if (wagW < 0.002) {
            wagW = 0;
          }
          companion.wag.weight = wagW;
          if (wagW > 0) {
            companion.idle.weight = 1 - wagW;
          }
          // Stopped only once the burst is over AND it has faded out, or the
          // last frame of the tail would vanish mid-sweep.
          if (wagT <= 0 && wagW === 0 && running) {
            companion.wag.stop();
            // Long gaps, and sometimes very long ones. Without the second
            // roll every silence is about the same length, which is its own
            // kind of metronome.
            wagCool =
              5 +
              Math.random() * 12 +
              (Math.random() < 0.3 ? 10 + Math.random() * 14 : 0);
          }
        }

        // Where it is looking: down the trail while the player is on the move,
        // since a companion facing the wrong way mid-walk looks lost, and off
        // at something of its own once they are down.
        // THE GUIDE LOOKS BACK AT THEM, and he does it whenever he is ahead —
        // not only while they rest, and not to a random angle.
        //
        // The look-around below is gated on `seen.resting`, so as written the
        // turn clips could only ever fire during a pause; walking three units
        // up the road he never turned at all, which is why they were invisible.
        // And a guide who is showing somebody the way looks back to check they
        // are still coming. That is his whole job, and the script leans on it
        // — "{guide} waves from further up the road", "{guide} is waiting up
        // ahead".
        //
        // Facing BACK is a half turn, which is two of his quarter-turn clips.
        // They chain by themselves: the block below re-tests every frame, so
        // when the first finishes and there is still more than half a right
        // angle to go, it starts the second.
        // ONLY WHEN THEY HAVE STOPPED. This block rotates the whole wrap, not
        // just the head, so turning him round while the group is still moving
        // left him walking backwards up the road — the locomotion clip plays
        // forward whichever way he happens to face. Stopped, it reads as what
        // it is: he has got ahead and turned to see if they are coming.
        // Latched once and never cleared: the point is whether this child has
        // EVER set off, not whether they are moving right now.
        if (seen.moveW > 0.2) {
          guideEverMoved = true;
        }
        if (
          follower.guide &&
          (sitPhase !== "none" || (dogTravel === "guideWait" && guideRest))
        ) {
          // Sat, going down, or getting up: he is looking at them the whole
          // way through, so he never swings round mid-pose.
          lookTarget = follower.gap < 0 ? Math.PI * 1.5 : Math.PI / 2;
          lookHold = 0;
        } else if (follower.guide && follower.gap < -1.2 && seen.moveW < 0.2) {
          // NOT BEFORE THEY HAVE EVER STARTED.
          //
          //
          // The timer ran from the moment he spawned, so on a fresh load he
          // turned round to check on a child who had not yet typed a key --
          // three to eight seconds in, which is about when the loading screen
          // clears. Looking back is something you do at somebody who is
          // coming, and nobody is coming yet.
          if (guideEverMoved) {
            guideLookBack -= dt;
          }
          if (guideLookBack <= 0) {
            const back = cw.rotation.y < Math.PI ? Math.PI * 1.5 : Math.PI / 2;
            lookTarget = back;
            // Held long enough to be a look rather than a scan, then he faces
            // front again and walks on.
            guideLookBack = 6 + Math.random() * 8;
            lookHold = 0;
          }
        } else if (
          // WHENEVER THEY HAVE STOPPED, not only during the rest chain.
          //
          // Gated on `seen.resting` alone this only ran while the child was
          // crouched or sat cross-legged, and every other kind of standing
          // still fell through to the `else` below -- which pins the facing
          // down the trail, i.e. back to the camera. That is why the robot
          // stood showing its back: not a broken look-around, an unreachable
          // one.
          (seen.resting || seen.moveW < 0.15) &&
          !companion.quadruped &&
          !follower.guide
        ) {
          if (lookHold > 0) {
            lookHold -= 1;
          } else {
            // Side first, then how far — rather than one uniform draw
            // across the whole arc.
            //
            // The old draw was symmetric on paper and did not look it. Half
            // of a uniform spread lands near the middle, where the turn is
            // too small to see, so the only turns a child actually noticed
            // were the big ones at the edges — and which edge that happened
            // to be over a few pauses is what reads as "it always goes the
            // same way". Choosing the side explicitly and giving every look
            // a floor means each one is a real turn, and the two directions
            // come up equally often rather than merely on average.
            //
            // PURELY RANDOM, both ways, every time.
            //
            // This used to pick the side from where it was already facing --
            // left of centre had to go right, right of centre had to go left
            // -- on the reasoning that turning the same way twice is a twitch
            // rather than a look. In practice that is not randomness, it is a
            // metronome: left, right, left, right, for as long as you watch.
            // A coin each time does occasionally repeat a side, and that is
            // exactly what makes the next turn unguessable.
            const side = Math.random() < 0.5 ? -1 : 1;
            lookTarget =
              Math.PI / 2 +
              side * (0.35 + Math.random() * 0.65) * (Math.PI * 0.75);
            // AND IT TAKES ITS TIME. Four to fourteen seconds on one heading,
            // where it used to be one and a half to six. Something that turns
            // every couple of seconds is scanning the road for threats; one
            // that settles and stays has simply found something to look at.
            lookHold = 240 + Math.floor(Math.random() * 600);
          }
        } else {
          // Facing down the trail, always, for a dog: it has a tail for
          // saying things, and the wag above is doing that job.
          lookTarget = Math.PI / 2;
          lookHold = 0;
        }
        let turn = lookTarget - cw.rotation.y;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        if (follower.guide && companion.settle.turnLeft != null) {
          // A GUIDE TURNS ON HIS FEET.
          //
          // The lerp below spins the wrap with no stepping underneath it,
          // which is a glide — and it is the most visible thing he does,
          // because he is the one character who is regularly facing back down
          // the road at the child.
          //
          // His turn clips bake the rotation into the HIPS, so the two must
          // never run at once: while a clip plays the wrap holds absolutely
          // still, and when it finishes the wrap takes over the quarter-turn
          // the clip was holding. Rotating both would turn him twice.
          // THE SPIN OUTLIVES THE CLIP. Tied to the clip's own duration it
          // had to cover ninety degrees in nine tenths of a second, which is
          // a whip on top of hips already turning. Given its own, longer
          // clock it simply finishes after the boy has stopped stepping.
          if (turnSpin !== 0) {
            turnSpinT = Math.max(0, turnSpinT - dt);
            const u = turnSpinDur > 0 ? 1 - turnSpinT / turnSpinDur : 1;
            const want = turnSpin * (u * u * (3 - 2 * u));
            cw.rotation.y += want - turnSpun;
            turnSpun = want;
            if (turnSpinT <= 0) {
              turnSpin = 0;
              turnSpun = 0;
              turnSpinDur = 0;
            }
          }
          if (dogTurn != null) {
            dogTurnT -= dt;
            // CLAIM THE BODY. `oneShot` builds every action at weight 0, so
            // playing one is not enough to see it — the turn was running at
            // zero weight the whole time, which is why he snapped round
            // instead of stepping. The locomotion weights are reassigned from
            // measured movement every frame, and a turning boy measures as
            // standing still, so they have to be damped here too.
            dogTurn.weight = 1;
            if (companion.idle) companion.idle.weight = 0;
            if (companion.walk) companion.walk.weight = 0;
            if (companion.run) companion.run.weight = 0;
            if (dogTurnT <= 0) {
              // The quarter the clip was holding in its hips, handed to the
              // wrap as the pose returns to neutral. The spin, if any is
              // left, carries on above on its own clock.
              cw.rotation.y += turnBy;
              dogTurn.weight = 0;
              dogTurn.stop();
              dogTurn = null;
              turnBy = 0;
            }
          } else if (turnSpin !== 0) {
            // Clip done, spin still running it round. Nothing to add.
          } else if (Math.abs(turn) > 0.9) {
            const left = turn > 0;
            const t = left
              ? companion.settle.turnLeft
              : companion.settle.turnRight;
            if (t != null) {
              // BRISK WHEN THEY ARE TYPING. Standing about, a turn can take
              // its time -- he is looking at something. Once the child is
              // moving he is in the way and facing the wrong direction, so
              // the whole turn, footwork and spin alike, is hurried up.
              // `dogTurnT` counts real seconds, so it takes the rate out.
              const rush = seen.moveW > 0.2 ? 1.35 : 1;
              t.reset();
              t.timeScale = rush;
              t.weight = 1;
              t.play();
              dogTurn = t;
              dogTurnT = t.getClip().duration / rush;
              turnBy = left ? Math.PI / 2 : -Math.PI / 2;
              // One clip, whatever the angle. A 90 spins nothing extra; a 180
              // spins the other 90 under it; anything between trims itself.
              turnSpin = turn - turnBy;
              turnSpun = 0;
              // Longer the more there is to spin, so a full 180 gets half as
              // long again while a turn that only needs trimming by a few
              // degrees does not trail on after the footwork has finished.
              turnSpinDur =
                dogTurnT *
                (1 + 0.5 * Math.min(1, Math.abs(turnSpin) / (Math.PI / 2)));
              turnSpinT = turnSpinDur;
            }
          } else {
            // Small corrections stay a lerp: a quarter-turn clip for ten
            // degrees would read as a fidget.
            cw.rotation.y += turn * 0.045;
          }
        } else {
          // SLOWLY. At 0.045 a frame a 90-degree look was over in about half
          // a second, which on a machine standing still reads as a head
          // snapping round. A fifth of that takes two and a half seconds to
          // cover the same arc -- long enough to watch it happen, which is
          // the point of it happening at all.
          //
          // Frame-rate independent, unlike the constant it replaces: at 0.045
          // per FRAME the same turn took twice as long on a 30fps machine as
          // on a 60fps one, so the character was quicker on better hardware.
          cw.rotation.y += turn * Math.min(1, dt * 0.55);
        }
        // Its lamp rides the same offset the hero's does, so the light sits
        // where a child would carry it rather than where the maths is tidy.
        // The lamp is placed after the loop, over the pair — see below.
        // Lit here rather than in `applySky`.
        //
        // That is where it was, and `applySky` runs while the world is being
        // built — before `spawnCompanion` has finished, so `companion` was
        // still null, the lamp was set to intensity 0, and nothing looked at
        // it again once the companion actually arrived. The hero's lamp is
        // fine because the hero exists by then. Decided every frame instead:
        // it is one assignment, and it cannot go stale.

        // The celebration is the one thing they do rather than copy, because
        // it is a one-shot: replaying the flag every frame it was true would
        // restart the clip forty times. Fired on the edge instead.
        if (companion.joy) {
          if (seen.celebrating && !companionCelebrating) {
            companion.joy.reset();
            companion.joy.play();
          }
          const w = seen.celebrating
            ? 1
            : Math.max(0, companion.joy.weight - 0.04);
          companion.joy.weight = w;
          for (const a of [companion.run, companion.walk, companion.idle]) {
            if (a) a.weight *= 1 - w;
          }
        }
        companionCelebrating = seen.celebrating;
        // The companion raises dust too. It walks the same road on the same
        // feet, and a friend gliding silently beside a child who is kicking up
        // dust is the sort of detail that reads as wrong without anyone being
        // able to say why. Its own counter, so the two are never in lockstep.
        if (dustyRoad) {
          companionDust += Math.abs(cw.position.x - companionLastX);
          const running = runShare > 0.5;
          if (companionDust > (running ? 0.55 : 1.05)) {
            companionDust = 0;
            dust(
              cw.position.x - 0.12,
              cw.position.y + 0.03,
              cw.position.z,
              running ? 2 : 1,
            );
          }
        }
        companionLastX = cw.position.x;
        companion.mixer.update(dt);
        // AFTER the mixer, never before: the clip poses the skeleton and the
        // hair answers the pose it was left in. Run the other way round the
        // mixer simply overwrites it.
        //
        // The gain is how hard she is actually moving -- a run throws it
        // about, standing still barely stirs it -- plus a floor, so even an
        // idle has a little life in it rather than hair carved from wood.
        stepHair(companion.hair, dt, 0.35 + seen.moveW * 1.5);
        follower.lastX = companionLastX;
        follower.dust = companionDust;
        follower.celebrating = companionCelebrating;
        lampAtX += cw.position.x;
        lampAtY += cw.position.y;
        lampAtZ += cw.position.z;
        follower.s.lookTarget = lookTarget;
        follower.s.lookHold = lookHold;
        follower.s.compFidget = compFidget;
        follower.s.compFidgetT = compFidgetT;
        follower.s.compFidgetCool = compFidgetCool;
        follower.s.wagT = wagT;
        follower.s.wagCool = wagCool;
        follower.s.wagW = wagW;
        follower.s.dogAct = dogAct;
        follower.s.dogSettleAt = dogSettleAt;
        follower.s.dogT = dogT;
        follower.s.dogRested = dogRested;
        follower.s.dogSettled = dogSettled;
        follower.s.dogW = dogW;
        follower.s.dogOffX = dogOffX;
        follower.s.dogOffZ = dogOffZ;
        follower.s.dogWander = dogWander;
        follower.s.dogGap = dogGap;
        follower.s.dogOrbit = dogOrbit;
        follower.s.dogOrbitDir = dogOrbitDir;
        follower.s.dogLead = dogLead;
        follower.s.dogTravel = dogTravel;
        follower.s.dogLeadTarget = dogLeadTarget;
        follower.s.dogNextRun = dogNextRun;
        follower.s.dogPrevSeenX = dogPrevSeenX;
        // MOVE BETWEEN THE IDLES, rather than standing in one all visit.
        //
        // Placed last on purpose. Every block above reassigns the idle weight
        // from scratch each frame -- from movement, from a turn, from the
        // roadside sit -- so an AnimationMixer crossfade set up when the swap
        // begins is overwritten before it is ever seen. Instead this takes
        // whatever weight the idle ended the frame on and splits it between
        // the loop going out and the one coming in, which leaves every
        // decision above untouched and still blends.
        if (companion.idles.length > 1) {
          const idleW = companion.idle != null ? companion.idle.weight : 0;
          if (idleAlt == null) {
            idleNext -= dt;
            if (idleNext <= 0) {
              const others = companion.idles.filter(
                (a) => a !== companion.idle,
              );
              const nxt = others[Math.floor(Math.random() * others.length)];
              if (nxt != null) {
                nxt.reset();
                nxt.play();
                nxt.weight = 0;
                idleAlt = nxt;
                idleFade = 0;
              }
            }
          }
          if (idleAlt != null) {
            // Slow. These are whole-body poses, and anything quick enough to
            // notice reads as him being interrupted rather than settling.
            idleFade = Math.min(1, idleFade + dt / 1.1);
            const f = idleFade * idleFade * (3 - 2 * idleFade);
            if (companion.idle != null) companion.idle.weight = idleW * (1 - f);
            idleAlt.weight = idleW * f;
            if (idleFade >= 1) {
              const done = companion.idle;
              companion.idle = idleAlt;
              if (done != null) done.weight = 0;
              idleAlt = null;
              idleFade = 0;
              idleNext = 7 + Math.random() * 9;
            }
          }
        }
        follower.s.idleAlt = idleAlt;
        follower.s.idleFade = idleFade;
        follower.s.idleNext = idleNext;
        follower.s.dogTurn = dogTurn;
        follower.s.turnBy = turnBy;
        follower.s.turnSpin = turnSpin;
        follower.s.turnSpun = turnSpun;
        follower.s.turnSpinT = turnSpinT;
        follower.s.turnSpinDur = turnSpinDur;
        follower.s.guideLookBack = guideLookBack;
        follower.s.guideEverMoved = guideEverMoved;
        follower.s.sitAct = sitAct;
        follower.s.sitPhase = sitPhase;
        follower.s.sitT = sitT;
        follower.s.dogTurnT = dogTurnT;
        follower.s.dogAhead = dogAhead;
        follower.s.dogSpeed = dogSpeed;
        follower.s.dogPrevX = dogPrevX;
        follower.s.dogPrevZ = dogPrevZ;
      }

      if (followers.length > 0) {
        const n = followers.length;
        // Hung over the middle of the group — and, like the hero's, handed
        // over to a milestone's flame when the group comes up to one, so the
        // whole party is lit from the same place the child is. See
        // `lampFrom`. Aimed from the group's centre, so a pair straddling a
        // stone both get it.
        const cx = lampAtX / n;
        const cy = lampAtY / n;
        const cz = lampAtZ / n;
        const mateLit = lampFrom(
          TMP_MATE.set(cx + 0.9, cy + 2.1, cz + 1.6),
          TMP_AT.set(cx, cy, cz),
        );
        companionLamp.position.copy(TMP_MATE);
        // Lit here rather than in `applySky`, which runs while the world is
        // still being built — before anybody has arrived to be lit.
        // DIMMER THAN THE HERO'S, deliberately.
        //
        // It used to be the same 3.2, and with the pair of them lit exactly
        // as brightly as the child there was nothing in the frame saying
        // which one the keyboard belongs to — three faces at the same
        // exposure, in a scene where the only real light is what they carry.
        // The pointer ring says whose turn it is, but the ring is a UI mark
        // and the LIGHT is the thing the eye reads first.
        //
        // Two thirds. Enough that nobody is walking in the dark beside
        // somebody with a lantern, which is the whole reason this light
        // exists, and little enough that the child is plainly the brightest
        // person on the road.
        // Blended, not stepped on `nightLook`, and squared like the hero's —
        // see there.
        companionLamp.intensity =
          // 2.1 as it always was. Raising the BASE lifted the companion on
          // every night frame, not just beside a stone -- the milestone lift
          // is the `mateLit` term and that is the only part that should move.
          3.0 * (nightBlend * nightBlend + mateLit * LAMP_LIFT * nightBlend);
        companionLamp.distance = 6.2 + mateLit * LAMP_REACH;
        companionLamp.color.copy(LAMP_WHITE).lerp(LAMP_AMBER, mateLit * 0.85);
      }

      // ── buffalo showcase: keep it beside the player and cycle its clips ──
      if (buffaloMixer) {
        // Start the cycle on the first TICK, not at load time. The clips were
        // advancing while the loading screen was still up, so the first few -
        // Walk among them - had come and gone before the world was visible.
        if (!buffaloStarted) {
          buffaloStarted = true;
          advanceBuffalo(0);
        }
        buffaloMixer.update(dt);
        buffaloHold += dt;
        if (buffaloWrap && player) {
          // The animal being REVIEWED goes next to the player, where the eye
          // already is. Parking it out past the companion - which is itself
          // behind the player - is right for something 5.4 units tall that
          // would otherwise crowd the shot, and wrong for a puppy: at that
          // distance it is a speck at the edge of frame. So the anchor is the
          // player, and the clearance scales with the animal.
          const anchorX = player.wrap.position.x;
          const isPup = opts.showcaseModel === "Puppy";
          const bx = anchorX - (isPup ? 2.8 : 7.4);
          // Inside the flat lane band, and grounded with `groundY` — exactly
          // what the player and the companion use. Two things had it standing
          // in the ground: `surfaceY` beds its caller 0.06 INTO the surface by
          // default (right for rocks, wrong for something on its feet), and
          // past |z| > 2.6 the terrain gains up to 0.19 of noise that the
          // characters never sit in, so the buffalo was in an undulating band
          // while they were on the flat.
          // Nearer the camera than the player for the small animal, so he does
          // not stand in front of it - at the puppy's size any overlap hides
          // most of what there is to review. Still well inside the flat lane:
          // past |z| > 2.6 the terrain picks up noise the characters never
          // stand in, and the animal would bob through it.
          const bz = isPup ? 1.3 : 2.4;
          buffaloWrap.position.set(bx, groundY(bx) + buffaloFootLift, bz);
        }
        if (idleShowMixer && idleShowWrap && player) {
          idleShowMixer.update(dt);
          // Beyond the cycling model, so the moving animal stays nearest the
          // camera and the still one reads as the scale reference behind it.
          // Behind the cycling animal, but still IN the shot. 13.5 units out at
          // z 5.4 put it off the edge of frame and past |z| > 2.6, where the
          // terrain picks up noise the characters never stand in - so it was
          // both invisible and bobbing.
          const ix = player.wrap.position.x - 8.6;
          idleShowWrap.position.set(ix, groundY(ix) + idleShowFootLift, 2.5);
        }
        const cur = buffaloActions[buffaloIdx];
        const dur = cur ? cur.getClip().duration : 2;
        // hold each clip for a couple of plays (min ~3.2s) then move on
        // Gaits repeat, so they need a few cycles to read. One-shots do NOT:
        // they play once and clamp, so holding them to a fixed 4.5s left the
        // short ones frozen on their last frame for seconds - Charge_Start is
        // 0.9s of launch and then stood stock still, which read as the animal
        // being stuck mid-animation. A one-shot now gets its own length plus a
        // beat to register its final pose, and moves on.
        const loops = SHOWCASE_LOOPS.test(cur ? cur.getClip().name : "");
        // Charge_Start is a TRANSITION - it launches into the charge and is
        // immediately followed by Charge_Loop. Holding it on its last frame,
        // even for a beat, reads as the animal freezing mid-launch, so it
        // hands straight over. Death, Graze and the attacks do want a moment
        // on their final pose.
        const transition = cur ? cur.getClip().name === "Charge_Start" : false;
        // The pause after a one-shot SCALES with the clip. A flat 1.2s left
        // Hit_Reaction (0.8s of animation) frozen for 60% of its screen time -
        // four captures in a row showed an identical still. A third of the
        // clip's own length, capped, reads as a beat rather than a stall.
        const pause = transition ? 0.1 : Math.min(1.2, dur * 0.35);
        const hold = loops ? Math.max(4.5, dur * 1.6) : dur + pause;
        if (buffaloHold >= hold) {
          advanceBuffalo((buffaloIdx + 1) % buffaloActions.length);
        }
      }

      // ── the idle chain ────────────────────────────────────────────────
      //
      // Runs on the clock rather than on clip-finished events: the sequencing
      // is a handful of durations and a stage name, and keeping it here means
      // one place to read when the timings need tuning.
      const r = player.rest;
      if (moving) {
        if (restStep > 0) {
          // A pause that actually reached the chain is over. Count it, so the
          // next one is met with more patience and less chain.
          pauses += 1;
        }
        idleT = 0;
        restStep = 0;
        spokeThisPause = false;
        if (restStage !== "none" && restStage !== "standing") {
          leaveRest();
        }
      } else if (restStage !== "standing") {
        idleT += dt;
      }
      restHold = Math.max(0, restHold - dt);
      braveCool = Math.max(0, braveCool - dt);

      // Escalation, checked every frame — and deliberately NOT inside the
      // "a one-shot just finished" branch below.
      //
      // That is where it used to live, and a looping pose has no finish to
      // wait for: `hold()` parks `restHold` at Infinity, so once he was in
      // Crouch_Idle the branch never ran again and he crouched forever. The
      // step he is allowed to leave from is a settled one — a standstill or a
      // looping pose — never the middle of a one-shot, or sitting down would
      // cut off crouching down halfway.
      const settled =
        restStage === "none" ||
        restStage === "crouchIdle" ||
        restStage === "sitIdle";
      if (!moving && settled) {
        // Set when she squares up, so the waiting chain below is skipped for
        // this frame WITHOUT returning out of `tick`.
        let stoodUp = false;
        // Before the waiting chain: is there a skeleton to stand up to?
        //
        // Ahead of wave/sit on purpose. The chain is what a child does when
        // nothing is happening, and something IS happening — walking past a
        // skeleton to sit down cross-legged in front of it would undo the
        // whole character. Only at night, only within sight along the trail,
        // and only if she owns the clips, which today only Peeli does.
        const p0 = player;
        if (
          p0 != null &&
          // `nightLook`, not `nightNow`. `nightNow` follows the day/night
          // TOGGLE, and it is only ever set by `setNight()` — which the page
          // calls on load solely when the night preference is already on. The
          // Hero Trail's "Spooky" style makes the world night through
          // `trueNight` instead, so the scene can be dark, the lanterns lit
          // and the skeletons up while `nightNow` is still false. This is the
          // same value that decides whether the hero is carrying a light,
          // which is the right test for "is it dark enough to meet one".
          nightLook > 0 &&
          p0.brave.length > 0 &&
          braveCool === 0 &&
          friends.some(
            (f) =>
              f.wrap.userData.scary === true &&
              f.wrap.visible &&
              Math.abs(f.wrap.position.x - p0.wrap.position.x) < BRAVE_RANGE,
          )
        ) {
          // Only a performance starts the cooldown.
          //
          // Setting it on the roll instead meant a failed roll bought nine
          // seconds of silence exactly as if she had squared up, so the real
          // rate was the chance AND the cooldown multiplied — she reacted to
          // roughly one skeleton in four rather than one in two.
          if (Math.random() < BRAVE_CHANCE) {
            braveCool = BRAVE_COOLDOWN_S;
            const total = p0.brave.reduce((sum, b) => sum + b.weight, 0);
            let roll = Math.random() * total;
            const chosen =
              p0.brave.find((b) => (roll -= b.weight) <= 0) ?? p0.brave[0]!;
            startRest("brave", chosen.action);
            // Deliberately outside the wave/crouch/sit numbering: standing up
            // to something is not a step along the waiting chain, and it must
            // not consume the wave she has not had yet.
            //
            // A flag, NOT a `return`. This block is inside `tick()`, which
            // ends with `renderer.render(...)` followed by
            // `requestAnimationFrame(tick)` — so returning here skipped the
            // draw AND the scheduling of the next frame, and the render loop
            // stopped for good. It only ever showed up after dark because
            // that is the only time this branch runs: the pane went blank
            // mid-game, in dark mode, and no amount of reloading explained
            // why. Nothing in `tick` may return early.
            stoodUp = true;
          }
          // Passed over this time — look again shortly rather than not at
          // all, or a single unlucky roll while a skeleton is in range means
          // she walks the whole stretch without noticing it.
          braveCool = 2;
        }
        // Thresholds stretch with how often they have paused, and the early
        // steps drop out of the chain once they have been seen.
        const p = patience();
        if (stoodUp) {
          // She is already doing something about the skeleton in front of
          // her; the waiting chain has nothing to add this frame.
        } else {
          const sitAt = REST_SIT_S * p * playerSitsLate;
          const crouchAt = REST_CROUCH_S * p;
          const showWave = pauses < WAVE_UNTIL_PAUSE;
          const showCrouch = pauses < CROUCH_UNTIL_PAUSE;
          if (idleT >= sitAt && restStep < 3 && r.sitDown) {
            // He has to stand up before he can sit down.
            //
            // `Sit_CrossLegged_Down` is authored from a STANDING pose, so
            // playing it straight out of a crouch teleported him upright first —
            // measured at 0.70 of bone movement in a single frame, by far the
            // largest seam in the chain and the one that read as choppy. Going
            // via `Stand_From_Crouch` brings that down to 0.13, which the
            // crossfade then covers.
            if (restStage === "crouchIdle" && r.standFromCrouch) {
              startRest("upToSit", r.standFromCrouch);
            } else {
              startRest("sitDown", r.sitDown);
            }
            restStep = 3;
          } else if (
            idleT >= crouchAt &&
            restStep < 2 &&
            showCrouch &&
            r.crouchDown
          ) {
            startRest("crouchDown", r.crouchDown);
            restStep = 2;
          } else if (
            idleT >= crouchAt &&
            restStep < 2 &&
            p0 != null &&
            p0.fidget.length > 0
          ) {
            // The same slot the crouch would have taken.
            //
            // Peeli has no crouch, so without this her chain is wave then a
            // long nothing then sit — and the wave itself stops after the
            // second pause, leaving the whole wait blank. A standing gesture
            // costs nothing to reach (she is already on her feet) and is the
            // one thing that fits a character who would rather not sit down.
            //
            // A different one each time, so a child who pauses twice does not
            // see the same beat twice.
            startRest(
              "fidget",
              p0.fidget[Math.floor(Math.random() * p0.fidget.length)]!,
            );
            restStep = 2;
          } else if (
            idleT >= waveAt(r) * p &&
            restStep < 1 &&
            showWave &&
            r.wave
          ) {
            startRest("wave", r.wave);
            maybeSay("wave");
            restStep = 1;
          }
        }
      }
      if (restHold <= 0) {
        // A one-shot has run its length; move to whatever holds that pose.
        // `restStep` is what stops the wave restarting the moment it ends —
        // without it he waved on a five-second loop and never reached a crouch.
        // Every standing one-shot ends the same way: back to `none`, with
        // the fade below releasing the clip.
        //
        // `brave` and `fidget` were added to the chain without being added
        // HERE, and the two failures that caused look unrelated until you
        // see the cause. `restStage` never returned to a settled value, so
        // (1) the escalation below — which only runs from `none`,
        // `crouchIdle` or `sitIdle` — could never reach the sit, and
        // (2) `restTarget` stayed at 1, holding the clamped final frame at
        // full weight, which is a character frozen mid-gesture.
        //
        // "She stopped sitting down" and "she is stuck in a crouch" were
        // the same missing branch. Any new one-shot stage must be listed
        // here or it will do both again.
        if (
          restStage === "wave" ||
          restStage === "brave" ||
          restStage === "fidget" ||
          restStage === "standing"
        ) {
          restStage = "none";
        } else if (restStage === "upToSit") {
          if (r.sitDown) startRest("sitDown", r.sitDown);
          else restStage = "none";
        } else if (restStage === "crouchDown") {
          hold("crouchIdle", r.crouchIdle);
        } else if (restStage === "sitDown") {
          hold("sitIdle", r.sitIdle);
        }
      }

      // The rest pose fades over the gait rather than replacing it outright,
      // so a keystroke mid-sit blends back into walking instead of cutting.
      const restTarget = restStage === "none" ? 0 : 1;
      restW += (restTarget - restW) * 0.14;

      // Exactly one rest clip may be showing, and the rest must be at zero
      // AND stopped.
      //
      // This is not defensive tidying, it is the whole correctness of the
      // chain. Every one-shot here sets `clampWhenFinished`, which holds its
      // final frame at whatever weight it was last given — so releasing an
      // action by dropping the reference leaves it standing at full weight
      // forever, on top of everything after it. That is what froze the
      // character in the last frame of Wave and then blended Crouch and Sit
      // on top of it. Driving every non-current clip to zero each frame makes
      // the sequencing bug unrepresentable rather than merely fixed.
      // Two clips may carry weight at once, and only during a crossfade: the
      // one arriving and the one it replaced. Everything else is at zero and
      // stopped.
      //
      // Without the fade the stages swapped instantly at full weight, so
      // every authored difference between the end of one clip and the start
      // of the next landed in a single frame. That is what the chop was.
      restBlend = Math.min(1, restBlend + dt / REST_CROSSFADE_S);
      const arriving = restW * restBlend;
      const leaving = restW * (1 - restBlend);
      // Every clip the chain can put on the body, not a hand-written
      // subset of them.
      //
      // This list WAS hand-written, and `brave` and `fidget` were added to
      // the chain without being added to it. The result is the failure that
      // looks least like its cause: `restW` fades the gait out because a
      // rest stage is running, the stage's own clip never receives
      // `arriving` because it is not in this loop, and a character with no
      // clip at any weight falls to its bind pose. She was not playing the
      // wrong animation — she was playing none, and a rig with nothing
      // driving it stands in the pose it was modelled in.
      //
      // Derived from the rig now, so a clip that exists cannot be left out
      // of the thing that gives it weight.
      for (const a of [
        r.wave,
        r.crouchDown,
        r.crouchIdle,
        r.standFromCrouch,
        r.sitDown,
        r.sitIdle,
        r.standFromSit,
        ...player.brave.map((b) => b.action),
        ...player.fidget,
      ]) {
        if (a == null) continue;
        if (a === restAction) {
          a.weight = arriving;
        } else if (a === restPrev) {
          a.weight = leaving;
          if (leaving <= 0.001) {
            a.weight = 0;
            a.stop();
            restPrev = null;
          }
        } else if (a.weight !== 0 || a.isRunning()) {
          a.weight = 0;
          a.stop();
        }
      }
      // Once faded out, let go of it — a stopped clip at zero weight costs
      // nothing, but holding the reference would block the next stage.
      if (restStage === "none" && restW < 0.002) {
        restW = 0;
        for (const a of [restAction, restPrev]) {
          if (a == null) continue;
          a.weight = 0;
          a.stop();
        }
        restAction = null;
        restPrev = null;
      }
      if (restW > 0.001) {
        for (const a of [player.run, player.walk, player.idle]) {
          if (a) a.weight *= 1 - restW;
        }
      }

      // The jump clip rides over the gait at partial weight: full weight would
      // stop his legs mid-stride, and most jumps happen while he is running.
      jumpAnimHold = Math.max(0, jumpAnimHold - dt);
      const jumpAnim = player.rest.jump;
      if (jumpAnim != null) {
        const w = jumpAnimHold > 0 ? 0.85 : 0;
        jumpAnim.weight = w;
        if (w > 0) {
          for (const a of [player.run, player.walk, player.idle]) {
            if (a) a.weight *= 1 - w;
          }
        }
      }

      const cur = player.wrap.scale.x;
      player.wrap.scale.setScalar(cur + (growTarget - cur) * 0.06);
      if (celebT > 0) {
        celebT -= celebRate;
        const t = 1 - Math.max(0, celebT); // 0 -> 1 across the celebration
        if (player.joy) {
          // Full weight for the body of the celebration, easing out at the
          // end so the character settles back into idle rather than snapping.
          const w = Math.min(1, (1 - t) * 6);
          player.joy.weight = w;
          for (const a of [player.run, player.walk, player.idle]) {
            if (a) a.weight *= 1 - w;
          }
        }
        if (player.joy) {
          // The character celebrates for itself. A clip authored for this
          // beats spinning the whole model on the spot, which is what a
          // character with nothing to play had to make do with.
          player.wrap.rotation.y = Math.PI / 2;
          player.wrap.rotation.z = 0;
        } else if (theme.pointerRing) {
          // No celebration clip: a full turn on the spot, landing back where
          // it started.
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
        // Facing. Along the trail while he is going somewhere; towards
        // whoever he is waiting for while he is not.
        //
        // A wave to the back of someone's head is not a wave, so the whole
        // resting chain turns to face the camera and stays turned — waving,
        // then crouching, then sitting, all addressed to the person who has
        // stopped typing. He turns back as he stands up, because by then he is
        // about to run again.
        //
        // The angle is computed rather than fixed: the camera trails the
        // player down the trail, so a hard-coded quarter turn would be right
        // at the start and increasingly wrong later.
        const waiting = restStage !== "none" && restStage !== "standing";
        const facing = waiting
          ? Math.atan2(cam.position.x - p.x, cam.position.z - p.z)
          : Math.PI / 2;
        // Shortest way round, so he never spins the long way to face front.
        let turn = facing - player.wrap.rotation.y;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        player.wrap.rotation.y += turn * 0.12;
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
          heroPumpkin.rotation.z = calmMode
            ? 0
            : Math.sin(clock.elapsedTime * 26) * 0.16 * k;
          // The knight's ring has no face to pull, so it recoils and shivers
          // instead — the same beat, told with the only vocabulary it has.
          heroRing.position.z = -k * 0.3;
          heroRing.rotation.z = calmMode
            ? 0
            : Math.sin(clock.elapsedTime * 22) * 0.3 * k;
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
        // Fires exactly when a child is already struggling, which is why it
        // is the first thing to go when they have asked for calm. The red
        // flush above stays: that is the part that says what happened.
        const shakeAmp = calmMode ? 0 : 1;
        const shakeX = Math.sin(clock.elapsedTime * 60) * hit * 0.28 * shakeAmp;
        const shakeY = Math.cos(clock.elapsedTime * 52) * hit * 0.12 * shakeAmp;
        if (playerGhostly) {
          heroPumpkin.position.set(p.x + shakeX, py + shakeY, p.z);
          heroPumpkin.rotation.y = Math.sin(clock.elapsedTime * 1.5) * 0.15;
          heroPumpkin.rotation.z =
            Math.sin(clock.elapsedTime * 55) * hit * 0.5 * shakeAmp;
        } else {
          heroRing.position.set(p.x + shakeX, py + shakeY, p.z);
          heroRing.rotation.z +=
            0.03 + Math.sin(clock.elapsedTime * 55) * hit * 0.4 * shakeAmp;
        }
      }
      cam.position.x += (p.x - 2 - cam.position.x) * 0.06;
      // The sun sets and the moon rises, as one move. `SUN_AT` is eased
      // between the two rigs by the same blend that fades the rest of the
      // night, so the shadows swing round and shorten over the same second
      // and a half rather than jumping at the flip. All three axes, not just
      // x: y and z used to be written once at build time, back when there
      // was only ever one place for the light to be.
      SUN_AT.lerpVectors(SUN_DAY, SUN_NIGHT, nightBlend);
      sun.position.set(cam.position.x + SUN_AT.x, SUN_AT.y, SUN_AT.z);
      sun.target.position.x = cam.position.x;
      sun.target.updateMatrixWorld();
      player.mixer.update(dt);
      // See the companion above: after the mixer, and scaled by how much the
      // child is actually moving. `runShare` on top, because a run should
      // throw it further than a walk at the same speed does.
      stepHair(player.hair, dt, 0.35 + moveW * 1.5 + moveW * runShare * 0.9);
      // The 3-D word rides on the trail to the RIGHT of the runner — the way
      // he's heading — held steady on screen by tracking the camera; the
      // current tile lifts + bobs.
      if (wordGroup.visible) {
        // The ribbon glides so the current letter always sits at the same spot
        // (just to the right of the runner, low in the pane); typed letters
        // scroll off left, upcoming ones flow in from the right — no jump.
        const gz = theme.wordZ ?? 10;
        const anchorX = p.x + 3;
        const targetX = anchorX - wordIdx * TILE_GAP;
        if (wordSnap) {
          wordGroup.position.x = targetX;
          wordSnap = false;
        } else {
          wordGroup.position.x += (targetX - wordGroup.position.x) * 0.18;
        }
        wordGroup.position.z = gz;
        wordGroup.position.y = theme.wordY ?? 0;
        for (let i = 0; i < wordTiles.length; i++) {
          const g = wordTiles[i].grp;
          const cur = i === wordIdx;
          const s = cur ? 1.28 : 1;
          g.scale.x += (s - g.scale.x) * 0.2;
          g.scale.y = g.scale.z = g.scale.x;
          const lift = cur ? 0.35 + Math.sin(clock.elapsedTime * 3) * 0.12 : 0;
          // Hover clearly above the ground (still following its contour) so the
          // row reads as floating, not resting on the dirt.
          //
          // 1.55 rather than the 1.35 it sat at: a fifth of a unit, which on a
          // boy four and a third tall is a couple of finger-widths. Enough to
          // lift the letters off the road they were nearly touching without
          // moving them far enough to read as a separate band of interface.
          const tileX = wordGroup.position.x + g.position.x;
          const groundH = terrainY(tileX, gz);
          g.position.y += (groundH + 1.55 + lift - g.position.y) * 0.25;
          // PIN THE PAINTED SHADOW TO THE GROUND, AND THROW IT FROM THE SUN.
          //
          // Not directly under the card: that is the shadow of a light hung
          // straight overhead, and every other shadow in the scene falls
          // down-road because the sun is up and behind. A row of letter
          // cards each sitting on its own perfectly centred blob was the one
          // thing in the frame lit by a different sun from everything else.
          //
          // Displaced by the card's height above the ground times the sun's
          // horizontal run over its vertical rise — the same vector the real
          // shadows use, so moving `SUN_AT` moves these with them. Divided
          // by the group's scale, because these are local offsets on a group
          // that is scaled as the ribbon settles, and an offset in local
          // units drifts out of world units the moment the scale is not 1.
          const tile = wordTiles[i];
          const drop = g.position.y - groundH;
          const sx = g.scale.x || 1;
          const sz = g.scale.z || 1;
          tile.shadow.position.y = -drop / (g.scale.y || 1);
          tile.shadow.position.x = ((SUN_AT.x / -SUN_AT.y) * drop) / sx;
          tile.shadow.position.z = ((SUN_AT.z / -SUN_AT.y) * drop) / sz;
        }
      }
    }
    // Companions notice the runner: when it comes near they turn to watch it
    // pass, then drift back to their own random facing once it's gone.
    const heroX = player ? player.wrap.position.x : 0;
    const heroZ = player ? player.wrap.position.z : 0;
    /**
     * IS THE CHILD ACTUALLY RUNNING?
     *
     * Measured from how far they moved, not asked of the animation. The
     * trail's speed comes from typing, so the run clip can be playing while
     * the character is barely moving — a learner picking out one letter
     * every few seconds is not running past anybody, whatever their legs are
     * doing. Ground covered per second is the honest question, and it is the
     * same one the gait itself should have been asking.
     */
    if (dt > 0) {
      heroSpeed +=
        (Math.abs(heroX - heroLastX) / dt - heroSpeed) * Math.min(1, dt * 3);
    }
    heroLastX = heroX;
    // ── WALKING INTO THE VILLAGE ─────────────────────────────────────────
    //
    // Announced at the EDGE, not at the centre: by the time the child is level
    // with the market they have been looking at it for several seconds and
    // being told it is there is a beat late. Eighteen units out is about where
    // the roofs come into frame.
    //
    // Latched, because they walk through it for most of a lesson and the line
    // belongs to arriving rather than to being there. Released well past the
    // far side so a child who stalls on the edge is not told twice.
    if (villageX != null) {
      const near = Math.abs(heroX - villageX) < 18;
      if (near && insideVillage !== villageX) {
        insideVillage = villageX;
        opts.onEvent?.("village");
      } else if (!near && Math.abs(heroX - villageX) > 26) {
        insideVillage = null;
      }
      // And the view opens out for it — see `applyFrustum`. Eased on the same
      // 1.5s a person takes to stop and look up, and only re-projected while
      // it is actually moving: the matrix is the same every frame the child
      // spends on the open road.
      const wantWide = insideVillage != null ? 1 : 0;
      if (Math.abs(wantWide - villageWide) > 0.0015) {
        villageWide += (wantWide - villageWide) * Math.min(1, dt / 1.5);
        applyFrustum();
      }
    }
    const heroRunning = heroSpeed > 1.4;

    // ── the wild ones ────────────────────────────────────────────────────
    if (wildReview) {
      wildBeat += dt;
      if (wildBeat > 3) {
        wildBeat = 0;
        console.log(
          `[wildbeat] n=${wilds.length} motion=${motionScale.toFixed(2)} idleT=${idleT.toFixed(1)} ` +
            wilds
              .map(
                (w) =>
                  `{${w.state}/${w.cur} t=${w.t.toFixed(1)} cd=${w.cooldown.toFixed(0)} gap=${Math.hypot(heroX - w.wrap.position.x, heroZ - w.wrap.position.z).toFixed(1)}}`,
              )
              .join(" "),
        );
      }
    }
    for (const w of wilds) {
      w.mixer.update(dt * motionScale);
      const step = dt * motionScale;
      // The turn hand-off, if one is running: the heading climbs by the same
      // amount the outgoing clip is giving up, so the animal appears to hold
      // still while the two swap over.
      if (w.yawT > 0) {
        w.yawT = Math.max(0, w.yawT - step);
        const k = 1 - w.yawT / WILD_TURN_FADE;
        w.wrap.rotation.y = w.yawFrom + angTo(w.yawFrom, w.yawTo) * k;
      }
      w.cooldown = Math.max(0, w.cooldown - step);
      w.scareCool = Math.max(0, w.scareCool - step);
      w.t -= step;
      const pos = w.wrap.position;
      // Which side of the road it is on NOW — it may have crossed.
      w.side = pos.z >= meander(pos.x) ? 1 : -1;
      const dxh = heroX - pos.x;
      const dzh = heroZ - pos.z;
      const gap = Math.hypot(dxh, dzh);
      /** Straight at the child. */
      const facingHero = Math.atan2(dxh, dzh);

      /**
       * THE FENCE, and the one thing allowed through it.
       *
       * The z this animal may not pass while it is interested in the child.
       * The road's centre wanders with x, so this is recomputed from where
       * it actually is rather than from a constant — a fence that assumed a
       * straight road would let it onto a bend. `roadClear` is the same
       * clearance that keeps trees off the road, so the buffalo pulls up
       * exactly where the field stops. It is not a number chosen to feel
       * safe; it is the edge of the road itself.
       *
       * A buffalo that can NEVER cross is a buffalo painted onto one side of
       * the world, so it may cross — when the child is nowhere near, and
       * only on its way somewhere. It never stops on the road: a wander
       * target is always chosen off it (see wildAmbient), the crossing is
       * walked straight through, and if the child turns up mid-crossing it
       * keeps going rather than stopping in the lane. What it may not do is
       * cross TOWARDS them, which is the only case the fence is for.
       */
      // 0.95 of the scatter clearance: right out at the field's edge, a good
      // margin beyond the travelled part of the road, so the animal pulls up
      // on the far verge rather than stepping onto the lane the child walks.
      const fenceZ = (x: number) => meander(x) + w.side * (roadClear * 0.95);
      const clampZ = (x: number, z: number) =>
        w.side < 0 ? Math.min(z, fenceZ(x)) : Math.max(z, fenceZ(x));
      /** Free movement — used while walking somewhere, fence and all. */
      const freeZ = (_x: number, z: number) => z;

      /**
       * THIS ANIMAL DOES NOT SLEW. IT TURNS, WITH ITS LEGS.
       *
       * The rule is absolute: it has Turn_Left_90 and Turn_Right_90, so every
       * change of heading is one of them, played for the fraction of ninety
       * degrees the change is worth. Nothing rotates the body while the feet
       * are doing something else.
       *
       * That is what this function used to do, and it is the slide. It was
       * kept for "trimming a few degrees" on the theory that a small enough
       * rotation reads as leaning into a line — it does not. A buffalo is a
       * tonne of animal with four feet planted on the ground, and rotating it
       * at all without a step under it reads as an object being dragged,
       * however slowly it is done. There is no angle small enough to be free.
       *
       * The callers keep their `face(...)` lines, because "point at the
       * child" is still the right instruction; what changed is that asking
       * for a heading now means asking for a TURN. Anything worth turning for
       * hands off to a clip, and anything smaller is left alone — a herd
       * animal is not a turret and does not need to be exactly on target.
       */
      const face = (target: number, _rate = 0.45) => {
        if (w.yawT > 0 || w.state === "turn" || midOneShot) {
          return;
        }
        const need = angTo(w.wrap.rotation.y, target);
        if (Math.abs(need) > WILD_TURN_MIN) {
          wildTurn(w, need, w.state === "escort" ? "escort" : null);
        }
      };
      /** Walk towards (tx,tz); returns the distance still to go. */
      const advance = (
        tx: number,
        tz: number,
        speed: number,
        limit: (x: number, z: number) => number = clampZ,
        turnRate = 0.45,
      ) => {
        const dx = tx - pos.x;
        const dz = tz - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.05) {
          return 0;
        }
        const move = Math.min(d, speed * step);
        // The stones are solid. Clamped HERE rather than in each state, so a
        // charge, an escort, a wander and a backing-off all respect them
        // without any of them having to know the stones exist — and because
        // the charge ends on "have I arrived", pulling it up short of a stone
        // makes it break off into its bluff there, on its feet, with the
        // turn-and-toss it would have played anyway.
        const nx = stoneLimitX(pos.x, pos.x + (dx / d) * move, pos.z);
        const nz = limit(nx, pos.z + (dz / d) * move);
        pos.set(nx, wildGroundY(nx, nz), nz);
        // NO STEERING WHILE WALKING. Every state that moves already checks
        // its heading and hands off to a turn clip before it takes a step —
        // see the wander, the escort and the way home. Trimming the heading
        // here as well was the slide, and it ran on every single frame of
        // every walk, which is why it was the one that would not go away.
        void turnRate;
        return d - move;
      };
      /**
       * Drop a lifted pose back onto the ground. See plantFeet's probe.
       *
       * EASED, not applied outright. The rear-up sits a long way above the
       * graze in model space, so switching between them moved the root by
       * that whole gap on a single frame — a jump, and half of what read as
       * a flicker. Over a quarter of a second it is a weight shift instead,
       * and it lines up with the crossfade that caused it.
       */
      const settle = () => {
        const want = w.lift.get(w.cur) ?? 0;
        w.liftNow += (want - w.liftNow) * Math.min(1, step * 4);
        pos.y = wildGroundY(pos.x, pos.z) - w.liftNow;
      };
      /**
       * STAND ON THE GROUND THAT IS THERE.
       *
       * Four probes, one under each end of the animal, turned with it: the
       * difference front-to-back is its pitch and the difference side-to-side
       * is its roll. A heavy animal whose feet are all at one height on a
       * road that dips reads as hovering over the dip, and this world's road
       * is deliberately worn BELOW the fields — so the one place the tilt
       * matters most is exactly where the buffalo crosses.
       *
       * Eased, so the lean settles rather than snapping when it turns.
       */
      const stand = () => {
        const yaw = w.wrap.rotation.y;
        const sy = Math.sin(yaw),
          cy = Math.cos(yaw);
        const L = w.halfLen,
          W = w.halfWid;
        const at = (fx: number, fz: number) =>
          wildGroundY(pos.x + fx, pos.z + fz);
        const front = at(sy * L, cy * L);
        const back = at(-sy * L, -cy * L);
        const right = at(cy * W, -sy * W);
        const left = at(-cy * W, sy * W);
        const wantPitch = Math.atan2(front - back, 2 * L);
        const wantRoll = Math.atan2(right - left, 2 * W);
        const k = Math.min(1, step * 3);
        w.pitch += (wantPitch - w.pitch) * k;
        w.roll += (wantRoll - w.roll) * k;
        w.wrap.rotation.x = w.pitch;
        w.wrap.rotation.z = w.roll;
      };
      // ── the charge, and the one thing that calls it off ────────────────
      //
      // Checked before the state machine, because a child coming back to the
      // keyboard has to interrupt whatever is in progress — waiting for the
      // current clip to finish would mean typing and being charged anyway,
      // which teaches the opposite of the intended lesson.
      // A TURN IS PART OF WHATEVER IT IS FOR.
      //
      // Leaving "turn" out of this test was a genuine deadlock: a buffalo
      // that noticed the child, finished its Idle_Alert and started to turn
      // round was, on the very next frame, seen as not-chasing and sent back
      // to "notice" — which then finished and started the turn again. It
      // stood there alerting forever and never charged, and from outside it
      // simply looked stuck.
      const turning = w.state === "turn";
      /**
       * Is a one-shot still playing?
       *
       * Nothing interrupts one. The child coming back to the keyboard, the
       * decision to charge, a threat drawn at random — all of them wait for
       * the current motion to finish rather than cutting it off mid-swing.
       * An animal that abandons a movement halfway through reads as broken
       * in a way that an animal a beat late does not, and the longest wait
       * this can cost is the six seconds of the rear-and-stomp.
       */
      const midOneShot = w.t > 0 && !WILD_LOOPS.test(w.cur);
      const chasing =
        w.state === "notice" ||
        w.state === "windup" ||
        w.state === "charge" ||
        w.state === "bluff" ||
        (turning && w.after === "windup");
      /**
       * CAN IT STILL CHANGE ITS MIND?
       *
       * Only before it has committed. Once the head is down the charge runs
       * to the end, and this is the difference between the four buffalo
       * lines being reachable and three of them being dead text.
       *
       * They were dead. `chasing` covered the whole sequence, so the instant
       * the child touched a key the animal abandoned whatever it was doing —
       * and since every warn line in the script is an instruction to TYPE,
       * obeying the warning was precisely what cancelled the charge. A child
       * who did as they were told never saw `buffaloCharge` or
       * `buffaloSafe`, and a child who ignored it was by definition not
       * looking at the screen. Nobody could ever have read them.
       *
       * The script always meant the charge to happen: it "always pulls up
       * short and never reaches the child", and the relief beat afterwards
       * is the point of it. Typing is what you do WHILE it comes, not a way
       * to stop it coming. So the notice is abortable — it has only looked
       * up — and the windup and the charge are not.
       */
      const abortable =
        w.state === "notice" ||
        w.state === "bluff" ||
        (turning && w.after === "windup");
      if (abortable && idleT < 1.5 && !midOneShot) {
        // They typed. It thinks better of the whole idea — once whatever it
        // is doing has finished; see midOneShot.
        //
        // A turn cut short has to hand its rotation over first: the clip
        // turns the model and the wrap only takes that up when the clip
        // ends, so abandoning one mid-way snaps the animal back to where it
        // started facing.
        if (turning) {
          w.wrap.rotation.y = w.yaw;
          w.after = null;
        }
        wildEnter(w, "flinch", "Hit_Reaction");
        w.cooldown = WILD_COOLDOWN_S;
      } else if (
        !chasing &&
        // Never interrupt a turn, nor anything else mid-motion.
        !turning &&
        !midOneShot &&
        w.state !== "flinch" &&
        w.state !== "backoff" &&
        w.state !== "gohome" &&
        w.cooldown <= 0 &&
        player != null &&
        idleT >= WILD_CHARGE_IDLE_S &&
        gap < WILD_NOTICE_D &&
        gap > WILD_STOP_D + 2
      ) {
        // Decided ONCE per opportunity, not per frame: the cooldown is what
        // closes the window, so a roll that fails means it has genuinely let
        // this one go rather than re-rolling sixty times a second until it
        // succeeds, which would have made the odds meaningless.
        if (playerIsLittle() && Math.random() > LITTLE_CHARGE_ODDS) {
          w.cooldown = WILD_COOLDOWN_S * 0.5;
        } else {
          wildEnter(w, "notice", "Idle_Alert", 1.3);
          opts.onEvent?.("buffaloNotice");
        }
      }

      switch (w.state) {
        case "wander": {
          // IF IT HAS TO TURN, IT TURNS — with the clip, on its feet.
          //
          // `advance` used to slew the body round towards its target every
          // frame while walking, which meant most of this animal's turning
          // happened with no turn animation at all: it simply rotated as it
          // walked, and the two 90-degree clips only ever fired on the first
          // step of an errand. Anything past the dead-band now stops the walk
          // and plays the turn, then resumes the same errand — `w.tx`/`w.tz`
          // are untouched, so it picks up exactly where it left off.
          const need = angTo(
            w.wrap.rotation.y,
            Math.atan2(w.tx - pos.x, w.tz - pos.z),
          );
          if (Math.abs(need) > WILD_TURN_MIN) {
            wildTurn(w, need, "wander");
            break;
          }
          // Unfenced — a wander may cross the road, because its target is
          // never on one. The crossing is only ever a crossing. The turn rate
          // here is deliberately slow: it is a drift to hold the line, not a
          // turn, and anything that needs a turn was caught above.
          const left = advance(w.tx, w.tz, 1.7, freeZ, 0.6);
          if (left <= 0 || w.t <= 0) {
            wildAmbient(w, nightNow);
          }
          break;
        }
        case "turn": {
          // The rotation is NOT driven from here. Turn_Left_90 rotates the
          // hips a measured 90 degrees on its own and holds there, so
          // turning the wrap as well would spin the animal through 180.
          //
          // THE HAND-OFF IS A CROSSFADE, NOT A CUT, and getting that wrong is
          // what made the animal flash at the end of every turn.
          //
          // Cutting hard keeps the HEADING continuous — the clip's 90 degrees
          // vanishes on the same frame the wrap's 90 appears — but it snaps
          // the POSE, from the turn's last frame to the next clip's first, in
          // a single frame. That is the flash.
          //
          // So both are faded together. The outgoing clip's contribution
          // falls from 1 to 0 across WILD_TURN_FADE, unwinding its 90 degrees
          // as it goes, while the wrap's heading is ramped up by the same 90
          // on the same curve. The sum stays put, and the pose blends.
          if (w.t <= 0) {
            // FREEZE THE TURN WHERE IT STOPPED, before anything fades it out.
            //
            // This is the flicker that survived every other fix, and it is
            // not a bad frame in the clip: measured at 60Hz with the real
            // linear/slerp interpolation, all thirteen of this animal's clips
            // are smooth, Turn_Left_90 and Turn_Right_90 included — their
            // worst single step is about three times their own median, where
            // a flicker needs twenty or more.
            //
            // It is the hand-off. A turn shorter than ninety degrees plays a
            // FRACTION of the clip: the state clock is set to `dur * frac`
            // and ends there, but the ACTION is a LoopOnce over the whole
            // clip and simply carries on. `crossFadeFrom` keeps the outgoing
            // action running while its weight falls, so for the length of the
            // fade the hips go on turning toward the full ninety — while the
            // wrap's own ramp adds the same rotation underneath. The two
            // stack, the animal over-rotates, and then the action is cut and
            // it snaps back. A quarter of a second of wrong yaw, arriving
            // only at the end of a turn, which is exactly where it was seen.
            //
            // Paused, not stopped: the pose has to stay on screen to be faded
            // out of. `reset()` in wildPlay clears this when the clip is next
            // played.
            const turning = w.act.get(w.cur);
            if (turning != null) {
              turning.paused = true;
            }
            w.yawFrom = w.wrap.rotation.y;
            w.yawTo = w.yaw;
            w.yawT = WILD_TURN_FADE;
            const after = w.after;
            w.after = null;
            // More than 90 degrees to come round? Take another 90. The
            // errand survives the extra leg.
            const goal =
              after === "wander"
                ? Math.atan2(w.tx - pos.x, w.tz - pos.z)
                : after === "gohome"
                  ? Math.atan2(w.homeX - pos.x, w.homeZ - pos.z)
                  : after === "windup"
                    ? facingHero
                    : null;
            if (goal != null) {
              const left = angTo(w.yaw, goal);
              if (Math.abs(left) > WILD_TURN_MIN) {
                // COMMIT THE HEADING BEFORE TAKING ANOTHER LEG.
                //
                // `wildTurn` bases the next turn on `w.wrap.rotation.y`, and
                // at this instant that is still the heading from BEFORE this
                // turn — the hand-off ramp has not run yet. Chaining without
                // committing meant every extra leg re-based from the same
                // stale heading, so the legs never accumulated and the animal
                // rocked back and forth about one spot indefinitely. That is
                // the spin, and it only appears on turns of more than ninety
                // degrees, which is why it looked intermittent.
                //
                // The ramp is cancelled with it: there is nothing to blend
                // into, because another turn clip is about to play from this
                // exact heading.
                w.wrap.rotation.y = w.yaw;
                w.yawT = 0;
                wildTurn(w, left, after);
                break;
              }
            }
            if (after === "wander") {
              wildEnter(w, "wander", "Walk", 9, WILD_TURN_FADE);
            } else if (after === "gohome") {
              wildEnter(w, "gohome", "Run", 14, WILD_TURN_FADE);
            } else if (after === "windup") {
              wildEnter(w, "windup", "Charge_Start", undefined, WILD_TURN_FADE);
              opts.onEvent?.("buffaloWarn");
            } else {
              wildAmbient(w, nightNow);
            }
          }
          break;
        }
        case "notice": {
          if (w.t <= 0) {
            const need = angTo(w.wrap.rotation.y, facingHero);
            if (Math.abs(need) > WILD_TURN_MIN) {
              // Properly behind it: turn round on its feet before charging,
              // rather than sliding round on the spot mid-charge.
              wildTurn(w, need, "windup");
            } else {
              wildEnter(w, "windup", "Charge_Start");
              opts.onEvent?.("buffaloWarn");
            }
          }
          break;
        }
        case "windup": {
          face(facingHero, 2.6);
          if (w.t <= 0) {
            wildEnter(w, "charge", "Charge_Loop", 6);
            opts.onEvent?.("buffaloCharge");
          }
          break;
        }
        case "charge": {
          // THE TARGET IS NOT THE CHILD. It is the point on the line between
          // them that sits WILD_STOP_D short — so even run to completion,
          // the charge ends six units away.
          const k = gap > 0.001 ? Math.max(0, (gap - WILD_STOP_D) / gap) : 0;
          const tx = pos.x + dxh * k;
          const tz = clampZ(tx, pos.z + dzh * k);
          // And the advance is clamped again on the measured gap, so a bad
          // target cannot be acted on even if one were somehow computed.
          const left = gap > WILD_STOP_D ? advance(tx, tz, 7.5, clampZ) : 0;
          // PULL UP WHEN IT HAS ARRIVED, not when the gap hits the floor.
          //
          // Those are not the same thing, and assuming they were broke the
          // charge the moment the hero moved off the middle of the road. The
          // fence holds the animal at the far verge, so with the child
          // walking the near side the gap can never close to six however far
          // it runs — it reached the fence, kept "charging", and slid along
          // it past the child until the timer ran out. Arrival is what ends
          // a charge; the gap is only the floor underneath it.
          if (left <= 0.3 || gap <= WILD_STOP_D + 0.4 || w.t <= 0) {
            // A THREAT, not a strike. Attack_Horn and Attack_Stomp would
            // have been the obvious clips and neither one exists in this
            // app — see the header — so the pull-up is a display: it hauls
            // up short, tosses its head, and occasionally rears. Which is
            // better anyway. Nothing is ever swung at the child.
            wildEnter(
              w,
              "bluff",
              Math.random() < 0.7
                ? "Aggressive_Threat"
                : "Supernatural_Rear_Stomp",
            );
          }
          break;
        }
        case "bluff": {
          // It hits nothing. There is no hitbox, no damage, no score change:
          // the animal tosses its horns at empty air a body's length away.
          face(facingHero, 1.2);
          if (w.t <= 0) {
            wildEnter(w, "backoff", "Walk_Backward", 1.6);
            // It has stopped and is giving ground: the relief beat.
            opts.onEvent?.("buffaloSafe");
            w.cooldown = WILD_COOLDOWN_S;
          }
          break;
        }
        case "flinch": {
          if (w.t <= 0) {
            wildEnter(w, "backoff", "Walk_Backward", 1.4);
          }
          break;
        }
        case "backoff": {
          // Reversing, still facing them — the way an animal that has
          // changed its mind but has not stopped being wary actually leaves.
          const bx = pos.x - Math.sin(w.wrap.rotation.y) * 2.2 * step;
          const bz = clampZ(
            bx,
            pos.z - Math.cos(w.wrap.rotation.y) * 2.2 * step,
          );
          pos.set(bx, wildGroundY(bx, bz), bz);
          face(facingHero, 0.8);
          if (w.t <= 0) {
            wildEnter(w, "gohome", "Run", 14);
          }
          break;
        }
        case "escort": {
          // ON ITS OWN SIDE OF THE FENCE, LEVEL WITH THE CHILD.
          //
          // It aims at a point ahead of them rather than at them, which is
          // what makes it read as running WITH somebody instead of chasing
          // them: aim at a moving target and you always arrive behind it.
          // The z it wants is its own resting distance off the road, so the
          // fence never has to argue with it — and `clampZ` is still the
          // limit, so if the road bends towards the animal it gives way
          // rather than running down the middle of it.
          //
          // A real turn still gets its clip, exactly as the wander does.
          const wantX = heroX + WILD_ESCORT_LEAD;
          const wantZ = fenceZ(wantX) + w.side * 2.2;
          const needRun = angTo(
            w.wrap.rotation.y,
            Math.atan2(wantX - pos.x, wantZ - pos.z),
          );
          if (Math.abs(needRun) > WILD_TURN_MIN) {
            wildTurn(w, needRun, "escort");
            break;
          }
          advance(wantX, wantZ, 7.2, clampZ, 0.8);
          // Gives up when its time is out, when the child stops running, or
          // if they have got far enough away that keeping up stopped being
          // the same idea.
          if (w.t <= 0 || !heroRunning || gap > WILD_NOTICE_D) {
            // Its own cooldown, so a child who runs the whole trail is
            // joined once in a while rather than escorted the entire way.
            w.cooldown = 14 + Math.random() * 26;
            wildEnter(w, "gohome", "Run", 12);
          }
          break;
        }
        case "gohome": {
          // Same rule as the wander: a real turn gets the clip. Going home
          // is the longest walk it ever takes and the one most likely to
          // need a correction halfway.
          const needHome = angTo(
            w.wrap.rotation.y,
            Math.atan2(w.homeX - pos.x, w.homeZ - pos.z),
          );
          if (Math.abs(needHome) > WILD_TURN_MIN) {
            wildTurn(w, needHome, "gohome");
            break;
          }
          const left = advance(w.homeX, w.homeZ, 5.5, freeZ, 0.6);
          if (left <= 0 || w.t <= 0) {
            wildAmbient(w, nightNow);
          }
          break;
        }
        case "threat": {
          // A display, in place, aimed at the child — it never advances, and
          // it only turns when it is properly facing the wrong way. A slow
          // turn is what makes a display read as a display rather than as a
          // machine tracking a target.
          if (
            gap < WILD_NOTICE_D &&
            Math.abs(angTo(w.wrap.rotation.y, facingHero)) > WILD_HEAD_MAX
          ) {
            face(facingHero, 1.1);
          }
          if (w.t <= 0) {
            w.scareCool = 8 + Math.random() * 14;
            wildAmbient(w, nightNow);
          }
          break;
        }
        default: {
          // graze / idle / alert: stands where it is, eating or looking up.
          // After dark it looks up at the child as they pass, and now and
          // then makes something of it. By day it barely notices them.
          if (
            nightNow &&
            !midOneShot &&
            w.scareCool <= 0 &&
            gap < 16 &&
            w.cooldown <= 0 &&
            Math.random() < 0.5 * step
          ) {
            wildEnter(
              w,
              "threat",
              Math.random() < 0.75
                ? "Aggressive_Threat"
                : "Supernatural_Rear_Stomp",
            );
          } else if (
            // RUNNING WITH THE CHILD, now and then.
            //
            // A buffalo in a field does not care about a person walking past
            // and very much does care about one RUNNING past — it will come
            // along the fence line beside them for a bit, lose interest, and
            // go back to eating. That is the behaviour here: it needs the
            // child to actually be moving at a run, to be close enough to
            // have noticed, and then it needs to feel like it.
            //
            // Kept off the charge's cooldown deliberately — this is play,
            // not a threat, and it must not eat the budget the scare
            // behaviour spends. It has its own, set when it gives up.
            // WALKING IS ENOUGH FOR THE LITTLE ONE. For everybody else it
            // has to see them running before it bothers — see above — but
            // with Drew it will amble along beside him at any pace, which is
            // the behaviour that actually reads as the animal liking him.
            (heroRunning || (playerIsLittle() && heroSpeed > 0.35)) &&
            !midOneShot &&
            gap < WILD_NOTICE_D &&
            gap > WILD_STOP_D &&
            w.cooldown <= 0 &&
            Math.random() <
              WILD_ESCORT_CHANCE *
                (playerIsLittle() ? LITTLE_ESCORT_X : 1) *
                step
          ) {
            wildEnter(
              w,
              "escort",
              "Run",
              WILD_ESCORT_SECS[0] +
                Math.random() * (WILD_ESCORT_SECS[1] - WILD_ESCORT_SECS[0]),
            );
          } else if (w.t <= 0) {
            wildAmbient(w, nightNow);
          }
          break;
        }
      }

      // ONE owner for ground contact, after every state has had its say.
      //
      // It used to be each case's job and most of them forgot, so an animal
      // that was walking kept the height `advance` gave it and an animal
      // that was posing kept whatever it had. Height and tilt are a property
      // of where it is standing, not of what it is doing, so they are
      // settled here, once, for all of them.
      settle();
      stand();
    }

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
        /** A morphed twin: it looms at the hero; strangers only stare. */
        scarer?: boolean;
        loom?: number;
        baseScale?: number;
        /** Comes out only after dark. */
        nightOnly?: boolean;
        /** Turns in when the sun goes down. */
        dayOnly?: boolean;
        guard?: boolean;
        phase?: number;
        smiler?: boolean;
        sheep?: boolean;
        head?: THREE.Object3D | null;
        /** Several standing loops, swapped between. See spawnCompanion. */
        idlePool?: THREE.AnimationAction[];
        idleNext?: number;
        headBaseX?: number;
        baseX?: number;
        baseZ?: number;
        state?: "graze" | "walk";
        stateT?: number;
        tx?: number;
        tz?: number;
        roams?: boolean;
        /** Placed facing wins over `companionsWatch`. */
        fixedFace?: boolean;
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
      // A bystander with several idles moves between them, so a character
      // stood by the road for four minutes is not in one three-second loop
      // the whole time. Crossfaded, because these are full-body poses and
      // cutting between them twitches.
      {
        const pool = ud.idlePool;
        if (pool != null && pool.length > 1) {
          ud.idleNext = (ud.idleNext ?? 0) - dt;
          if (ud.idleNext <= 0) {
            ud.idleNext = 12 + Math.random() * 14;
            const cur = pool.find((a) => a.isRunning() && a.weight > 0.5);
            const next = pool[Math.floor(Math.random() * pool.length)];
            if (next != null && next !== cur) {
              next.reset();
              next.setEffectiveWeight(1);
              next.play();
              if (cur != null) {
                next.crossFadeFrom(cur, 0.8, false);
              }
              for (const a of pool) {
                if (a !== next && a !== cur) {
                  a.stop();
                  a.setEffectiveWeight(0);
                }
              }
            }
          }
        }
      }
      // Other props carry no home — they just animate in place.
      if (ud.homeX == null) {
        continue;
      }
      const near =
        player != null && Math.abs(heroX - ud.homeX) < NEAR_HERO_RANGE;
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
      // Dino companions just carry on with their own idle — no watching,
      // and neither does anyone whose facing was placed deliberately.
      if (!theme.companionsWatch || ud.homeY == null || ud.fixedFace === true) {
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
        // Two kinds of skeleton, two manners. The strangers out in the dark
        // only watch: they stand, sway almost imperceptibly, and turn to
        // follow the hero like any villager — the turning is shared above.
        // But a villager the hero KNOWS who turned out to be a skeleton gets
        // to be frightening: as the hero comes close it LOOMS — rises a
        // little, grows a little, eyes brightening — slowly, and slowly back
        // down. Slow is what makes it scary; the old shudder was slapstick.
        f.wrap.rotation.z =
          Math.sin(clock.elapsedTime * 0.45 + (ud.phase ?? 0)) *
          0.045 *
          motionScale;
        if (ud.scarer === true) {
          const want = near ? 1 : 0;
          ud.loom =
            (ud.loom ?? 0) + (want - (ud.loom ?? 0)) * Math.min(1, dt * 1.6);
          const loom = (ud.loom ?? 0) * motionScale;
          f.wrap.position.y = homeGY + 0.24 * loom;
          const base = ud.baseScale ?? f.wrap.scale.x;
          f.wrap.scale.setScalar(base * (1 + 0.08 * loom));
          // And a tremble riding on the loom — the rise says it noticed you,
          // the shiver says it is barely holding itself together.
          f.wrap.rotation.z +=
            Math.sin(clock.elapsedTime * 8.5 + (ud.phase ?? 0)) * 0.05 * loom;
          setEyeFlare(f.wrap, 1 + 0.35 * loom, 3.2 + 3.2 * loom, 0x7fe3ff);
        } else {
          f.wrap.position.y += (homeGY - f.wrap.position.y) * 0.1;
          applyEyeGlow(f.wrap, nightNow);
        }
        // The pumpkin's jump is still the joke, so the trigger survives.
        if (near && !scaredThisRun) {
          scaredThisRun = true;
          scareT = 1;
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
      s.userData.v.y -= s.userData.gravity ?? 0.012;
      s.userData.life -= s.userData.decay ?? 0.02;
      const spin = s.userData.spin ?? 1;
      s.rotation.x += 0.2 * spin;
      s.rotation.y += 0.13 * spin;
      if (s.userData.grow === true) {
        // Dust: spreads and thins. Fading by opacity rather than by scale,
        // because a shrinking cube reads as an object leaving and a fading one
        // reads as air.
        // Barely spreads. The first version grew 2.6x, which took a 0.04
        // cube back up to 0.104 — near the 0.16 clod it replaced, and the
        // reason it still read as lumps of mud after being shrunk. A puff
        // should soften as it goes, not swell.
        s.scale.setScalar(1 + (1 - s.userData.life) * 0.5);
        const mat = s.material as THREE.MeshStandardMaterial;
        mat.opacity = 0.5 * Math.max(0, s.userData.life);
      } else {
        s.scale.setScalar(Math.max(0.01, s.userData.life));
      }
      if (s.userData.life <= 0) {
        scene.remove(s);
        sparks.splice(i, 1);
      }
    }
    renderer.render(scene, cam);
    requestAnimationFrame(tick);
  }
  /**
   * EVERYTHING THAT WOULD OTHERWISE BE PAID FOR MID-GAME, PAID FOR HERE.
   *
   * A frame that compiles a shader or uploads a texture is not a 16ms frame,
   * it is a 40-70ms one, and on a typing game that lands as the world
   * hitching under the child's fingers. Measured while typing a line: eleven
   * frames out of four hundred over 22ms, the worst at 74ms, and every one
   * of them inside `renderer.render` rather than in the game's own tick —
   * which is the signature of the driver stopping to compile or upload, not
   * of the world having too much to do.
   *
   * Two sources, both of them one-off costs that simply happen at the wrong
   * moment:
   *
   *  1. THE LETTERS. `letterTexture` caches per character, so each letter is
   *     drawn and uploaded once — but that once is the first time a child
   *     ever types it, so the alphabet is paid for one stutter at a time
   *     across their first few minutes. Drawn here instead, into the same
   *     cache, while the loading screen is still up.
   *  2. THE SHADERS. three compiles a material's program the first time it
   *     is drawn. `compile` walks the scene and does the whole set now.
   *
   * Both are pure prepayment: nothing renders differently, it is only paid
   * for at a moment when nobody is waiting on a frame.
   */
  //
  // SPREAD, NOT PAID IN ONE GO. Seventy-eight glyphs drawn to a canvas and
  // uploaded is a single blocking chunk if it is done in a loop here, and it
  // lands at the worst possible instant — the frame the loading screen
  // appears. Through `later` it is drained at three milliseconds a frame by
  // `runSlices`, finishing long before the first passage is typed and
  // blocking nothing on the way.
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?'-") {
    later(() => {
      renderer.initTexture(letterTexture(ch) as THREE.Texture);
      // The braille faces too. They are only ever shown on the first passage,
      // which is exactly the moment nobody can afford a texture upload —
      // there are at most 36 distinct patterns and they are shared by every
      // card that needs them.
      const cell = brailleTexture(ch);
      if (cell != null) {
        renderer.initTexture(cell);
      }
    });
  }
  // COMPILE BEFORE THE FIRST FRAME, NOT ON FIRST SIGHT.
  //
  // A shader is built the first time the thing that uses it is actually
  // drawn, and building one stalls the whole pipeline. Left alone that means
  // a hitch the first time each new object comes round the bend -- the
  // buffalo, the guide sitting, a lamp coming on -- which is exactly when
  // the child is looking at it. Doing them all here moves every one of those
  // stalls into the loading screen, where there is already a boy running.
  //
  // Wrapped because it is an optimisation, not a requirement: a driver that
  // refuses should cost us the hitches, not the world.
  //
  // ASYNCHRONOUSLY, where the browser offers it. `compile()` builds every
  // program on the main thread before returning, and with the Kerala planting
  // in the scene that is a long stall with nothing on screen -- the very
  // hitch it was added to remove, moved earlier and made bigger.
  // `compileAsync` does the same work off the critical path; where it is
  // missing we simply take the hitches, which is what happened before any of
  // this existed.
  try {
    const r = renderer as unknown as {
      compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<unknown>;
    };
    if (typeof r.compileAsync === "function") {
      void r.compileAsync(scene, cam);
    }
  } catch {
    /* compiled lazily instead */
  }
  tick();

  return {
    land,
    ready,
    setPlayer,
    setCompanion,
    setCompanions,
    setGuide,
    setGuideBand,
    /**
     * Recolour the character's clothes, now.
     *
     * Remembered even when the current character has no masks, so the
     * choice survives switching to the Knight and back rather than being
     * silently forgotten while he is off screen.
     */
    setCharacterColors(colours: ClothingColours) {
      pendingColours = { ...pendingColours, ...colours };
      playerTint?.setColors(colours);
    },
    resetCharacterColors() {
      pendingColours = {};
      playerTint?.reset();
    },
    /** What is set right now; empty means every garment is as painted. */
    characterColors(): ClothingColours {
      return playerTint?.current() ?? { ...pendingColours };
    },
    /** Whether the character on screen can be recoloured at all. */
    canTintCharacter(): boolean {
      return playerTint != null;
    },
    setProgress(frac) {
      targetX = runStart + Math.max(0, Math.min(1, frac)) * (runEnd - runStart);
    },
    startRun(passageChars) {
      scaredThisRun = false;
      runLen = runLengthFor(passageChars ?? Number.NaN);
      // Clamped against the full length, not this run's: the window slides
      // along a 260-unit trail, and a short run must not be allowed to
      // start further along than a full one could have.
      runStart = Math.min(targetX, TRAIL_END - RUN_LEN);
      runEnd = runStart + runLen;
      placeFlag();
    },
    jump() {
      // Single or double jump only — holding/mashing space can't turn into
      // flight.
      //
      // The first press is a small hop: space is pressed once per word, so it
      // happens constantly, and a big leap every few seconds turns the run
      // into pogo-sticking. The second, in mid-air, is the big one — that is
      // the move worth discovering, and it has to clear the first by enough
      // to read as a different thing rather than a slightly better hop.
      // A press that arrives after the window is a fresh first hop, not the
      // second half of a double somebody started seconds ago.
      if (framesSinceJump > DOUBLE_TAP_FRAMES) {
        jumpCount = 0;
      }
      if (jumpCount < 2) {
        framesSinceJump = 0;
        // A jump is activity: it ends any rest pose and restarts the clock.
        idleT = 0;
        if (restStage !== "none" && restStage !== "standing") leaveRest();
        const j = player?.rest.jump;
        if (j != null) {
          j.reset();
          j.play();
          // The clip is longer than the small hop's arc, so it is cut to the
          // hop rather than left hanging after he has landed.
          jumpAnimHold = Math.min(0.55, j.getClip().duration);
        }
        jumpV = jumpCount === 0 ? 0.2 : 0.34;
        // Both carry the character forward; the double covers more ground,
        // which is what makes it feel like a leap rather than a bounce.
        jumpFwdV = jumpCount === 0 ? 0.05 : 0.085;
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
    celebrate(): number {
      celebT = 1;
      celebHops = 0;
      celebRate = 0.012;
      if (player?.joy) {
        // From the top every time: `clampWhenFinished` leaves it parked on the
        // last frame, and without a reset the second celebration would play
        // nothing at all.
        player.joy.reset();
        player.joy.play();
        // Run the countdown at the clip's own length (assuming 60fps, which is
        // what the rest of these hand-tuned rates assume) so it neither cuts
        // the animation off nor holds a finished pose.
        const frames = player.joy.getClip().duration * 60;
        if (frames > 1) celebRate = 1 / frames;
      }
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
      // `celebT` starts at 1 and drops by `celebRate` each frame, so the
      // celebration lasts `1 / celebRate` frames — expressed here at the
      // same 60fps the rest of these hand-tuned rates assume.
      return (1 / celebRate / 60) * 1000;
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
      // A fixed-age character stays at its own fitted height, whatever the
      // lesson has unlocked.
      growTarget = playerGrows ? sizeForAge(dinoAge) : 1;
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
    setHour(hour) {
      if (hourPref === hour) {
        return;
      }
      hourPref = hour;
      restageSun();
      // The palette goes with the angle — a low sun is a gold one — so the
      // sky has to be rebuilt, not just the vector moved.
      applySky(nightNow ? "night" : land.mood).catch(() => {});
    },
    setNight(night) {
      nightNow = night;
      applySky(night ? "night" : land.mood).catch(() => {});
      refreshEyeGlow();
      refreshPopulation(true);
    },
    setLook(brightness, paleness) {
      userBright = brightness;
      userPale = paleness;
      applyLook();
    },
    setPace(wpm) {
      paceWpm = Number.isFinite(wpm) ? Math.max(0, wpm) : 0;
    },
    wake() {
      if (restStep > 0) pauses += 1;
      idleT = 0;
      restStep = 0;
      spokeThisPause = false;
      if (restStage !== "none" && restStage !== "standing") {
        leaveRest();
      }
    },
    passStone() {
      if (pendingStone == null) {
        return;
      }
      // Permanent now: it joins the map the marker-clearance and the
      // behind-stones read, and the road ahead measures from it.
      milestones.set(Math.round(pendingX), pendingStone);
      lastStoneX = pendingX;
      milestoneNo += 1;
      pendingStone = null;
    },
    setHeld(on) {
      held = on;
    },
    setMotion(intensity) {
      motionScale = Math.max(0, Math.min(1, intensity));
    },
    setCalm(calm) {
      calmMode = calm === true;
      if (calmMode) {
        // Anything already in the air comes down now rather than finishing its
        // arc — a learner who has just asked for stillness should get it, not
        // get it after one more burst.
        for (const s of sparks) {
          scene.remove(s);
        }
        sparks.length = 0;
      }
    },
    setAccent(hex) {
      setTileAccent(hex);
      // Re-lay the word so the tile already on screen takes the new colour.
      setWordImpl(lastWord, lastIndex);
    },
    setWord: setWordImpl,
    resize,
    dispose() {
      disposed = true;
      // Caches first. A letter drawn once is kept so the next word that needs
      // it is free, but a tile can leave the scene while its texture stays in
      // here — and then a traversal of the scene never reaches it.
      for (const texture of letterTexCache.values()) {
        texture.dispose();
        (texture.image as { close?: () => void } | undefined)?.close?.();
      }
      letterTexCache.clear();
      // The scene first — the renderer's own dispose does not reach into it.
      disposeScene(scene);
      // Then the parsed models, which were never in it.
      for (const model of loaded) {
        disposeScene(model);
      }
      loaded.length = 0;
      (scene.background as THREE.Texture | null)?.dispose?.();
      (scene.environment as THREE.Texture | null)?.dispose?.();
      scene.background = null;
      scene.environment = null;
      pmrem.dispose();
      // The transcoder runs a pool of workers. One world that forgets
      // them is one pool that outlives it, and a child who flips between
      // Dino Run and Hero Trail a few times ends up with several — which
      // is a slow page at best and a loader that never answers at worst.
      ktx2.dispose();
      renderer.dispose();
      // dispose() frees the renderer's GL objects but never loses the
      // CONTEXT — and Chrome pins a canvas (and several megabytes of
      // renderer-side JS state) for as long as its WebGL context is alive.
      // Measured with WeakRefs across an unmount: the scene and every model
      // collected, the renderer and canvas never did, ~6 MB per visit.
      // Losing the context is what lets the browser release the pair.
      renderer.forceContextLoss();
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
  /**
   * Who runs across the loading screen. Defaults to the theme's own
   * character, but the caller passes whoever the learner actually chose —
   * waiting behind somebody else's hero, then arriving as your own, reads
   * as the game having forgotten you.
   */
  playerName: string = theme.defaultPlayer,
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
  // No angle on the camera either way — the character is turned, not the lens.
  //
  // Framed on the character's middle rather than its knees. At this focal
  // length the lens sees about 5.4 units at the character's distance, so a
  // 4.2-unit character aimed at y=1.3 loses the top of its head; aimed at its
  // own midpoint it sits inside the frame with room to spare.
  cam.position.set(0, 2.1, 10);
  cam.lookAt(0, 2.1, 0);
  /**
   * Which way the character faces while the world loads.
   *
   * ALWAYS side-on, always to the right. A quarter turn faces +X, which is
   * the direction the world runs in and the direction the progress under his
   * feet travels.
   *
   * This used to be a coin toss between side-on and head-on, on the argument
   * that one reads as a journey and the other as company. In practice the
   * two do not sit together: the loading screen is a walk to somewhere, the
   * bar beneath him moves left to right, and a character facing the camera
   * while the light travels past him is standing still in a picture about
   * going. Half the loads contradicted the other half, which is worse than
   * either on its own.
   */
  const facing = Math.PI / 2;
  let mixer: THREE.AnimationMixer | null = null;
  let hair: HairSim | null = null;
  let disposed = false;
  const loader = new GLTFLoader();
  meshoptOffMainThread();
  loader.setMeshoptDecoder(MeshoptDecoder);
  // The preview needs the transcoder too — it draws the same characters.
  const previewKtx2 = new KTX2Loader()
    .setTranscoderPath(`${ASSETS}/basis/`)
    .detectSupport(renderer);
  serveTranscoderFromUrl(previewKtx2);
  loader.setKTX2Loader(previewKtx2);
  loader
    .loadAsync(modelUrl(theme.modelDir, playerName))
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
      const s = 4.2 / (size.y || 1);
      gltf.scene.scale.setScalar(s);
      gltf.scene.position.y = -box.min.y * s;
      gltf.scene.rotation.y = facing;
      scene.add(gltf.scene);
      const playRun = (clips: readonly THREE.AnimationClip[]) => {
        // A walk, where the character has one. Nobody is racing on a loading
        // screen, and a sprint cycle under a progress bar reads as urgency
        // the screen does not mean.
        const clip =
          clips.find((c) => /\bwalk\b/i.test(c.name)) ??
          clips.find((c) => /run/i.test(c.name));
        if (clip != null) {
          mixer = new THREE.AnimationMixer(gltf.scene);
          // Same export noise the world strips: without this the character
          // changes size the instant the clip starts.
          mixer.clipAction(stripScaleTracks(clip)).play();
          // HER HAIR MOVES HERE TOO.
          //
          // The loading screen builds its own scene, its own mixer and its own
          // tick -- it shares nothing with the world -- so the hair simulation
          // wired into the world's frame loop never ran on it. She ran across
          // the loader with the hair welded to her skull, which is the first
          // thing anybody sees.
          hair = makeHairSim(gltf.scene);
        }
      };
      const own = gltf.animations ?? [];
      if (own.some((c) => /run|walk/i.test(c.name)) || !theme.animationUrls) {
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
    const dt = clock.getDelta();
    mixer?.update(dt);
    // A steady gain: she is running the whole time she is on screen, so there
    // is no movement to measure her effort from -- the loader's character
    // never travels, it runs on the spot.
    stepHair(hair, dt, 2.1);
    renderer.render(scene, cam);
    requestAnimationFrame(tick);
  }
  tick();
  return {
    dispose() {
      disposed = true;
      // The file cache holds a copy of every GLB this world loaded — tens of
      // megabytes of ArrayBuffer that nothing will ask for again once the
      // world is gone. It is global to three, so it outlives the world
      // unless it is emptied here.
      THREE.Cache.clear();
      disposeScene(scene);
      previewKtx2.dispose();
      renderer.dispose();
      // dispose() frees the renderer's GL objects but never loses the
      // CONTEXT — and Chrome pins a canvas (and several megabytes of
      // renderer-side JS state) for as long as its WebGL context is alive.
      // Measured with WeakRefs across an unmount: the scene and every model
      // collected, the renderer and canvas never did, ~6 MB per visit.
      // Losing the context is what lets the browser release the pair.
      renderer.forceContextLoss();
    },
  };
}

/**
 * Give back everything a scene holds.
 *
 * `renderer.dispose()` frees the renderer's own caches and nothing else: every
 * geometry, material and texture the world built stays allocated. This world
 * builds a great many — a GLTF cast, ground and sky textures, and a cloned
 * material for every figure that fades at nightfall — so each visit to the
 * kids page cost about twelve megabytes that never came back. Twelve trips
 * between the trail and the progress page is most of a low-end Chromebook's
 * tab budget, and this page is built for exactly those machines.
 *
 * Materials and textures are collected before disposing because they are
 * shared: the same material is on many meshes, and disposing it once per mesh
 * would be wasted work at best.
 */
function disposeScene(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    const mesh = node as Partial<THREE.Mesh> & THREE.Object3D;
    mesh.geometry?.dispose?.();
    const material = (mesh as { material?: unknown }).material;
    for (const one of Array.isArray(material)
      ? material
      : material != null
        ? [material]
        : []) {
      materials.add(one as THREE.Material);
    }
  });
  for (const material of materials) {
    // A material's maps are ordinary properties, so this is how three.js
    // itself finds them — anything carrying `isTexture` is one.
    for (const value of Object.values(material)) {
      if ((value as THREE.Texture | null)?.isTexture) {
        textures.add(value as THREE.Texture);
      }
    }
    material.dispose();
  }
  for (const texture of textures) {
    texture.dispose();
    // `dispose()` gives back the GPU handle and nothing else. The decoded
    // image behind it is a separate allocation — an ImageBitmap holds its
    // pixels outside the JS heap and is only released by closing it — so
    // without this the picture data for every model survives the world that
    // loaded it.
    const image = (texture as { image?: unknown }).image as
      | { close?: () => void }
      | undefined;
    image?.close?.();
    const source = (texture as { source?: { data?: { close?: () => void } } })
      .source;
    if (source?.data !== image) {
      source?.data?.close?.();
    }
  }
  root.clear();
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
