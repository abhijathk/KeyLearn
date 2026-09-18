# Kerala Ground & Vegetation QA

Terrain treatment: **flat Y=0 playable ground**. Distant mountains are
reserved for a separate low-contrast background layer and are not included
in the terrain textures or plant GLBs.

## Ground textures

All six textures are 512×512 RGB JPEGs. Diffuse maps were generated with
tileable edge-preserving sources and checked with 2×2 previews; no central
join is visibly stronger than the interior pattern. Normal maps are derived
from the corresponding diffuse luminance with restrained tangent-space
strength.

| Diffuse | Bytes | Normal | Bytes | Seam QA |
|---|---:|---|---:|---|
| paddy_field_diff.jpg | 108,659 | paddy_field_nor.jpg | 29,155 | PASS |
| laterite_mud_diff.jpg | 116,694 | laterite_mud_nor.jpg | 38,345 | PASS |
| coconut_grove_diff.jpg | 122,182 | coconut_grove_nor.jpg | 41,899 | PASS |

The generated diffuse maps use the requested Kerala palette: green wet
paddy, warm rust-red laterite, and pale dry coconut-grove soil.

## Plant collections

| GLB | Root variants | Triangles (approx.) | Size | Cameras/lights/animation |
|---|---:|---:|---:|---|
| KeralaGrassTufts.glb | 6 | 54 | 4.4 KB | none |
| KeralaLeafShrubs.glb | 5 | 42 | 3.3 KB | none |
| KeralaGroundCover.glb | 6 | 36 | 3.6 KB | none |

Combined plant payload: **11.3 KB**, under the 0.30 MB budget. Every variant
is a direct scene-root child, centered at x/z≈0 with base y=0, and uses simple
Y-up low-poly geometry with shared flat materials.

## QA previews

- `01_ground_texture_contact_sheet.png`
- `paddy_field_diff_2x2.png`
- `laterite_mud_diff_2x2.png`
- `coconut_grove_diff_2x2.png`

The source reference files were not available in the workspace, so the
ground palette was matched to the existing project nature textures found in
the local asset tree where possible. No TypeScript/TSX files were modified.
