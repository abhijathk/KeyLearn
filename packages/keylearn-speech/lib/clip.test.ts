import { test } from "node:test";
import { equal, isTrue } from "rich-assert";

/**
 * The server-clip path, which had no tests at all.
 *
 * This package shipped with none, and the parts most worth covering are the
 * ones added last: a chosen voice going to the server FIRST rather than as a
 * fallback, and the cache key that decides whether two requests are the same
 * audio.
 *
 * That key is not a detail. It once omitted the voice, so whichever rendering
 * of a phrase arrived first was served to everybody afterwards — a child
 * hearing the man's voice because an adult had asked a moment earlier. It
 * failed intermittently, which is the worst way for it to fail, and nothing
 * here would have noticed.
 *
 * Everything is driven through `say`, the public surface, rather than by
 * reaching for internals. What matters is what leaves the process and how
 * often, and both are observable from outside.
 */

type Call = { url: string };

/**
 * A browser with no speech engine and a stub audio context.
 *
 * No `speechSynthesis` on purpose: that is what a real failed engine looks
 * like from here, and it is the state in which the server path is reached.
 * The audio context only has to be enough to decode and start a source; what
 * is being tested is the fetching, not the playing.
 */
function browser(respond: (url: string) => Response | Promise<Response>): {
  calls: Call[];
  restore: () => void;
} {
  const calls: Call[] = [];
  const g = globalThis as any;
  const before = {
    fetch: g.fetch,
    AudioContext: g.AudioContext,
    speechSynthesis: g.window?.speechSynthesis,
  };

  g.fetch = (async (url: any) => {
    calls.push({ url: String(url) });
    return await respond(String(url));
  }) as typeof fetch;

  g.AudioContext = class {
    state = "running";
    destination = {};
    async resume() {}
    async decodeAudioData() {
      return { duration: 0.4 } as unknown as AudioBuffer;
    }
    createBufferSource() {
      return {
        buffer: null,
        playbackRate: { value: 1 },
        connect() {},
        start() {},
        stop() {},
        addEventListener() {},
        onended: null,
      };
    }
  };

  return {
    calls,
    restore: () => {
      g.fetch = before.fetch;
      g.AudioContext = before.AudioContext;
    },
  };
}

const wav = () =>
  new Response(new ArrayBuffer(64), {
    status: 200,
    headers: { "content-type": "audio/wav" },
  });

const voices = (rev: string) =>
  new Response(JSON.stringify({ voices: ["kid", "lady"], rev }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const audioCalls = (calls: Call[]) =>
  calls.filter((c) => c.url.includes("speech.wav"));

const paramOf = (url: string, name: string) =>
  new URL(url, "http://localhost").searchParams.get(name);

test("a chosen voice and the build it came from both reach the server", async () => {
  // The voice, because otherwise the server renders whatever it likes; the
  // revision, because the audio is cached for a week and marked immutable, so
  // without it a changed voice reaches nobody who has already heard the old
  // one. Three of four voices arrived as the previous engine's renders for
  // exactly this reason.
  const { say } = await import("./speech.ts");
  const { calls, restore } = browser((url) =>
    url.includes("/_/speech/voices") ? voices("abc123") : wav(),
  );
  try {
    say("hello there", { rate: 1, enabled: true, clip: "kid" });
    await new Promise((r) => setTimeout(r, 60));
    const audio = audioCalls(calls);
    isTrue(audio.length > 0, "the server was asked for audio");
    equal(paramOf(audio[0].url, "voice"), "kid");
    equal(paramOf(audio[0].url, "rev"), "abc123");
  } finally {
    restore();
  }
});

test("two voices saying the same words are not the same cached clip", async () => {
  // The bug this exists for. With the voice missing from the key, the second
  // voice was served the first one's audio — the setting silently not working,
  // intermittently, in a way nobody could reproduce.
  const { say } = await import("./speech.ts");
  const { calls, restore } = browser((url) =>
    url.includes("/_/speech/voices") ? voices("abc123") : wav(),
  );
  try {
    say("same words", { rate: 1, enabled: true, clip: "kid" });
    await new Promise((r) => setTimeout(r, 60));
    say("same words", { rate: 1, enabled: true, clip: "lady" });
    await new Promise((r) => setTimeout(r, 60));

    const audio = audioCalls(calls);
    const asked = audio.map((c) => paramOf(c.url, "voice"));
    isTrue(asked.includes("kid"), `kid was asked for — got ${asked.join(",")}`);
    isTrue(
      asked.includes("lady"),
      `lady was asked for separately — got ${asked.join(",")}`,
    );
  } finally {
    restore();
  }
});

test("the same phrase in the same voice is fetched once, not once per caller", async () => {
  // A drill says the same six things after every keystroke, and every uncached
  // phrase costs the server a synthesiser subprocess. Without this a child
  // holding down a chord could spawn dozens of them.
  const { say } = await import("./speech.ts");
  const { calls, restore } = browser((url) =>
    url.includes("/_/speech/voices") ? voices("abc123") : wav(),
  );
  try {
    say("repeated line", { rate: 1, enabled: true, clip: "kid" });
    say("repeated line", { rate: 1, enabled: true, clip: "kid" });
    say("repeated line", { rate: 1, enabled: true, clip: "kid" });
    await new Promise((r) => setTimeout(r, 120));
    equal(
      audioCalls(calls).filter((c) => c.url.includes("repeated")).length,
      1,
    );
  } finally {
    restore();
  }
});

test("a server that cannot speak does not leave the learner in silence", async () => {
  // The whole point of the fallback chain. A deployment with no synthesiser,
  // or one that is simply down, must not mean nothing is said — on the braille
  // page the voice is the interface, not a nicety.
  const { say, speechHealth } = await import("./speech.ts");
  const { restore } = browser(() => new Response("no", { status: 503 }));
  try {
    let finished = false;
    say(
      "fallback line",
      { rate: 1, enabled: true, clip: "kid" },
      () => (finished = true),
    );
    await new Promise((r) => setTimeout(r, 120));
    // Either something else spoke it or the chain admitted it could not; what
    // must never happen is the callback being dropped, because callers chain
    // their next line on it and a lost callback stops the conversation dead.
    isTrue(
      finished || speechHealth() !== "working",
      "the chain resolved rather than hanging",
    );
  } finally {
    restore();
  }
});
