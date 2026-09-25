#!/usr/bin/env bash
# Builds the loading card's small copy of a child character:
#   scripts/kids-loader-lite.sh <Name> <RunClip>     e.g. Explorer6 Run, Peeli Run_InPlace
# Reads root/public/kids-assets/models/ak-3d-pack/<Name>.glb and writes
# root/public/kids-assets/models/loader/<Name>.glb: the one run clip, the mesh
# simplified (glb-simplify-skinned, ratio 0.4), each KTX2 texture cut to its
# 256-px mip level and re-encoded, then meshopt-compressed and verified.
# Needs basisu on PATH. See LOADER_LITE in packages/page-kids/lib/world.ts.
set -euo pipefail
N=$1; KEEP=$2
ROOT=$(cd "$(dirname "$0")/.." && pwd); cd "$ROOT"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
node scripts/glb-decompress.mjs root/public/kids-assets/models/ak-3d-pack/$N.glb $T/plain.glb >/dev/null
DROP=$(node -e 'const b=require("fs").readFileSync(process.argv[1]);const jl=b.readUInt32LE(12);const j=JSON.parse(b.subarray(20,20+jl));console.log((j.animations||[]).map(a=>a.name).filter(n=>n!==process.argv[2]).join(" "))' $T/plain.glb "$KEEP")
node scripts/glb-drop-clips.mjs $T/plain.glb $T/run.glb $DROP >/dev/null
node scripts/glb-simplify-skinned.mjs $T/run.glb $T/cur.glb --ratio 0.4 | grep triangles
NIMG=$(node -e '
const fs=require("fs");const b=fs.readFileSync(process.argv[1]);const jl=b.readUInt32LE(12);const j=JSON.parse(b.subarray(20,20+jl));const bin=b.subarray(20+jl+8);
(j.images||[]).forEach((im,i)=>{const v=j.bufferViews[im.bufferView];fs.writeFileSync(process.argv[2]+"/img-"+i+".ktx2",bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength));});
console.log((j.images||[]).length)' $T/cur.glb $T)
for i in $(seq 0 $((NIMG-1))); do
  (cd $T && basisu -unpack img-$i.ktx2 -format_only 0 -no_ktx >/dev/null 2>&1)
  PNG=$(cd $T && for f in img-${i}_unpacked_*level_*_face_0_layer_0000.png; do w=$(file "$f" | sed -E 's/.* ([0-9]+) x [0-9]+.*/\1/'); [ "$w" -ge 256 ] && echo "$w $f"; done | sort -n | head -1 | cut -d' ' -f2)
  (cd $T && basisu -ktx2 -mipmap -q 128 "$PNG" -output_file small-$i.ktx2 >/dev/null 2>&1)
  node scripts/glb-swap-texture.mjs $T/cur.glb $T/next.glb $i $T/small-$i.ktx2 | head -1
  mv $T/next.glb $T/cur.glb
done
mkdir -p root/public/kids-assets/models/loader
node scripts/glb-compress.mjs $T/cur.glb root/public/kids-assets/models/loader/$N.glb --verify --indices | tail -1
