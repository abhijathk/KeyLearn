/**
 * Rebase a borrowed clip's root translation onto the skeleton it now drives.
 *
 *   node scripts/glb-rebase-root.mjs in.glb out.glb --from source.glb \
 *        --clip Graze --clip Walk [--bone Hips]
 *
 * WHY A CLIP THAT SPLICES CLEANLY CAN STILL COME OUT WRONG.
 *
 * `glb-splice-animations.mjs` remaps channels by bone NAME, which is exactly
 * right for rotation: a rotation is a joint angle and means the same thing on
 * any skeleton that has that joint, whatever its proportions. Every clip on
 * these animals is rotation-only except for ONE channel — a translation on
 * the root bone, which carries the body's height and its bob.
 *
 * That one is not portable, because it is written in ABSOLUTE units in the
 * source animal's body. The buffalo's hips rest at y = -0.1195, the cow's at
 * -0.0912 and the calf's at -0.083, so a clip that drives the calf's hips to
 * the buffalo's numbers lifts it two and a half centimetres of model space
 * off its own rest — which on the smallest animal, whose legs are shortest,
 * is most of a leg. The calf came out standing in the air with its knees in
 * the wrong place, while the same clip on the cow was merely a little high.
 *
 * So the MOTION transfers and the REST does not: every key is shifted by
 * (this skeleton's rest - the source skeleton's rest). The bob, the dip of a
 * grazing head, the rise and fall of a walk are all preserved exactly,
 * because they are differences within the track and a constant offset leaves
 * differences alone. Only the height the whole thing hangs from changes, and
 * that is the part that was never the source animal's to lend.
 *
 * ONLY THE CLIPS NAMED WITH --clip. This matters more than it looks: the
 * animal's OWN clips are already written in its own body and shifting them
 * would break the one thing that was never broken. Run without the filter
 * this rebased the cow's authored Idle along with the three borrowed ones,
 * which is exactly the bug it exists to fix, applied backwards.
 *
 * Rotation channels are not touched, and neither is any other node.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(n);
  return i < 0 ? d : args[i + 1];
};
const [inPath, outPath] = args.filter(
  (a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")),
);
const fromPath = flag("--from");
const clips = args.flatMap((a, i) => (a === "--clip" ? [args[i + 1]] : []));
const BONE = flag("--bone", "Hips");
if (!inPath || !outPath || !fromPath || clips.length === 0) {
  console.error(
    "usage: glb-rebase-root.mjs in.glb out.glb --from source.glb" +
      " --clip Name [--clip Name...] [--bone Hips]",
  );
  process.exit(2);
}

function read(path) {
  const src = readFileSync(path);
  let off = 12,
    json = null,
    bin = null;
  while (off + 8 <= src.length) {
    const len = src.readUInt32LE(off),
      type = src.readUInt32LE(off + 4);
    const body = src.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
    if (type === 0x004e4942) bin = Buffer.from(body);
    off += 8 + len;
  }
  return { json, bin };
}

const restOf = (json, name) => {
  const node = json.nodes.find((n) => n.name === name);
  if (node == null) throw new Error(`no bone called "${name}"`);
  return node.translation ?? [0, 0, 0];
};

const { json, bin } = read(inPath);
const { json: srcJson } = read(fromPath);
const here = restOf(json, BONE);
const there = restOf(srcJson, BONE);
const delta = [here[0] - there[0], here[1] - there[1], here[2] - there[2]];
console.log(
  `  ${BONE}: source rest ${there.map((v) => v.toFixed(4)).join(", ")}` +
    ` -> this rest ${here.map((v) => v.toFixed(4)).join(", ")}`,
);
if (delta.every((d) => Math.abs(d) < 1e-6)) {
  console.log("  identical rests — nothing to rebase");
  writeFileSync(outPath, readFileSync(inPath));
  process.exit(0);
}

const boneIdx = json.nodes.findIndex((n) => n.name === BONE);
let shifted = 0;
const done = new Set();
for (const anim of json.animations ?? []) {
  if (!clips.includes(anim.name)) {
    continue; // its own clip, already in its own body
  }
  for (const ch of anim.channels) {
    if (ch.target.node !== boneIdx || ch.target.path !== "translation") continue;
    const acc = json.accessors[anim.samplers[ch.sampler].output];
    // Same accessor can back several clips; shift its bytes once.
    if (done.has(acc.bufferView)) continue;
    done.add(acc.bufferView);
    if (acc.componentType !== 5126 || acc.type !== "VEC3") {
      console.warn(`  skipped a non-float VEC3 track in "${anim.name}"`);
      continue;
    }
    const view = json.bufferViews[acc.bufferView];
    const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    for (let i = 0; i < acc.count; i++) {
      for (let c = 0; c < 3; c++) {
        const at = base + (i * 3 + c) * 4;
        bin.writeFloatLE(bin.readFloatLE(at) + delta[c], at);
      }
    }
    // The accessor's declared bounds have to move with the data, or a
    // renderer that culls or quantizes from them reads the old body.
    if (acc.min != null) acc.min = acc.min.map((v, c) => v + delta[c]);
    if (acc.max != null) acc.max = acc.max.map((v, c) => v + delta[c]);
    shifted++;
    console.log(`  rebased "${anim.name}" (${acc.count} keys)`);
  }
}

const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
const jsonPad = Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20);
const binPad = Buffer.alloc((4 - (bin.length % 4)) % 4);
const head = Buffer.alloc(12);
const jh = Buffer.alloc(8);
const bh = Buffer.alloc(8);
jh.writeUInt32LE(jsonBuf.length + jsonPad.length, 0);
jh.writeUInt32LE(0x4e4f534a, 4);
bh.writeUInt32LE(bin.length + binPad.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
const body = Buffer.concat([jh, jsonBuf, jsonPad, bh, bin, binPad]);
head.write("glTF", 0);
head.writeUInt32LE(2, 4);
head.writeUInt32LE(12 + body.length, 8);
writeFileSync(outPath, Buffer.concat([head, body]));
console.log(`  ${shifted} root track(s) rebased -> ${outPath}`);
