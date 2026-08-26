import { test } from "node:test";
import { deepEqual, equal, isFalse, isTrue } from "rich-assert";
import { loadA11y, saveA11yLocal } from "./a11y-storage.ts";
import { pullA11y } from "./a11y-sync.ts";

/**
 * The reconciliation, tested where it can actually go wrong.
 *
 * The push is a fetch and the server half is covered in the sync controller's
 * own tests. What has to be right here is the decision `pullA11y` makes when
 * the two sides disagree — and in particular the upgrade case, where getting
 * it wrong destroys the settings of exactly the learners this work is for.
 */

type Call = { url: string; method: string; body: unknown };

function withFetch(
  respond: (url: string, init?: RequestInit) => Response | Promise<Response>,
): { calls: Call[]; restore: () => void } {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: any, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body == null ? null : JSON.parse(String(init.body)),
    });
    return await respond(String(url), init);
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

test("the account's settings reach a device that has never seen them", async () => {
  // The reported bug, from the other device's side: a learner set the
  // dyslexic typeface and a slower voice on their tablet, and opens the app on
  // a laptop that knows nothing about them.
  localStorage.clear();
  const { restore } = withFetch(() =>
    json({ typeface: "dyslexic", targets: "large", speechRate: 1.4 }),
  );
  try {
    isTrue(await pullA11y("19"));
    const prefs = loadA11y("19");
    equal(prefs.typeface, "dyslexic");
    equal(prefs.targets, "large");
    equal(prefs.speechRate, 1.4);
  } finally {
    restore();
  }
});

test("an empty account does NOT wipe the settings already on the device", async () => {
  // The upgrade case, and the one worth the most care.
  //
  // Every learner using the app today has preferences on their device and
  // nothing on the server, because until now nothing ever sent them. If an
  // empty server were read as "this learner has chosen nothing", the release
  // that fixes portability would erase the settings of every person who
  // depended on them — the same people, by the same mechanism, on the day we
  // claimed to have fixed it.
  localStorage.clear();
  saveA11yLocal({ typeface: "dyslexic", lineHeight: 1.8 }, "19");

  const { calls, restore } = withFetch(() => json({}));
  try {
    // Nothing changed locally: there was nothing to bring down.
    isFalse(await pullA11y("19"));
    const prefs = loadA11y("19");
    equal(prefs.typeface, "dyslexic");
    equal(prefs.lineHeight, 1.8);

    // And the device's copy was offered up, rather than left as the only one
    // in existence, one cache-clear from gone.
    const pushed = calls.find((c) => c.method === "POST");
    equal(pushed?.url, "/_/sync/a11y/profile/19");
    deepEqual((pushed?.body as any)?.typeface, "dyslexic");
  } finally {
    restore();
  }
});

test("being offline leaves the learner exactly as they were", async () => {
  // Nothing here may be the reason a page does not render, or a setting is
  // lost: a signed-out or offline learner keeps working on the device's copy.
  localStorage.clear();
  saveA11yLocal({ targets: "large" }, "19");
  const { restore } = withFetch(() => {
    throw new Error("offline");
  });
  try {
    isFalse(await pullA11y("19"));
    equal(loadA11y("19").targets, "large");
  } finally {
    restore();
  }
});

test("a learner with no profile is not synced at all", async () => {
  // Anonymous, or signed in with nobody chosen: there is no account copy to
  // reconcile with, and asking for one would 403 on every page load.
  localStorage.clear();
  const { calls, restore } = withFetch(() => json({}));
  try {
    isFalse(await pullA11y(null));
    equal(calls.length, 0);
  } finally {
    restore();
  }
});

test("a server error is not mistaken for an empty account", async () => {
  // A 500 must leave the device's settings alone. Treating a failed read as
  // "nothing set" is the same destructive mistake as the empty-document case,
  // arrived at from a different direction.
  localStorage.clear();
  saveA11yLocal({ typeface: "dyslexic" }, "19");
  const { restore } = withFetch(() => new Response("nope", { status: 500 }));
  try {
    isFalse(await pullA11y("19"));
    equal(loadA11y("19").typeface, "dyslexic");
  } finally {
    restore();
  }
});
