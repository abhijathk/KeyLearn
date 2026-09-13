#!/usr/bin/env node
/**
 * Regenerates the AK 3D Pack's asset inventory inside COMMERCIAL-LICENSE.md.
 *
 * Written rather than typed because a licence document that lists the wrong
 * files is worse than one that lists none: it looks authoritative and is
 * not. Everything between the INVENTORY markers is replaced from what is
 * actually in the folder.
 *
 *   node scripts/ak-pack-manifest.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const DIR = "root/public/kids-assets/models/ak-3d-pack";
const DOC = `${DIR}/COMMERCIAL-LICENSE.md`;

// How each model is presented to a child, and what it may be used as.
const ROLE = {
  Explorer: ["Dave", "Main character or companion"],
  Explorer6: ["Little Drew", "Main character or companion"],
  Peeli: ["Peeli", "Main character or companion"],
  Robot: ["Robot", "Companion only"],
  Puppy: ["Puppy", "Companion only"],
  Buffalo: ["Buffalo", "Random character (wild)"],
  // Village Road scenery. Props rather than characters: no rig, no clips, and
  // placed as landmarks along the road instead of being chosen by a child.
  Temple: ["Temple", "Village landmark"],
  Market: ["Village Market", "Village landmark"],
  Banyan: ["Banyan Tree", "Village landmark"],
  HouseMoss: ["Moss-Crowned Homestead", "Village dwelling"],
  HouseHearth: ["Hearth House", "Village dwelling"],
  HouseThatch: ["Thatch Homestead", "Village dwelling"],
  Wall: ["Stone Wall", "Village dressing"],
  Cart: ["Wooden Cart", "Village dressing"],
};

function read(file) {
  const b = readFileSync(file);
  let off = 12, json = null;
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), t = b.readUInt32LE(off + 4);
    if (t === 0x4e4f534a) json = JSON.parse(b.subarray(off + 8, off + 8 + len).toString("utf8"));
    off += 8 + len;
  }
  const acc = json.accessors ?? [];
  let tris = 0;
  for (const m of json.meshes ?? []) for (const p of m.primitives) tris += Math.floor((acc[p.indices]?.count ?? 0) / 3);
  return {
    bytes: b.length,
    joints: json.skins?.[0]?.joints?.length ?? 0,
    tris,
    clips: (json.animations ?? []).map((a) => a.name),
  };
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".glb")).sort();
const rows = files.map((f) => {
  const name = f.replace(/\.glb$/, "");
  const m = read(`${DIR}/${f}`);
  const [shown, role] = ROLE[name] ?? ["—", "—"];
  return { f, name, shown, role, ...m };
});

const total = rows.reduce((s, r) => s + r.bytes, 0);
const table = [
  "| File | Shown in the app as | Role | Size | Triangles | Joints | Animations |",
  "|---|---|---|---|---|---|---|",
  ...rows.map((r) =>
    `| \`${r.f}\` | ${r.shown} | ${r.role} | ${(r.bytes / 1048576).toFixed(2)} MB | ${r.tris.toLocaleString()} | ${r.joints} | ${r.clips.length} |`),
  "",
  `**${rows.length} models, ${(total / 1048576).toFixed(2)} MB in total.**`,
  "",
  "Animation clips, per model:",
  "",
  ...rows.map((r) => `- **${r.shown}** (\`${r.f}\`) — ${r.clips.map((c) => `\`${c}\``).join(", ")}`),
].join("\n");

const doc = readFileSync(DOC, "utf8");
const START = "<!-- INVENTORY:START -->", END = "<!-- INVENTORY:END -->";
const a = doc.indexOf(START), b = doc.indexOf(END);
if (a === -1 || b === -1) throw new Error(`${DOC} is missing the INVENTORY markers`);
writeFileSync(DOC, `${doc.slice(0, a + START.length)}\n\n${table}\n\n${doc.slice(b)}`);
console.log(`  inventory written: ${rows.length} models, ${(total / 1048576).toFixed(2)} MB`);
for (const r of rows) console.log(`    ${r.f.padEnd(16)} ${r.shown.padEnd(12)} ${r.clips.length} clips`);
