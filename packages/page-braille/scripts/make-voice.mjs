#!/usr/bin/env node
/**
 * Records the offline voice.
 *
 * The braille page needs a voice that works when the browser's own does not —
 * and on the braille page the voice is not a nicety, it is the interface. The
 * server used to synthesise the words on demand, but a round trip before every
 * utterance is too slow for a drill where the learner hears something after
 * every cell. So the words are recorded once, here, and bundled.
 *
 * The vocabulary is finite on purpose. Everything the page says is either one
 * of the fixed phrases below, a letter, a digit, or a lesson word — and a
 * lesson word is spelled out from the letter clips, which for someone learning
 * braille cell by cell is arguably the more useful reading anyway.
 *
 * English only. English braille is what the page teaches, and a recorded
 * voice cannot follow the interface into 54 locales; when the page grows
 * another braille code this script grows another voice with it.
 *
 * Run on a Mac, where `say` and `afconvert` both ship with the system:
 *
 *   node packages/page-braille/scripts/make-voice.mjs
 *
 * The output is committed, so nobody needs a Mac to build the app — only to
 * change what the voice says.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "..", "assets", "voice");
const generated = join(here, "..", "lib", "voice-clips.ts");

/** The voice. Samantha is the clearest of the ones present on every Mac. */
const VOICE = "Samantha";
/** Slightly slower than conversational: this is being listened to closely. */
const WPM = 170;

/**
 * Every sound the page can make, as `id: text`.
 *
 * The ids are what the runtime composes phrases out of, so they are stable
 * even when the wording changes.
 */
const CLIPS = {
  // The letters and digits, which everything else is built from.
  ...Object.fromEntries(
    Array.from({ length: 26 }, (_, i) => {
      const letter = String.fromCharCode(97 + i);
      return [`letter-${letter}`, letter];
    }),
  ),
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`digit-${i}`, String(i)]),
  ),

  // Fixed sentences, recorded whole so they keep their prosody. Reading these
  // out of concatenated word clips sounds like a ransom note.
  ready:
    "Braille practice. Press the slash key for controls, " +
    "Enter to hear the word again.",
  controls:
    "F D S and J K L are dots one to six. Space is a blank cell, and two " +
    "low notes tell you one is due. Enter repeats the word. Left arrow " +
    "reads the whole line. Up arrow spells the word. Down arrow gives the " +
    "dots. Backspace deletes the last cell.",

  // The cells past the alphabet, named. The mark itself is no use to a speech
  // engine — a full stop is rendered as a pause, or as nothing at all.
  "mark-full-stop": "full stop",
  "mark-comma": "comma",
  "mark-question-mark": "question mark",
  "mark-apostrophe": "apostrophe",
  "mark-exclamation-mark": "exclamation mark",
  "mark-hyphen": "hyphen",
  "mark-semicolon": "semicolon",
  "mark-colon": "colon",
  "sign-capital": "capital sign",
  "sign-number": "number sign",

  // Finishing the alphabet, which is now the halfway mark rather than the end.
  "alphabet-done":
    "That is the whole alphabet, every letter, a to z. From here the lines " +
    "start using punctuation, capitals and numbers.",

  // The daily goal. Fragments, because the numbers in it are not knowable in
  // advance and the digits are already recorded.
  "minutes-today": "minutes of practice today.",
  "minutes-to-go": "minutes to go.",
  "goal-halfway": "Halfway to today's goal:",
  "goal-passed": "That is your goal passed. Anything more is a bonus.",
  "goal-of": "of",

  // Fragments the templated messages are assembled from.
  dots: "dots",
  space: "space",
  blank: "blank",
  "try-again": "Try again.",
  "new-line": "New line,",
  words: "words.",
  "line-done": "Line done.",
  "cells-a-minute": "cells a minute,",
  "percent-accurate": "percent accurate.",
  correct: "correct",
};

function main() {
  rmSync(assets, { recursive: true, force: true });
  mkdirSync(assets, { recursive: true });

  const tmp = join(assets, "tmp.aiff");
  for (const [id, text] of Object.entries(CLIPS)) {
    execFileSync("say", ["-v", VOICE, "-r", String(WPM), "-o", tmp, text]);
    // Mono, 24 kbit/s AAC. Speech at this bitrate is indistinguishable from
    // the original and the whole set stays small enough to bundle.
    execFileSync("afconvert", [
      "-f", "mp4f", "-d", "aac", "-b", "24000", "-c", "1",
      tmp, join(assets, `${id}.m4a`),
    ]);
  }
  rmSync(tmp, { force: true });

  const ids = Object.keys(CLIPS);
  const imports = ids
    .map((id, i) => `import c${i} from "../assets/voice/${id}.m4a";`)
    .join("\n");
  const entries = ids.map((id, i) => `  ${JSON.stringify(id)}: c${i},`).join("\n");
  writeFileSync(
    generated,
    `// Generated by scripts/make-voice.mjs — do not edit.\n` +
      `//\n` +
      `// Regenerate after changing the vocabulary in that script; the audio\n` +
      `// files beside it are committed so a build needs no recording tools.\n` +
      `${imports}\n\n` +
      `export const VOICE_CLIPS: Readonly<Record<string, string>> = {\n` +
      `${entries}\n};\n`,
  );

  const total = readdirSync(assets)
    .map((name) => join(assets, name))
    .reduce((sum, path) => sum + sizeOf(path), 0);
  console.log(
    `${ids.length} clips, ${(total / 1024).toFixed(0)} KB total, ` +
      `written to assets/voice`,
  );
}

function sizeOf(path) {
  return execFileSync("stat", ["-f%z", path], { encoding: "utf8" }).trim() * 1;
}

main();
