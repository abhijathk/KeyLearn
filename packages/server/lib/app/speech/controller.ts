import { controller, http } from "@fastr/controller";
import { Context } from "@fastr/core";
import { HttpError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { allLocales } from "@keylearn/intl";
import { rateLimit } from "../auth/ratelimit.ts";
import {
  findSynth,
  installedVoices,
  isVoiceId,
  MAX_TEXT,
  type VoiceId,
  voiceRev,
} from "./synth.ts";

/**
 * A phrase rendered to audio, kept because a drill says the same things over
 * and over: the same six letters, "try again", the dot names. Without this the
 * server would fork a synthesiser for every keystroke.
 */
const cache = new Map<string, Buffer>();

/**
 * Budgeted in bytes rather than in entries.
 *
 * Counting entries looks like a bound and is not: a phrase may render up to
 * the synthesiser's own 8 MB ceiling, so five hundred of them is four
 * gigabytes — per worker. Distinct phrases are rate limited, but only per
 * address and per window, so patience or a handful of addresses was enough to
 * hold a server's memory hostage with nothing but GET requests.
 */
const CACHE_BYTES = 32 * 1024 * 1024;
/** Beyond this a phrase is served but not kept; one clip must not evict the lot. */
const CACHE_ITEM_BYTES = 1024 * 1024;
let cachedBytes = 0;

function remember(key: string, wav: Buffer): void {
  if (wav.length > CACHE_ITEM_BYTES) {
    return;
  }
  const had = cache.get(key);
  if (had != null) {
    cachedBytes -= had.length;
  }
  cache.set(key, wav);
  cachedBytes += wav.length;
  // Oldest first — a Map iterates in insertion order, which is all the
  // ordering a cache this small needs.
  while (cachedBytes > CACHE_BYTES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    cachedBytes -= cache.get(oldest)?.length ?? 0;
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
    const voiceParam = String(query.get("voice") ?? "").trim();

    if (text === "" || text.length > MAX_TEXT) {
      throw new HttpError(400, "Nothing to say, or too much of it.");
    }
    if (!LOCALES.has(lang)) {
      throw new HttpError(400, "Unknown language.");
    }
    if (!Number.isFinite(wpm) || wpm < 80 || wpm > 450) {
      throw new HttpError(400, "Speech rate out of range.");
    }
    // An allow-list, checked here rather than trusted from the picker that
    // offered it: this value selects a model file and becomes a subprocess
    // argument, and the request does not have to have come from our own page.
    let voice: VoiceId | null = null;
    if (voiceParam !== "") {
      if (!isVoiceId(voiceParam)) {
        throw new HttpError(400, "Unknown voice.");
      }
      voice = voiceParam;
    }

    // The voice is part of what the bytes are. Leaving it out of the key would
    // serve a child the phrase a previous request happened to render in the
    // man's voice, which is not a subtle wrongness — it is the setting simply
    // not working, intermittently, in a way no one could reproduce.
    const key = `${voice ?? "-"}|${lang}|${wpm}|${text}`;
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
      wav = await synth.render(text, lang, wpm, voice);
    } catch {
      throw new HttpError(503, "Speech synthesis failed.");
    }
    if (wav.length === 0) {
      throw new HttpError(503, "Speech synthesis produced no audio.");
    }
    remember(key, wav);
    send(ctx, wav);
  }

  /**
   * Which curated voices this deployment can speak.
   *
   * Asked before the picker is drawn, so a parent is not offered a voice that
   * will fall back to something else the moment they choose it. An empty list
   * is a real answer — a machine with no models still has the browser's own
   * engine, which is what everyone has today.
   */
  @http.GET("/_/speech/voices")
  async voices(ctx: Context) {
    ctx.response.type = "application/json";
    // The revision goes out with the list so the page can put it in the audio
    // URL. Without it the hard cache on /_/speech.wav outlives the voices it
    // holds, and changing a voice reaches nobody for a week.
    ctx.response.body = {
      voices: await installedVoices(),
      rev: await voiceRev(),
    };
    ctx.response.headers.set("Cache-Control", "public, max-age=300");
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
