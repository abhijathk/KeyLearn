#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";

/**
 * Downloads the neural voices the server reads lessons in.
 *
 * They are ~78 MB each and they are data, not source, so they are not in the
 * repository. Without them a deployment still speaks — it falls back to
 * espeak-ng — but espeak is the "very rough and not kids friendly" voice a
 * customer complained about, and the fallback is silent about it. So a machine
 * that has not run this is quietly serving the thing the voices were built to
 * replace.
 *
 * Run once per deployment:
 *
 *     node scripts/fetch-voices.mjs
 *
 * Idempotent: a voice already present and matching its hash is left alone, so
 * this is safe in a deploy script that runs every time.
 */

/**
 * The three voices, pinned by the SHA-256 of the model actually listened to.
 *
 * Pinned rather than trusted, because these are ~78 MB binaries fetched over
 * the network and fed to a model runner. A hash mismatch means the file is not
 * the one that was chosen by ear — whether through corruption, a re-uploaded
 * release, or something worse — and none of those should be loaded and spoken
 * to a child without somebody looking first.
 */
const VOICES = [
  {
    bundle: "vits-piper-en_US-amy-medium",
    model: "en_US-amy-medium.onnx",
    sha256: "fbaa8e36d8f26fe6f3ebb65cab461e629d8b37a5b7c5fb78fb64317db73e1c25",
    // Amy carries both Pip (the child, pitched up) and Maya.
    used: "Pip, Maya",
  },
  {
    bundle: "vits-piper-en_GB-jenny_dioco-medium",
    model: "en_GB-jenny_dioco-medium.onnx",
    sha256: "bd5207a2752d8766a8b771437776fd7575031a9f9876eaf13b8db778b150993a",
    used: "Robin",
  },
  {
    bundle: "vits-piper-en_US-ryan-medium",
    model: "en_US-ryan-medium.onnx",
    sha256: "7194c57359c49aaa1abb9c66d6d30d376475859f4ffdfd9c0415be8e032565f9",
    used: "Theo",
  },
];

const BASE =
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models";

/**
 * Where the models go.
 *
 * The same resolution the server uses, so the two cannot disagree about where
 * the voices live — see `voicesDir()` in packages/server/lib/app/speech/synth.ts.
 */
function voicesDir() {
  const home = process.env.HOME ?? ".";
  return (
    process.env.KEYLEARN_VOICES_DIR ||
    join(
      (process.env.DATA_DIR || join(home, ".local/state/keylearn")).replace(
        /^~/,
        home,
      ),
      "voices",
    )
  );
}

async function sha256(file) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

async function exists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr?.on("data", (b) => (err += String(b)));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} failed: ${err.trim()}`)),
    );
  });
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

async function fetchVoice(voice, dir) {
  const target = join(dir, voice.bundle);
  const model = join(target, voice.model);

  if (await exists(model)) {
    const have = await sha256(model);
    if (have === voice.sha256) {
      console.log(`  ${voice.bundle}  already installed (${voice.used})`);
      return "kept";
    }
    // Present but not what we pinned. Say so rather than silently replacing
    // it: somebody may have put it there deliberately.
    console.log(
      `  ${voice.bundle}  present but does NOT match the pinned hash\n` +
        `      expected ${voice.sha256}\n` +
        `      found    ${have}\n` +
        `      remove it and run again to replace it.`,
    );
    return "mismatch";
  }

  const url = `${BASE}/${voice.bundle}.tar.bz2`;
  console.log(`  ${voice.bundle}  downloading (${voice.used})…`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${url} -> HTTP ${response.status}`);
  }

  // Unpacked through a temporary directory so an interrupted run cannot leave
  // a half-extracted voice that looks installed.
  const work = await mkdtemp(join(tmpdir(), "keylearn-voice-"));
  try {
    const archive = join(work, "voice.tar.bz2");
    await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
    await run("tar", ["xjf", archive], work);
    const unpacked = join(work, voice.bundle);
    if (!(await exists(join(unpacked, voice.model)))) {
      throw new Error(`archive did not contain ${voice.model}`);
    }
    const got = await sha256(join(unpacked, voice.model));
    if (got !== voice.sha256) {
      throw new Error(
        `hash mismatch for ${voice.model}\n` +
          `      expected ${voice.sha256}\n` +
          `      got      ${got}\n` +
          `      Refusing to install a model that is not the one we chose.`,
      );
    }
    await mkdir(dir, { recursive: true });
    await rm(target, { recursive: true, force: true });
    await run("mv", [unpacked, target]);
    const size = (await stat(join(target, voice.model))).size;
    console.log(`  ${voice.bundle}  installed (${mb(size)})`);
    return "installed";
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

const dir = voicesDir();
console.log(`Voices go in ${dir}`);
await mkdir(dir, { recursive: true });

const results = [];
for (const voice of VOICES) {
  try {
    results.push(await fetchVoice(voice, dir));
  } catch (err) {
    console.error(`  ${voice.bundle}  FAILED: ${err.message}`);
    results.push("failed");
  }
}

const failed = results.filter((r) => r === "failed" || r === "mismatch").length;
if (failed > 0) {
  console.error(
    `\n${failed} of ${VOICES.length} voices are not installed.\n` +
      `The server will fall back to espeak-ng, which is the rough voice these\n` +
      `replace — so this is worth fixing rather than shipping past.`,
  );
  process.exit(1);
}
console.log(
  `\nAll ${VOICES.length} voices ready. The server picks them up on restart; ` +
    `check with:\n  curl -s localhost:4000/_/speech/voices`,
);
