"""
Retopologise a photogrammetry-style bake and re-bake its texture to fit.

  blender -b -P scripts/blender-retopo-bake.py -- in.glb out.glb TRIS TEXPX

WHY THIS AND NOT MORE COMPRESSION. These props will not decimate. The
attribute-aware simplifier floors at a third of the triangles it is given,
because a bake is split at every UV seam and arrives as hundreds of separate
shells. Welding the seams unlocks it completely -- and stretches the atlas
across every seam it welded, which shows as a speckled roof and laterite
with no edges. Both roads end at the same wall: the MESH cannot be reduced
while the TEXTURE is pinned to that mesh's exact vertices.

So unpin it. Decimate as hard as the silhouette allows, throw the inherited
UVs away, unwrap the result cleanly, and BAKE the original's colour onto the
new layout. The texture is then made to fit the low-poly mesh rather than
being dragged across it, and the seam damage cannot happen because there are
no inherited seams left to damage.

The bake is DIFFUSE COLOUR ONLY -- no direct light, no indirect, no ambient
occlusion. What comes out is the albedo that went in, resampled into a new
arrangement, which is the whole intent: this is a re-atlas, not a relight.
"""
import sys
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
src, out, want_tris, texpx = argv[0], argv[1], int(argv[2]), int(argv[3])
# HOW WILLING THE UNWRAPPER IS TO DISTORT BEFORE IT CUTS ANOTHER ISLAND, in
# radians, and it is per-prop because the right answer is about the SHAPE.
# A wide value makes few cuts and fewer vertices, which is cheaper -- and on
# the thatch house, whose roof is one big curved sweep, 1.55 unwrapped that
# roof as a single island so distorted that its straw went flat. Not the
# decimation: at 40,000 triangles it was just as flat. Cheap is the wrong
# call on anything that curves.
angle = float(argv[4]) if len(argv) > 4 else 1.15

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if len(meshes) != 1:
    raise SystemExit(f"expected one mesh, found {len(meshes)}")
hi = meshes[0]
hi.name = "hi"
src_tris = len(hi.data.loop_triangles) or len(hi.data.polygons)
print(f"[retopo] source {src_tris} faces")

# ── the low-poly ───────────────────────────────────────────────────────
lo = hi.copy()
lo.data = hi.data.copy()
lo.name = "lo"
bpy.context.collection.objects.link(lo)

bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = lo
lo.select_set(True)

# ── WELD FIRST, AND HERE IT IS FREE ────────────────────────────────────
#
# Welding a bake by position is what unlocks its simplifier -- it arrives
# split at every UV seam, as hundreds of shells meshopt will not collapse
# across -- and on its own it is unusable, because a welded vertex holds one
# texture coordinate where a seam vertex had two and the atlas stretches
# across every seam. That was measured and rejected.
#
# It costs NOTHING HERE. The inherited coordinates are about to be thrown
# away and the surface re-unwrapped from scratch, so there is no seam left
# for the weld to damage. The one objection to welding disappears the moment
# the texture stops being pinned to these particular vertices.
#
# Without it the decimated mesh carries the split: 29,000 vertices for
# 14,000 triangles, two per triangle, where a welded mesh runs at half of
# one. Those vertices are most of the file.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
print(f"[retopo] welded to {len(lo.data.vertices)} vertices")
# Hard edges stay hard, the rest smooths -- welding averaged every normal it
# merged, and without this a building's corners come back rounded.
bpy.ops.object.shade_auto_smooth(angle=0.663)

# ── DECIMATE IN PASSES, BECAUSE ONE IS NOT ALWAYS ENOUGH ───────────────
#
# Blender's collapse decimate stalls on very dense, very non-manifold input
# the same way meshopt does. MEASURED on the thatch house: 1,975,220 faces
# asked down to 9,000 in a single pass stopped at 33,140 and would not move
# — a ratio of 0.0046 applied once, and the collapser ran out of legal edges
# long before it ran out of budget.
#
# Asking again, with the ratio recomputed against what actually survived,
# gets it the rest of the way: each pass has a far gentler ratio to achieve
# and a cleaner mesh to do it on. It gives up when a pass stops making
# progress, so an impossible target fails loudly at the floor rather than
# looping.
for attempt in range(6):
    have = len(lo.data.polygons)
    if have <= want_tris * 1.08:
        break
    mod = lo.modifiers.new("dec", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = min(1.0, want_tris / max(1, have))
    bpy.ops.object.modifier_apply(modifier="dec")
    now = len(lo.data.polygons)
    print(f"[retopo] pass {attempt + 1}: {have} -> {now} faces")
    if now >= have * 0.98:
        # ── FLOORED: REBUILD THE TOPOLOGY INSTEAD OF EDITING IT ────────
        #
        # Some bakes cannot be collapsed at all. The thatch house is one:
        # its roof is hundreds of thousands of individual straws, each its
        # own shell, and a collapser will not destroy a component to meet a
        # budget. It stalled at 32,498 of 1,975,220 and a gentler second
        # pass moved it by two per cent.
        #
        # A voxel remesh does not edit that topology, it REPLACES it — one
        # watertight surface at a chosen resolution, components and all. It
        # throws away every bit of fine geometry in the process, which
        # anywhere else would be the objection and here is free: the detail
        # is about to be re-baked into the texture from the original mesh,
        # which is still sitting right there. The straws come back as
        # pixels.
        #
        # Voxel size is a fraction of the model, so it is the same decision
        # at any scale. 1/140th was NOT fine enough and the failure was
        # instructive: it swallowed the thatch house's veranda posts into the
        # wall behind them and left the bake painting torn white gashes
        # across surfaces that no longer matched the original. A remesh has
        # to resolve the THINNEST thing worth keeping, and on a building that
        # is a post, not a wall.
        print(f"[retopo] collapse floored at {now}; remeshing instead")
        dim = max(hi.dimensions)
        rm = lo.modifiers.new("vox", "REMESH")
        rm.mode = "VOXEL"
        rm.voxel_size = dim / 260.0
        bpy.ops.object.modifier_apply(modifier="vox")
        print(f"[retopo] remeshed to {len(lo.data.polygons)} faces")
        continue
print(f"[retopo] decimated to {len(lo.data.polygons)} faces")

# ── fresh UVs, the point of the exercise ───────────────────────────────
# Every inherited coordinate goes. `angle_limit` is what decides how much
# the unwrapper is willing to distort before it cuts another island; the
# default is generous and a building has plenty of hard corners to cut on.
# `island_margin` has to clear the mip chain, same as the blanking margin.
while len(lo.data.uv_layers) > 0:
    lo.data.uv_layers.remove(lo.data.uv_layers[0])
lo.data.uv_layers.new(name="baked")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=angle, island_margin=0.0, correct_aspect=True)
# ── AND THEN PACK THEM, WHICH IS NOT OPTIONAL ──────────────────────────
#
# `smart_project` CUTS the islands well and lays them out at WORLD SCALE.
# It does not scale them to fill the square, so on a two-metre building the
# islands landed in a corner using SEVEN PER CENT of the atlas, against the
# original bake's fifty-nine. Every surface was getting eight times fewer
# texels than it was paying for, and the result read as a soft texture --
# which is exactly what it was, at an eighth of the resolution.
#
# Nothing about this is visible in a triangle count, a file size or a
# simplification error. It shows up by measuring the summed UV area of the
# triangles, and then in the picture.
#
# `margin` is the gutter between islands. It has to clear the mip chain --
# the same reason the back-blanking dilates -- and every texel of it is
# atlas that carries nothing, so it is as small as that allows.
bpy.ops.uv.pack_islands(rotate=True, scale=True, margin=0.0035)
bpy.ops.object.mode_set(mode="OBJECT")

# ── somewhere to bake to ───────────────────────────────────────────────
img = bpy.data.images.new("atlas", texpx, texpx, alpha=False)
mat = bpy.data.materials.new("baked")
mat.use_nodes = True
nodes = mat.node_tree.nodes
tex = nodes.new("ShaderNodeTexImage")
tex.image = img
nodes.active = tex
# LINKED, not merely present. The node has to be `nodes.active` for the bake
# to target it, and wired into Base Color for the exporter to carry it -- do
# only the first and the GLB comes out with a flat colour and no texture at
# all, which is a silent and very convincing failure.
bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Metallic"].default_value = 0.0
bsdf.inputs["Roughness"].default_value = 0.6
lo.data.materials.clear()
lo.data.materials.append(mat)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 1
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False
scene.render.bake.use_selected_to_active = True
# The cage has to reach past the high-poly everywhere without reaching
# through it into the far side of a thin wall. A fiftieth of the model is
# comfortably both on props at this scale.
dim = max(hi.dimensions)
# HOW FAR THE RAYS REACH, and it has to cover how far the low-poly has
# MOVED from the original. A collapse keeps the new surface close to the old
# one, so a fiftieth of the model was enough. A voxel remesh does not: it
# rebuilds the surface on a grid and can sit a whole voxel off, and worst in
# the concave places — under a veranda, inside an eave — which is exactly
# where the misses showed as raw white gashes across the walls.
#
# A miss is silent. The bake simply leaves those texels as it found them, so
# the failure arrives as a finished-looking file with holes in its paint.
scene.render.bake.cage_extrusion = dim * 0.05
scene.render.bake.max_ray_distance = dim * 0.14
scene.render.bake.margin = max(4, texpx // 128)

bpy.ops.object.select_all(action="DESELECT")
hi.select_set(True)
lo.select_set(True)
bpy.context.view_layer.objects.active = lo
print("[retopo] baking...")
bpy.ops.object.bake(type="DIFFUSE")

img.file_format = "PNG"
img.filepath_raw = out + ".atlas.png"
img.save()

bpy.data.objects.remove(hi, do_unlink=True)
bpy.ops.object.select_all(action="DESELECT")
lo.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=out, export_format="GLB", use_selection=True,
    export_image_format="AUTO", export_yup=True,
)
print(f"[retopo] wrote {out}")
