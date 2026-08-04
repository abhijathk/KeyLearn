import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import { clearRemoteProgress, pullProgress, pushProgress } from "./sync.ts";

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

type Call = { url: string; method: string; body?: string };
let calls: Call[] = [];
let respond: () => Promise<Response> = async () =>
  new Response("{}", { status: 200 });

(globalThis as { fetch?: unknown }).fetch = async (
  url: string,
  init?: { method?: string; body?: string },
) => {
  calls.push({ url, method: init?.method ?? "GET", body: init?.body });
  return respond();
};

const reset = () => {
  calls = [];
  store.clear();
  respond = async () => new Response("{}", { status: 200 });
};

test("a learner with no account profile is left entirely alone", async () => {
  // Signed out, or practising on the shared account. Nothing is sent anywhere,
  // and above all nothing is fetched that could overwrite their device.
  reset();
  isFalse(await pullProgress(null));
  await pushProgress(null);
  await clearRemoteProgress(null);
  equal(calls.length, 0);
});

test("a profile id that is not a profile id is refused", async () => {
  // The id goes into a URL path. Anything but digits is not ours to send.
  reset();
  for (const bad of ["../../etc", "1;drop", "", "abc"]) {
    isFalse(await pullProgress(bad));
    await pushProgress(bad);
  }
  equal(calls.length, 0);
});

test("nothing stored yet leaves the device's own copy alone", async () => {
  reset();
  store.set(
    "keylearn.braille.progress.9",
    JSON.stringify({
      a: { hits: 40, misses: 0, bestMs: 400, recentMs: [400] },
    }),
  );
  isFalse(await pullProgress("9"), "an empty document is not a merge");
  isTrue(store.get("keylearn.braille.progress.9")!.includes('"hits":40'));
});

test("the account's copy is folded in, not swapped for", async () => {
  reset();
  store.set(
    "keylearn.braille.progress.9",
    JSON.stringify({
      a: { hits: 40, misses: 0, bestMs: 400, recentMs: [400] },
    }),
  );
  respond = async () =>
    new Response(
      JSON.stringify({
        progress: { b: { hits: 12, misses: 1, bestMs: 500, recentMs: [500] } },
        days: ["2026-08-01"],
        daily: {},
        savedAt: 1,
      }),
      { status: 200 },
    );
  isTrue(await pullProgress("9"));
  const after = store.get("keylearn.braille.progress.9")!;
  isTrue(after.includes('"a"'), "the device's own work survives");
  isTrue(after.includes('"b"'), "and the account's is added to it");
});

test("being offline is not an error the learner ever sees", async () => {
  reset();
  respond = async () => {
    throw new TypeError("Failed to fetch");
  };
  isFalse(await pullProgress("9"), "the drill still starts");
  await pushProgress("9"); // must not throw
  await clearRemoteProgress("9"); // nor this
});

test("a server error does not corrupt the device's copy", async () => {
  reset();
  store.set("keylearn.braille.progress.9", JSON.stringify({ a: { hits: 7 } }));
  respond = async () => new Response("nope", { status: 500 });
  isFalse(await pullProgress("9"));
  isTrue(store.get("keylearn.braille.progress.9")!.includes('"hits":7'));
});

test("clearing removes the account's copy as well as the device's", async () => {
  // Otherwise "clear my statistics" deletes the local copy and has it handed
  // straight back by the next pull.
  reset();
  await clearRemoteProgress("9");
  equal(calls.length, 1);
  equal(calls[0].method, "DELETE");
  isTrue(calls[0].url.includes("/9"));
});

test("pushing sends the whole snapshot", async () => {
  reset();
  store.set("keylearn.braille.days.9", JSON.stringify(["2026-08-02"]));
  await pushProgress("9");
  equal(calls[0].method, "POST");
  const sent = JSON.parse(calls[0].body!);
  isTrue("progress" in sent && "days" in sent && "daily" in sent);
  isTrue(sent.days.includes("2026-08-02"), "the calendar travels too");
});
