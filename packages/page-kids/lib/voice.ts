import { loadA11y } from "@keylearn/pages-shared";
import { hush, say, unlockSpeech } from "@keylearn/speech";
import { type AgeBand, currentBand } from "./age.ts";

/**
 * The coach, out loud.
 *
 * Every encouraging line on this page is written prose, and the two bands it
 * was written hardest for cannot read it. A five-year-old still learning where
 * the letters live is not simultaneously reading "the trail is quiet… one
 * glowing key starts it again" — so for those bands the coach speaks, and the
 * writing finally reaches the child it was for.
 *
 * Two things keep that from becoming a nuisance.
 *
 * Only moments are spoken, never chatter. Cheers fire on up to a third of all
 * correct keys and misses fire on every wrong one; a voice on either would talk
 * continuously over a child who is trying to concentrate. The spoken lines are
 * the ones a child would otherwise miss entirely: the greeting, a new key, a
 * hatch, being stuck, going quiet, and the end of the session.
 *
 * And typing always wins. The moment a key is pressed the voice stops, because
 * a sentence still playing over the child's own typing is noise, not coaching.
 */

/**
 * The say-line categories that are spoken.
 *
 * Deliberately a small set. Adding `cheer` or `miss` here would produce a voice
 * that never stops — those are the highest-frequency lines on the page.
 */
const SPOKEN = new Set([
  "start",
  "grow",
  "growYoung",
  "growOld",
  "hatch",
  "streak",
  "stuck",
  "stuckSpace",
  "wake",
  "crossed",
  "timerEnd",
  "roar",
  "idle",
  "idleYoung",
  "idleOld",
  // The waiting poses (world.ts, the idle chain). These say the same kind of
  // thing `idle` does — "I am still here, press a key" — to a child who has
  // stopped, which is exactly the moment they are least likely to be reading
  // the screen. Safe to add despite the note above because the chain rations
  // them hard: one line per pause at most, never two inside 45 seconds, and
  // the early steps drop out entirely once somebody has paused a few times.
  // They also REPLACE the `idle` line for any character that has the poses,
  // rather than adding to it.
  "wave",
  "crouch",
  "sit",
  "graduate",
]);

export function isSpoken(key: string): boolean {
  return SPOKEN.has(key);
}

/**
 * A written line, readied for a speech engine.
 *
 * The lines carry typography meant for the eye. An engine reads a bracketed
 * aside as part of the sentence, runs straight through an em-dash that was
 * placed as a beat, and gives "!!" no more weight than "!" — so the punctuation
 * is translated into pauses rather than left to be recited.
 */
export function forSpeech(text: string): string {
  return (
    text
      // Grown-up asides — "(see settings)" — are directions, not encouragement,
      // and are addressed to somebody who is not listening.
      .replace(/\s*\([^)]*\)/g, "")
      // Beats written for the eye become pauses for the ear.
      .replace(/\s*[—–]\s*/g, ", ")
      .replace(/…/g, ", ")
      .replace(/([!?.]){2,}/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/**
 * Which of the app's own voices the coach speaks in.
 *
 * Never the browser's engine. Left to itself, `appVoice` is null and null
 * means "the device's own voice" — which on a good many devices is an adult
 * male one, and it arrived unpredictably depending on what the machine had
 * installed. On the kids pages that is not a preference to be defaulted, so
 * the default here is a voice chosen for the band rather than no choice at
 * all.
 *
 * An adult voice picked deliberately in Account → Accessibility is honoured
 * everywhere else in the app; on these pages it is mapped to the band's
 * voice, because "only kids voices on the kids pages" is the rule and a
 * grown-up's pick is usually about the braille page rather than about what
 * their five-year-old hears.
 */
function coachVoice(band: AgeBand = currentBand()): "kid" | "tween" {
  const chosen = loadA11y().appVoice;
  if (chosen === "kid" || chosen === "tween") {
    return chosen;
  }
  return band === "5-6" || band === "7-8" ? "kid" : "tween";
}

/** Speaks a coach line, if this band and this child have the voice on. */
export function speakLine(text: string, rate: number): void {
  const spoken = forSpeech(text);
  if (spoken !== "") {
    // Read here rather than passed in by each caller. There are three of them
    // today, and a fourth added later would otherwise speak in the default
    // voice — a child hearing the coach in two different voices depending on
    // which line it is, which is worse than either voice on its own.
    //
    // `clipOnly` is the other half: if the server cannot render the phrase,
    // the coach stays quiet rather than handing the line to the device. A
    // missed line costs a child nothing; a rough voice mid-lesson costs them
    // the page.
    say(spoken, {
      rate,
      enabled: true,
      clip: coachVoice(),
      clipOnly: true,
    });
  }
}

/** Stops mid-sentence. Called on the first keystroke of every burst. */
export function stopSpeaking(): void {
  hush();
}

/** Lets the browser make a sound at all. Must run inside a user gesture. */
export function unlockVoice(): void {
  unlockSpeech();
}
