/**
 * The Dino Run arcade's 8-bit sound synth, ported from the game. Web Audio
 * only — no files, zero load time.
 */
class KidsAudio {
  #ctx: AudioContext | null = null;

  init() {
    if (this.#ctx == null && typeof window !== "undefined") {
      this.#ctx = new AudioContext();
    }
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

  /** A very short high blip — a good keystroke. */
  playMove() {
    this.#beep(600, 0.02, "square", 0.03);
  }

  /** A short mid buzz — a wrong key. */
  playDrop() {
    this.#beep(200, 0.1, "square", 0.08);
  }

  /** Mario-style jump sweep — the space bar. */
  playJump() {
    this.#sweep(150, 600, 0.15, "square", 0.05);
  }

  /** Layered growl — three misses in a row. */
  playRoar() {
    this.#beep(60, 0.4, "sawtooth", 0.15);
    this.#sweep(400, 100, 0.4, "sawtooth", 0.08);
  }

  /** Coin chime — a finished word. */
  playPoint() {
    this.#beep(987.77, 0.05, "square");
    setTimeout(() => this.#beep(1318.51, 0.2, "square"), 50);
  }

  /** Level-complete arpeggio — a new letter unlocked. */
  playWin() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((f, i) => {
      setTimeout(() => this.#beep(f, 0.15, "square", 0.08), i * 100);
    });
    setTimeout(() => {
      this.#beep(1046.5, 0.4, "square", 0.1);
      this.#beep(783.99, 0.4, "square", 0.1);
    }, notes.length * 100);
  }

  /** Rising fanfare — the campfire at the end of the session. */
  playSuccess() {
    this.#beep(523.25, 0.1, "square");
    setTimeout(() => this.#beep(659.25, 0.1, "square"), 80);
    setTimeout(() => this.#beep(783.99, 0.1, "square"), 160);
    setTimeout(() => this.#beep(1046.5, 0.3, "square"), 240);
  }
}

export const kidsAudio = new KidsAudio();
