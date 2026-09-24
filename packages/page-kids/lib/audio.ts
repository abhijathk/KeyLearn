/**
 * The kids' game sound synth — Web Audio only, no files, zero load time.
 *
 * The keyboard has one voice per world (see `#synthKey`): Dino Run's 8-bit
 * blips, Hero Trail's storybook chimes, and Time Keepers' recorded keys.
 * Switch with setTheme(). Everything else is the shared recorded library.
 */

import { ASSETS, versioned } from "./asset-url.ts";
import type { WorldId } from "./world.ts";
type Voice = WorldId;

/**
 * The two things a child (or a teacher) can switch off independently.
 *
 *  - `clicks` is the keyboard and the buttons: the sound a key makes, and the
 *    tap a menu button makes. Feedback for something the child just did.
 *  - `world` is everything the game itself makes: the background air, the
 *    night, jumps, chimes, level-ups, the dino's roar.
 *
 * They are separate because they fail in opposite directions. A classroom of
 * eight needs the world quiet and the key click kept — the click is what tells
 * a child their press landed. A child practising alone with headphones wants
 * the world. Collapsing both into one switch means whoever needs half of it
 * turns all of it off, and never hears any of it again.
 */
export type SoundBus = "clicks" | "world";

/** One short clip, or a set of variants picked from at random. */
const CLIPS = {
  // Twelve of them, because this is the sound a child hears most in the whole
  // app — several a second, for minutes at a time. Two or three variants
  // become a pattern the ear picks out, and a pattern is what turns a key
  // click into a nag.
  key: [
    "typing/key_soft_01",
    "typing/key_soft_02",
    "typing/key_soft_03",
    "typing/key_soft_04",
    "typing/key_soft_05",
    "typing/key_soft_06",
    "typing/key_soft_07",
    "typing/key_soft_08",
    "typing/key_soft_09",
    "typing/key_soft_10",
    "typing/key_soft_11",
    "typing/key_soft_12",
  ],
  // The big keys have their own shape, which is how a touch-typist's hand
  // knows which one it hit without looking.
  space: [
    "typing/space_01",
    "typing/space_02",
    "typing/space_03",
    "typing/space_04",
  ],
  backspace: [
    "typing/backspace_01",
    "typing/backspace_02",
    "typing/backspace_03",
  ],
  enter: ["typing/enter_01", "typing/enter_02", "typing/enter_03"],
  // "Low dry friendly wooden tok, clearly different from a correct key, never
  // punitive or buzzy" — the recording brief's own words, and the reason a
  // wrong letter gets a sound at all rather than a buzz or silence.
  wrong: [
    "typing/wrong_01",
    "typing/wrong_02",
    "typing/wrong_03",
    "typing/wrong_04",
  ],
  button: ["ui/ui_button_01", "ui/ui_button_02"],
  back: ["ui/ui_back_01"],
  toggleOn: ["ui/ui_toggle_on_01"],
  toggleOff: ["ui/ui_toggle_off_01"],
  panelOpen: ["ui/ui_window_open_01"],
  panelClose: ["ui/ui_window_close_01"],
  wind: ["ambient/wind_open_air_01", "ambient/wind_open_air_02"],
  cricket: ["ambient/cricket_night_01", "ambient/cricket_night_02"],
  whisperPot: ["environment/pot_set_01"],
  // The game's own moments. Each is the library's event for that exact
  // moment rather than something borrowed and re-pitched.
  word: [
    "rewards/word_complete_01",
    "rewards/word_complete_02",
    "rewards/word_complete_03",
  ],
  sentence: ["rewards/sentence_complete_01", "rewards/sentence_complete_02"],
  lesson: ["rewards/lesson_complete_01", "rewards/lesson_complete_02"],
  achievement: ["rewards/achievement_01", "rewards/achievement_02"],
  push: [
    "movement/child_push_01",
    "movement/child_push_02",
    "movement/child_push_03",
  ],
  land: [
    "movement/child_land_01",
    "movement/child_land_02",
    "movement/child_land_03",
  ],
  shift: [
    "movement/body_shift_01",
    "movement/body_shift_02",
    "movement/body_shift_03",
  ],
  // For the moment the trail wants attention. A water buffalo lowing, which
  // is what is actually standing in this village — the sound it replaced was
  // a synthesised dinosaur roar.
  vocal: [
    "creatures/buffalo_vocal_01",
    "creatures/buffalo_vocal_02",
    "creatures/buffalo_vocal_03",
  ],
} as const;

type ClipName = keyof typeof CLIPS;

/**
 * How loud the background bed sits.
 *
 * Deliberately far below every other sound in here. This is air moving in a
 * village, not a soundtrack: it should be the thing a child notices when it
 * STOPS, never something competing with the letters they are reading. The
 * brief for the recording says the same in its own words — "barely
 * perceptible, no tonal whistle".
 */
const BED_PEAK = 0.085;
/**
 * How loud a key is, and every UI tap relative to it.
 *
 * Taken from the library's own manifest rather than tuned by ear here: it
 * gives typing 0.17 and a UI button 0.13, which is the relationship its
 * designer intended — the keyboard slightly forward of the interface, because
 * the keyboard is the thing being learned.
 */
/**
 * TARGET PEAKS, not multipliers — and that distinction is the whole reason
 * anything is audible.
 *
 * The recordings are raw generator output: the library's own README says they
 * "have not been edited, compressed to final Opus, listened to, or approved",
 * and their levels prove it. Twelve variants of the SAME key click run from
 * -48.4 dBFS to +0.3 dBFS — a spread of about 250 to one. Played at a fixed
 * multiplier, the quiet ones are silence and the loud ones are a bang, at
 * random, several times a second.
 *
 * So every clip is measured once when it is decoded and scaled to hit the
 * peak named here. That makes the library usable while it is still
 * unmastered, and it keeps variants of one sound at one loudness — which is
 * the point of having variants at all.
 */
const TYPING_PEAK = 0.25;
const UI_PEAK = 0.2;
const REWARD_PEAK = 0.35;
const MOVE_PEAK = 0.25;
/** Night insects, quieter again, and never a continuous loop. See `#cricket`. */
const CRICKET_PEAK = 0.06;

/** The loudest sample in a clip, across every channel. */
function peakOf(buf: AudioBuffer): number {
  let peak = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]!);
      if (v > peak) {
        peak = v;
      }
    }
  }
  return peak;
}

/**
 * The gain that puts a clip's loudest moment at `target`.
 *
 * CAPPED at 60. A clip that peaks below about -36 dBFS is either a very quiet
 * recording or a failed one, and lifting it further would bring its noise
 * floor up with it — better a sound that is slightly too quiet than one that
 * is mostly hiss. Unmeasured clips fall back to the target itself, which is
 * what the old fixed-multiplier code did for everything.
 */
function levelFor(peak: number | undefined, target: number): number {
  if (peak == null || peak <= 0) {
    return target;
  }
  return Math.min(target / peak, 60);
}

class KidsAudio {
  #ctx: AudioContext | null = null;
  #bus: Record<SoundBus, GainNode> | null = null;
  #on: Record<SoundBus, boolean> = { clicks: true, world: true };
  /** Decoded once, kept; these are a few kilobytes each. */
  #buffers = new Map<string, AudioBuffer>();
  /** The loudest sample in each decoded clip, so it can be levelled. */
  #peaks = new Map<string, number>();
  #loading = new Map<string, Promise<AudioBuffer | null>>();
  #bed: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  #crickets: ReturnType<typeof setTimeout> | null = null;
  #hidden = false;

  init() {
    if (this.#ctx == null && typeof window !== "undefined") {
      const ctx = new AudioContext();
      this.#ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
      const clicks = ctx.createGain();
      const world = ctx.createGain();
      clicks.gain.value = this.#on.clicks ? 1 : 0;
      world.gain.value = this.#on.world ? 1 : 0;
      clicks.connect(master);
      world.connect(master);
      this.#bus = { clicks, world };
      // A tab nobody is looking at makes no noise. Without this the bed keeps
      // playing behind whatever the child switched to, which is the single
      // most annoying thing a background loop can do.
      document.addEventListener("visibilitychange", this.#visibility);
    }
    // Browsers hand back a suspended context until a real gesture; every
    // caller here is already inside one, so this is the moment to resume.
    if (this.#ctx?.state === "suspended") {
      this.#ctx.resume().catch(() => {});
    }
  }

  #visibility = () => {
    this.#hidden = document.visibilityState === "hidden";
    this.#applyGains(0.12);
  };

  /**
   * Turn each half on or off.
   *
   * Ramped rather than switched: setting a gain to zero on the sample where a
   * loop is mid-cycle is a click, and a click is exactly the artefact somebody
   * reaches for the sound switch to escape.
   */
  setEnabled(on: Partial<Record<SoundBus, boolean>>) {
    const closing = (["clicks", "world"] as const).some(
      (name) => this.#on[name] && on[name] === false,
    );
    this.#on = { ...this.#on, ...on };
    // ASYMMETRIC ON PURPOSE. Coming on is instant — the child pressed a
    // button and wants an answer. Going off takes a moment, because the
    // sound being switched off usually has one last thing to say: the click
    // of the switch itself. Muting on the same tick swallowed it, so the one
    // press that turns the sound off was the one press with no sound.
    this.#applyGains(closing ? 0.34 : 0.08);
    // Stop the bed outright when the world is off, rather than leaving a
    // silent source running for the rest of the session.
    if (!this.#on.world) {
      this.stopAmbience();
    }
  }

  #applyGains(seconds: number) {
    const ctx = this.#ctx;
    const bus = this.#bus;
    if (ctx == null || bus == null) {
      return;
    }
    const now = ctx.currentTime;
    for (const name of ["clicks", "world"] as const) {
      const want = this.#on[name] && !this.#hidden ? 1 : 0;
      bus[name].gain.cancelScheduledValues(now);
      bus[name].gain.setTargetAtTime(want, now, Math.max(0.01, seconds / 3));
    }
  }

  #out(bus: SoundBus): AudioNode | null {
    return this.#bus?.[bus] ?? null;
  }

  /** True when this half is audible right now — cheap enough to call per key. */
  #live(bus: SoundBus): boolean {
    return this.#ctx != null && this.#on[bus] && !this.#hidden;
  }

  /**
   * Which world's keyboard is live.
   *
   * Only the KEYBOARD differs by world. Time Keepers uses the recorded wooden
   * keys; Dino Run keeps its arcade blips and Hero Trail its storybook
   * chimes, which is what each world sounded like before the recorded
   * library arrived. Every other sound is the shared recorded library.
   */
  #voice: Voice = "village";

  setTheme(theme: Voice): void {
    this.#voice = theme;
  }

  /** A good keystroke used to be a blip here; it is a real key now. See `playKey`. */
  playMove() {
    this.playKey();
  }

  /** Landing. */
  playDrop() {
    this.#fire("land", "world", MOVE_PEAK);
  }

  /** The space-bar hop: the push off, and the landing a moment later. */
  playJump() {
    this.#fire("push", "world", MOVE_PEAK);
    setTimeout(() => this.#fire("land", "world", MOVE_PEAK * 0.85), 260);
  }

  /** The trail wanting attention after a run of misses. */
  playRoar() {
    this.#fire("vocal", "world", REWARD_PEAK);
  }

  /** A word finished. */
  playPoint() {
    this.#fire("word", "world", REWARD_PEAK);
  }

  /** A lesson done, a letter woken, a graduation. */
  playWin() {
    this.#fire("lesson", "world", REWARD_PEAK);
  }

  /** Something joined the trail. */
  playSuccess() {
    this.#fire("achievement", "world", REWARD_PEAK);
  }

  /** Waiting: a small shift of weight, not a tune. */
  playIdle() {
    this.#fire("shift", "world", MOVE_PEAK);
  }

  /** A quiet physical object cue; respects the existing world-sound switch. */
  playWhisperPot() {
    this.#fire("whisperPot", "world", 0.035);
  }

  // ── Recorded sounds ──────────────────────────────────────────────────
  //
  // The synth above covers the game's chimes. These are the two places a real
  // recording earns its download: the click a button makes, and the air in the
  // village. Both are things a synthesised approximation gets obviously wrong.

  async #buffer(clip: string): Promise<AudioBuffer | null> {
    const have = this.#buffers.get(clip);
    if (have != null) {
      return have;
    }
    const already = this.#loading.get(clip);
    if (already != null) {
      return already;
    }
    const ctx = this.#ctx;
    if (ctx == null) {
      return null;
    }
    // Registered BEFORE the fetch starts, not after. An async IIFE runs its
    // body synchronously as far as the first await — which is the fetch — so
    // two callers in the same tick both got past the check above and both
    // downloaded the file. A microtask hop puts the bookkeeping first.
    const job = Promise.resolve().then(async () => {
      try {
        const res = await fetch(versioned(`${ASSETS}/audio/${clip}.mp3`));
        if (!res.ok) {
          return null;
        }
        const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
        this.#buffers.set(clip, decoded);
        this.#peaks.set(clip, peakOf(decoded));
        return decoded;
      } catch {
        // A sound that will not load is not a reason for anything to break;
        // the game is perfectly playable silent, which is how it starts.
        return null;
      } finally {
        this.#loading.delete(clip);
      }
    });
    this.#loading.set(clip, job);
    return job;
  }

  /** One clip from a named set, levelled to `target`, on a bus. Fire and forget. */
  #fire(name: ClipName, bus: SoundBus, target: number) {
    // SELF-STARTING, because the alternative is silence with no symptom.
    // Everything here used to give up quietly when no context existed yet,
    // and whether one existed depended on whether the child had happened to
    // press one of the seven buttons that called `init()`. A page loaded with
    // sound already on called none of them, so the whole game was mute and
    // nothing said why.
    this.init();
    if (!this.#live(bus)) {
      return;
    }
    const set = CLIPS[name];
    const clip = set[Math.floor(Math.random() * set.length)]!;
    void this.#buffer(clip).then((buf) => {
      const ctx = this.#ctx;
      const out = this.#out(bus);
      // Checked again: the download took time, and the child may have switched
      // this half off, hidden the tab, or left the page while it ran.
      if (buf == null || ctx == null || out == null || !this.#live(bus)) {
        return;
      }
      // A context that has gone to sleep makes no sound and reports no error.
      // The synthesiser this replaced resumed on every note; so does this.
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => {});
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const level = ctx.createGain();
      level.gain.value = levelFor(this.#peaks.get(clip), target);
      src.connect(level);
      level.connect(out);
      src.start();
    });
  }

  /**
   * THE KEYBOARD. One call per press, whichever key it was.
   *
   * Time Keepers plays the recorded keys. Dino Run and Hero Trail play their
   * own synthesised voices; see {@link #synthKey}.
   */
  playKey(key?: string) {
    const kind = key === " " ? "space" : key === "\n" ? "enter" : "key";
    if (this.#synthKey(kind)) {
      return;
    }
    this.#fire(kind, "clicks", TYPING_PEAK);
  }

  /** A letter that was not the one asked for. */
  playWrong() {
    if (this.#synthKey("wrong")) {
      return;
    }
    this.#fire("wrong", "clicks", TYPING_PEAK);
  }

  playBackspace() {
    if (this.#synthKey("backspace")) {
      return;
    }
    this.#fire("backspace", "clicks", TYPING_PEAK);
  }

  playEnter() {
    if (this.#synthKey("enter")) {
      return;
    }
    this.#fire("enter", "clicks", TYPING_PEAK);
  }

  /**
   * The per-world keyboards, synthesised: no download, no latency.
   *
   *  - Dino Run: short 8-bit square-wave blips with a quick pitch drop,
   *    softened by a low-pass so several a second never turn shrill.
   *  - Hero Trail: soft triangle/sine chimes on a pentatonic scale with a
   *    gentle decay, like a storybook xylophone.
   *
   * Pitch is picked at random from a small set so a run of keys never
   * becomes one repeated note. Returns false in Time Keepers, where the
   * recorded keys play instead.
   */
  #synthKey(kind: "key" | "space" | "enter" | "backspace" | "wrong"): boolean {
    const voice = this.#voice;
    if (voice !== "dino" && voice !== "hero") {
      return false;
    }
    this.init();
    const ctx = this.#ctx;
    const out = this.#out("clicks");
    if (ctx == null || out == null || !this.#live("clicks")) {
      return true;
    }
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    const t = ctx.currentTime + 0.002;
    const pick = <T>(xs: readonly T[]): T =>
      xs[Math.floor(Math.random() * xs.length)]!;
    const note = (
      type: OscillatorType,
      from: number,
      to: number,
      at: number,
      length: number,
      peak: number,
      through: AudioNode,
    ) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(from, at);
      if (to !== from) {
        osc.frequency.exponentialRampToValueAtTime(to, at + length * 0.8);
      }
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(peak, at + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, at + length);
      osc.connect(env);
      env.connect(through);
      osc.start(at);
      osc.stop(at + length + 0.02);
    };
    if (voice === "dino") {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2600;
      lp.connect(out);
      switch (kind) {
        case "key": {
          const f = pick([660, 740, 784, 880, 988]);
          note("square", f, f * 0.7, t, 0.06, 0.07, lp);
          break;
        }
        case "space":
          note("square", 330, 220, t, 0.09, 0.07, lp);
          break;
        case "enter":
          note("square", 523, 523, t, 0.06, 0.06, lp);
          note("square", 784, 784, t + 0.07, 0.08, 0.06, lp);
          break;
        case "backspace":
          note("square", 440, 294, t, 0.07, 0.06, lp);
          break;
        case "wrong":
          note("square", 196, 147, t, 0.14, 0.07, lp);
          break;
      }
    } else {
      switch (kind) {
        case "key": {
          const f = pick([784, 880, 1047, 1175, 1319]);
          note("triangle", f, f, t, 0.18, 0.16, out);
          note("sine", f * 2, f * 2, t, 0.1, 0.04, out);
          break;
        }
        case "space":
          note("sine", 523, 523, t, 0.22, 0.16, out);
          break;
        case "enter":
          note("triangle", 784, 784, t, 0.16, 0.14, out);
          note("triangle", 1175, 1175, t + 0.08, 0.24, 0.14, out);
          break;
        case "backspace":
          note("sine", 659, 523, t, 0.14, 0.13, out);
          break;
        case "wrong":
          note("sine", 330, 262, t, 0.24, 0.14, out);
          break;
      }
    }
    return true;
  }

  /** A menu button being pressed. */
  playButton() {
    this.#fire("button", "clicks", UI_PEAK);
  }

  /** Going back, or closing something without changing it. */
  playBack() {
    this.#fire("back", "clicks", UI_PEAK);
  }

  /** A switch in the settings being flipped, in the direction it went. */
  playToggle(on: boolean) {
    this.#fire(on ? "toggleOn" : "toggleOff", "clicks", UI_PEAK);
  }

  /** A panel or card opening, and closing. */
  playPanel(open: boolean) {
    this.#fire(open ? "panelOpen" : "panelClose", "clicks", UI_PEAK);
  }

  /**
   * The background bed: moving air, and at night a few insects.
   *
   * Deliberately almost nothing. It fades in over four seconds so it is never
   * an event, sits at {@link BED_PEAK}, and the insects are scattered one-shots
   * rather than a loop — a 1.25-second cricket recording played end to end
   * becomes a stutter within about ten seconds, and a repeating pattern is the
   * fastest way to make a quiet sound distracting.
   */
  startAmbience(night: boolean) {
    this.init();
    if (!this.#live("world")) {
      return;
    }
    if (this.#bed == null) {
      void this.#buffer(CLIPS.wind[0]).then((buf) => {
        const ctx = this.#ctx;
        const out = this.#out("world");
        if (buf == null || ctx == null || out == null || this.#bed != null) {
          return;
        }
        if (!this.#live("world")) {
          return;
        }
        if (ctx.state === "suspended") {
          void ctx.resume().catch(() => {});
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const gain = ctx.createGain();
        const bed = levelFor(this.#peaks.get(CLIPS.wind[0]), BED_PEAK);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(bed, ctx.currentTime + 4);
        src.connect(gain);
        gain.connect(out);
        src.start();
        this.#bed = { src, gain };
      });
    }
    if (night) {
      this.#scheduleCricket();
    } else if (this.#crickets != null) {
      clearTimeout(this.#crickets);
      this.#crickets = null;
    }
  }

  #scheduleCricket() {
    if (this.#crickets != null) {
      return;
    }
    const again = () => {
      this.#crickets = setTimeout(
        () => {
          this.#crickets = null;
          if (this.#live("world")) {
            this.#fire("cricket", "world", CRICKET_PEAK);
            again();
          }
        },
        // Irregular on purpose. Anything evenly spaced reads as a machine.
        2600 + Math.random() * 5200,
      );
    };
    again();
  }

  /** Fade the bed out and stop the insects. Safe to call when nothing is playing. */
  stopAmbience() {
    if (this.#crickets != null) {
      clearTimeout(this.#crickets);
      this.#crickets = null;
    }
    const bed = this.#bed;
    const ctx = this.#ctx;
    if (bed == null || ctx == null) {
      return;
    }
    this.#bed = null;
    const now = ctx.currentTime;
    bed.gain.gain.cancelScheduledValues(now);
    bed.gain.gain.setTargetAtTime(0, now, 0.5);
    try {
      bed.src.stop(now + 2.2);
    } catch {
      // Already stopped; nothing to do.
    }
  }

  /**
   * The hero world's night insects.
   *
   * Was a synthesised chirp; it is the recorded one now, scheduled the same
   * scattered way as the village's — see `#scheduleCricket`, which this and
   * the ambient bed share.
   */
  startCrickets() {
    this.#scheduleCricket();
  }

  stopCrickets() {
    if (this.#crickets != null) {
      clearTimeout(this.#crickets);
      this.#crickets = null;
    }
  }
}

export const kidsAudio = new KidsAudio();
