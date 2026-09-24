"""
Give the cattle a spine and a neck.

    blender -b -P scripts/blender-cattle-rig-refine.py -- <in.glb> <out.glb>

WHY THIS EXISTS. The cow and the calf ship a 27-bone rig whose entire torso
is two joints, `Hips` and `chest`, with the skull hanging straight off the
chest on a single `head` joint. There is no spine and there is no neck. The
tail alone has five joints — more than the torso and neck put together.

Everything a body does therefore has to be faked by rotating two blocks. The
back cannot arch, cannot dip as a leg takes load, and cannot round when the
animal lies down. The neck cannot reach: lowering the head to graze swings
the whole neck and skull rigidly about one point at its base, so the muzzle
travels on a long arc and the animal reads as a puppet hinged at the
shoulders. No amount of work in the clip authoring fixes that, because the
degrees of freedom are not in the rig.

WHAT IT ADDS, and no more:

    Hips -> spine1 -> spine2 -> chest      the back
    chest -> neck1 -> neck2 -> head        the neck

Four joints. They are inserted INTO the existing chains rather than added
beside them, so every bone that exists today still exists, still has the same
name, and still sits in the same place at rest. A clip that drives `head`
still drives `head`.

WEIGHTS ARE REDISTRIBUTED, NEVER REASSIGNED. Each vertex keeps exactly the
total weight it had; what changes is how that total is split along the chain
it already belonged to. A vertex weighted to `head` is shared out between
`neck1`, `neck2` and `head` according to how far along the neck it sits, and
likewise for `Hips`/`chest` along the back. Per-vertex sums are therefore
unchanged by construction, which is the one property that cannot be allowed
to drift: a vertex that loses weight collapses to the origin and tears a hole
in the animal.
"""
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
mesh = next(o for o in bpy.data.objects if o.type == "MESH"
            and any(m.type == "ARMATURE" for m in o.modifiers))

# ── where the real joints are ────────────────────────────────────────────
# Only bone HEADS carry meaning here. The importer invents a tail for any
# joint without a single obvious child, and those invented tails are 20-60x
# the actual joint spacing — so anything derived from bone length or
# direction is noise. Heads are the joint positions the file actually states.
def head_of(n):
    return arm.data.bones[n].head_local.copy()

CHAINS = [
    # (parent, child, [new bone names], fractions along parent->child)
    ("Hips", "chest", ["spine1", "spine2"], [0.34, 0.67]),
    ("chest", "head", ["neck1", "neck2"], [0.34, 0.67]),
]

bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm.data.edit_bones

created = []
for parent, child, names, fracs in CHAINS:
    p_head = eb[parent].head.copy()
    c_head = eb[child].head.copy()
    span = c_head - p_head
    prev = eb[parent]
    pts = [p_head + span * f for f in fracs] + [c_head]
    for i, name in enumerate(names):
        b = eb.new(name)
        b.head = pts[i]
        b.tail = pts[i + 1]
        b.parent = prev
        b.use_connect = False
        prev = b
        created.append(name)
    # The original child now hangs off the end of the new chain. Its own
    # children (the legs on `chest`, the ears and muzzle on `head`) are
    # untouched and come along with it.
    eb[child].parent = prev

bpy.ops.object.mode_set(mode="OBJECT")
print("RIG added: %s (now %d bones)" % (", ".join(created), len(arm.data.bones)))

# ── redistribute the weights along each new chain ────────────────────────
#
# A vertex's share is decided by where it sits along the chain axis, measured
# as a projection onto the parent->child line and clamped to it. The blend is
# a smooth tent per joint rather than a hard cut, so the skin bends
# continuously instead of creasing at each new joint.
for name in created:
    if name not in mesh.vertex_groups:
        mesh.vertex_groups.new(name=name)

def smoothstep(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)

for parent, child, names, fracs in CHAINS:
    p_head = head_of(parent)
    c_head = head_of(child)
    axis = c_head - p_head
    L2 = axis.length_squared
    if L2 < 1e-18:
        raise SystemExit("degenerate chain %s->%s" % (parent, child))
    # The joints now on this chain, in order, with their position along it.
    joints = [(parent, 0.0)] + [(n, f) for n, f in zip(names, fracs)] + [(child, 1.0)]
    gi = {n: mesh.vertex_groups[n].index for n, _ in joints}
    src_names = [parent, child]
    src_idx = [mesh.vertex_groups[n].index for n in src_names]

    moved = 0
    for v in mesh.data.vertices:
        pool = 0.0
        for g in v.groups:
            if g.group in src_idx:
                pool += g.weight
        if pool <= 1e-9:
            continue
        s = (v.co - p_head).dot(axis) / L2          # 0 at parent, 1 at child
        s = max(0.0, min(1.0, s))
        # Tent weights: each joint claims the vertex in proportion to its
        # nearness along the chain, normalised so the pool is conserved.
        share = []
        for _, pos in joints:
            d = abs(s - pos)
            share.append(max(0.0, 1.0 - d / 0.5))
        tot = sum(share)
        if tot <= 1e-9:
            continue
        for (n, _), w in zip(joints, share):
            add = pool * (w / tot)
            if add > 1e-6:
                mesh.vertex_groups[n].add([v.index], add, "REPLACE")
            else:
                mesh.vertex_groups[n].add([v.index], 0.0, "REPLACE")
        moved += 1
    print("RIG reweighted %s->%s over %d vertices" % (parent, child, moved))

# ── the one property that must not drift ─────────────────────────────────
worst = 0.0
orphan = 0
for v in mesh.data.vertices:
    s = sum(g.weight for g in v.groups)
    if s < 1e-6:
        orphan += 1
    worst = max(worst, abs(s - 1.0))
print("RIG weight-sum worst deviation from 1.0: %.6f ; orphaned vertices: %d" % (worst, orphan))

bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB",
                          export_animations=True, export_skins=True,
                          export_apply=False)
print("RIG wrote %s" % dst)
