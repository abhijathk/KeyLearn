import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Speech synthesised on the server.
 *
 * The browser's own speech engine is the right thing to use when it works: it
 * is the learner's configured voice, at their rate, with no network in the
 * loop. But it fails in a way that cannot be recovered from inside the page —
 * Chrome accepts an utterance, reports it as speaking, and never makes a sound
 * — and on the braille page the voice is not a nicety, it is the interface.
 *
 * So the server can speak instead. Same words, a plainer voice, and a round
 * trip that a drill can absorb because the phrases repeat and cache.
 */

/** The longest phrase we will synthesise. */
export const MAX_TEXT = 300;

export type Synth = {
  readonly name: string;
  /** Renders to WAV bytes. */
  readonly render: (text: string, lang: string, wpm: number) => Promise<Buffer>;
};

async function onPath(binary: string): Promise<boolean> {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    if (dir === "") {
      continue;
    }
    try {
      await access(join(dir, binary), constants.X_OK);
      return true;
    } catch {
      // Not here; keep looking.
    }
  }
  return false;
}

/**
 * Runs a command with its arguments as an array — never a shell string. The
 * text being spoken comes from the client, and a shell would turn a phrase
 * containing a semicolon into a command.
 */
function run(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    let size = 0;
    // A synthesiser that goes haywire must not be able to fill memory.
    const cap = 8 * 1024 * 1024;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out`));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > cap) {
        child.kill("SIGKILL");
        reject(new Error(`${command} produced too much audio`));
        return;
      }
      out.push(chunk);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(Buffer.concat(out));
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}

/**
 * espeak-ng: small, offline, packaged everywhere, and the voice a lot of
 * screen reader users already run at speed. This is the one production uses.
 */
const espeak: Synth = {
  name: "espeak-ng",
  render: async (text, lang, wpm) =>
    run(
      "espeak-ng",
      ["-v", lang, "-s", String(wpm), "--stdout", "--", text],
      5000,
    ),
};

/**
 * macOS `say`, so the fallback can be developed and tested on a Mac without
 * installing anything. It has no stdout mode, hence the temp file.
 */
const macSay: Synth = {
  name: "say",
  render: async (text, _lang, wpm) => {
    const dir = await mkdtemp(join(tmpdir(), "keylearn-tts-"));
    const file = join(dir, "out.wav");
    try {
      await run(
        "say",
        [
          "-r",
          String(wpm),
          "--data-format=LEI16@22050",
          "-o",
          file,
          "--file-format=WAVE",
          "--",
          text,
        ],
        5000,
      );
      return await readFile(file);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
};

let resolved: Synth | null | undefined;

/**
 * The synthesiser this machine has, or null if it has none.
 *
 * Resolved once. A missing binary is a deployment fact, not a per-request one,
 * and probing the path on every request would be a syscall per spoken word.
 */
export async function findSynth(): Promise<Synth | null> {
  if (resolved === undefined) {
    resolved = (await onPath("espeak-ng"))
      ? espeak
      : (await onPath("say"))
        ? macSay
        : null;
  }
  return resolved;
}
