/**
 * The kids' game sound synth — Web Audio only, no files, zero load time.
 *
 * Two voices share one set of scenarios:
 *  - "dino": the Dino Run arcade's crunchy 8-bit square-wave blips.
 *  - "hero": Hero Trail's softer, cuter, storybook chimes (sine/triangle with
 *    gentle envelopes) — including a little "bored" babble when the child stops
 *    typing.
 * Switch with setTheme(); every play* method picks the right voice.
 */
type Voice = "dino" | "hero";

class KidsAudio {
  #ctx: AudioContext | null = null;
  #theme: Voice = "dino";

  init() {
    if (this.#ctx == null && typeof window !== "undefined") {
      this.#ctx = new AudioContext();
    }
  }

  /** Pick the voice for the active world ("dino" arcade vs "hero" storybook). */
  setTheme(theme: Voice) {
    this.#theme = theme;
  }

  #beep(
    freq: number,
    duration: number,
    type: OscillatorType = "square",
    volume = 0.1,
  ) {
    const ctx = this.#ctx;
    if (ctx == null) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  #sweep(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ) {
    const ctx = this.#ctx;
    if (ctx == null) {
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  /**
   * A soft, rounded tone with a gentle attack and release — the building block
   * of the cute Hero voice. `delay` schedules it ahead of "now" for melodies;
   * `bend` glides the pitch (a little "boing"/question lilt).
   */
  #soft(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.06,
    delay = 0,
    bend = 0,
  ) {
    const ctx = this.#ctx;
    if (ctx == null) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (bend !== 0) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freq * (1 + bend)),
        t0 + duration,
      );
    }
    // A soft 8ms fade-in and a smooth tail — no hard click, so it reads cute.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** A warm bell: a sine fundamental with a soft octave shimmer on top — the
   * storybook voice's signature timbre. */
  #chime(freq: number, duration: number, volume = 0.06, delay = 0) {
    this.#soft(freq, duration, "sine", volume, delay);
    this.#soft(freq * 2, duration * 0.7, "triangle", volume * 0.4, delay);
  }

  /** A very short high blip — a good keystroke. */
  playMove() {
    if (this.#theme === "hero") {
      // A little glassy harp pluck, warm and round — not a beep.
      this.#chime(1174.66, 0.09, 0.03);
    } else {
      this.#beep(600, 0.02, "square", 0.03);
    }
  }

  /** A short mid buzz — a wrong key. */
  playDrop() {
    if (this.#theme === "hero") {
      // A gentle downward "oh" — a soft nudge, never harsh.
      this.#soft(360, 0.16, "sine", 0.06, 0, -0.32);
    } else {
      this.#beep(200, 0.1, "square", 0.08);
    }
  }

  /** Jump — the space bar. */
  playJump() {
    if (this.#theme === "hero") {
      // A cute springy "boing" that lifts and settles.
      this.#soft(300, 0.18, "triangle", 0.06, 0, 1.5);
    } else {
      this.#sweep(150, 600, 0.15, "square", 0.05);
    }
  }

  /** Three misses in a row — a nudge to try again. */
  playRoar() {
    if (this.#theme === "hero") {
      // A soft, sympathetic "uh-ohh" — playful, not scary.
      this.#soft(520, 0.16, "sine", 0.07);
      this.#soft(392, 0.3, "sine", 0.07, 0.14, -0.1);
    } else {
      this.#beep(60, 0.4, "sawtooth", 0.15);
      this.#sweep(400, 100, 0.4, "sawtooth", 0.08);
    }
  }

  /** A finished word. */
  playPoint() {
    if (this.#theme === "hero") {
      // A bright two-note twinkle with bell shimmer.
      this.#chime(1046.5, 0.12, 0.055);
      this.#chime(1567.98, 0.2, 0.05, 0.09);
    } else {
      this.#beep(987.77, 0.05, "square");
      setTimeout(() => this.#beep(1318.51, 0.2, "square"), 50);
    }
  }

  /** A new letter unlocked. */
  playWin() {
    if (this.#theme === "hero") {
      // A sparkly rising bell arpeggio with a shimmering chord to finish.
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((f, i) => {
        this.#chime(f, 0.2, 0.055, i * 0.09);
      });
      const end = notes.length * 0.09;
      this.#chime(1046.5, 0.55, 0.05, end);
      this.#soft(1318.51, 0.55, "triangle", 0.035, end);
      return;
    }
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((f, i) => {
      setTimeout(() => this.#beep(f, 0.15, "square", 0.08), i * 100);
    });
    setTimeout(() => {
      this.#beep(1046.5, 0.4, "square", 0.1);
      this.#beep(783.99, 0.4, "square", 0.1);
    }, notes.length * 100);
  }

  /** The campfire at the end of the session. */
  playSuccess() {
    if (this.#theme === "hero") {
      // A warm little storybook fanfare of bells.
      this.#chime(523.25, 0.16, 0.065);
      this.#chime(659.25, 0.16, 0.065, 0.12);
      this.#chime(783.99, 0.16, 0.065, 0.24);
      this.#chime(1046.5, 0.5, 0.07, 0.36);
      this.#soft(659.25, 0.5, "triangle", 0.04, 0.36);
      return;
    }
    this.#beep(523.25, 0.1, "square");
    setTimeout(() => this.#beep(659.25, 0.1, "square"), 80);
    setTimeout(() => this.#beep(783.99, 0.1, "square"), 160);
    setTimeout(() => this.#beep(1046.5, 0.3, "square"), 240);
  }

  /**
   * The child has stopped typing — a friendly "you still there?" mumble. The
   * hero babbles a little bored tune that lilts up into a question; the dino
   * gives a curious double-chirp.
   */
  playIdle() {
    if (this.#theme === "hero") {
      // A cute wandering babble that ends on a rising "hmm?" question.
      this.#soft(430, 0.14, "triangle", 0.05, 0);
      this.#soft(380, 0.14, "triangle", 0.05, 0.16);
      this.#soft(450, 0.14, "triangle", 0.05, 0.32);
      this.#soft(410, 0.16, "triangle", 0.05, 0.48);
      this.#soft(560, 0.22, "sine", 0.055, 0.66, 0.18); // the questioning lilt
    } else {
      this.#beep(500, 0.05, "square", 0.05);
      setTimeout(() => this.#beep(720, 0.09, "square", 0.05), 90);
    }
  }

  // ── the night, heard ─────────────────────────────────────────────────
  #cricketTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * A cricket, far off. Three to five tiny pulses make one chirp; chirps come
   * at lazy, uneven intervals so it never reads as a loop. Very quiet on
   * purpose — it is the sound of the night being there, not a soundtrack.
   */
  #chirp() {
    const ctx = this.#ctx;
    if (ctx == null) {
      return;
    }
    const pulses = 3 + Math.floor(Math.random() * 3);
    const freq = 4100 + Math.random() * 400;
    for (let i = 0; i < pulses; i++) {
      const at = ctx.currentTime + i * 0.062;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.016, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.04);
    }
  }

  /** Starts the night chorus. Harmless to call twice. */
  startCrickets() {
    if (this.#cricketTimer != null) {
      return;
    }
    const loop = () => {
      this.#chirp();
      this.#cricketTimer = setTimeout(loop, 1400 + Math.random() * 2600);
    };
    this.#cricketTimer = setTimeout(loop, 600);
  }

  stopCrickets() {
    if (this.#cricketTimer != null) {
      clearTimeout(this.#cricketTimer);
      this.#cricketTimer = null;
    }
  }
}

export const kidsAudio = new KidsAudio();
