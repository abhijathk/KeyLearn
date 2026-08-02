/**
 * Audio for the practice loop.
 *
 * A screen reader already speaks the page chrome, and duplicating it produces
 * two voices talking over each other. But screen readers are too slow and too
 * verbose for keystroke-rate feedback during a drill — they queue and lag — so
 * the loop itself gets its own cues. Everything outside the loop goes through
 * ARIA live regions instead, in the user's own voice at their own rate.
 *
 * The channels are split by weight, so the feedback scales with skill without
 * anyone changing a setting: a correct cell gets a tick, a wrong one gets words.
 * A beginner hears a lot of speech; a fluent user hears almost none.
 */

let ctx: AudioContext | null = null;
let unlocked = false;

/**
 * Browsers discard speech and keep an AudioContext suspended until the user has
 * interacted with the page. Anything spoken on arrival is therefore thrown
 * away — which for a blind learner is a deadlock: they wait for the app to
 * speak, the app waits for them to press something.
 *
 * Called from the first key event, so the audio is live from the first thing
 * they do.
 */
export function unlockAudio(): boolean {
  const first = !unlocked;
  unlocked = true;
  try {
    const c = audio();
    if (c != null && c.state === "suspended") {
      void c.resume();
    }
  } catch {
    // Nothing to resume.
  }
  return first;
}

/** Whether the browser will actually let us make a sound yet. */
export function audioReady(): boolean {
  return unlocked;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return (ctx ??= new AudioContext());
  } catch {
    return null; // Unavailable; the drill still works silently.
  }
}

function beep(hz: number, ms: number, gainTo = 0.18): void {
  const c = audio();
  if (c == null) {
    return;
  }
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(gainTo, c.currentTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + ms / 1000 + 0.02);
}

/** A correct cell. Short enough not to interrupt the rhythm. */
export function tick(): void {
  beep(880, 55, 0.12);
}

/** A wrong cell. Low, and always followed by speech saying what was entered. */
export function buzz(): void {
  beep(170, 130, 0.2);
}

/** A word finished. */
export function chime(): void {
  beep(660, 70, 0.14);
  setTimeout(() => beep(990, 90, 0.14), 70);
}

/** The line finished. */
export function fanfare(): void {
  [660, 880, 1180].forEach((hz, i) =>
    setTimeout(() => beep(hz, 100, 0.15), i * 90),
  );
}

export type VoiceSettings = {
  /** Speech rate. Screen reader users typically run far faster than default. */
  readonly rate: number;
  readonly enabled: boolean;
};

export const defaultVoice: VoiceSettings = { rate: 1, enabled: true };

/**
 * Chrome reports an empty voice list for the first moments after load and
 * silently swallows anything spoken during that window — the utterance is
 * accepted, never starts, and no error is raised. The greeting lands squarely
 * in that window, which is exactly the one line a learner who cannot see the
 * page depends on.
 *
 * So the first request is held until the list arrives rather than spoken into
 * the void.
 */
let pending: {
  text: string;
  voice: VoiceSettings;
  onDone: (() => void) | undefined;
} | null = null;
let watching = false;

let gaveUpWaiting = false;

function voicesReady(): boolean {
  return gaveUpWaiting || window.speechSynthesis.getVoices().length > 0;
}

function release(): void {
  const held = pending;
  pending = null;
  if (held != null) {
    say(held.text, held.voice, held.onDone);
  }
}

function watchVoices(): void {
  if (watching) {
    return;
  }
  watching = true;
  window.speechSynthesis.addEventListener("voiceschanged", release);
  // Not every browser raises the event — some have the list from the start and
  // never fire it at all. Waiting on it unconditionally would mean a learner
  // who hears nothing and has no way to know why, so the hold is bounded, and
  // giving up is permanent: a second hold would just stall again.
  window.setTimeout(() => {
    gaveUpWaiting = true;
    release();
  }, 1500);
}

/**
 * Speech stalls in ways that leave no error to catch: Chrome pauses the engine
 * on its own, and an utterance that never starts blocks every one behind it.
 * A stalled voice is indistinguishable from a broken app to someone relying on
 * it, so we nudge the engine rather than trust it.
 */
function nudge(): void {
  window.setTimeout(() => {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // Engine gone; the tones still carry the essential feedback.
    }
  }, 250);
}

/**
 * Whether the browser's voice is actually producing sound.
 *
 * Not a setting — an observation. A speech engine can fail in a way that looks
 * exactly like success: the utterance is accepted, `speaking` goes true, and
 * nothing is ever heard or reported. Chrome does this, and no amount of
 * cancelling, resuming or re-speaking brings it back within the page.
 *
 * For a sighted user that is a missing nicety. For the learners this page is
 * built for it is the whole interface going quiet with no way to tell whether
 * the app broke, the browser broke, or they did something wrong — so the page
 * has to be able to say which.
 */
export type SpeechHealth =
  | "unknown"
  /** The browser is speaking. */
  | "working"
  /** The browser's engine is gone; the server is speaking instead. */
  | "dead"
  /** Neither can speak — a dead engine and no server to fall back to. */
  | "mute";

let health: SpeechHealth = "unknown";
let silences = 0;
const listeners = new Set<(health: SpeechHealth) => void>();

function setHealth(next: SpeechHealth): void {
  if (health === next) {
    return;
  }
  health = next;
  for (const listener of listeners) {
    listener(next);
  }
}

/**
 * One utterance that finished without ever starting. A single one of these is
 * not proof — a cancel racing the engine can produce it — so it takes a second
 * before the page tells anyone the voice is gone.
 */
/**
 * Returns true when it has taken over the chain — i.e. it is re-speaking this
 * phrase through the server and will run `onDone` itself. False means the
 * caller still owns it, and dropping it there would stall the drill.
 */
function missed(
  text: string,
  voice: VoiceSettings,
  onDone?: () => void,
): boolean {
  if (health === "working") {
    return false;
  }
  if (++silences < 2) {
    return false;
  }
  setHealth("dead");
  // The phrase that proved the engine dead was never heard. Saying it again
  // through the server is the difference between the fallback being invisible
  // and the learner losing whichever line happened to be second.
  void serverSay(text, voice, onDone).then((spoke) => {
    if (!spoke) {
      setHealth("mute");
      // Nothing will speak it, so nothing will fire the chain either.
      onDone?.();
    }
  });
  return true;
}

export function speechHealth(): SpeechHealth {
  return health;
}

/** Subscribes to changes; returns the unsubscribe. */
export function onSpeechHealth(
  listener: (health: SpeechHealth) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── The fallback voice ──
//
// When the browser's engine is dead, the server speaks instead. Same words,
// a plainer voice, played through the AudioContext the tones already use — so
// it is unlocked by the same first keystroke and needs nothing else switched
// on. See `packages/server/lib/app/speech/`.

/** Clips already fetched and decoded, so a repeated phrase is instant. */
const clips = new Map<string, AudioBuffer>();
const CLIPS_MAX = 200;
let playing: AudioBufferSourceNode | null = null;

/** The server takes words per minute; a learner sets a multiplier. */
function wpmOf(rate: number): number {
  return Math.max(80, Math.min(450, Math.round(175 * rate)));
}

function pageLang(): string {
  const lang = document.documentElement.lang || navigator.language || "en";
  // The endpoint's allowlist is the app's own locales, which are bare tags.
  return lang.split("-")[0] === lang ? lang : lang.toLowerCase();
}

async function clipFor(
  text: string,
  rate: number,
): Promise<AudioBuffer | null> {
  const lang = pageLang();
  const wpm = wpmOf(rate);
  const key = `${lang}|${wpm}|${text}`;
  const hit = clips.get(key);
  if (hit != null) {
    return hit;
  }
  const ctx = audio();
  if (ctx == null) {
    return null;
  }
  const url =
    `/_/speech.wav?text=${encodeURIComponent(text)}` +
    `&lang=${encodeURIComponent(lang)}&wpm=${wpm}`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
  clips.set(key, buffer);
  while (clips.size > CLIPS_MAX) {
    const oldest = clips.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    clips.delete(oldest);
  }
  return buffer;
}

function stopPlaying(): void {
  const source = playing;
  playing = null;
  try {
    source?.stop();
  } catch {
    // Already finished.
  }
}

/**
 * Speaks through the server. Resolves false if it could not — offline, or a
 * deployment with no synthesiser — so the caller can fall back again.
 */
async function serverSay(
  text: string,
  voice: VoiceSettings,
  onDone?: () => void,
): Promise<boolean> {
  let buffer: AudioBuffer | null;
  try {
    buffer = await clipFor(text, voice.rate);
  } catch {
    buffer = null;
  }
  const ctx = audio();
  if (buffer == null || ctx == null) {
    return false;
  }
  // Newest wins, exactly as with the browser engine: in a drill, feedback
  // about a cell typed three cells ago is worse than no feedback.
  stopPlaying();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.addEventListener("ended", () => {
    if (playing === source) {
      playing = null;
    }
    onDone?.();
  });
  source.start();
  playing = source;
  return true;
}

/**
 * Fetches phrases the drill is about to need, before it needs them.
 *
 * A synthesised phrase takes a moment the first time and none of it after —
 * and a drill's vocabulary is known in advance: the words of the line, and the
 * letters they are made of. Without this, every new word costs the learner a
 * pause exactly where the voice is supposed to be leading them.
 *
 * Best-effort and quiet: a phrase that fails to warm simply gets fetched when
 * it is spoken, and the caller is never made to wait on this.
 */
export function warmSpeech(texts: readonly string[], rate = 1): void {
  if (health !== "dead") {
    return;
  }
  for (const text of texts) {
    if (text !== "") {
      void clipFor(text, rate).catch(() => {});
    }
  }
}

/**
 * How long this line could take to speak, generously. Roughly twelve
 * characters a second at rate 1, plus slack for the engine to get going.
 */
function speechBudget(text: string, rate: number): number {
  return Math.min(30000, 1500 + ((text.length / 12) * 1000) / rate);
}

/**
 * Says something immediately, cancelling whatever was speaking.
 *
 * In a drill the newest utterance is the only one that matters — a queue would
 * fall further behind with every keystroke, and the learner would be hearing
 * feedback about a cell they typed several cells ago.
 *
 * `onDone` runs when the utterance finishes, is cut off by the next one, or
 * fails outright. Callers that follow speech with more speech must chain on it
 * instead of guessing a delay: guessing either talks over the first line or
 * leaves a silence, and both read as the app having stopped working.
 */
export function say(
  text: string,
  voice: VoiceSettings = defaultVoice,
  onDone?: () => void,
): void {
  if (!voice.enabled) {
    onDone?.();
    return;
  }
  if (typeof window === "undefined") {
    onDone?.();
    return;
  }
  if (!("speechSynthesis" in window)) {
    setHealth("dead");
  }
  // Past the point of no return for the browser engine, everything goes to the
  // server. No retrying it per utterance: it does not recover within a page,
  // and each attempt costs the learner a silence the length of the phrase.
  if (health === "dead") {
    void serverSay(text, voice, onDone).then((spoke) => {
      if (!spoke) {
        setHealth("mute");
        onDone?.();
      }
    });
    return;
  }
  try {
    if (!voicesReady()) {
      watchVoices();
      // Held, along with whatever was chained behind it — running that now
      // would put the follow-up ahead of the line it was meant to follow.
      pending = { text, voice, onDone };
      // Chrome populates the list lazily, and only on request.
      window.speechSynthesis.getVoices();
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = voice.rate;
    // Naming the language lets the engine pick the matching system voice.
    // Naming the voice itself would not: the list is full of novelty voices
    // that match on language and are unusable as a reading voice.
    utter.lang = document.documentElement.lang || navigator.language;
    let spoke = false;
    utter.addEventListener("start", () => {
      spoke = true;
      setHealth("working");
    });
    let done = false;
    const finish = (silent: boolean) => {
      if (done) {
        return;
      }
      done = true;
      window.clearTimeout(guard);
      // When missed() takes the phrase over it runs onDone itself once the
      // server has spoken it; firing it here too would double-advance the drill.
      if (silent && !spoke && missed(text, voice, onDone)) {
        return;
      }
      onDone?.();
    };
    utter.addEventListener("end", () => finish(false));
    utter.addEventListener("error", () => finish(false));
    // A wedged engine raises no error — it accepts the utterance, stays
    // silent and never reports back. Whatever was chained behind it would
    // then never run, which for a learner waiting on the voice is a dead
    // app with no way to tell. Past the longest this line could plausibly
    // take, we carry on regardless, and count the silence.
    const guard = window.setTimeout(
      () => finish(true),
      speechBudget(text, voice.rate),
    );
    window.speechSynthesis.cancel();
    // Chrome drops an utterance queued in the same task as the cancel that
    // precedes it — it is accepted and then never spoken. A fresh task is
    // enough to clear it, and is imperceptible next to the speech itself.
    window.setTimeout(() => {
      try {
        window.speechSynthesis.speak(utter);
        nudge();
      } catch {
        setHealth("dead");
        finish(false);
      }
    }, 0);
  } catch {
    // No voice on this platform; the tones carry the essential feedback.
    setHealth("dead");
    onDone?.();
  }
}

/** Stops any speech in progress, e.g. when the learner starts typing. */
export function hush(): void {
  pending = null;
  stopPlaying();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Nothing to stop.
  }
}

/**
 * The gap between words.
 *
 * A learner finishing a word has nothing telling them a space is next — the
 * dictation speaks words, not the spaces between them, and saying "space" every
 * time would be chatty enough to grate within a minute. Two soft low notes
 * instead: distinct from the tick, learned in about a minute, and out of the
 * way once they are.
 */
export function spaceCue(): void {
  beep(300, 60, 0.1);
  setTimeout(() => beep(300, 60, 0.1), 95);
}
