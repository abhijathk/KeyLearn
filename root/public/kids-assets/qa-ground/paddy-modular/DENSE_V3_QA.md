# Dense modular paddy revision

Asset: `models/nature/paddy-modular/KeralaPaddy_Dense_v3.glb` under kids-assets.

- Exact size: 130,884 bytes (under the 150,000-byte paddy target).
- 13 root modules: two dense rice fields and eleven pre-oriented bund connections.
- 141 and 143 rice clumps per field, eight curved blades per clump.
- Bund shoulders have clustered grass, with the central walking strip open.
- Bund colour transitions use interpolated vertex colours: damp dark feet to worn earth above. The previous repeating red-earth texture is removed.
- Flat muddy brown-green water uses restrained normal-map ripples. Water colour has no repeating bands; reflections depend on scene lighting.
- 17 shared meshes, 1,526 unique stored triangles, five materials, one embedded 64×64 normal map. Instanced placements draw more triangles than the unique stored count.
- No animations, skins, cameras or additional decoder dependency.
- Buffer bounds checked; final packed GLB successfully reimported in Blender.
- Full Khronos validator has not been run for this revision.

The export render is `paddy_dense_v3_export_QA.png`. The working-scene render
is `paddy_dense_v3.png`. Earlier versions remain available.

Placement: field centres on (2+4x, 0, 2+4z), bund junctions on (4x, 0, 4z).
Use the pre-oriented connections; arbitrary rotation would disrupt winding seams.
For bund suffix digits: 0 points toward -Z, 1 toward -X, 2 toward +Z,
3 toward +X in the exported glTF coordinate system.
Field placement uses Blender-to-glTF Z sign conversion; the two field rows
can be extended in either Z direction because the boundary repeats every 4 units.

Runtime limitation: standard shared-mesh nodes save download bytes but do not
automatically batch three.js draw calls. Large fields should be instanced or
batched by the separate integration task; no TypeScript files were edited.
This is an updated review asset, not completed QA for the entire village pack.
