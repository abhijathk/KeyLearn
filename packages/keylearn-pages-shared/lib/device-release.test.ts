import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import { releaseDevice } from "./device-release.ts";

/**
 * Signing out of a shared computer: what leaves the device, and — the part
 * that can cost somebody their work — what must not.
 */

type Call = { url: string; method: string };

function withServer(respond: (url: string, method: string) => Response): {
  calls: Call[];
  restore: () => void;
} {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: any, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url: String(url), method });
    return respond(String(url), method);
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

const SETTINGS = { lesson: "guided", textSize: 2 };

function seed(): void {
  localStorage.clear();
  localStorage.setItem("keylearn.activeProfile.abc", "7");
  localStorage.setItem("keylearn.theme", '{"color":"auto"}'); // account scope
  localStorage.setItem("profile-7.kids.prefs", '{"world":"village"}');
  localStorage.setItem("profile-7.keylearn.ngrams", "[]");
  localStorage.setItem("profile-7.settings", JSON.stringify(SETTINGS));
  localStorage.setItem("profile-7.settings.migrated", "true");
  localStorage.setItem("profile-7.keylearn.support.outbox", "[]");
  localStorage.setItem("keylearn.braille.progress.7", '{"cells":1}');
  localStorage.setItem(
    "keylearn.sync.stamps",
    JSON.stringify({ "profile-7.kids.prefs": 5, "profile-7.kids.land": 6 }),
  );
}

test("everything the account holds leaves; the device's own keys stay", async () => {
  seed();
  const { calls, restore } = withServer((url) =>
    url.includes("profile-settings") ? json(SETTINGS) : json({}),
  );
  try {
    await releaseDevice(["7"]);
  } finally {
    restore();
  }

  equal(localStorage.getItem("profile-7.kids.prefs"), null);
  equal(localStorage.getItem("profile-7.keylearn.ngrams"), null);
  equal(localStorage.getItem("profile-7.settings"), null);
  equal(localStorage.getItem("profile-7.keylearn.support.outbox"), null);
  equal(localStorage.getItem("keylearn.braille.progress.7"), null);
  // Its stamp goes too, or the next sign-in would think this device already
  // has the value and never take the account's copy back.
  const stamps = JSON.parse(
    localStorage.getItem("keylearn.sync.stamps") ?? "{}",
  );
  isFalse("profile-7.kids.prefs" in stamps);
  // Nor a deletion already delivered (a stamp with no value): sent again at
  // the next sign-in, it would delete whatever the account set since.
  isFalse("profile-7.kids.land" in stamps);
  // Not the account's: which learner this device uses.
  equal(localStorage.getItem("keylearn.activeProfile.abc"), "7");
  // The account's own scope, once it is on the server, goes too — it would
  // otherwise be pushed into the next account signed in here.
  equal(localStorage.getItem("keylearn.theme"), null);
  // The mirror went up first, and the braille record was merged in.
  isTrue(
    calls.some(
      (c) => c.method === "POST" && c.url === "/_/sync/doc/profile/7/local",
    ),
  );
  isTrue(
    calls.some(
      (c) => c.method === "POST" && c.url === "/_/sync/braille/profile/7",
    ),
  );
});

test("nothing the account has not confirmed is removed", async () => {
  seed();
  localStorage.setItem(
    "profile-7.keylearn.support.outbox",
    '[{"body":"help"}]',
  );
  // The mirror push fails, the braille push fails, and the account's settings
  // differ from the device's (changed offline, not yet sent).
  const { restore } = withServer((url, method) =>
    method === "POST"
      ? json({}, 503)
      : url.includes("profile-settings")
        ? json({ lesson: "classic" })
        : json({}),
  );
  try {
    await releaseDevice(["7"]);
  } finally {
    restore();
  }

  isTrue(localStorage.getItem("profile-7.kids.prefs") != null);
  isTrue(localStorage.getItem("profile-7.settings") != null);
  isTrue(localStorage.getItem("keylearn.braille.progress.7") != null);
  isTrue(localStorage.getItem("keylearn.theme") != null);
  equal(
    localStorage.getItem("profile-7.keylearn.support.outbox"),
    '[{"body":"help"}]',
  );
});
