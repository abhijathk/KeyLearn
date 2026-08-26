/**
 * Saying things out loud, for any page that needs a voice.
 *
 * Written for the braille drill, where a learner who cannot see the page has
 * nothing else to go on, so it treats the browser's speech engine as the
 * unreliable component it is: Chrome reports no voices for the first moments
 * after load and silently swallows anything spoken in that window, pauses its
 * own engine, and can fail in a way indistinguishable from success — utterance
 * accepted, `speaking` true, nothing ever heard and nothing ever reported. Each
 * of those is handled below, and a server-side synthesiser stands behind the
 * whole thing when the engine turns out to be dead.
 *
 * The kids page leans on the same machinery for the opposite reason: its
 * youngest learners cannot read the coaching they are shown.
 */

let ctx: AudioContext | null = null;
let unlocked = false;

/**
 * Browsers discard speech and keep an AudioContext suspended until the user has
 * interacted with the page. Anything spoken on arrival is therefore thrown
 * away — which for a blind learner is a deadlock: they wait for the app to
 * speak, the app waits for them to press something.
 *
 * Call from the first key or pointer event, so the voice is live from the first
 * thing they do.
 */
export function unlockSpeech(): boolean {
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

/** The context the server's clips are played through. */
function audio(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return (ctx ??= new AudioContext());
  } catch {
    return null; // Unavailable; the caller carries on silently.
  }
}

export type VoiceSettings = {
  /** Speech rate. Screen reader users typically run far faster than default. */
  readonly rate: number;
  readonly enabled: boolean;
  /**
   * A system voice the learner picked by name, or null for the language match.
   *
   * Only ever set by somebody choosing from the list themselves. Choosing one
   * for them is what the language match exists to avoid — see below.
   */
  readonly name?: string | null;
  /**
   * One of the app's own curated voices — "kid", "lady", "man" — or null for
   * the browser's engine.
   *
   * A customer reported that what their child heard was "very rough and not
   * kids friendly". It was: whatever engine the device shipped with, and
   * espeak-ng behind it. Neither is something to ask a five-year-old to listen
   * to while learning to read.
   *
   * Set, the server synthesises in that voice and the browser's engine is not
   * used at all — not as a fallback from failure but as the first choice, which
   * is the whole point. The engine remains the last resort beneath it, because
   * a voice that sometimes does not arrive is worse than a plain one that
   * always does.
   */
  readonly clip?: string | null;
};

export const defaultVoice: VoiceSettings = {
  rate: 1,
  enabled: true,
  name: null,
  clip: null,
};

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
  clips?: readonly string[],
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
  void fallbackSay(text, voice, onDone, clips);
  return true;
}

/**
 * Everything that speaks when the browser's engine does not: the recorded
 * clips first, then the server, then an honest admission of silence.
 */
async function fallbackSay(
  text: string,
  voice: VoiceSettings,
  onDone?: () => void,
  clips?: readonly string[],
): Promise<void> {
  if (clipVoice != null && clips != null && clips.length > 0) {
    stopPlaying();
    if (await clipVoice.play(clips, voice.rate, onDone)) {
      return;
    }
  }
  if (await serverSay(text, voice, onDone)) {
    return;
  }
  setHealth("mute");
  // Nothing will speak it, so nothing will fire the chain either.
  onDone?.();
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

// ── The recorded voice ──
//
// A finite set of clips, bundled with the app. When the browser's engine is
// gone this is tried before the server: it needs no network, and it starts
// instantly, where a round trip before every utterance is far too slow for a
// drill that says something after every keystroke.
//
// The clips themselves belong to the page that recorded them, so the player is
// registered rather than imported — this package has no business knowing about
// braille assets.

/** Plays a sequence of clip ids. Resolves false if it could not. */
export type ClipVoice = {
  play: (
    ids: readonly string[],
    rate: number,
    onDone?: () => void,
  ) => Promise<boolean>;
  /** Stops mid-sequence. Without it `hush` would silence every voice but one. */
  stop: () => void;
};

let clipVoice: ClipVoice | null = null;

export function registerClipVoice(voice: ClipVoice | null): void {
  clipVoice = voice;
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

/**
 * Fetches already in the air, by the same key the cache uses.
 *
 * The cache only fills once a response has come back, so without this a burst
 * of drill input asks the server for the same phrase several times over — and
 * for several different phrases at once. Every uncached phrase costs the
 * server a synthesiser subprocess, so a child holding down a chord could
 * spawn dozens, and the page froze waiting on them. Sharing the promise means
 * one request per phrase however many callers want it.
 */
const inFlight = new Map<string, Promise<AudioBuffer | null>>();

/**
 * Aborts the request for an utterance nobody is waiting for any more.
 *
 * This module's rule is that the newest utterance is the only one that
 * matters, and that has to hold for the server voice too: without it the
 * abandoned requests still arrive, still cost a subprocess, and still decode.
 */
let pendingClip: AbortController | null = null;

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
  clip: string | null = null,
): Promise<AudioBuffer | null> {
  const lang = pageLang();
  const wpm = wpmOf(rate);
  // The voice is part of what the audio IS. Left out, a child would be served
  // whichever rendering of the phrase happened to be cached first — the
  // setting silently not working, intermittently, unreproducibly.
  const key = `${clip ?? "-"}|${lang}|${wpm}|${text}`;
  const hit = clips.get(key);
  if (hit != null) {
    return hit;
  }
  const ctx = audio();
  if (ctx == null) {
    return null;
  }
  const already = inFlight.get(key);
  if (already != null) {
    return await already;
  }
  const url =
    `/_/speech.wav?text=${encodeURIComponent(text)}` +
    `&lang=${encodeURIComponent(lang)}&wpm=${wpm}` +
    (clip == null ? "" : `&voice=${encodeURIComponent(clip)}`);
  // The previous phrase is no longer wanted the moment this one is asked for.
  pendingClip?.abort();
  const controller = new AbortController();
  pendingClip = controller;
  const work = (async () => {
    const response = await fetch(url, { signal: controller.signal });
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
  })();
  inFlight.set(key, work);
  try {
    return await work;
  } finally {
    inFlight.delete(key);
    if (pendingClip === controller) {
      pendingClip = null;
    }
  }
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
    buffer = await clipFor(text, voice.rate, voice.clip ?? null);
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
/**
 * Said whenever the app speaks, carrying the words.
 *
 * Every route to the speech engine passes through `say`, so this is the one
 * place that knows what the app has just said out loud — which is what makes
 * captions possible without every caller having to remember to write its line
 * down twice.
 */
export const SPOKEN_EVENT = "keylearn:spoken";

export function say(
  text: string,
  voice: VoiceSettings = defaultVoice,
  onDone?: () => void,
  clips?: readonly string[],
): void {
  // Announced before anything else, and regardless of whether the engine will
  // manage it: a caption is most useful to somebody who is not going to hear
  // the words at all, and least useful if it waits for the voice to succeed.
  try {
    window.dispatchEvent(
      new window.CustomEvent(SPOKEN_EVENT, { detail: text }),
    );
  } catch {
    // No window, or an engine-less environment. Speech is optional; so is
    // saying what it would have been.
  }
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
  // A chosen voice goes to the server FIRST, not as a fallback from failure.
  //
  // This is the whole of what the customer asked for. The browser's engine is
  // the thing that sounded rough; reaching it only after the engine has failed
  // would mean the child keeps hearing the rough voice on every device where
  // the engine works — which is most of them. So when somebody has picked one
  // of our voices, that is the voice, and the engine sits underneath as the
  // last resort rather than the default.
  //
  // `serverSay` resolves false when it cannot — offline, or a deployment with
  // no models — and then this falls through to the engine below, so a chosen
  // voice never costs a learner their speech.
  if (voice.clip != null && health !== "mute") {
    void (async () => {
      if (!(await serverSay(text, voice, onDone))) {
        sayWithEngine(text, { ...voice, clip: null }, onDone, clips);
      }
    })();
    return;
  }
  sayWithEngine(text, voice, onDone, clips);
}

/** The browser's own engine, and everything that stands in for it. */
function sayWithEngine(
  text: string,
  voice: VoiceSettings,
  onDone?: () => void,
  clips?: readonly string[],
): void {
  // Past the point of no return for the browser engine, everything goes to the
  // recorded clips, and to the server only for what they cannot say. No
  // retrying the engine per utterance: it does not recover within a page, and
  // each attempt costs the learner a silence the length of the phrase.
  if (health === "dead") {
    void fallbackSay(text, voice, onDone, clips);
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
    // Picking a voice *for* the learner would not: the list is full of novelty
    // voices that match on language and are unusable as a reading voice.
    utter.lang = document.documentElement.lang || navigator.language;
    // A voice the learner chose themselves is a different matter — they have
    // heard it, and nobody knows better than they do which one they can listen
    // to all day. Missing from this machine means we fall back to the language
    // match rather than to silence.
    if (voice.name != null) {
      const chosen = window.speechSynthesis
        .getVoices()
        .find((each) => each.name === voice.name);
      if (chosen != null) {
        utter.voice = chosen;
      }
    }
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
      if (silent && !spoke && missed(text, voice, onDone, clips)) {
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
  clipVoice?.stop();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Nothing to stop.
  }
}
