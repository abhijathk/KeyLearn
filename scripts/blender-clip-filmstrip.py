"""
Render a filmstrip of one clip, straight from the GLB, to judge the motion.

    blender -b -P scripts/blender-clip-filmstrip.py -- <in.glb> <out-dir> <Clip> [frames] [view]

Measurement catches a hoof through the floor; it cannot tell you that an
animal reads as crouching rather than resting, or that a calf is climbing
into the sky. That needs looking at the thing move, and the browser harness
can only show one instant at a time.

WORKBENCH, NOT EEVEE. Workbench renders this about sixty times faster here
and is the better engine for judging motion anyway: flat shading with a
cavity pass shows silhouette and limb position clearly, where a lit render
mostly shows the texture.

The camera is orthographic and square to the body, because every question
being asked here — is the barrel on the ground, is that leg folded under or
splayed out, is the muzzle at the grass — is a question about the side view.
"""
import bpy, sys, os, math

argv = sys.argv[sys.argv.index("--") + 1:]
src, outdir, clip = argv[0], argv[1], argv[2]
nframes = int(argv[3]) if len(argv) > 3 else 8
view = argv[4] if len(argv) > 4 else "side"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
if arm is None:
    raise SystemExit("no armature in " + src)

action = next((a for a in bpy.data.actions if a.name == clip
               or a.name.endswith("|" + clip) or a.name.split("|")[-1] == clip), None)
if action is None:
    names = sorted(a.name for a in bpy.data.actions)
    raise SystemExit("clip %r not found; have: %s" % (clip, names))

if arm.animation_data is None:
    arm.animation_data_create()
arm.animation_data.action = action
start, end = action.frame_range

# THE ANIMAL, POSED — not the scene, and not the bind pose.
#
# Framing on every MESH in the scene put the camera three hundred units back
# and rendered the cow as one white pixel: the glTF import leaves a stray
# `Icosphere` in the scene (it is not in the file — checked) and it is two
# units across, where the cow, under an armature scaled to 0.01, is about a
# third of one. Framing on the SKINNED mesh alone fixes that.
#
# Evaluated through the depsgraph so the box is the posed silhouette rather
# than the bind pose: a lying-down animal and a standing one need different
# framing, and the bind box would report the same for both.
from mathutils import Vector
skinned = [o for o in bpy.data.objects
           if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)]
if not skinned:
    skinned = [o for o in bpy.data.objects if o.type == "MESH" and o.parent is arm]

def frame_bounds(fr):
    sc = bpy.context.scene
    sc.frame_set(fr)
    deps = bpy.context.evaluated_depsgraph_get()
    lo = [1e9] * 3
    hi = [-1e9] * 3
    for o in skinned:
        ev = o.evaluated_get(deps)
        me = ev.to_mesh()
        for v in me.vertices:
            w = o.matrix_world @ v.co
            for i in range(3):
                lo[i] = min(lo[i], w[i]); hi[i] = max(hi[i], w[i])
        ev.to_mesh_clear()
    return lo, hi

# Over the whole clip, so nothing swings out of frame mid-motion.
lo = [1e9] * 3
hi = [-1e9] * 3
for i in range(6):
    f = start + (end - start) * i / 5
    l, h = frame_bounds(int(round(f)))
    for i2 in range(3):
        lo[i2] = min(lo[i2], l[i2]); hi[i2] = max(hi[i2], h[i2])
size = max(hi[i] - lo[i] for i in range(3))
mid = [(lo[i] + hi[i]) / 2 for i in range(3)]
# Vertically centred on the animal's own mid-height but never below the
# floor, so the ground line stays in shot and "is it on the floor" is
# answerable by eye.
mid[2] = max(mid[2], size * 0.25)
print("BOUNDS lo=%s hi=%s size=%.4f" % ([round(v,4) for v in lo], [round(v,4) for v in hi], size))

cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = size * 1.35
# CLIPPING SET FROM THE SUBJECT'S SIZE, not left at Blender's defaults.
#
# This rig lives under an armature scaled to 0.01, so a whole cow is about
# four thousandths of a Blender unit across. The default near plane is 0.1 —
# twenty times the entire animal — so every frame rendered pure black with
# the subject clipped away in front of the camera.
cam_data.clip_start = size * 0.01
cam_data.clip_end = size * 200
cam = bpy.data.objects.new("cam", cam_data)
bpy.context.scene.collection.objects.link(cam)
d = size * 20
if view == "side":
    # TILTED TWELVE DEGREES, not dead level. A ground plane seen exactly
    # edge-on is a zero-thickness line and renders as nothing, so a strictly
    # side-on camera answers the silhouette question but not the one that
    # matters most here — is the animal ON the floor. A small elevation puts
    # the floor in shot and still reads as a side view.
    tilt = math.radians(22)
    cam.location = (mid[0] + d * math.cos(tilt), mid[1], mid[2] + d * math.sin(tilt))
    cam.rotation_euler = (math.radians(90) - tilt, 0, math.radians(90))
elif view == "front":
    cam.location = (mid[0], mid[1] - d, mid[2])
    cam.rotation_euler = (math.radians(90), 0, 0)
else:  # three-quarter — aimed, not guessed at with fixed Euler angles
    import mathutils
    cam.location = (mid[0] + d * 0.75, mid[1] - d * 0.6, mid[2] + d * 0.30)
    look = mathutils.Vector(mid) - cam.location
    cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam

# A ground plane, so "is it on the floor" is answerable by eye. y=0 is the
# floor in this pack's node space, which the importer maps to world z.
bpy.ops.mesh.primitive_plane_add(size=size * 8, location=(mid[0], mid[1], 0))
ground = bpy.context.active_object
gm = bpy.data.materials.new("ground")
gm.use_nodes = False
gm.diffuse_color = (0.30, 0.38, 0.22, 1)
ground.data.materials.append(gm)

sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.render.resolution_x, sc.render.resolution_y = 520, 360
sc.render.film_transparent = False
sh = sc.display.shading
sh.light = "STUDIO"
sh.show_cavity = True
sh.show_shadows = True
sh.color_type = "MATERIAL"

am = bpy.data.materials.new("hide")
am.use_nodes = False
am.diffuse_color = (0.62, 0.42, 0.28, 1)
for o in skinned:
    o.data.materials.clear()
    o.data.materials.append(am)

os.makedirs(outdir, exist_ok=True)
for i in range(nframes):
    f = start + (end - start) * i / max(1, nframes - 1)
    sc.frame_set(int(round(f)))
    sc.render.filepath = os.path.join(outdir, "%s_%02d.png" % (clip, i))
    bpy.ops.render.render(write_still=True)
print("FILMSTRIP OK %s %d frames -> %s" % (clip, nframes, outdir))
