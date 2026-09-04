import { test } from "node:test";
import { deepEqual, equal, isFalse, isTrue } from "rich-assert";
import {
  installLocalSync,
  isPortable,
  pullLocal,
  pushLocal,
} from "./local-sync.ts";

/**
 * The mirror, tested where it can lose somebody's settings.
 *
 * The transport is a fetch and the storage half is the sync controller's own
 * tests. What has to be right here is the reconciliation: which side wins when
 * two devices disagree, and — the case that matters most — what happens on the
 * day this ships, when every existing learner has settings on the device and an
 * empty account.
 */

type Call = { url: string; method: string; body: any };

function withFetch(respond: (url: string) => Response | Promise<Response>): {
  calls: Call[];
  restore: () => void;
} {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: any, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body == null ? null : JSON.parse(String(init.body)),
    });
    return await respond(String(url));
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const empty = () => json({ keys: {} });

/** A mirror as the account would hold one. */
const mirror = (keys: Record<string, { v: string | null; t: number }>) => ({
  keys,
});

/**
 * Stamps a key as though this device had set it at a given moment.
 *
 * Written straight into the stamp record rather than through `setItem`, because
 * the hook stamps with the real clock and these tests are about which of two
 * moments is later.
 */
function localSet(key: string, value: string | null, t: number): void {
  if (value == null) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, value);
  }
  const stamps = JSON.parse(
    localStorage.getItem("keylearn.sync.stamps") ?? "{}",
  );
  stamps[key] = t;
  localStorage.setItem("keylearn.sync.stamps", JSON.stringify(stamps));
}

const pushedTo = (calls: Call[], url: string) =>
  calls.find((c) => c.method === "POST" && c.url === url);

test("the account's settings reach a device that has never seen them", async () => {
  // The reported bug from the other device's side. A learner built their kids
  // world and picked a theme on a tablet, then opened the app on a laptop that
  // knows nothing about them.
  localStorage.clear();
  const { restore } = withFetch((url) =>
    url.endsWith("/local") && !url.includes("/profile/")
      ? json(
          mirror({
            "keylearn.theme[background]": { v: "#101820", t: 5_000 },
            "prefs.practice.view": { v: '"compact"', t: 5_000 },
          }),
        )
      : empty(),
  );
  try {
    isTrue(await pullLocal());
    equal(localStorage.getItem("keylearn.theme[background]"), "#101820");
    equal(localStorage.getItem("prefs.practice.view"), '"compact"');
  } finally {
    restore();
  }
});

test("an empty account does NOT wipe the settings already on the device", async () => {
  // The upgrade case, and the one worth the most care.
  //
  // Every learner using the app today has their settings on the device and
  // nothing on the server, because until now nothing ever sent them. If an
  // empty account were read as "this learner has chosen nothing", the release
  // that fixes portability would erase the settings of every person who had
  // any — the same loss the customer reported, by our own hand, on the day we
  // claimed to have fixed it.
  localStorage.clear();
  localSet("keylearn.theme[background]", "#101820", 5_000);
  localSet("ui.speedUnit", '"wpm"', 5_000);

  const { calls, restore } = withFetch(() => empty());
  try {
    // Nothing came down, because there was nothing to bring.
    isFalse(await pullLocal());
    equal(localStorage.getItem("keylearn.theme[background]"), "#101820");
    equal(localStorage.getItem("ui.speedUnit"), '"wpm"');

    // And the device's copy went up, rather than being left as the only copy
    // in existence, one cleared cache from gone.
    const pushed = pushedTo(calls, "/_/sync/doc/local");
    equal(pushed?.body?.keys?.["keylearn.theme[background]"]?.v, "#101820");
    equal(pushed?.body?.keys?.["ui.speedUnit"]?.v, '"wpm"');
  } finally {
    restore();
  }
});

test("the newer of two devices wins, per key rather than per document", async () => {
  // Two devices open at once, each changing something different. Neither change
  // may take the other with it: whole-document last-write-wins would mean the
  // laptop's push silently reverted the tablet's theme, which to the learner is
  // indistinguishable from the sync being broken.
  localStorage.clear();
  localSet("ui.speedUnit", '"cpm"', 9_000); // Changed here, a moment ago.
  localSet("keylearn.theme[background]", "#ffffff", 1_000); // Long settled.

  const { restore } = withFetch((url) =>
    url.includes("/profile/")
      ? empty()
      : json(
          mirror({
            "ui.speedUnit": { v: '"wpm"', t: 3_000 }, // Older: must not win.
            "keylearn.theme[background]": { v: "#101820", t: 7_000 }, // Newer.
          }),
        ),
  );
  try {
    isTrue(await pullLocal());
    equal(localStorage.getItem("ui.speedUnit"), '"cpm"');
    equal(localStorage.getItem("keylearn.theme[background]"), "#101820");
  } finally {
    restore();
  }
});

test("clearing a setting on one device clears it on the other", async () => {
  // Without tombstones, a key that has been deleted and a key that never
  // existed look the same, so the device that still has it would hand it
  // straight back and the learner could never turn anything off.
  localStorage.clear();
  localSet("ui.hideKeyboard", "true", 2_000);
  const { restore } = withFetch((url) =>
    url.includes("/profile/")
      ? empty()
      : json(mirror({ "ui.hideKeyboard": { v: null, t: 8_000 } })),
  );
  try {
    isTrue(await pullLocal());
    equal(localStorage.getItem("ui.hideKeyboard"), null);
  } finally {
    restore();
  }
});

test("settings the account has never seen survive the pull that brings others down", async () => {
  // The realistic shape of a partly-migrated account, and the wipe that a
  // plausible implementation causes.
  //
  // Adopting the account's document as the new truth — writing what it holds
  // and clearing what it omits — reads as correct and is catastrophic: every
  // setting made on this device before it ever synced, and everything set
  // while it was offline, is a key the account has never heard of. It must
  // survive and go up, not be deleted for being unfamiliar.
  localStorage.clear();
  localSet("prefs.practice.view", '"compact"', 5_000); // Only here.
  localSet("ui.hideKeyboard", "true", 5_000); // Only here.

  const { calls, restore } = withFetch((url) =>
    url.includes("/profile/")
      ? empty()
      : json(mirror({ "ui.speedUnit": { v: '"wpm"', t: 6_000 } })),
  );
  try {
    isTrue(await pullLocal());
    equal(localStorage.getItem("ui.speedUnit"), '"wpm"'); // Came down.
    equal(localStorage.getItem("prefs.practice.view"), '"compact"'); // Kept.
    equal(localStorage.getItem("ui.hideKeyboard"), "true"); // Kept.

    const pushed = pushedTo(calls, "/_/sync/doc/local");
    equal(pushed?.body?.keys?.["prefs.practice.view"]?.v, '"compact"');
    equal(pushed?.body?.keys?.["ui.hideKeyboard"]?.v, "true");
  } finally {
    restore();
  }
});

test("an adopted value is not pushed straight back as though it were ours", async () => {
  // A device that restamped what it just received would claim authorship of
  // someone else's change, and would then beat a third device that genuinely
  // had something newer. The stamp that comes down is the stamp that is kept.
  localStorage.clear();
  const { calls, restore } = withFetch((url) =>
    url.includes("/profile/")
      ? empty()
      : json(mirror({ "ui.speedUnit": { v: '"wpm"', t: 4_000 } })),
  );
  try {
    isTrue(await pullLocal());
    await pushLocal();
    const pushed = pushedTo(calls, "/_/sync/doc/local");
    equal(pushed?.body?.keys?.["ui.speedUnit"]?.t, 4_000);
  } finally {
    restore();
  }
});

test("a server error is not mistaken for an empty account", async () => {
  // Treating a failed read as "nothing stored" is the same destructive mistake
  // as the empty-document case, arrived at from a different direction.
  localStorage.clear();
  localSet("ui.speedUnit", '"cpm"', 5_000);
  const { restore } = withFetch(() => new Response("nope", { status: 500 }));
  try {
    isFalse(await pullLocal());
    equal(localStorage.getItem("ui.speedUnit"), '"cpm"');
  } finally {
    restore();
  }
});

test("being offline leaves the learner exactly as they were", async () => {
  // Nothing here may be the reason a setting is lost or a page fails to draw.
  localStorage.clear();
  localSet("ui.speedUnit", '"cpm"', 5_000);
  const { restore } = withFetch(() => {
    throw new Error("offline");
  });
  try {
    isFalse(await pullLocal());
    equal(localStorage.getItem("ui.speedUnit"), '"cpm"');
  } finally {
    restore();
  }
});

test("one learner's state is never written into another's", async () => {
  // The scopes are separate documents and separate routes, but a document that
  // named a key outside its own scope would cross them. Two children on one
  // account is the ordinary case, not the exotic one.
  localStorage.clear();
  const { restore } = withFetch((url) =>
    url.includes("/profile/")
      ? empty()
      : json(
          mirror({
            "profile-77.kids.prefs": { v: '{"world":"reef"}', t: 9_000 },
          }),
        ),
  );
  try {
    // Offered in the account document, which is not that key's scope.
    isFalse(await pullLocal());
    equal(localStorage.getItem("profile-77.kids.prefs"), null);
  } finally {
    restore();
  }
});

test("what stays on the device is a decision, with a reason", () => {
  // The exclusions are the whole risk surface of a mirror: everything else
  // travels by default. Each of these would be a bug if carried.
  isFalse(isPortable("keylearn.sync.stamps")); // Its own bookkeeping.
  isFalse(isPortable("keylearn.activeProfile.42")); // Who is at THIS device.
  isFalse(isPortable("profile-9.settings")); // Has its own route.
  isFalse(isPortable("profile-9.keylearn.a11y")); // Has its own route.
  isFalse(isPortable("profile-9.keylearn.braille.progress")); // Merges, not copies.
  isFalse(isPortable("keylearn.support.outbox")); // A send queue.
  isFalse(isPortable("profile-9.keylearn.ngrams")); // Derived, large, hot.

  // And the settings the customer actually reported, every one of which was
  // device-local before this existed.
  isTrue(isPortable("profile-9.kids.prefs"));
  isTrue(isPortable("profile-9.kids.best"));
  isTrue(isPortable("keylearn.theme[background]"));
  // Day or night, the font and the text size. Kept in a cookie for the
  // server-rendered first paint AND in storage so they follow the learner —
  // the cookie alone is one browser on one machine, which is why this was the
  // one preference that never travelled (4 Sep 2026).
  isTrue(isPortable("profile-9.keylearn.theme"));
  isTrue(isPortable("keylearn.mode"));
  isTrue(isPortable("prefs.practice.view"));
  isTrue(isPortable("ui.speedUnit"));
  isTrue(isPortable("keylearn.accents.custom"));
});

test("a value too large to carry does not stop the rest travelling", async () => {
  // One learner pasting a novel into custom text must not be the reason nobody
  // else's theme syncs.
  localStorage.clear();
  localSet("lesson.wordList.custom", "x".repeat(60_000), 5_000);
  localSet("ui.speedUnit", '"wpm"', 5_000);
  const { calls, restore } = withFetch(() => empty());
  try {
    await pullLocal();
    const pushed = pushedTo(calls, "/_/sync/doc/local");
    deepEqual(pushed?.body?.keys?.["lesson.wordList.custom"], undefined);
    equal(pushed?.body?.keys?.["ui.speedUnit"]?.v, '"wpm"');
  } finally {
    restore();
  }
});

test("installing the hook actually intercepts a write", async () => {
  // The obvious way to write this — assigning to `localStorage.setItem` — is
  // not a no-op but something worse. `Storage` has a named-property setter, so
  // the assignment STORES an entry called "setItem" holding the source text of
  // the wrapper, leaves the real method in place, and never fires. The sync
  // would have shipped inert, and would have mirrored its own wrapper to every
  // device the learner owned.
  //
  // Nothing about that failure is visible from the outside, which is why it is
  // pinned here rather than trusted.
  localStorage.clear();
  installLocalSync();

  const { calls, restore } = withFetch(() => empty());
  try {
    localStorage.setItem("ui.speedUnit", '"cpm"');

    // The wrapper went to the prototype, not into the store.
    equal(localStorage.getItem("setItem"), null);
    equal(typeof localStorage.setItem, "function");

    // And the write was noticed: it is stamped, so it can be reconciled.
    const stamps = JSON.parse(
      localStorage.getItem("keylearn.sync.stamps") ?? "{}",
    );
    isTrue(typeof stamps["ui.speedUnit"] === "number");

    // sessionStorage shares that prototype and must not be carried anywhere.
    sessionStorage.setItem("ui.hideKeyboard", "true");
    const after = JSON.parse(
      localStorage.getItem("keylearn.sync.stamps") ?? "{}",
    );
    equal(after["ui.hideKeyboard"], undefined);

    await pushLocal();
    const pushed = pushedTo(calls, "/_/sync/doc/local");
    equal(pushed?.body?.keys?.["ui.speedUnit"]?.v, '"cpm"');
    equal(pushed?.body?.keys?.["setItem"], undefined);
  } finally {
    restore();
  }
});

test("a migrated account reaches a fresh device — the whole point, and it did not work", async () => {
  // This is the customer's report, in the shape it actually occurs, and it is
  // the test that was missing when the feature shipped.
  //
  // Every key migrated from before this existed carries a stamp of zero: that
  // is how "we do not know when this was set" is written. A device that has
  // never synced has no stamp for those keys either, which also reads as zero.
  // So the "is the remote newer" comparison was 0 <= 0 — true — and every
  // migrated setting was skipped on every new device.
  //
  // The earlier tests all invented stamps like 5000, so they passed while the
  // feature did nothing whatsoever in life. Running the real app is what found
  // it: 74 keys were wiped from a browser, the page reloaded, and none of the
  // eleven on the server came back.
  localStorage.clear();
  const { restore } = withFetch((url) =>
    url.includes("/profile/")
      ? empty()
      : json(
          mirror({
            "kids.prefs": { v: '{"world":"hero","name":"Rexy"}', t: 0 },
            "keylearn.mode": { v: "grown-ups", t: 0 },
            "kids.best": { v: "27", t: 0 },
          }),
        ),
  );
  try {
    isTrue(await pullLocal());
    equal(localStorage.getItem("kids.prefs"), '{"world":"hero","name":"Rexy"}');
    equal(localStorage.getItem("keylearn.mode"), "grown-ups");
    equal(localStorage.getItem("kids.best"), "27");
  } finally {
    restore();
  }
});

test("a tombstone for a key this device never had is not resurrected as one", async () => {
  // The other side of adopting unknown keys: "absent locally so take it" must
  // not turn a deletion into a stored null, nor stamp a key that does not
  // exist and never did.
  localStorage.clear();
  const { restore } = withFetch((url) =>
    url.includes("/profile/")
      ? empty()
      : json(mirror({ "ui.hideKeyboard": { v: null, t: 900 } })),
  );
  try {
    isFalse(await pullLocal());
    equal(localStorage.getItem("ui.hideKeyboard"), null);
  } finally {
    restore();
  }
});
