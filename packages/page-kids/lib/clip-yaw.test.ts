import { ok } from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { boneToRig, clipYaw, clipYawAt } from "./clip-yaw.ts";

// The buffalo's rig, reduced to the two facts that matter.
//
// Its armature carries a quarter turn about X, left over from a Z-up export,
// and its hips sit in a rest pose that is slightly tilted — the real values,
// read off the shipped Buffalo.glb. Together those are what made a clean
// ninety-degree clip read as something else, so a fixture without both would
// pass whatever the code did.
const HIPS_REST = new THREE.Quaternion(-0.048, -0.001, 0.01, 0.999).normalize();
const ARMATURE = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  Math.PI / 2,
);

const DEG = 180 / Math.PI;

/** The rig: wrap → armature → hips, as the loader builds it. */
function rig() {
  const wrap = new THREE.Group();
  const armature = new THREE.Object3D();
  armature.quaternion.copy(ARMATURE);
  const hips = new THREE.Object3D();
  hips.name = "Hips";
  hips.quaternion.copy(HIPS_REST);
  armature.add(hips);
  wrap.add(armature);
  return { wrap, hips };
}

/**
 * A turn clip: the hips swept `deg` about the axis the real clips use, eased
 * the way the real ones are eased, over the real 1.40s.
 *
 * A POSITIVE SWEEP HERE IS A RIGHT TURN. The hips turn about their own Z and
 * the armature's quarter turn about X sends that axis to world −Y, so the
 * sign flips on the way out. That inversion is exactly the kind of thing the
 * old reading hid, so the fixture keeps it rather than picking signs that
 * happen to look tidy.
 */
function turnClip(name: string, deg: number) {
  const times = [0, 0.35, 0.7, 1.05, 1.4];
  const values: number[] = [];
  for (const t of times) {
    const u = t / 1.4;
    // Smoothstep, so the clip is not linear in time — a part turn playing a
    // fraction of the timeline does not deliver that fraction of the angle.
    const eased = u * u * (3 - 2 * u);
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 0, 1), (deg / DEG) * eased)
      .multiply(HIPS_REST);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.AnimationClip(name, 1.4, [
    new THREE.QuaternionKeyframeTrack("Hips.quaternion", times, values),
  ]);
}

/** The reading this module replaced: Y-Euler at the ends, subtracted. */
function eulerDifference(clip: THREE.AnimationClip) {
  const v = clip.tracks[0]!.values;
  const yawOf = (i: number) => {
    const [x, y, z, w] = [v[i]!, v[i + 1]!, v[i + 2]!, v[i + 3]!];
    return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
  };
  return yawOf(v.length - 4) - yawOf(0);
}

test("boneToRig finds the quarter turn the armature carries", () => {
  const { wrap, hips } = rig();
  const toRig = boneToRig(hips, wrap);
  ok(
    toRig.angleTo(ARMATURE) < 1e-9,
    `expected the armature's rotation, got ${toRig.toArray().join(", ")}`,
  );
});

test("a ninety-degree turn clip measures ninety degrees", () => {
  const { wrap, hips } = rig();
  const toRig = boneToRig(hips, wrap);
  for (const deg of [90, -90]) {
    const got = clipYaw(turnClip("Turn", deg), "Hips", toRig)! * DEG;
    ok(
      Math.abs(Math.abs(got) - 90) < 0.01,
      `expected 90 degrees, measured ${got.toFixed(2)}`,
    );
  }
});

test("the two turn clips are exact mirrors of each other", () => {
  const { wrap, hips } = rig();
  const toRig = boneToRig(hips, wrap);
  const left = clipYaw(turnClip("Turn_Left_90", -90), "Hips", toRig)!;
  const right = clipYaw(turnClip("Turn_Right_90", 90), "Hips", toRig)!;
  ok(
    Math.abs(left + right) < 1e-6,
    `expected mirrors, got ${(left * DEG).toFixed(2)} and ${(right * DEG).toFixed(2)}`,
  );
});

// THE BUG, PINNED.
//
// Six separate attempts were made on a flicker at the end of the buffalo's
// turns before the cause turned out to be the measurement rather than
// anything in the animation. The reading below is the one that was there,
// and on this rig it is wrong by eleven degrees WITH A SIGN — short one way
// and long the other — which is why the flicker looked like it had a side
// and why fixing one direction never fixed the other.
test("the reading this replaced is wrong, and asymmetrically so", () => {
  const left = eulerDifference(turnClip("Turn_Left_90", -90)) * DEG;
  const right = eulerDifference(turnClip("Turn_Right_90", 90)) * DEG;
  ok(
    Math.abs(left - 78.5) < 1.5,
    `the old reading should be short on a left turn, got ${left.toFixed(2)}`,
  );
  ok(
    Math.abs(right + 101.4) < 1.5,
    `the old reading should be long on a right turn, got ${right.toFixed(2)}`,
  );
  ok(
    Math.abs(left + right) > 20,
    "the old reading's error should not cancel between the two directions",
  );
});

// Why the hand-off samples the clip instead of scaling the arc.
//
// A turn shorter than the clip plays a fraction of the timeline. The clip is
// eased, so that fraction of the TIME is not that fraction of the ANGLE, and
// the gap is what the body snapped through at the end of a small correction.
test("half the timeline is not half the rotation", () => {
  const { wrap, hips } = rig();
  const toRig = boneToRig(hips, wrap);
  const clip = turnClip("Turn_Left_90", -90);
  const quarter = Math.abs(clipYawAt(clip, "Hips", 1.4 * 0.25, toRig)! * DEG);
  ok(
    Math.abs(quarter - 22.5) > 4,
    `a quarter of the timeline should not be a quarter of the turn, got ${quarter.toFixed(2)}`,
  );
});

test("sampling mid-clip never exceeds the clip's own total", () => {
  const { wrap, hips } = rig();
  const toRig = boneToRig(hips, wrap);
  for (const deg of [90, -90]) {
    const clip = turnClip("Turn", deg);
    let last = -1;
    for (let i = 0; i <= 40; i++) {
      // Magnitude, so the check reads the same for either direction.
      const got = Math.abs(
        clipYawAt(clip, "Hips", (1.4 * i) / 40, toRig)! * DEG,
      );
      ok(
        got >= last - 1e-6 && got <= 90.01,
        `${deg} sample at ${i}/40 went backwards or overshot: ${got.toFixed(2)}`,
      );
      last = got;
    }
  }
});

test("a clip that does not drive the bone measures nothing", () => {
  const { wrap, hips } = rig();
  const toRig = boneToRig(hips, wrap);
  const clip = new THREE.AnimationClip("Graze", 1, []);
  ok(clipYaw(clip, "Hips", toRig) == null, "expected null, not a guess");
});
