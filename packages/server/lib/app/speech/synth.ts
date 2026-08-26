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

/**
 * The voices a learner may be given.
 *
 * A curated three rather than whatever the machine has. A customer reported
 * that the voice their child heard was "very rough and not kids friendly",
 * which it was: the browser's default engine on whatever device they had, or
 * espeak-ng behind it, and neither is something a five-year-old should be
 * asked to listen to while learning to read.
 *
 * Three, not thirty, because each one has to be listened to and judged before
 * it is put in front of a child, and because a list of thirty is a list nobody
 * chooses from. "system" is the browser's own engine — today's behaviour, and
 * still the right answer for an adult who has already configured a voice they
 * like, or for a screen reader user whose voice at speed is part of how they
 * work.
 *
 * An allow-list, not a shape check: the value picks a model file and reaches a
 * subprocess argument, and "looks like a voice name" is a weaker promise than
 * "is one of ours".
 */
export const VOICES = ["kid", "lady", "man"] as const;

export type VoiceId = (typeof VOICES)[number];

export function isVoiceId(value: string): value is VoiceId {
  return (VOICES as readonly string[]).includes(value);
}

export type Synth = {
  readonly name: string;
  /** Renders to WAV bytes. */
  readonly render: (
    text: string,
    lang: string,
    wpm: number,
    voice: VoiceId | null,
  ) => Promise<Buffer>;
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
  input?: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: [input == null ? "ignore" : "pipe", "pipe", "pipe"],
    });
    if (input != null && child.stdin != null) {
      // Piper reads its text from stdin. That is better than an argument, not
      // worse: the phrase never appears in a process listing, and there is no
      // length at which it stops being a single value.
      child.stdin.on("error", () => {}); // The child may exit before we finish.
      child.stdin.end(input);
    }
    const out: Buffer[] = [];
    let size = 0;
    // A synthesiser that goes haywire must not be able to fill memory.
    const cap = 8 * 1024 * 1024;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out`));
    }, timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
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
 * Piper: small neural voices, offline, MIT-licensed, and the reason this work
 * exists. It is the difference between a synthesiser a child tolerates and one
 * they turn off — which for a learner who cannot yet read the coaching is the
 * difference between the app working and not.
 *
 * The models are data, not code: one .onnx per voice, tens of megabytes, and
 * not something to vendor into a repository. So the paths come from the
 * environment and the voice is available exactly when its model is installed.
 * A machine with piper and two of the three models offers those two.
 */
const PIPER_MODELS: Record<VoiceId, string | undefined> = {
  kid: process.env.KEYLEARN_PIPER_KID,
  lady: process.env.KEYLEARN_PIPER_LADY,
  man: process.env.KEYLEARN_PIPER_MAN,
};

/** Which curated voices this machine can actually speak in. */
export async function installedVoices(): Promise<readonly VoiceId[]> {
  if (!(await onPath("piper"))) {
    return [];
  }
  const found: VoiceId[] = [];
  for (const id of VOICES) {
    const model = PIPER_MODELS[id];
    if (model != null && model !== "") {
      try {
        await access(model, constants.R_OK);
        found.push(id);
      } catch {
        // Configured but not there. Better absent than failing per request.
      }
    }
  }
  return found;
}

const piper: Synth = {
  name: "piper",
  render: async (text, _lang, wpm, voice) => {
    const model = PIPER_MODELS[voice ?? "lady"] ?? PIPER_MODELS.lady;
    if (model == null || model === "") {
      throw new Error("no piper model for this voice");
    }
    // Piper's length scale is duration, so it runs the opposite way to a rate:
    // 175 wpm is the reference the rest of the app is written against.
    const scale = Math.max(0.5, Math.min(2, 175 / wpm));
    return await run(
      "piper",
      [
        "--model",
        model,
        "--length_scale",
        scale.toFixed(2),
        "--output_file",
        "-",
      ],
      // A neural model is slower than a formant synthesiser, and a cold start
      // loads weights. Still bounded: a request that hangs is worse than one
      // that fails, because the page has a fallback and no way to wait.
      15000,
      text,
    );
  },
};

/**
 * espeak-ng: small, offline, packaged everywhere, and the voice a lot of
 * screen reader users already run at speed. Behind piper now rather than in
 * front of it, and kept because a machine without models still has to speak —
 * the braille page's voice is its interface, not a nicety.
 *
 * Its "voices" are variants of one formant synthesiser: a pitch and a timbre,
 * not a person. Offered under the same three names because being read to in a
 * higher, slower voice is still closer to what was asked for than nothing, and
 * because the alternative is a setting that silently does nothing on the very
 * deployment that most needs it.
 */
const ESPEAK_VARIANT: Record<VoiceId, readonly string[]> = {
  // Higher and a little slower. The nearest espeak has to a child.
  kid: ["+f5", "-p", "80"],
  lady: ["+f3", "-p", "55"],
  man: ["+m3", "-p", "30"],
};

const espeak: Synth = {
  name: "espeak-ng",
  render: async (text, lang, wpm, voice) => {
    const [variant, ...pitch] = voice == null ? [""] : ESPEAK_VARIANT[voice];
    return await run(
      "espeak-ng",
      [
        "-v",
        `${lang}${variant}`,
        "-s",
        String(wpm),
        ...pitch,
        "--stdout",
        "--",
        text,
      ],
      5000,
    );
  },
};

/**
 * macOS `say`, so the fallback can be developed and tested on a Mac without
 * installing anything. It has no stdout mode, hence the temp file.
 */
const MAC_VOICE: Record<VoiceId, string> = {
  // Named rather than chosen by attribute, since the attribute lists differ
  // between macOS releases and a missing voice fails the whole request.
  kid: "Samantha",
  lady: "Samantha",
  man: "Daniel",
};

const macSay: Synth = {
  name: "say",
  render: async (text, _lang, wpm, voice) => {
    const dir = await mkdtemp(join(tmpdir(), "keylearn-tts-"));
    const file = join(dir, "out.wav");
    try {
      await run(
        "say",
        [
          ...(voice == null ? [] : ["-v", MAC_VOICE[voice]]),
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
    // Piper first, and only when it has a model to speak with — the binary
    // alone would take the request and fail it, which is worse than espeak.
    resolved =
      (await installedVoices()).length > 0
        ? piper
        : (await onPath("espeak-ng"))
          ? espeak
          : (await onPath("say"))
            ? macSay
            : null;
  }
  return resolved;
}

/** Forgets the probe. Tests only; a deployment's binaries do not move. */
export function resetSynth(): void {
  resolved = undefined;
}
