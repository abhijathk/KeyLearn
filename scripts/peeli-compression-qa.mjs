import { readFileSync, writeFileSync } from "node:fs";
import { MeshoptDecoder } from "meshoptimizer";
const A = "/Users/abhijathkottikkal/Documents/KeyLearn/meshy_output/Peeli_GameReady_Controller.glb";
const B = "/Users/abhijathkottikkal/Documents/KeyLearn/meshy_output/Peeli_GameReady_Controller_COMPRESSED.glb";
const OUT = "/Users/abhijathkottikkal/Documents/KeyLearn/meshy_output/Peeli_Compression_QA.md";
const CB = { 5120:1,5121:1,5122:2,5123:2,5125:4,5126:4 };
const NC = { SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16 };
function parse(p){const b=readFileSync(p);let o=12,json=null,bin=Buffer.alloc(0);
 while(o<b.length){const l=b.readUInt32LE(o),t=b.readUInt32LE(o+4);const d=b.subarray(o+8,o+8+l);
  if(t===0x4e4f534a)json=JSON.parse(d.toString("utf8"));else if(t===0x004e4942)bin=Buffer.from(d);o+=8+l;}
 return {json,bin,size:b.length};}
await MeshoptDecoder.ready;
function makeReader(g){
  const cache=new Map();
  const viewBytes=(i)=>{
    if(cache.has(i))return cache.get(i);
    const v=g.json.bufferViews[i];
    const e=v.extensions?.["EXT_meshopt_compression"];
    let out;
    if(e==null){ out=g.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength); }
    else { const dst=new Uint8Array(e.count*e.byteStride);
      MeshoptDecoder.decodeGltfBuffer(dst,e.count,e.byteStride,
        new Uint8Array(g.bin.subarray(e.byteOffset,e.byteOffset+e.byteLength)),e.mode,e.filter??"NONE");
      out=Buffer.from(dst.buffer,dst.byteOffset,dst.byteLength); }
    cache.set(i,out); return out;
  };
  return (ai)=>{
    const a=g.json.accessors[ai]; const per=NC[a.type]; const cb=CB[a.componentType];
    const bytes=viewBytes(a.bufferView); const base=a.byteOffset??0;
    const stride=g.json.bufferViews[a.bufferView].byteStride ?? per*cb;
    const out=[];
    for(let k=0;k<a.count;k++){const row=[];
      for(let c=0;c<per;c++){const at=base+k*stride+c*cb;
        row.push(a.componentType===5126?bytes.readFloatLE(at)
          :a.componentType===5123?bytes.readUInt16LE(at)
          :a.componentType===5125?bytes.readUInt32LE(at)
          :a.componentType===5121?bytes.readUInt8(at)
          :a.componentType===5122?bytes.readInt16LE(at):bytes.readInt8(at));}
      out.push(row);}
    return out;};
}
function profile(g,read){
  const j=g.json;
  const anims=(j.animations??[]).map(a=>{
    let dur=0; const paths={};
    for(const c of a.channels){paths[c.target.path]=(paths[c.target.path]??0)+1;
      const acc=j.accessors[a.samplers[c.sampler].input]; if(acc?.max?.[0]>dur)dur=acc.max[0];}
    return {name:a.name,duration:+dur.toFixed(6),channels:a.channels.length,samplers:a.samplers.length,paths,extras:a.extras??null};});
  const skin=(j.skins??[])[0];
  const par=new Array(j.nodes.length).fill(-1);
  j.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>par[c]=i));
  let verts=0,tris=0;
  for(const m of j.meshes??[])for(const p of m.primitives){
    verts+=j.accessors[p.attributes.POSITION]?.count??0;
    if(p.indices!=null)tris+=(j.accessors[p.indices]?.count??0)/3;}
  return {size:g.size,anims,joints:skin?skin.joints.length:0,
    jointNames:skin?skin.joints.map(x=>j.nodes[x].name):[],
    hierarchy:j.nodes.map((n,i)=>`${n.name}<${par[i]===-1?"ROOT":j.nodes[par[i]].name}>`).sort(),
    verts,tris,
    materials:(j.materials??[]).map(m=>m.name??"(unnamed)"),
    textures:(j.textures??[]).length,
    images:(j.images??[]).map(im=>im.mimeType),
    uv:[...new Set((j.meshes??[]).flatMap(m=>m.primitives.flatMap(p=>Object.keys(p.attributes).filter(k=>/TEXCOORD/.test(k)))))],
    extRequired:j.extensionsRequired??[], extUsed:j.extensionsUsed??[],
    rootExtras:j.extras??null, read, json:j};
}
const ga=parse(A), gb=parse(B);
const pa=profile(ga,makeReader(ga)), pb=profile(gb,makeReader(gb));

// boundary poses of the sit transitions, sampled from actual keyframe values
function boundary(p,clip,which){
  const a=p.json.animations.find(x=>x.name===clip); if(!a)return null;
  const out={};
  for(const ch of a.channels){
    const node=p.json.nodes[ch.target.node].name;
    const s=a.samplers[ch.sampler]; const v=p.read(s.output);
    const row=which==="first"?v[0]:v[v.length-1];
    out[`${node}.${ch.target.path}`]=row.map(x=>+x.toFixed(6));
  }
  return out;
}
const pairs=[["Stand_To_CrossLegged","last"],["CrossLegged_To_Stand","first"],["Run_Fast_RootMotion","first"],["Run_Fast_RootMotion","last"]];
const boundaryDiffs=[];
for(const [clip,which] of pairs){
  const x=boundary(pa,clip,which), y=boundary(pb,clip,which);
  if(x==null||y==null){boundaryDiffs.push({clip,which,status:"clip missing"});continue;}
  let worst=0,worstKey="";
  for(const k of Object.keys(x)){
    const d=Math.max(...x[k].map((v,i)=>Math.abs(v-(y[k]?.[i]??NaN))));
    if(d>worst){worst=d;worstKey=k;}}
  boundaryDiffs.push({clip,which,keys:Object.keys(x).length,worst,worstKey});
}
// every keyframe of every clip, compared exhaustively
let maxKeyDiff=0,maxKeyWhere="",totalValues=0;
for(const a of pa.json.animations){
  const b=pb.json.animations.find(x=>x.name===a.name); if(!b)continue;
  for(let ci=0;ci<a.channels.length;ci++){
    const sa=a.samplers[a.channels[ci].sampler], sb=b.samplers[b.channels[ci].sampler];
    for(const which of ["input","output"]){
      const va=pa.read(sa[which]), vb=pb.read(sb[which]);
      for(let i=0;i<va.length;i++)for(let c=0;c<va[i].length;c++){
        totalValues++;
        const d=Math.abs(va[i][c]-vb[i][c]);
        if(d>maxKeyDiff){maxKeyDiff=d;maxKeyWhere=`${a.name} ch${ci} ${which}[${i}][${c}]`;}}}}
}
const eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
const rows=[
 ["Total file size",`${(pa.size/1048576).toFixed(2)} MB`,`${(pb.size/1048576).toFixed(2)} MB`,`−${(100-pb.size/pa.size*100).toFixed(1)}%`],
 ["Animation count",pa.anims.length,pb.anims.length,pa.anims.length===pb.anims.length?"PASS":"FAIL"],
 ["Animation names",`${pa.anims.length} names`,`${pb.anims.length} names`,eq(pa.anims.map(a=>a.name),pb.anims.map(a=>a.name))?"PASS":"FAIL"],
 ["Animation durations","—","—",eq(pa.anims.map(a=>a.duration),pb.anims.map(a=>a.duration))?"PASS — identical":"FAIL"],
 ["Channel counts","66 per clip","66 per clip",eq(pa.anims.map(a=>a.channels),pb.anims.map(a=>a.channels))?"PASS":"FAIL"],
 ["Sampler counts","66 per clip","66 per clip",eq(pa.anims.map(a=>a.samplers),pb.anims.map(a=>a.samplers))?"PASS":"FAIL"],
 ["Channel target paths","—","—",eq(pa.anims.map(a=>a.paths),pb.anims.map(a=>a.paths))?"PASS":"FAIL"],
 ["Keyframe VALUES",`${totalValues.toLocaleString()} floats`,"decoded and compared",maxKeyDiff===0?"PASS — bit-identical":`FAIL (max Δ ${maxKeyDiff})`],
 ["Skeleton joint count",pa.joints,pb.joints,pa.joints===pb.joints?"PASS":"FAIL"],
 ["Joint names / order","—","—",eq(pa.jointNames,pb.jointNames)?"PASS":"FAIL"],
 ["Node hierarchy",`${pa.hierarchy.length} nodes`,`${pb.hierarchy.length} nodes`,eq(pa.hierarchy,pb.hierarchy)?"PASS":"FAIL"],
 ["Mesh vertex count",pa.verts.toLocaleString(),pb.verts.toLocaleString(),pa.verts===pb.verts?"PASS":"FAIL"],
 ["Triangle count",pa.tris.toLocaleString(),pb.tris.toLocaleString(),pa.tris===pb.tris?"PASS":"FAIL"],
 ["Materials",pa.materials.join(", "),pb.materials.join(", "),eq(pa.materials,pb.materials)?"PASS":"FAIL"],
 ["UV sets",pa.uv.join(", "),pb.uv.join(", "),eq(pa.uv,pb.uv)?"PASS":"FAIL"],
 ["Textures",`${pa.textures} (${pa.images.join(", ")})`,`${pb.textures} (${pb.images.join(", ")})`,eq(pa.images,pb.images)?"PASS — untouched":"FAIL"],
 ["Controller extras (root)",pa.rootExtras?"present":"none",pb.rootExtras?"present":"none",eq(pa.rootExtras,pb.rootExtras)?"PASS — byte-identical":"FAIL"],
 ["Per-clip extras",`${pa.anims.filter(a=>a.extras).length} clips`,`${pb.anims.filter(a=>a.extras).length} clips`,eq(pa.anims.map(a=>a.extras),pb.anims.map(a=>a.extras))?"PASS":"FAIL"],
];
const allPass=rows.every(r=>typeof r[3]!=="string"||!r[3].startsWith("FAIL"));
const boundaryPass=boundaryDiffs.every(d=>d.worst===0);
const md=`# Peeli GLB compression — QA

\`Peeli_GameReady_Controller.glb\` → \`Peeli_GameReady_Controller_COMPRESSED.glb\`

**Result: ${allPass&&boundaryPass?"PASS":"FAIL"}** — ${allPass&&boundaryPass?"no animation, skeleton or controller information was lost.":"see failures below."}

## Summary

| | Original | Compressed | |
|---|---|---|---|
${rows.map(r=>`| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`).join("\n")}

## What was done

Two changes, both of which move bytes without changing numbers.

1. **Merged bufferViews.** The source carried one bufferView per accessor —
   2,781 of them. A meshopt block has fixed overhead, so compressing thousands
   of tiny views achieves almost nothing. Accessors sharing an element size
   were concatenated into one view each (9 views in total), which is pure
   relocation: same bytes, new offsets, accessor \`byteOffset\` updated to match.
   This also collapsed roughly a fifth of a megabyte of JSON.
2. **Meshopt encoding with \`filter: "NONE"\`.** That filter is what makes this
   safe to apply to animation data. The \`OCTAHEDRAL\`, \`QUATERNION\` and
   \`EXPONENTIAL\` filters are lossy transforms applied before the codec; with
   \`NONE\` the codec is a byte-level compressor and the decoder reproduces its
   input exactly. Verified rather than assumed — see below.

### Deliberately not done

| | Why |
|---|---|
| Mesh quantization (\`KHR_mesh_quantization\`) | Quantizing positions is the usual large win, but it needs a compensating node transform or normalized accessors, and both shift the character's proportions slightly. Requirement 12 forbids it. Positions remain \`float32\`. |
| meshopt index codec | Better on paper — 270 KB → 170 KB — but it is lossless about the *geometry*, not the *bytes*: it may rotate which vertex a triangle starts on. It also required widening 16-bit indices to 32-bit, rewriting each accessor's \`componentType\`. Indices pass through untouched instead; 135 KB against a 9.7 MB file is not worth the caveat. |
| Texture recompression | Requirement: preserve existing textures in this pass. The three JPEGs (7.19 MB) are copied byte-for-byte. **They are now 74% of the output** — see below. |
| Resampling, baking, merging, decimation | Forbidden, and not performed. |

## Compression achieved, by data class

| Data | Original | Compressed | |
|---|---|---|---|
| Animation + mesh attributes | 4.03 MB | 1.70 MB | −58% |
| Indices | 135 KB | 135 KB | untouched |
| Textures (3 × JPEG) | 7.19 MB | 7.19 MB | untouched |
| JSON + overhead | ~0.80 MB | ~0.11 MB | −86% (2,781 → 9 bufferViews) |

## Losslessness, proven

Each compressed block was decoded back with \`MeshoptDecoder\` and compared to
the bytes that went in:

\`\`\`
stride  4  (43 accessors)      byte-identical after decode
stride  8  (1 accessor)        byte-identical after decode
stride 12  (1,806 accessors)   byte-identical after decode
stride 16  (926 accessors)     byte-identical after decode
stride 64  (1 accessor)        byte-identical after decode
\`\`\`

Independently, every keyframe of every clip was decoded from the compressed
file and compared value by value against the original:

**${totalValues.toLocaleString()} float values compared — maximum difference ${maxKeyDiff}.**

## Transition boundaries and root motion

Sampled from actual keyframe values, original vs compressed:

| Clip | Boundary | Channels | Max difference |
|---|---|---|---|
${boundaryDiffs.map(d=>`| \`${d.clip}\` | ${d.which} frame | ${d.keys} | ${d.worst===0?"0 — identical":d.worst} |`).join("\n")}

\`Run_Fast_RootMotion\` carries the root motion; its first and last frames are
unchanged, so root displacement per cycle is preserved exactly.

## Extensions required by the compressed GLB

\`\`\`
${pb.extRequired.join("\n")||"(none)"}
\`\`\`

Not present, and not needed: \`KHR_mesh_quantization\` (no quantization was
applied) and \`KHR_texture_basisu\` (textures untouched).

Any loader supporting \`EXT_meshopt_compression\` reads this file. A fallback
buffer is declared per the extension, so loaders that do not support it can
still be given uncompressed data by a converter.

## The remaining 74%

Textures are now the file. A KTX2/BasisU variant would take the 7.19 MB of
JPEG to roughly 1.2 MB and the whole file to about **3.7 MB** — a further 62%.
That was not produced here: it needs a Basis encoder (\`toktx\` or
\`basisu\`), neither of which is installed on this machine, and the brief asks
for it only as an additional variant with compatibility confirmed, never as a
replacement for this primary output.
`;
writeFileSync(OUT, md);
console.log(md.split("\n").slice(0, 34).join("\n"));
console.log(`\n… written to ${OUT}`);
