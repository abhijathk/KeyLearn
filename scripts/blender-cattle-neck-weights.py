"""
Make the cattle's neck joints actually carry the neck.

    blender -b -P scripts/blender-cattle-neck-weights.py -- <in.glb> <out.glb>

`buffalo-add-neck.mjs` inserts `neck0` and `neck1` between `chest` and `head`
and then moves skin weights onto them. Its weighting is written around the
buffalo's proportions, and on the cattle it transfers almost nothing:
measured on the cow, `head` keeps 7408 units of weight while `neck0` gets 42
and `neck1` gets 9, with no vertex anywhere exceeding 0.10 on either. The
joints are present, every clip dutifully rotates them, and the skin does not
move. That is why the cow could not reach the grass no matter how far the
neck was bent, and why lowering the BODY was the only thing that had any
effect — which in turn drove her hooves through the floor.

The cause is geometric. This rig stacks its torso joints: chest to head is
0.00043 across, while the skin weighted to `head` spans 0.00081 and reaches
0.00062 BEYOND the head joint. So the skull sits on a long lever out in front
of the last joint, and the two inserted joints land inside the first third of
the lump. Splitting the joint-to-joint offset, which is what the buffalo tool
does, puts them in the wrong place for this animal.

So the axis used here is the one the GEOMETRY defines — from the chest joint
to the most forward head-weighted vertex, the muzzle — rather than the one
the skeleton defines. Weight held by `head` is then shared along that axis:
the base of the neck to `neck0`, the middle to `neck1`, the skull to `head`.

Per-vertex weight sums are conserved exactly: only the split between three
bones of one chain changes, never the total. A vertex that lost weight would
collapse toward the origin and tear the animal open.
"""
import bpy, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
mesh = next(o for o in bpy.data.objects if o.type == "MESH"
            and any(m.type == "ARMATURE" for m in o.modifiers))

for n in ("chest", "neck0", "neck1", "head"):
    if n not in mesh.vertex_groups:
        raise SystemExit("missing vertex group %r — run buffalo-add-neck.mjs first" % n)

# ONE SPACE, NOT TWO. `bone.head_local` is in the ARMATURE's space and
# `vertex.co` is in the MESH's; the two objects carry different transforms
# here, so mixing them gave a chest-to-muzzle axis of 0.107 for an animal
# that is 0.004 across — a direction picked out of nowhere. Everything below
# works in world space.
inv = mesh.matrix_world.inverted()
chest = inv @ (arm.matrix_world @ arm.data.bones["chest"].head_local)
hi = mesh.vertex_groups["head"].index

# The muzzle: the head-weighted vertex furthest from the chest joint. Using
# the skin rather than the `head` joint is the whole point — the joint is at
# the base of the skull, the muzzle is the far end of it.
far, muzzle = -1.0, None
pool_of = {}
for v in mesh.data.vertices:
    w = 0.0
    for g in v.groups:
        if g.group == hi:
            w = g.weight
            break
    if w <= 1e-6:
        continue
    pool_of[v.index] = w
    d = (v.co - chest).length
    if d > far:
        far, muzzle = d, v.co.copy()

axis = muzzle - chest
L2 = axis.length_squared
print("NECK axis chest->muzzle length %.6f over %d weighted vertices" % (axis.length, len(pool_of)))

def smoothstep(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)

# ── WHERE THE SKULL STARTS, MEASURED ─────────────────────────────────────
#
# THE SKULL IS ONE RIGID THING AND MUST STAY ONE RIGID THING. The first
# version of this split the head's weight purely by position along the
# chest->muzzle axis, and it tore the head apart: a cow's horns and ears do
# not sit forward on that axis. Measured on this rig, the HORN TIPS project
# to s = 0.33..0.42 — the middle of the span, right where neck weight was
# being handed out. So the face followed `head` while the horns and ears
# followed `neck1`, and the moment the head turned relative to the neck they
# came away from it.
#
# It matters more here than on most rigs: `earend`, `R_earend` and `headend`
# carry NO weight at all on the cattle, so there is nothing else holding the
# ears and horns on. They are part of the `head` lump and must travel with
# it.
#
# The boundary is therefore taken from the geometry rather than from the
# skeleton (the head and chest joints are nearly co-located here, so a
# nearest-joint split cannot separate neck from skull at all — it claimed
# 7477 of 9413 vertices as skull and left the neck carrying 85 units again).
# Below s=0.16 is neck tube; above s=0.26 is skull, which puts the horns
# comfortably inside it. The band between the two blends, so the skin does
# not crease at the join.
SKULL_FROM, SKULL_TO = 0.16, 0.26
JOINTS = [("neck0", 0.30), ("neck1", 0.72)]
WIDTH = 0.55

moved, skull = 0, 0
for vi, pool in pool_of.items():
    co = mesh.data.vertices[vi].co
    s = (co - chest).dot(axis) / L2
    s = max(0.0, min(1.0, s))
    skullness = smoothstep((s - SKULL_FROM) / (SKULL_TO - SKULL_FROM))
    if skullness >= 0.999:
        skull += 1
        continue                       # pure skull: leave it entirely on `head`
    neck_pool = pool * (1.0 - skullness)
    # Position WITHIN the neck tube, so the two joints share it evenly rather
    # than both crowding the base.
    u = max(0.0, min(1.0, s / SKULL_TO))
    share = [max(0.0, 1.0 - abs(u - pos) / WIDTH) for _, pos in JOINTS]
    tot = sum(share)
    if tot <= 1e-9:
        continue
    mesh.vertex_groups["head"].add([vi], pool * skullness, "REPLACE")
    for (name, _), w in zip(JOINTS, share):
        mesh.vertex_groups[name].add([vi], neck_pool * (w / tot), "REPLACE")
    moved += 1

print("NECK skull kept whole on %d vertices; neck split over %d" % (skull, moved))

# ── FOUR INFLUENCES, BECAUSE THAT IS ALL glTF CARRIES ────────────────────
#
# Splitting one bone's weight can push a vertex past four influences, and the
# exporter then silently drops the smallest — the vertex arrives in the game
# weighing less than 1 and drifts toward the origin. Pruning to the four
# largest and renormalising here makes the file say exactly what the game
# will do with it.
for v in mesh.data.vertices:
    gs = sorted(((g.group, g.weight) for g in v.groups), key=lambda x: -x[1])
    if len(gs) <= 4:
        continue
    keep, drop = gs[:4], gs[4:]
    tot = sum(w for _, w in keep)
    if tot <= 1e-9:
        continue
    for gi, _ in drop:
        mesh.vertex_groups[gi].remove([v.index])
    for gi, w in keep:
        mesh.vertex_groups[gi].add([v.index], w / tot, "REPLACE")

worst, orphan = 0.0, 0
for v in mesh.data.vertices:
    s = sum(g.weight for g in v.groups)
    if s < 1e-6:
        orphan += 1
    worst = max(worst, abs(s - 1.0))
print("NECK reweighted %d vertices; worst weight-sum deviation %.6f; orphans %d"
      % (moved, worst, orphan))

import collections
tot = collections.Counter()
for v in mesh.data.vertices:
    for g in v.groups:
        tot[mesh.vertex_groups[g.group].name] += g.weight
for n in ("head", "neck0", "neck1", "chest"):
    print("NECK carries %-6s %8.1f" % (n, tot[n]))

bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB",
                          export_animations=True, export_skins=True)
print("NECK wrote %s" % dst)
