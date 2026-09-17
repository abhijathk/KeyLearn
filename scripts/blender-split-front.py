"""
Cuts a building into the part that must be REAL and the part that can be flat.

  blender -b -P scripts/blender-split-front.py -- in.glb front.glb body.glb 0.34

A two-storey mansion seen from a fixed camera thirty units away has almost no
depth the player can ever perceive. Its façade could be painted on a plank and
nobody would know — EXCEPT for the portico standing in front of it, which is
the one part with real overlap: columns against a wall, a balcony throwing
shade on what is behind it, steps catching the light on their treads. That
projecting mass is what tells an eye it is looking at a building rather than
at a picture of one, and it is a fraction of the geometry.

So the model is cut on a plane parallel to the façade. Everything forward of
it is kept as geometry; everything behind becomes the card. The cut is a
BISECT rather than a face-by-face sort, so the columns come away with clean
edges instead of a ragged fringe of half-triangles.

`--at` is the fraction of the model's DEPTH that stays solid, measured from
the front. It is a number to look at rather than to reason about: too little
and the columns are sheared off at the shaft, too much and the card stops
being most of the building, which was the entire point.
"""
import sys
import bmesh
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
src, out_front, out_body = argv[0], argv[1], argv[2]
FRAC = float(argv[3]) if len(argv) > 3 else 0.34

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if len(meshes) != 1:
    raise SystemExit(f"expected one mesh, found {len(meshes)}")
obj = meshes[0]
bpy.context.view_layer.objects.active = obj

# glTF is Y-up and Blender is Z-up, so the model's FRONT (+Z in glTF) is -Y
# here after import. Measured rather than assumed: the axis with the smallest
# extent on a building this shape is its depth, and the front is the end the
# portico sticks out of.
lo = [min(v.co[i] for v in obj.data.vertices) for i in range(3)]
hi = [max(v.co[i] for v in obj.data.vertices) for i in range(3)]
depth = hi[1] - lo[1]
cut = lo[1] + depth * FRAC
print(f"[split] depth {depth:.4f} on Y, cutting at {cut:.4f} ({FRAC:.2f} from the front)")


def carve(keep_front: bool, path: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    dup = obj.copy()
    dup.data = obj.data.copy()
    bpy.context.collection.objects.link(dup)
    bpy.context.view_layer.objects.active = dup
    dup.select_set(True)

    me = dup.data
    bm = bmesh.new()
    bm.from_mesh(me)
    # Bisect first, so the cut runs THROUGH faces that straddle the plane and
    # both halves get a straight edge. Without it a column sliced mid-shaft
    # loses whichever triangles happened to have their centre on the wrong
    # side, which reads as bites taken out of it.
    bmesh.ops.bisect_plane(
        bm,
        geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
        plane_co=(0, cut, 0),
        plane_no=(0, 1, 0),
        clear_inner=False,
        clear_outer=False,
    )
    bm.faces.ensure_lookup_table()
    doomed = [
        f for f in bm.faces
        if (sum(v.co.y for v in f.verts) / len(f.verts) > cut) == keep_front
    ]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.to_mesh(me)
    bm.free()
    print(f"[split] {'front' if keep_front else 'body '}: {len(me.polygons)} faces")

    bpy.ops.object.select_all(action="DESELECT")
    dup.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_image_format="AUTO", export_yup=True,
    )
    bpy.data.objects.remove(dup, do_unlink=True)


carve(True, out_front)
carve(False, out_body)
print("[split] done")
