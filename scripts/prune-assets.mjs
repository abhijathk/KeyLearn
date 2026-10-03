// Removes built browser assets that are old AND not in the current manifest.
// A build no longer empties root/public/assets (see webpack.config.js), so a
// tab left open across a rebuild still finds the chunks it asks for; this
// keeps the folder from growing for ever.
import { readFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "root", "public", "assets");
const DAYS = Number(process.env.KEEP_ASSET_DAYS ?? 3);
let manifest = "";
try {
  manifest = readFileSync(join(dir, "manifest.json"), "utf8");
} catch {
  process.exit(0);
}
// Lazy chunks are not in the manifest: the entry script names them. Treat a
// file as live if any built script mentions it.
for (const name of readdirSync(dir)) {
  if (name.endsWith(".js")) manifest += readFileSync(join(dir, name), "utf8");
}
const cutoff = Date.now() - DAYS * 86_400_000;
let removed = 0;
for (const name of readdirSync(dir)) {
  if (name === "manifest.json") continue;
  const base = name.replace(/\.(br|gz)$/, "");
  if (manifest.includes(base)) continue;
  const path = join(dir, name);
  if (statSync(path).mtimeMs < cutoff) {
    unlinkSync(path);
    removed += 1;
  }
}
console.log(`prune-assets: removed ${removed} files older than ${DAYS} days`);
