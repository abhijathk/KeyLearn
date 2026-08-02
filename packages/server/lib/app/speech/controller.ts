import { controller, http } from "@fastr/controller";
import { Context } from "@fastr/core";
import { HttpError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { allLocales } from "@keybr/intl";
import { rateLimit } from "../auth/ratelimit.ts";
import { findSynth, MAX_TEXT } from "./synth.ts";

/**
 * A phrase rendered to audio, kept because a drill says the same things over
 * and over: the same six letters, "try again", the dot names. Without this the
 * server would fork a synthesiser for every keystroke.
 *
 * Bounded, and evicted oldest-first — a Map iterates in insertion order, which
 * is all the ordering a cache this small needs.
 */
const cache = new Map<string, Buffer>();
const CACHE_MAX = 500;

function remember(key: string, wav: Buffer): void {
  cache.set(key, wav);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    cache.delete(oldest);
  }
}

/** Locales we will hand to a synthesiser, as an allowlist rather than a shape
 * check — the value reaches a subprocess argument, and "looks like a language
 * tag" is a weaker promise than "is one of ours". */
const LOCALES = new Set<string>(allLocales);

@injectable()
@controller()
export class Controller {
  /**
   * Speaks a phrase.
   *
   * Only reached when the browser's own engine has failed, which is why it is
   * worth having at all — see `synth.ts`. Everything here is shaped by the text
   * coming from the client and ending up as an argument to a subprocess: the
   * length is capped, the locale is an allowlist, the rate is clamped, and the
   * command is spawned with an argument array so no phrase can become a shell
   * command.
   */
  @http.GET("/_/speech.wav")
  async get(ctx: Context) {
    const query = ctx.request.query;
    const text = String(query.get("text") ?? "").trim();
    const lang = String(query.get("lang") ?? "en");
    const wpm = Number(query.get("wpm") ?? "175");

    if (text === "" || text.length > MAX_TEXT) {
      throw new HttpError(400, "Nothing to say, or too much of it.");
    }
    if (!LOCALES.has(lang)) {
      throw new HttpError(400, "Unknown language.");
    }
    if (!Number.isFinite(wpm) || wpm < 80 || wpm > 450) {
      throw new HttpError(400, "Speech rate out of range.");
    }

    const key = `${lang}|${wpm}|${text}`;
    const hit = cache.get(key);
    if (hit != null) {
      send(ctx, hit);
      return;
    }

    // Only uncached phrases cost anything, so the limit is on those. It is
    // generous next to a drill — a learner hears far more repeats than new
    // phrases — and tight next to anyone using this as a free TTS service.
    rateLimit(ctx, "speech", 120, 60_000);

    const synth = await findSynth();
    if (synth == null) {
      // The page has its own offline fallback and can tell the learner what is
      // happening; it needs to know this is not a transient failure.
      throw new HttpError(503, "No speech synthesiser on this server.");
    }
    let wav: Buffer;
    try {
      wav = await synth.render(text, lang, wpm);
    } catch {
      throw new HttpError(503, "Speech synthesis failed.");
    }
    if (wav.length === 0) {
      throw new HttpError(503, "Speech synthesis produced no audio.");
    }
    remember(key, wav);
    send(ctx, wav);
  }
}

function send(ctx: Context, wav: Buffer): void {
  ctx.response.body = wav;
  ctx.response.type = "audio/wav";
  // The same words always sound the same, so this is safe to keep for a long
  // time — and a cached phrase is one the learner hears with no delay at all.
  ctx.response.headers.set(
    "Cache-Control",
    "public, max-age=604800, immutable",
  );
}
