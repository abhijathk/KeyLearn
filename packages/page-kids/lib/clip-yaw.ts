// How far an animation clip actually turns an animal.
//
// Its own file because it is the answer to a bug that was re-fixed five
// times from the wrong premise, and because the premise is now pinned by
// tests that do not need a GLB to run — see clip-yaw.test.ts.

import * as THREE from "three";

/**
 * The rotation that carries a bone's own frame into the rig's — the frame
 * `wrap.rotation.y` turns in. Every ancestor's rotation up to, but not
 * including, the wrap.
 *
 * THE BUFFALO'S HIPS DO NOT YAW ABOUT Y. Its armature carries a quarter
 * turn about X, left over from a Z-up export, so the hips turn about their
 * OWN Z to swing the animal about the world's Y. Reading a yaw off that
 * bone without this is reading the wrong axis, and the numbers it gives
 * back are wrong in a way that still looks plausible.
 */
export function boneToRig(
  bone: THREE.Object3D,
  root: THREE.Object3D,
): THREE.Quaternion {
  const q = new THREE.Quaternion();
  for (let n = bone.parent; n != null && n !== root; n = n.parent) {
    q.premultiply(n.quaternion);
  }
  return q;
}

/** A bone's quaternion track within a clip, or null when it has none. */
export const quatTrack = (clip: THREE.AnimationClip, bone: string) =>
  clip.tracks.find(
    (t) =>
      t.name === `${bone}.quaternion` || t.name.endsWith(`/${bone}.quaternion`),
  ) ?? null;

/** What a bone-space delta rotation is worth as yaw in the rig's frame. */
export function rigYaw(d: THREE.Quaternion, toRig: THREE.Quaternion): number {
  const q = toRig.clone().multiply(d).multiply(toRig.clone().invert());
  return Math.atan2(
    2 * (q.w * q.y + q.x * q.z),
    1 - 2 * (q.y * q.y + q.z * q.z),
  );
}

/**
 * The yaw a clip has put on a bone by time `t`, relative to its own first
 * keyframe, in radians and signed — measured in the rig's frame.
 *
 * A DELTA, NOT A DIFFERENCE OF TWO HEADINGS, and that distinction is the
 * whole bug this replaced. The old reading took the Y component of the
 * hips' Euler angles at the first and last keys and subtracted them. That
 * is only the rotation between them when the pose has no pitch or roll —
 * and the buffalo's hips have both, sitting under a quarter turn about X.
 * The Y component then runs fast through one sign and slow through the
 * other, so a clean ninety-degree clip read as +78.6 turning one way and
 * −101.4 turning the other, and the code believed it.
 *
 * Composing the rotations instead and reading the result in the rig's own
 * frame gives the two clips what they actually are: an exact ±90.00°, and
 * exact mirrors of each other.
 *
 * Returns null when the clip does not drive that bone at all, which is the
 * honest answer and lets the caller keep its own assumption.
 */
export function clipYawAt(
  clip: THREE.AnimationClip,
  bone: string,
  t: number,
  toRig: THREE.Quaternion,
): number | null {
  const track = quatTrack(clip, bone);
  const v = track?.values;
  const times = track?.times;
  if (v == null || times == null || v.length < 8) {
    return null;
  }
  const last = times.length - 1;
  const now = new THREE.Quaternion();
  if (!(t > times[0]!)) {
    now.fromArray(v as unknown as number[], 0);
  } else if (t >= times[last]!) {
    now.fromArray(v as unknown as number[], last * 4);
  } else {
    // The keys are sparse and unevenly spaced — gltfpack drops any key
    // linear interpolation can reproduce — so the pose has to be sampled
    // the way the mixer samples it, not snapped to the nearest key.
    let i = 0;
    while (i < last - 1 && times[i + 1]! < t) i++;
    const span = times[i + 1]! - times[i]!;
    const dst: number[] = [0, 0, 0, 0];
    THREE.Quaternion.slerpFlat(
      dst,
      0,
      v as unknown as number[],
      i * 4,
      v as unknown as number[],
      (i + 1) * 4,
      span > 0 ? (t - times[i]!) / span : 0,
    );
    now.fromArray(dst);
  }
  const from = new THREE.Quaternion().fromArray(v as unknown as number[], 0);
  return rigYaw(now.multiply(from.invert()), toRig);
}

/** The net yaw a clip puts on a bone over its whole length. */
export const clipYaw = (
  clip: THREE.AnimationClip,
  bone: string,
  toRig: THREE.Quaternion,
) => clipYawAt(clip, bone, Infinity, toRig);

/**
 * WHEN THIS CLIP HAS TURNED THE ANIMAL `want` RADIANS — the clip time to
 * stop at, not the fraction of the timeline the angle looks like.
 *
 * The difference is the whole reason this exists. A turn clip is eased: it
 * starts slow, peaks near the middle and settles. Playing `want / total` of
 * the TIMELINE therefore delivers well under `want` of ANGLE — about a
 * third of it, a quarter of the way in. The animal then finished its turn
 * still short of where it meant to be, asked for the rest, got a third of
 * that, and asked again: a stutter of clips a few frames long, each one
 * crossfading over longer than it played. That is the shiver, and the
 * winding is the same thing seen from further away.
 *
 * Bisection rather than a table, because the answer is wanted once per turn
 * and the curve is monotone — every sample between the ends is bracketed by
 * the ones either side of it.
 *
 * Returns null when the clip does not drive the bone, and the clip's own
 * duration when it never reaches `want`, which is the honest cap: it cannot
 * turn further than it turns.
 */
export function clipTimeForYaw(
  clip: THREE.AnimationClip,
  bone: string,
  want: number,
  toRig: THREE.Quaternion,
): number | null {
  const total = clipYaw(clip, bone, toRig);
  if (total == null) {
    return null;
  }
  const goal = Math.min(Math.abs(want), Math.abs(total));
  if (!(goal > 0)) {
    return 0;
  }
  let lo = 0;
  let hi = clip.duration;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const at = Math.abs(clipYawAt(clip, bone, mid, toRig) ?? 0);
    if (at < goal) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return hi;
}
