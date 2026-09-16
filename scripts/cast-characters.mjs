/**
 * Build the SHIPPED player cast — Dave, Little Drew, Peeli — and Abee, the
 * boy in the opening frame of every village.
 *
 *   node scripts/cast-characters.mjs                 # build + install
 *   node scripts/cast-characters.mjs --dry           # build, report, do not install
 *   node scripts/cast-characters.mjs Peeli           # just one
 *   node scripts/cast-characters.mjs --out=DIR       # build into DIR (for side-by-side renders)
 *   node scripts/cast-characters.mjs --normal=keep   # override the normal-map decision
 *   node scripts/cast-characters.mjs --tex=2048      # override the basecolor size
 *
 * THESE ARE THE FIRST THING EVERY SESSION DOWNLOADS. A villager loads when
 * the world reaches the village; the player's own character loads before
 * the world can be shown at all, and every companion the child picks loads
 * with it. So the cast was the largest cost on the wire, and the one nobody
 * had measured:
 *
 *   Explorer    2635 KB    9,875 tris   three KTX2 maps, 1968 KB of them
 *   Peeli       2094 KB   17,976 tris   three KTX2 maps, 1165 KB
 *   Explorer6   1889 KB   10,822 tris   three KTX2 maps, 1295 KB
 *   Abee        1330 KB   28,548 tris   one 1024 JPEG, 267 KB; 760 KB of mesh
 *
 * The clips, the skins and the geometry were already right — trimmed,
 * simplified and key-reduced when these were first shipped — so THE SOURCE
 * IS THE SHIPPED FILE ITSELF, and it is edited in place rather than decoded
 * and re-encoded. That is not laziness: the shipped meshopt streams were
 * written by gltfpack with its quaternion, exponential and octahedral
 * filters, and this repo's own lossless compressor (glb-compress.mjs, filter
 * NONE) cannot get back to that size — measured, a decode/re-encode round
 * trip cost 74 KB on Explorer, 45 KB on Explorer6 and 57 KB on Peeli for no
 * change in content. So every bufferView that is not an image is COPIED
 * BYTE FOR BYTE, still compressed, and only the JSON and the images change.
 * A copy of each file as it stood before this is in
 * meshy_output/shipped-before-cast-compression-2026-09-16/, and the script
 * refuses to install a result whose clip list, joint count or triangle
 * count differs from what it started with.
 *
 * THREE CUTS, each measured:
 *
 * 1. THE METALLIC-ROUGHNESS MAP SAYS TWO NUMBERS. Same argument as the
 *    villagers (chapter1-characters.mjs), but here the numbers were READ off
 *    the maps rather than assumed: each shipped MR map was transcoded and
 *    averaged, and the blue (metallic) channel means 0.002–0.011 on every
 *    one — and `loadModel` overwrites metalness to 0.05 on load anyway. The
 *    green (roughness) channel is a band, p10 to p90 within ±0.1 of its
 *    mean, and three multiplies it by the material's factor. So the factor
 *    shipped here is the OLD FACTOR TIMES THE MEAN OF THE MAP, which is the
 *    roughness the character already had on average:
 *
 *      Explorer   0.78 x 0.897 = 0.70     (was max(0.65, 0.78) x G)
 *      Explorer6  1.00 x 0.873 = 0.87
 *      Peeli      1.00 x 0.735 = 0.74
 *
 *    Abee already ships with a factor of 0.826 and no map — the mean of his
 *    master's MR map is 0.826, so that decision was made once before.
 *
 * 2. THE NORMAL MAP IS THE SINGLE LARGEST THING IN EACH FILE — 1089 KB on
 *    Explorer, 892 KB on Peeli, 694 KB on Explorer6 — because it was encoded
 *    UASTC, which is four times the bytes of ETC1S and the right choice for
 *    a normal map that is going to be kept. Whether to keep it is NOT the
 *    villagers' call: they draw a few hundred pixels tall on a trail, the
 *    cast are foreground. So this was decided by RENDERING BOTH, in the
 *    runtime's own material path (welded, normals recomputed, metalness
 *    0.05, roughness floored at 0.65), side by side at 560–600 px tall —
 *    about three times the height the player is drawn at in the 3-D pane —
 *    and again at 1100 px on the head alone. At neither size could the map
 *    be told from its absence on any of the three: the bakes already carry
 *    their shading in the basecolor, and what the map adds is fabric grain
 *    finer than a screen pixel at any distance the game uses. So it goes,
 *    and `--normal=keep` builds the other answer for anyone who wants to
 *    look again. The TANGENT attribute goes with it: a tangent frame exists
 *    to orient a normal map and has no other reader, and Peeli's is 33,522
 *    x VEC4 of it.
 *
 * 3. THE BASECOLOR IS RE-ENCODED FROM ITS MASTER WITH `-mip_linear`. The
 *    shipped KTX2s were made with basisu's default mip filter, which
 *    averages in linear light and lifts every distant mip: measured on the
 *    shipped files, mip 4 of Explorer's atlas averages 2.5 luma units
 *    brighter than an sRGB-space box filter of its own level 0, Explorer6's
 *    4.4, Peeli's mip 3 4.9. That is the wash-out the blacksmith made
 *    visible, on the characters who are on screen the whole time. The
 *    masters were confirmed to be the shipped bakes and not a different pass
 *    — each shipped map transcodes back against its master at 29–34 dB,
 *    which is ETC1S loss and nothing else — so the re-encode loses no
 *    generation. Encoded from the master rather than from a transcode of
 *    the shipped KTX2, which would have stacked two lossy encodes. 1024 for
 *    all three: Explorer and Explorer6 shipped 2048s, and at 560 px tall the
 *    1024 rebuild could not be told from either the 2048 rebuild or the
 *    shipped map, for 560 KB less on Explorer alone.
 *
 *    Abee's JPEG goes to KTX2 the same way, from the 2048 PNG in his
 *    BATCH_04 master. On disk that is a wash — 267 KB of JPEG against 212 KB
 *    of ETC1S — but a 1024 JPEG is 5.3 MB of RGBA in video memory once the
 *    driver has built its mips, and ETC1S is 0.7 MB and stays compressed;
 *    and his mips are then filtered in sRGB rather than whatever
 *    generateMipmap does. He is in the opening frame of every village.
 *
 * NOT DONE, on purpose and with the numbers:
 *   - ABEE'S MESH. 28,548 triangles is a lot for a boy Explorer6's size, and
 *     simplifying him was tried: plain, ratio 0.5, stops at 25,374 (89%);
 *     with --attrs and a UV weight of 1.0 at ratio 0.4 it stops at 25,233.
 *     That is the border-lock plateau chapter1-characters.mjs describes —
 *     a Meshy atlas split at every UV seam, plus the hundreds of open edges
 *     on each hand from his rebuilt rig — and it is the floor. Eleven per
 *     cent off the mesh is about 80 KB, not worth a decode/re-encode of
 *     his animation, and forcing past the plateau tears the texture.
 *   - THE PUPPY. 904 KB, one 512 ETC1S map, already the smallest of the
 *     cast; his remaining bytes are mesh and animation, and his legs,
 *     tongue and gait have been hand-tuned (puppy-*.mjs). A simplification
 *     pass would have to be checked against all of that for perhaps 200 KB.
 *   - THE JSON. 150–280 KB of each hero is the glTF JSON — 1,200-odd
 *     accessors and animation channels — and that is inherent to a rig with
 *     twenty clips. It gzips about ten to one. The dev server answers
 *     model/gltf-binary with Content-Encoding: identity; that is the next
 *     saving and it lives in server/, not here.
 *   - The Explorer's atlas seam on the cheek is in the master and is not a
 *     compression artefact.
 *
 * Verify after building — cheap and not optional:
 *   node scripts/kids-characters.mjs
 *   node scripts/glb-decompress.mjs <shipped> /tmp/raw.glb
 */
import {
  readFileSync, writeFileSync, copyFileSync, statSync, mkdirSync, mkdtempSync, rmSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const MODELS = join(REPO, "root/public/kids-assets/models");
/** Masters for the cast live beside the Meshy exports, not in the vault. */
const MESHY = join(REPO, "..", "meshy_output");

const CAST = [
  {
    name: "Explorer", out: "ak-3d-pack/Explorer.glb",
    // The 2048 JPEG bake the shipped 2048 ETC1S was made from (32.5 dB).
    master: { glb: join(MESHY, "boy10_LOD0_texture_final.glb"), image: 0 },
    tex: 1024, roughness: 0.70, normal: "drop", budget: 1_000_000,
  },
  {
    name: "Explorer6", out: "ak-3d-pack/Explorer6.glb",
    master: { glb: join(MESHY, "boy6_GAME_ANIMATIONS_MASTER.glb"), image: 1 },
    tex: 1024, roughness: 0.87, normal: "drop", budget: 900_000,
  },
  {
    name: "Peeli", out: "ak-3d-pack/Peeli.glb",
    master: { glb: join(MESHY, "Peeli_GameReady_Controller.glb"), image: 1 },
    tex: 1024, roughness: 0.74, normal: "drop", budget: 1_250_000,
  },
  {
    name: "Abee", out: "abee/Abee.glb",
    // BATCH_04 carries the 2048 PNG of the same bake the shipped 1024 JPEG
    // was cut from (33.7 dB against it). Not BATCH_04's clips — the shipped
    // twelve are the ones the village asks for, and nothing here touches
    // animation.
    master: { glb: join(MESHY, "Abee_8yo_BATCH_04.glb"), image: 0 },
    tex: 1024, normal: "drop", budget: 1_350_000,
  },
];

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const OUT_DIR = opt("out");
const NORMAL = opt("normal");
const TEX = opt("tex") != null ? Number(opt("tex")) : null;
const only = args.filter((a) => !a.startsWith("--"));
const kb = (p) => (statSync(p).size / 1024).toFixed(0);

function readGlb(path) {
  const src = readFileSync(path);
  let off = 12, json = null, bin = null;
  while (off + 8 <= src.length) {
    const len = src.readUInt32LE(off), type = src.readUInt32LE(off + 4);
    const body = src.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
    if (type === 0x004e4942) bin = Buffer.from(body);
    off += 8 + len;
  }
  return { json, bin };
}

function writeGlb(path, json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20);
  const binPad = Buffer.alloc((4 - (bin.length % 4)) % 4);
  const chunks = [
    Buffer.alloc(4), Buffer.alloc(4), jsonBuf, jsonPad,
    Buffer.alloc(4), Buffer.alloc(4), bin, binPad,
  ];
  chunks[0].writeUInt32LE(jsonBuf.length + jsonPad.length);
  chunks[1].writeUInt32LE(0x4e4f534a);
  chunks[4].writeUInt32LE(bin.length + binPad.length);
  chunks[5].writeUInt32LE(0x004e4942);
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.length, 8);
  writeFileSync(path, Buffer.concat([header, body]));
}

/**
 * A texture's image, wherever it keeps it. A KTX2 texture has no `source`:
 * it names its image under KHR_texture_basisu, and every one of the heroes'
 * textures is KTX2 already. Reading `.source` on them gives undefined, which
 * the villagers' pipeline never met because it starts from PNG masters.
 */
const texSource = (t) => t.extensions?.KHR_texture_basisu?.source ?? t.source;
const setTexSource = (t, i) => {
  if (t.extensions?.KHR_texture_basisu != null) t.extensions.KHR_texture_basisu.source = i;
  else t.source = i;
};

/**
 * The inventory the build must not change: every clip by name, duration and
 * channel count, and the mesh's triangle and vertex counts. Read from the
 * accessors' own `max`, which is what the runtime's clip duration is.
 */
function inventory(path) {
  const { json } = readGlb(path);
  const acc = json.accessors ?? [];
  const clips = (json.animations ?? []).map((a) => {
    const dur = Math.max(...a.samplers.map((s) => acc[s.input]?.max?.[0] ?? 0));
    return `${a.name}=${dur.toFixed(4)}s/${a.channels.length}ch`;
  });
  let tris = 0, verts = 0;
  for (const m of json.meshes ?? []) {
    for (const pr of m.primitives ?? []) {
      verts += acc[pr.attributes.POSITION].count;
      tris += pr.indices != null ? acc[pr.indices].count / 3 : acc[pr.attributes.POSITION].count / 3;
    }
  }
  const images = (json.images ?? []).length;
  return { clips, tris, verts, images, joints: json.skins?.[0]?.joints.length ?? 0 };
}

/**
 * Rebuild the binary chunk from the views still referenced, WITHOUT decoding
 * any of them, and re-index everything that names a view or an accessor.
 *
 * A meshopt view has two addresses: the compressed bytes, under
 * extensions.EXT_meshopt_compression in buffer 0, and a nominal decoded
 * range in a FALLBACK buffer that carries no data and exists so a loader
 * without the decoder can fail cleanly. The villagers' prune copies the
 * outer range, which on a compressed file is the wrong buffer entirely — it
 * is why that pipeline decodes first. Here the compressed bytes are what is
 * copied, and the fallback ranges are re-laid so they stay consistent.
 *
 * `replace` swaps one view's payload (the basecolor image) on the way past.
 */
function rebuild(json, bin, replace) {
  const keepAcc = new Set();
  for (const m of json.meshes ?? []) {
    for (const pr of m.primitives ?? []) {
      for (const a of Object.values(pr.attributes ?? {})) keepAcc.add(a);
      if (pr.indices != null) keepAcc.add(pr.indices);
      for (const t of pr.targets ?? []) for (const a of Object.values(t)) keepAcc.add(a);
    }
  }
  for (const sk of json.skins ?? []) {
    if (sk.inverseBindMatrices != null) keepAcc.add(sk.inverseBindMatrices);
  }
  for (const an of json.animations ?? []) {
    for (const sm of an.samplers ?? []) { keepAcc.add(sm.input); keepAcc.add(sm.output); }
  }
  const accMap = new Map();
  const accessors = [];
  for (const [i, a] of (json.accessors ?? []).entries()) {
    if (!keepAcc.has(i)) continue;
    accMap.set(i, accessors.length);
    accessors.push(a);
  }
  const keepView = new Set();
  for (const a of accessors) {
    // An accessor with no view is legal — it reads as zeros — and Abee has
    // one, a translation track gltfpack wrote that way. It is kept as it is.
    if (a.bufferView != null) keepView.add(a.bufferView);
    if (a.sparse != null) {
      keepView.add(a.sparse.indices.bufferView);
      keepView.add(a.sparse.values.bufferView);
    }
  }
  for (const im of json.images ?? []) if (im.bufferView != null) keepView.add(im.bufferView);

  const viewMap = new Map();
  const views = [];
  const parts = [];
  let cursor = 0;
  let fallback = 0;
  let compressed = 0;
  for (const [i, v] of (json.bufferViews ?? []).entries()) {
    if (!keepView.has(i)) continue;
    const ext = v.extensions?.EXT_meshopt_compression;
    const body = replace.has(i)
      ? replace.get(i)
      : ext != null
        ? bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength)
        : bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const pad = (4 - (body.length % 4)) % 4;
    parts.push(body, Buffer.alloc(pad));
    viewMap.set(i, views.length);
    if (ext != null) {
      if (replace.has(i)) throw new Error(`view ${i} is meshopt-compressed and cannot be replaced`);
      const decoded = ext.count * ext.byteStride;
      views.push({
        ...v, buffer: 1, byteOffset: fallback, byteLength: decoded,
        extensions: { ...v.extensions, EXT_meshopt_compression: { ...ext, buffer: 0, byteOffset: cursor, byteLength: body.length } },
      });
      fallback += decoded;
      compressed++;
    } else {
      views.push({ ...v, buffer: 0, byteOffset: cursor, byteLength: body.length });
    }
    cursor += body.length + pad;
  }

  const reAcc = (i) => accMap.get(i);
  for (const m of json.meshes ?? []) {
    for (const pr of m.primitives ?? []) {
      for (const k of Object.keys(pr.attributes ?? {})) pr.attributes[k] = reAcc(pr.attributes[k]);
      if (pr.indices != null) pr.indices = reAcc(pr.indices);
      for (const t of pr.targets ?? []) for (const k of Object.keys(t)) t[k] = reAcc(t[k]);
    }
  }
  for (const sk of json.skins ?? []) {
    if (sk.inverseBindMatrices != null) sk.inverseBindMatrices = reAcc(sk.inverseBindMatrices);
  }
  for (const an of json.animations ?? []) {
    for (const sm of an.samplers ?? []) { sm.input = reAcc(sm.input); sm.output = reAcc(sm.output); }
  }
  for (const a of accessors) {
    if (a.bufferView != null) a.bufferView = viewMap.get(a.bufferView);
    if (a.sparse != null) {
      a.sparse.indices.bufferView = viewMap.get(a.sparse.indices.bufferView);
      a.sparse.values.bufferView = viewMap.get(a.sparse.values.bufferView);
    }
  }
  for (const im of json.images ?? []) {
    if (im.bufferView != null) im.bufferView = viewMap.get(im.bufferView);
  }
  json.accessors = accessors;
  json.bufferViews = views;
  const out = Buffer.concat(parts);
  json.buffers = [{ byteLength: out.length }];
  if (compressed > 0) {
    json.buffers.push({ byteLength: fallback, extensions: { EXT_meshopt_compression: { fallback: true } } });
  }
  return out;
}

/** The master's image bytes, whatever container they are in. */
function extractImage(glbPath, index, to) {
  const { json, bin } = readGlb(glbPath);
  const im = json.images?.[index];
  if (im?.bufferView == null) throw new Error(`${glbPath}: image ${index} is not buffer-backed`);
  const v = json.bufferViews[im.bufferView];
  if (v.extensions?.EXT_meshopt_compression != null) throw new Error(`${glbPath}: image ${index} is in a compressed view`);
  const ext = { "image/png": "png", "image/jpeg": "jpg" }[im.mimeType];
  if (ext == null) throw new Error(`${glbPath}: image ${index} is ${im.mimeType}, need a PNG or JPEG master`);
  const path = `${to}.${ext}`;
  writeFileSync(path, bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  return path;
}

let total = 0;
let failed = 0;

for (const c of CAST) {
  if (only.length > 0 && !only.includes(c.name)) continue;
  const tmp = mkdtempSync(join(tmpdir(), `cast-${c.name}-`));
  const step = (n) => join(tmp, n);
  const normal = NORMAL ?? c.normal;
  const tex = TEX ?? c.tex;
  const src = join(MODELS, c.out);
  console.log(`\n${c.name}  <-  ${c.out}  (${kb(src)} KB)`);

  try {
    const before = inventory(src);
    const { json, bin } = readGlb(src);

    // 1 ── the maps that say two numbers, and the map that was decided by a render
    const keep = new Set();
    const dropped = [];
    let basecolor = null;
    for (const m of json.materials ?? []) {
      const pbr = (m.pbrMetallicRoughness ??= {});
      if (pbr.metallicRoughnessTexture != null) {
        delete pbr.metallicRoughnessTexture;
        dropped.push("metallicRoughness");
      }
      if (c.roughness != null) {
        pbr.metallicFactor = 0;
        pbr.roughnessFactor = c.roughness;
      }
      if (m.normalTexture != null && normal === "drop") {
        delete m.normalTexture;
        dropped.push("normal");
      }
      if (m.occlusionTexture != null) { delete m.occlusionTexture; dropped.push("occlusion"); }
      if (m.emissiveTexture != null) { delete m.emissiveTexture; dropped.push("emissive"); }
      if (pbr.baseColorTexture != null) {
        basecolor = texSource(json.textures[pbr.baseColorTexture.index]);
        keep.add(basecolor);
      }
      if (m.normalTexture != null) keep.add(texSource(json.textures[m.normalTexture.index]));
    }
    if (basecolor == null) throw new Error("no basecolor texture");
    let tangents = 0;
    if (normal === "drop") {
      for (const m of json.meshes ?? []) {
        for (const pr of m.primitives ?? []) {
          if (pr.attributes?.TANGENT != null) { delete pr.attributes.TANGENT; tangents++; }
        }
      }
    }
    // Images and textures re-indexed, not just filtered — materials address
    // them by number, and the basecolor is image 0 on Explorer and image 1
    // on the other two heroes.
    const imgKeep = [...(json.images ?? []).keys()].filter((i) => keep.has(i));
    const imgMap = new Map(imgKeep.map((old, now) => [old, now]));
    json.images = imgKeep.map((i) => json.images[i]);
    const texKeep = [...(json.textures ?? []).keys()].filter((i) =>
      imgMap.has(texSource(json.textures[i])),
    );
    const texMap = new Map(texKeep.map((old, now) => [old, now]));
    json.textures = texKeep.map((i) => {
      const t = structuredClone(json.textures[i]);
      setTexSource(t, imgMap.get(texSource(t)));
      return t;
    });
    for (const m of json.materials ?? []) {
      const bct = m.pbrMetallicRoughness?.baseColorTexture;
      if (bct != null) bct.index = texMap.get(bct.index);
      if (m.normalTexture != null) m.normalTexture.index = texMap.get(m.normalTexture.index);
    }
    const bc = imgMap.get(basecolor);

    // 2 ── basecolor from the master, resized losslessly, ETC1S with sRGB-filtered mips
    const masterImg = extractImage(c.master.glb, c.master.image, step("master"));
    execFileSync("cwebp", ["-quiet", "-resize", String(tex), String(tex), "-lossless", masterImg, "-o", step("tex.webp")]);
    execFileSync("dwebp", ["-quiet", step("tex.webp"), "-o", step("tex_small.png")]);
    // `-mip_linear`: filter the mips in the space the texture is stored in.
    // See chapter1-characters.mjs for the measurement; the shipped cast maps
    // were made without it and the numbers in the header are theirs.
    execFileSync("basisu", ["-ktx2", "-mipmap", "-mip_linear", "-q", "255", "-file", step("tex_small.png"), "-output_file", step("tex.ktx2")], { stdio: "ignore" });
    const ktx = readFileSync(step("tex.ktx2"));
    const image = json.images[bc];
    const wasMime = image.mimeType;
    image.mimeType = "image/ktx2";
    // A JPEG texture names its image by `source`; a KTX2 one names it under
    // the extension, and a loader without the transcoder must refuse the
    // file rather than draw the character untextured — hence REQUIRED.
    for (const t of json.textures) {
      if (t.source === bc) {
        delete t.source;
        t.extensions = { ...(t.extensions ?? {}), KHR_texture_basisu: { source: bc } };
      }
    }
    const add = (arr, name) => (arr.includes(name) ? arr : [...arr, name]);
    json.extensionsUsed = add(json.extensionsUsed ?? [], "KHR_texture_basisu");
    json.extensionsRequired = add(json.extensionsRequired ?? [], "KHR_texture_basisu");
    console.log(`  basecolor <- ${c.master.glb.split("/").pop()}#${c.master.image} -> ${tex}x${tex} ETC1S, ${(ktx.length / 1024).toFixed(0)} KB (was ${wasMime})`);

    // 3 ── everything else copied through, still compressed
    const out = rebuild(json, bin, new Map([[image.bufferView, ktx]]));
    const result = step("out.glb");
    writeGlb(result, json, out);
    console.log(
      `  dropped ${dropped.join(", ") || "no maps"}` +
        `${tangents > 0 ? `, ${tangents} tangent set(s)` : ""}` +
        `${c.roughness != null ? `, roughness -> ${c.roughness}` : ""}`,
    );

    // 4 ── THE CHECK THAT MATTERS. A character that lost a clip is broken in
    //      a way nothing downstream reports; a smaller file is not worth it.
    const after = inventory(result);
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    if (!same(before.clips, after.clips)) {
      const gone = before.clips.filter((x) => !after.clips.includes(x));
      const extra = after.clips.filter((x) => !before.clips.includes(x));
      throw new Error(`clip list changed — missing [${gone.join(", ")}] extra [${extra.join(", ")}]`);
    }
    if (after.joints !== before.joints) throw new Error(`joints ${before.joints} -> ${after.joints}`);
    if (after.tris !== before.tris || after.verts !== before.verts) {
      throw new Error(`geometry changed — ${before.tris} -> ${after.tris} tris, ${before.verts} -> ${after.verts} verts`);
    }
    const size = statSync(result).size;
    const was = statSync(src).size;
    console.log(`  clips ${after.clips.length} (unchanged), tris ${after.tris} (unchanged), verts ${after.verts} (unchanged), images ${before.images} -> ${after.images}`);
    console.log(`  ${(was / 1e6).toFixed(2)} MB -> ${(size / 1e6).toFixed(2)} MB  (${(100 - (size / was) * 100).toFixed(0)}% off)`);

    if (size > c.budget) {
      console.error(`  OVER BUDGET — expected under ${(c.budget / 1e6).toFixed(2)} MB`);
      failed++;
    }
    if (OUT_DIR != null) {
      mkdirSync(OUT_DIR, { recursive: true });
      const tag = `${c.name}-tex${tex}-normal${normal}.glb`;
      copyFileSync(result, join(OUT_DIR, tag));
      console.log(`  written -> ${join(OUT_DIR, tag)}`);
    } else if (!DRY) {
      copyFileSync(result, src);
      console.log(`  installed -> ${c.out}`);
    }
    total += size;
  } catch (e) {
    console.error(`  FAILED: ${e.message.split("\n")[0]}`);
    failed++;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`\ntotal ${(total / 1e6).toFixed(2)} MB across the cast`);
process.exit(failed > 0 ? 1 : 0);
