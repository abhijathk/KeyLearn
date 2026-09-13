/**
 * Build the SHIPPED buffalo from the master. One command, so the file the app
 * serves is always reproducible from the file we keep.
 *
 *   node scripts/buffalo-shipped.mjs            # build + install
 *   node scripts/buffalo-shipped.mjs --dry      # build, report, do not install
 *
 * The budget is one megabyte, and this is where every byte of it goes:
 *
 *   texture    226 KB   1024^2 ETC1S with mips
 *   geometry   607 KB   30,669 verts, untouched
 *   animation   96 KB   13 clips
 *   json       121 KB
 *
 * FOUR DECISIONS, each measured rather than assumed:
 *
 * 1. THREE CLIPS ARE DROPPED — Death, Attack_Horn, Attack_Stomp. Not a
 *    quality trade at all: `loadModel` in world.ts strips death/attack/bite
 *    from every character in the kids app, so these were downloaded on every
 *    visit and discarded before anything could play them. The MASTER keeps
 *    all sixteen; only the shipped build is trimmed.
 *
 * 2. THE MESH IS NOT SIMPLIFIED. It was tried. meshopt plateaus at 74% of
 *    the triangles whatever error bound it is given, because the UVs are a
 *    Meshy atlas — 9,041 distinct positions split into 30,512 distinct
 *    position+UV pairs — so nearly every edge reads as an open border and
 *    LockBorder freezes it. Forcing past that collapses UV seams and tears
 *    the texture, which is the one thing the budget is not allowed to cost.
 *    So the geometry ships exactly as authored, and the deformation is
 *    provably unchanged.
 *
 * 3. THE TEXTURE DROPS 1536 -> 1024. This is the only real reduction, and it
 *    is invisible: at the size a buffalo standing in a field actually draws,
 *    150-250 screen pixels, the two differ by an RMS of 0.4 out of 255 with
 *    a worst pixel of 1. Even at 800px — four times larger than it ever
 *    renders — it is RMS 0.86. 1536^2 was five times more texel than the
 *    screen could ever show.
 *
 * 4. INDEX COMPRESSION IS OFF. meshopt's index codec made this file BIGGER,
 *    106 KB to 127 KB: it needs 32-bit indices, and widening them costs more
 *    than the codec recovers on a mesh with this index locality. Measured,
 *    both ways. See glb-compress's --indices.
 *
 * Verify after building — the QA is not optional and it is cheap:
 *   node scripts/glb-decompress.mjs <shipped> /tmp/raw.glb
 *   node scripts/buffalo-qa.mjs /tmp/raw.glb      # expect 13 clips, 0 failing
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, statSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const MASTER = join(REPO, "masters", "Buffalo_MASTER.glb");
const SHIPPED_COPY = join(REPO, "masters", "Buffalo_SHIPPED.glb");
const APP = join(HERE, "..", "root", "public", "kids-assets", "models", "ak-3d-pack", "Buffalo.glb");
const DRY = process.argv.includes("--dry");

/** Clips the kids app strips at load; see decision 1. */
const DROP = ["Death", "Attack_Horn", "Attack_Stomp"];
const TEX = 1024;
const TOL_DEG = 0.5;
/**
 * NO self-light. The buffalo is lit by the scene and nothing else.
 *
 * It carried 0.18 for a while, added when night here was pitch black and the
 * animal disappeared into it, and 0.12 briefly after that. Both are gone by
 * request: emissive ignores the light, so every unit of it is a unit that
 * does not respond to the sun, to the shade of a palm, or to an oil lamp —
 * and on a dark-furred animal it reads as a glow rather than as fur.
 *
 * If it now reads too dark against bright paddy, the fix is NOT to put this
 * back. Raise `baseColorFactor` instead: that brightens the same texture
 * while leaving it lit by the scene, so the animal still takes the shade it
 * stands in.
 */
const EMISSIVE = 0;

const T = mkdtempSync(join(tmpdir(), "buffalo-"));
const step = (n) => join(T, n);
const run = (script, args) =>
  execFileSync("node", [join(HERE, script), ...args], { stdio: "pipe" }).toString();
const kb = (p) => (statSync(p).size / 1024).toFixed(0);

console.log(`master ${kb(MASTER)} KB`);

// 1 ── drop the clips the app cannot play
run("glb-drop-clips.mjs", [MASTER, step("a.glb"), ...DROP]);
console.log(`  dropped ${DROP.join(", ")}  ->  ${kb(step("a.glb"))} KB`);

// 2 ── the material the scene lights, rather than one that lights itself
{
  const b = readFileSync(step("a.glb"));
  let o = 12, json = null, bin = null;
  while (o < b.length) {
    const L = b.readUInt32LE(o), t = b.readUInt32LE(o + 4);
    if (t === 0x4e4f534a) json = JSON.parse(b.subarray(o + 8, o + 8 + L).toString("utf8"));
    if (t === 0x004e4942) bin = Buffer.from(b.subarray(o + 8, o + 8 + L));
    o += 8 + L;
  }
  for (const m of json.materials ?? []) {
    m.emissiveFactor = [EMISSIVE, EMISSIVE, EMISSIVE];
    // AND THE SHEEN GOES TOO, which is the other half of "it still glows".
    //
    // With emissive at zero the animal was still reading as lit from within,
    // and the reason was not emissive at all: the material carries
    // KHR_materials_specular with specularColorFactor [1,1,1] and an ior of
    // 1.45 — a full-strength white specular across the whole hide. On dark
    // wet-looking fur that is a broad white sheen, and a sheen that does not
    // move with the light is indistinguishable from a glow.
    //
    // A buffalo is matte. Dropping both extensions lets it load as a plain
    // standard material at roughness 0.9, which is what it should always
    // have been.
    if (m.extensions != null) {
      delete m.extensions.KHR_materials_specular;
      delete m.extensions.KHR_materials_ior;
      if (Object.keys(m.extensions).length === 0) {
        delete m.extensions;
      }
    }
    // The emissive TEXTURE goes too. Left bound with a zero factor it is dead
    // weight in the JSON and an invitation to wonder later whether the glow
    // is meant to come back.
    delete m.emissiveTexture;
    m.pbrMetallicRoughness = m.pbrMetallicRoughness ?? {};
    m.pbrMetallicRoughness.metallicFactor = 0;
    m.pbrMetallicRoughness.roughnessFactor = 0.9;
  }
  // Nothing declares an extension it no longer uses.
  const stillUsed = JSON.stringify(json.materials ?? []);
  json.extensionsUsed = (json.extensionsUsed ?? []).filter(
    (e) => !e.startsWith("KHR_materials_") || stillUsed.includes(e),
  );
  const jb = Buffer.from(JSON.stringify(json), "utf8");
  const jc = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
  const bc = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const ch = (l, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(l, 0); h.writeUInt32LE(t, 4); return h; };
  const total = 12 + 8 + jc.length + 8 + bc.length;
  const hdr = Buffer.alloc(12); hdr.write("glTF", 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(total, 8);
  writeFileSync(step("b.glb"), Buffer.concat([hdr, ch(jc.length, 0x4e4f534a), jc, ch(bc.length, 0x004e4942), bc]));
  console.log(`  emissive ${EMISSIVE} (flat, no map), metal 0, rough 0.9`);
}

// 3 ── attributes to their smallest honest types
run("glb-quantize-attrs.mjs", [step("b.glb"), step("c.glb"), "--normals"]);
console.log(`  quantised attributes  ->  ${kb(step("c.glb"))} KB`);

// 4 ── keyframes a linear interpolation already reproduces
const keys = run("glb-reduce-keys.mjs", [step("c.glb"), step("d.glb"), "--tol-deg", String(TOL_DEG)]);
console.log(`  ${keys.split("\n").find((l) => l.includes("keys"))?.trim()}`);

// 5 ── the texture, re-encoded from the master's own PNG
{
  const b = readFileSync(MASTER);
  let o = 12, json = null, bin = null;
  while (o < b.length) {
    const L = b.readUInt32LE(o), t = b.readUInt32LE(o + 4);
    if (t === 0x4e4f534a) json = JSON.parse(b.subarray(o + 8, o + 8 + L).toString("utf8"));
    if (t === 0x004e4942) bin = Buffer.from(b.subarray(o + 8, o + 8 + L));
    o += 8 + L;
  }
  const v = json.bufferViews[json.images[0].bufferView];
  writeFileSync(step("tex.png"), bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  // basisu has no resize of its own; cwebp does it losslessly on the way in.
  execFileSync("cwebp", ["-quiet", "-resize", String(TEX), String(TEX), "-lossless", step("tex.png"), "-o", step("tex.webp")]);
  execFileSync("dwebp", ["-quiet", step("tex.webp"), "-o", step("tex_small.png")]);
  execFileSync("basisu", ["-ktx2", "-mipmap", "-q", "255", "-file", step("tex_small.png"), "-output_file", step("tex.ktx2")], { stdio: "ignore" });
  console.log(`  texture -> ${TEX}x${TEX} ETC1S, ${kb(step("tex.ktx2"))} KB`);
}
run("glb-swap-texture.mjs", [step("d.glb"), step("e.glb"), "0", step("tex.ktx2")]);

// 6 ── meshopt. NOT --indices; see decision 4.
run("glb-compress.mjs", [step("e.glb"), step("f.glb")]);

const size = statSync(step("f.glb")).size;
console.log(`\nshipped ${size.toLocaleString()} bytes (${(size / 1048576).toFixed(2)} MB)`);
if (size > 1_100_000) {
  console.error(`OVER BUDGET — expected under 1.05 MB`);
  process.exit(1);
}
if (DRY) {
  console.log(`--dry: left at ${step("f.glb")}`);
} else {
  copyFileSync(step("f.glb"), APP);
  copyFileSync(step("f.glb"), SHIPPED_COPY);
  console.log(`installed -> ${APP}`);
  console.log(`         -> ${SHIPPED_COPY}`);
}
