import { registerClipVoice } from "@keylearn/speech";
import { VOICE_CLIPS } from "./voice-clips.ts";

/**
 * The recorded voice.
 *
 * On this page the voice is not a nicety, it is the interface — so it has to
 * survive a browser whose speech engine has died, and it has to survive being
 * offline, which the server synthesiser does not. The clips were recorded and
 * committed for exactly this and then never wired to anything, so until now the
 * only fallback was the network and offline meant silence.
 *
 * The vocabulary is finite on purpose. Everything the page says is a fixed
 * phrase, a letter, a digit, or a lesson word — and a lesson word is spelled
 * out from the letter clips, which for somebody learning braille cell by cell
 * is arguably the more useful reading anyway.
 */

let ctx: AudioContext | null = null;
const decoded = new Map<string, AudioBuffer>();
/** Bumped on every request, so a stale sequence stops when a newer one starts. */
let generation = 0;
let playing: AudioBufferSourceNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const c = (ctx ??= new AudioContext());
    if (c.state === "suspended") {
      // Created before the learner touched anything, which browsers leave
      // suspended. The drill's first key is what resumes it.
      void c.resume();
    }
    return c;
  } catch {
    return null;
  }
}

async function bufferFor(id: string): Promise<AudioBuffer | null> {
  const hit = decoded.get(id);
  if (hit != null) {
    return hit;
  }
  const url = VOICE_CLIPS[id];
  const c = audio();
  if (url == null || c == null) {
    return null;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const buffer = await c.decodeAudioData(await response.arrayBuffer());
    decoded.set(id, buffer);
    return buffer;
  } catch {
    return null;
  }
}

function play(buffer: AudioBuffer, rate: number): Promise<void> {
  return new Promise((resolve) => {
    const c = audio();
    if (c == null) {
      resolve();
      return;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    // The clips were recorded a little slower than conversational; the rate a
    // learner has chosen multiplies that, exactly as it does the live voice.
    source.playbackRate.value = Math.max(0.5, Math.min(4, rate));
    source.connect(c.destination);
    source.addEventListener("ended", () => {
      if (playing === source) {
        playing = null;
      }
      resolve();
    });
    source.start();
    playing = source;
  });
}

function stop(): void {
  const source = playing;
  playing = null;
  try {
    source?.stop();
  } catch {
    // Already finished.
  }
}

/**
 * Plays a sequence of clips, newest request winning.
 *
 * Returns false when any clip in the sequence is missing, so the caller can
 * fall back rather than play half a sentence — half of "dots 1 4. Try again."
 * is worse than none of it.
 */
async function playClips(
  ids: readonly string[],
  rate: number,
  onDone?: () => void,
): Promise<boolean> {
  const buffers = await Promise.all(ids.map(bufferFor));
  if (buffers.some((b) => b == null)) {
    return false;
  }
  const mine = ++generation;
  stop();
  for (const buffer of buffers) {
    if (generation !== mine) {
      // A newer utterance started: drop the rest of this one silently. Its
      // caller's chain belongs to the request that replaced it.
      return true;
    }
    await play(buffer!, rate);
  }
  if (generation === mine) {
    onDone?.();
  }
  return true;
}

/** Wires the recorded voice into the speech layer. Idempotent. */
export function installClipVoice(): void {
  registerClipVoice({
    play: playClips,
    stop: () => {
      // Abandons whatever sequence is in flight as well as the clip playing:
      // stopping only the current one would let the rest of the sentence carry
      // on into the silence hush was asked for.
      generation += 1;
      stop();
    },
  });
}

export * from "./phrases.ts";
