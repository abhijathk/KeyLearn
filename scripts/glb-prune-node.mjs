#!/usr/bin/env node
/**
 * Removes named node(s) from a GLB and garbage-collects everything left
 * orphaned — meshes, accessors, bufferViews, materials, textures, images,
 * samplers, skins, animation channels — then repacks the binary chunk so the
 * bytes actually leave the file. Mark-and-sweep from the surviving scene
 * nodes, skins and animations.
 *
 *   node scripts/glb-prune-node.mjs <in.glb> <out.glb> <NodeNameA> [NodeNameB ...]
 */
import { readFileSync, writeFileSync } from "node:fs";
const [, , inPath, outPath, ...names] = process.argv;
const drop = new Set(names);
const src = readFileSync(inPath);
let off = 12, json = null, bin = null;
while (off + 8 <= src.length) {
  const len = src.readUInt32LE(off), type = src.readUInt32LE(off + 4);
  const body = src.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
  if (type === 0x004e4942) bin = body;
  off += 8 + len;
}

// 1. Identify node indices to drop.
const dropNodes = new Set();
json.nodes.forEach((n, i) => { if (drop.has(n.name)) dropNodes.add(i); });
if (dropNodes.size === 0) { console.error("no matching node:", names.join(",")); process.exit(1); }

// 2. Remove them from scenes and from any node.children.
for (const s of json.scenes ?? []) s.nodes = (s.nodes ?? []).filter((i) => !dropNodes.has(i));
for (const n of json.nodes) if (n.children) n.children = n.children.filter((i) => !dropNodes.has(i));

// 3. Mark-and-sweep. Reachable meshes/skins from surviving nodes.
const keepNode = json.nodes.map((_, i) => !dropNodes.has(i));
const usedMesh = new Set(), usedSkin = new Set();
json.nodes.forEach((n, i) => { if (!keepNode[i]) return; if (n.mesh != null) usedMesh.add(n.mesh); if (n.skin != null) usedSkin.add(n.skin); });

const usedAccessor = new Set(), usedMaterial = new Set();
for (const mi of usedMesh) {
  const m = json.meshes[mi];
  for (const p of m.primitives) {
    for (const a of Object.values(p.attributes)) usedAccessor.add(a);
    if (p.indices != null) usedAccessor.add(p.indices);
    if (p.material != null) usedMaterial.add(p.material);
    for (const tgt of p.targets ?? []) for (const a of Object.values(tgt)) usedAccessor.add(a);
  }
}
for (const si of usedSkin) { const sk = json.skins[si]; if (sk.inverseBindMatrices != null) usedAccessor.add(sk.inverseBindMatrices); }
// animations reference accessors too; keep channels whose target node survives
for (const anim of json.animations ?? []) {
  anim.channels = anim.channels.filter((c) => c.target.node == null || keepNode[c.target.node]);
  const usedSamp = new Set(anim.channels.map((c) => c.sampler));
  const sampRemap = new Map();
  anim.samplers = anim.samplers.filter((_, i) => usedSamp.has(i));
  // (samplers rarely need remap here since we drop none for the buffalo, but keep correct)
  let k = 0; const order = [...usedSamp].sort((a,b)=>a-b); order.forEach((oldi)=>sampRemap.set(oldi,k++));
  for (const c of anim.channels) c.sampler = sampRemap.get(c.sampler);
  for (const s of anim.samplers) { usedAccessor.add(s.input); usedAccessor.add(s.output); }
}

const usedTexture = new Set();
for (const mi of usedMaterial) {
  const m = json.materials[mi]; const pbr = m.pbrMetallicRoughness ?? {};
  for (const t of [pbr.baseColorTexture, pbr.metallicRoughnessTexture, m.normalTexture, m.occlusionTexture, m.emissiveTexture]) if (t) usedTexture.add(t.index);
}
const usedImage = new Set(), usedSampler = new Set();
for (const ti of usedTexture) { const t = json.textures[ti]; const srcI = t.source ?? t.extensions?.KHR_texture_basisu?.source; if (srcI != null) usedImage.add(srcI); if (t.sampler != null) usedSampler.add(t.sampler); }
const usedBV = new Set();
for (const ai of usedAccessor) { const a = json.accessors[ai]; if (a.bufferView != null) usedBV.add(a.bufferView); if (a.sparse) { usedBV.add(a.sparse.indices.bufferView); usedBV.add(a.sparse.values.bufferView); } }
for (const ii of usedImage) { const im = json.images[ii]; if (im.bufferView != null) usedBV.add(im.bufferView); }

// 4. Build compacted arrays with index remaps.
function compact(arr, used) { const remap = new Map(); const out = []; arr.forEach((el, i) => { if (used.has(i)) { remap.set(i, out.length); out.push(el); } }); return { out, remap }; }
const nodeR = compact(json.nodes, new Set(json.nodes.map((_,i)=>i).filter(i=>keepNode[i]))).remap;
const keepNodes = json.nodes.filter((_,i)=>keepNode[i]);
const { out: meshes, remap: meshR } = compact(json.meshes, usedMesh);
const { out: skins, remap: skinR } = compact(json.skins ?? [], usedSkin);
const { out: materials, remap: matR } = compact(json.materials ?? [], usedMaterial);
const { out: textures, remap: texR } = compact(json.textures ?? [], usedTexture);
const { out: images, remap: imgR } = compact(json.images ?? [], usedImage);
const { out: samplers, remap: sampR } = compact(json.samplers ?? [], usedSampler);
const { out: accessors, remap: accR } = compact(json.accessors, usedAccessor);
const { out: bufferViews, remap: bvR } = compact(json.bufferViews, usedBV);

// 5. Rewrite all cross-references through the remaps.
const rn = (i)=> i==null?i:nodeR.get(i);
for (const n of keepNodes) { if (n.mesh!=null) n.mesh=meshR.get(n.mesh); if (n.skin!=null) n.skin=skinR.get(n.skin); if (n.children) n.children=n.children.map(rn).filter(x=>x!=null); }
for (const s of json.scenes ?? []) s.nodes = s.nodes.map(rn).filter(x=>x!=null);
for (const sk of skins) { if (sk.inverseBindMatrices!=null) sk.inverseBindMatrices=accR.get(sk.inverseBindMatrices); sk.joints=sk.joints.map(rn); if (sk.skeleton!=null) sk.skeleton=rn(sk.skeleton); }
for (const m of meshes) for (const p of m.primitives) { for (const k of Object.keys(p.attributes)) p.attributes[k]=accR.get(p.attributes[k]); if (p.indices!=null) p.indices=accR.get(p.indices); if (p.material!=null) p.material=matR.get(p.material); for (const tgt of p.targets??[]) for (const k of Object.keys(tgt)) tgt[k]=accR.get(tgt[k]); }
for (const mat of materials) { const pbr=mat.pbrMetallicRoughness??{}; for (const t of [pbr.baseColorTexture,pbr.metallicRoughnessTexture,mat.normalTexture,mat.occlusionTexture,mat.emissiveTexture]) if (t) t.index=texR.get(t.index); }
for (const t of textures) { if (t.source!=null) t.source=imgR.get(t.source); if (t.extensions?.KHR_texture_basisu) t.extensions.KHR_texture_basisu.source=imgR.get(t.extensions.KHR_texture_basisu.source); if (t.sampler!=null) t.sampler=sampR.get(t.sampler); }
for (const anim of json.animations ?? []) { for (const c of anim.channels) if (c.target.node!=null) c.target.node=rn(c.target.node); for (const s of anim.samplers) { s.input=accR.get(s.input); s.output=accR.get(s.output); } }

// 6. Repack bin with only kept bufferViews.
const parts=[]; let cursor=0; const bvNew=[];
for (const oldi of [...usedBV].sort((a,b)=>a-b)) {
  const v=json.bufferViews[oldi]; const raw=bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);
  const pad=(4-(cursor%4))%4; if (pad){parts.push(Buffer.alloc(pad));cursor+=pad;}
  const nv={...v,byteOffset:cursor}; delete nv.byteStride; bvNew.push(nv); cursor+=raw.length; parts.push(raw);
}
// remap accessors + images to new bv order (they were compacted; map old bv -> position in bvNew)
const bvPos=new Map([...usedBV].sort((a,b)=>a-b).map((oldi,idx)=>[oldi,idx]));
for (const a of accessors) { if (a.bufferView!=null) a.bufferView=bvPos.get(a.bufferView); if (a.sparse){a.sparse.indices.bufferView=bvPos.get(a.sparse.indices.bufferView);a.sparse.values.bufferView=bvPos.get(a.sparse.values.bufferView);} }
for (const im of images) if (im.bufferView!=null) im.bufferView=bvPos.get(im.bufferView);

json.nodes=keepNodes; json.meshes=meshes; if(json.skins)json.skins=skins; if(json.materials)json.materials=materials;
if(json.textures)json.textures=textures; if(json.images)json.images=images; if(json.samplers)json.samplers=samplers;
json.accessors=accessors; json.bufferViews=bvNew;
const newBin=Buffer.concat(parts); json.buffers=[{byteLength:newBin.length}];

const jb=Buffer.from(JSON.stringify(json),"utf8"); const jp=(4-(jb.length%4))%4; const jc=Buffer.concat([jb,Buffer.alloc(jp,0x20)]);
const bp=(4-(newBin.length%4))%4; const bc=Buffer.concat([newBin,Buffer.alloc(bp)]);
const head=(l,t)=>{const h=Buffer.alloc(8);h.writeUInt32LE(l,0);h.writeUInt32LE(t,4);return h;};
const bodyOut=Buffer.concat([head(jc.length,0x4e4f534a),jc,head(bc.length,0x004e4942),bc]);
const hdr=Buffer.alloc(12);hdr.writeUInt32LE(0x46546c67,0);hdr.writeUInt32LE(2,4);hdr.writeUInt32LE(12+bodyOut.length,8);
writeFileSync(outPath,Buffer.concat([hdr,bodyOut]));
console.log(`pruned ${names.join(",")}: nodes ${json.nodes.length}, meshes ${meshes.length}, accessors ${accessors.length}, images ${images.length}`);
console.log(`  ${(src.length/1048576).toFixed(2)} MB -> ${((12+bodyOut.length)/1048576).toFixed(2)} MB`);
