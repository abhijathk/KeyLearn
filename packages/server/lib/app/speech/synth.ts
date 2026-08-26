import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Speech synthesised on the server.
 *
 * Two separate reasons this exists, and they pull in the same direction.
 *
 * The first is reliability. The browser's own engine fails in a way that cannot
 * be recovered from inside the page — Chrome accepts an utterance, reports it
 * as speaking, and never makes a sound — and on the braille page the voice is
 * not a nicety, it is the interface.
 *
 * The second is quality, and it is why this is now the FIRST choice rather than
 * a fallback. A customer reported that the voice their child heard was "very
 * rough and not kids friendly". It was: whatever engine the device shipped
 * with, or espeak-ng behind it. Both are formant synthesisers, and no amount of
 * tuning makes one pleasant for a five-year-old who cannot yet read the words
 * being spoken to them.
 *
 * Rendering here also means every learner hears the same voice. The app runs on
 * mac, windows and linux; the learner's device only plays a WAV, so the voice
 * is a property of the product rather than of whatever machine a child happens
 * to be sitting at.
 */

/** The longest phrase we will synthesise. */
export const MAX_TEXT = 300;

/**
 * The voices a learner may be given.
 *
 * Four, chosen by listening to eleven candidates side by side rather than by
 * reading descriptions of them — see `.tools/voices`, which renders the real
 * audio for exactly that purpose.
 *
 * Two child voices because a twelve-year-old being read to in a five-year-
 * old's voice is being talked down to, and that is its own way of turning a
 * learner off. The age ranges are guidance for whoever picks, not a rule the
 * app enforces.
 *
 * An allow-list, not a shape check: the value selects a model and reaches a
 * subprocess argument, and "looks like a voice name" is a weaker promise than
 * "is one of ours".
 */
export const VOICES = ["kid", "tween", "lady", "man"] as const;

export type VoiceId = (typeof VOICES)[number];

export function isVoiceId(value: string): value is VoiceId {
  return (VOICES as readonly string[]).includes(value);
}

/**
 * Which model speaks each voice, and how far its pitch is moved.
 *
 * Amy carries both the youngest child and the woman. That is a better answer
 * than three unrelated voices: a household hears one consistent person, higher
 * for the child and natural for the adult, rather than a cast of strangers.
 *
 * There is no child model to be had — Piper's free set has none — so the child
 * voices are adult voices raised in pitch. See `render` for why that costs
 * nothing in quality.
 */
/**
 * `pace` corrects for how fast a model speaks of its own accord.
 *
 * These are separately trained voices and they do not agree on what a normal
 * speaking rate is: given the same sentence at the same nominal speed, Ryan
 * finishes in about three seconds where Amy takes nearly five. "The man talks
 * too fast" is not a setting anybody chose, and turning down the rate control
 * would slow every voice to fix one.
 *
 * Below one is slower. Applied before the pitch shift, so it changes the
 * delivery rather than falling out of the resampling.
 */
const VOICE_MODELS: Record<
  VoiceId,
  {
    readonly bundle: string;
    readonly model: string;
    readonly pitch: number;
    readonly pace: number;
  }
> = {
  // Roughly five to eight: the band that cannot read the coaching at all.
  kid: {
    bundle: "vits-piper-en_US-amy-medium",
    model: "en_US-amy-medium",
    // Nudged up from 1.28, and slowed a little. Higher alone starts to sound
    // pinched rather than young; taking the pace down with it is what reads as
    // a small person talking to you rather than an adult sped up. Both moves
    // are deliberately small — past about 1.4 the vowels go thin and it stops
    // sounding like a child at all.
    pitch: 1.33,
    pace: 0.94,
  },
  // Roughly nine to thirteen. Lifted, but only a little — enough not to be an
  // adult, not so much as to sound like a cartoon to somebody old enough to
  // notice and be embarrassed by it.
  tween: {
    bundle: "vits-piper-en_GB-jenny_dioco-medium",
    model: "en_GB-jenny_dioco-medium",
    pitch: 1.15,
    pace: 1,
  },
  lady: {
    bundle: "vits-piper-en_US-amy-medium",
    model: "en_US-amy-medium",
    pitch: 1,
    pace: 1,
  },
  man: {
    bundle: "vits-piper-en_US-ryan-medium",
    model: "en_US-ryan-medium",
    pitch: 1,
    // Ryan runs well ahead of the others; brought into line with them.
    pace: 0.8,
  },
};

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

// ── The neural voices ───────────────────────────────────────────────────────

/**
 * Where the models live.
 *
 * Beside the data rather than in the repository: they are ~78 MB each, they are
 * data rather than source, and a git history is the wrong home for either.
 * `scripts/fetch-voices.mjs` puts them here, and a deployment without them
 * falls back rather than failing.
 */
function voicesDir(): string {
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

/** One loaded model per bundle: loading is slow, and two voices share Amy. */
const engines = new Map<string, any>();

function engineFor(voice: VoiceId): any {
  const spec = VOICE_MODELS[voice];
  const had = engines.get(spec.bundle);
  if (had != null) {
    return had;
  }
  // Required rather than imported: a native addon, marked external in the
  // server bundle, and a machine with no models should not pay to load it.
  const sherpa = createRequire(import.meta.url)("sherpa-onnx-node");
  const base = join(voicesDir(), spec.bundle);
  const made = new sherpa.OfflineTts({
    model: {
      vits: {
        model: join(base, `${spec.model}.onnx`),
        tokens: join(base, "tokens.txt"),
        // Piper models are phonemised with espeak-ng, so the model alone is not
        // enough — it needs the phoneme data that ships beside it.
        dataDir: join(base, "espeak-ng-data"),
      },
      numThreads: 2,
      debug: false,
      provider: "cpu",
    },
    maxNumSentences: 1,
  });
  engines.set(spec.bundle, made);
  return made;
}

const neural: Synth = {
  name: "sherpa",
  render: async (text, _lang, wpm, voice) => {
    const id = voice ?? "lady";
    const { pitch } = VOICE_MODELS[id];
    // 175 wpm is the reference the rest of the app is written against.
    const rate = wpm / 175;
    // ## Raising the pitch without stretching anything
    //
    // The usual way — overlap-add time-stretching after synthesis — leaves
    // warble and seams on speech, and a child would then be listening to our
    // artefacts rather than to the voice. So the shift happens before synthesis
    // instead: the model is asked to speak proportionally SLOWER, and the
    // result is resampled faster by the same factor. Speed cancels exactly,
    // pitch is multiplied, and every sample is one the model really produced.
    const result = engineFor(id).generate({
      text,
      sid: 0,
      speed: (rate * VOICE_MODELS[id].pace) / pitch,
    });
    return wavOf(resample(result.samples, pitch), result.sampleRate);
  },
};

/** Linear resample. A ratio above one shortens, and so raises the pitch. */
function resample(samples: Float32Array, ratio: number): Float32Array {
  if (ratio === 1) {
    return samples;
  }
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const at = i * ratio;
    const lo = Math.floor(at);
    const hi = Math.min(lo + 1, samples.length - 1);
    out[i] = samples[lo] + (samples[hi] - samples[lo]) * (at - lo);
  }
  return out;
}

/** Float samples as a 16-bit mono WAV, which is what the page plays. */
function wavOf(samples: Float32Array, rate: number): Buffer {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

/** Which curated voices have a model on this machine. */
async function neuralVoices(): Promise<readonly VoiceId[]> {
  const found: VoiceId[] = [];
  for (const id of VOICES) {
    const spec = VOICE_MODELS[id];
    try {
      await access(
        join(voicesDir(), spec.bundle, `${spec.model}.onnx`),
        constants.R_OK,
      );
      found.push(id);
    } catch {
      // Not installed. Better absent than failing once per request.
    }
  }
  return found;
}

// ── The fallbacks ───────────────────────────────────────────────────────────

/**
 * espeak-ng: small, offline, packaged everywhere, and the voice a lot of screen
 * reader users already run at speed.
 *
 * Underneath the neural voices now rather than in front of them, and kept
 * because a machine without models still has to speak — on the braille page the
 * voice is the interface, and silence there is not a degraded experience but no
 * experience at all.
 *
 * Its "voices" are variants of one formant synthesiser: a pitch and a timbre,
 * not a person. They are offered under the same names because being read to in
 * a higher voice is closer to what was asked for than nothing, and because the
 * alternative is a setting that silently does nothing on the deployment that
 * has fallen back.
 */
const ESPEAK_VARIANT: Record<VoiceId, readonly string[]> = {
  kid: ["+f5", "-p", "80"],
  tween: ["+f4", "-p", "65"],
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
 *
 * Named voices rather than chosen by attribute, since the attribute lists
 * differ between macOS releases and a missing voice fails the whole request.
 * Distinct ones per role: mapping two roles to the same system voice makes the
 * setting appear broken, which is exactly the bug this table once had.
 */
const MAC_VOICE: Record<VoiceId, string> = {
  kid: "Junior",
  tween: "Karen",
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
    resolved =
      (await neuralVoices()).length > 0
        ? neural
        : (await onPath("espeak-ng"))
          ? espeak
          : (await onPath("say"))
            ? macSay
            : null;
  }
  return resolved;
}

/**
 * Which curated voices this machine can actually speak in.
 *
 * Asked of the synthesiser that will do the speaking, not of the neural models
 * alone — which is what this did at first, and it would have shipped the whole
 * feature dead. Production runs espeak-ng, so the answer would have been "none"
 * on every deployment that mattered: the picker hides itself when nothing is
 * offered, so nobody could ever have chosen a voice, while the endpoint behind
 * it rendered all of them perfectly well if asked directly.
 */
export async function installedVoices(): Promise<readonly VoiceId[]> {
  const synth = await findSynth();
  if (synth == null) {
    return [];
  }
  return synth.name === "sherpa" ? await neuralVoices() : VOICES;
}

/**
 * A short token that changes whenever the audio would.
 *
 * The rendered WAV is cached hard — a week, `immutable` — because the same
 * words in the same voice really are the same bytes, and a drill says the same
 * six things over and over. But the URL did not mention which voice table or
 * which engine produced them, so when the voices changed every browser went on
 * serving week-old audio from the previous engine. A customer heard exactly
 * that: three voices still the old rough ones, and the fourth right only
 * because it was new and had never been cached.
 *
 * Derived rather than declared. A hand-bumped constant is one more thing
 * somebody has to remember, and forgetting it looks precisely like the bug it
 * was meant to prevent.
 */
export async function voiceRev(): Promise<string> {
  const synth = await findSynth();
  return createHash("sha256")
    .update(`${synth?.name ?? "none"}|${JSON.stringify(VOICE_MODELS)}`)
    .digest("hex")
    .slice(0, 8);
}

/** Forgets the probe. Tests only; a deployment's binaries do not move. */
export function resetSynth(): void {
  resolved = undefined;
  engines.clear();
}
