# Modular Kerala paddy and bamboo — review build

Paddy files: `../../models/nature/paddy-modular/` relative to kids-assets/qa-ground.
Use a 4-unit square placement grid. Field tiles are 4×4, centered at their
origin. For example, place field centers at (2,0,2), (6,0,2), (2,0,6).
Place varambu junctions at grid intersections (0,0,0), (4,0,0), etc.
Bund arms extend 2 units from each junction and meet neighboring arms.
Rotate junctions around Y in 90-degree increments as required.
Select straight, corner, T, cross or end pieces for the desired boundaries.
The rice surface is flat at Y=0; bund tops are approximately 0.18 units high.
Bund endpoint dimensions are fixed; intermediate widths/heights vary subtly.

Seven paddy GLBs total 136,868 bytes. Two rice variants contain 902 and 812
triangles; the five bund pieces contain 32–98 triangles each. Standard glTF
materials and geometry require no extra decoder or texture downloads.

`../models/nature/KeralaBambooGroves.glb` (relative to kids-assets) contains
three root-level cluster variants sharing material definitions. Clone a root
child at Y=0 and vary rotation/spacing to assemble groves.

`paddy_joined_preview.png` and `bamboo_variants.png` are Blender renders of
the generated geometry. These are review builds, not a claim that all earlier
texture, vegetation, or complete world tasks are finished. No TS/TSX changed.
The paddy depicts young planted rice, not a mature dense crop.
