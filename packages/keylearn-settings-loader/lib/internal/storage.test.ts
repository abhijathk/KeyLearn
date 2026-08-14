import { test } from "node:test";
import { fakeAdapter, Recorder } from "@fastr/fetch";
import { saveActiveProfileId } from "@keylearn/pages-shared";
import { Settings, stringProp } from "@keylearn/settings";
import { deepEqual, equal, isFalse, isNotNull, isTrue } from "rich-assert";
import { openSettingsStorage, STORAGE_KEY } from "./storage.ts";

const PROFILE_ID = "p1";
const PROFILE_KEY = `profile-${PROFILE_ID}.${STORAGE_KEY}`;
const PROFILE_MIGRATED_KEY = `${PROFILE_KEY}.migrated`;
const PROFILE_URL = `/_/sync/profile-settings/${PROFILE_ID}`;

function asProfile(): void {
  (globalThis as any)["__PAGE_DATA__"] = {
    publicUser: { id: "u1", name: "Abhijath" },
    profiles: [{ id: PROFILE_ID, kind: "adult", firstName: "Abhijath" }],
  };
  saveActiveProfileId(PROFILE_ID);
}

test.beforeEach(() => {
  localStorage.clear();
  fakeAdapter.reset();
  (globalThis as any)["__PAGE_DATA__"] = { publicUser: {}, profiles: [] };
});

test.afterEach(() => {
  localStorage.clear();
  fakeAdapter.reset();
});

test("anonymous user - store and load settings", async () => {
  // Arrange.

  const settings = new Settings().set(stringProp("prop", "abc"), "xyz");

  // Store settings.

  deepEqual(await openSettingsStorage(null, null).store(settings), settings);
  isNotNull(localStorage.getItem(STORAGE_KEY));

  // Load settings.

  deepEqual(await openSettingsStorage(null, null).load(), settings);
  isNotNull(localStorage.getItem(STORAGE_KEY));
});

test("anonymous user - validate stored settings", async () => {
  // Load from garbage data.

  localStorage.setItem(STORAGE_KEY, "garbage");
  deepEqual(
    await openSettingsStorage(null, null).load(),
    new Settings(undefined, true),
  );

  // Load from valid data.

  localStorage.setItem(STORAGE_KEY, "{}");
  deepEqual(
    await openSettingsStorage(null, null).load(),
    new Settings(undefined, false),
  );
});

test("anonymous user - detect new settings", async () => {
  // Load for the first time.

  isTrue((await openSettingsStorage(null, null).load()).isNew);
  isNotNull(localStorage.getItem(STORAGE_KEY));

  // Load for the second time.

  isFalse((await openSettingsStorage(null, null).load()).isNew);
  isNotNull(localStorage.getItem(STORAGE_KEY));
});

test("named user - save to remote settings", async () => {
  // Arrange.

  const recorder = new Recorder();
  fakeAdapter.on
    .PUT("/_/sync/settings")
    .replyWith("", { status: 204 }, recorder);
  const settings = new Settings().set(stringProp("prop", "abc"), "xyz");
  localStorage.removeItem(STORAGE_KEY);

  // Act.

  const stored = await openSettingsStorage("abc", null).store(settings);

  // Assert.

  deepEqual(stored, settings);
  equal(localStorage.getItem(STORAGE_KEY), null);
  equal(recorder.requestCount, 1);
  equal(recorder.state, "ended");
  equal(recorder.request?.body, JSON.stringify(settings.toJSON()));
});

test("named user - load from remote settings", async () => {
  // Arrange.

  const recorder = new Recorder();
  fakeAdapter.on
    .PUT("/_/sync/settings")
    .replyWith("", { status: 204 }, recorder);
  const settings = new Settings().set(stringProp("prop", "abc"), "xyz");
  localStorage.removeItem(STORAGE_KEY);

  // Act.

  const loaded = await openSettingsStorage("abc", settings.toJSON()).load();

  // Assert.

  deepEqual(loaded, settings);
  equal(localStorage.getItem(STORAGE_KEY), null);
  equal(recorder.requestCount, 0);
  equal(recorder.state, "not called");
});

test("named user - load from local settings", async () => {
  // Arrange.

  const recorder = new Recorder();
  fakeAdapter.on
    .PUT("/_/sync/settings")
    .replyWith("", { status: 204 }, recorder);
  const settings = new Settings().set(stringProp("prop", "abc"), "xyz");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.toJSON()));

  // Act.

  const loaded = await openSettingsStorage("abc", null).load();

  // Assert.

  deepEqual(loaded, settings);
  equal(localStorage.getItem(STORAGE_KEY), null);
  equal(recorder.requestCount, 1);
  equal(recorder.state, "ended");
  equal(recorder.request?.body, JSON.stringify(settings.toJSON()));
});

test("named user - load default settings", async () => {
  // Arrange.

  const recorder = new Recorder();
  fakeAdapter.on
    .PUT("/_/sync/settings")
    .replyWith("", { status: 204 }, recorder);
  const settings = new Settings();
  localStorage.removeItem(STORAGE_KEY);

  // Act.

  const loaded = await openSettingsStorage("abc", null).load();

  // Assert.

  deepEqual(loaded, settings);
  equal(localStorage.getItem(STORAGE_KEY), null);
  equal(recorder.requestCount, 0);
  equal(recorder.state, "not called");
});

test("profile - store settings pushes to the server and caches locally", async () => {
  // Arrange.

  asProfile();
  const recorder = new Recorder();
  fakeAdapter.on.PUT(PROFILE_URL).replyWith("", { status: 204 }, recorder);
  const settings = new Settings().set(stringProp("prop", "abc"), "xyz");

  // Act.

  const stored = await openSettingsStorage("u1", null).store(settings);

  // Assert.

  deepEqual(stored, settings);
  deepEqual(JSON.parse(localStorage.getItem(PROFILE_KEY)!), settings.toJSON());
  isNotNull(localStorage.getItem(PROFILE_MIGRATED_KEY));
  equal(recorder.requestCount, 1);
  equal(recorder.state, "ended");
  equal(recorder.request?.body, JSON.stringify(settings.toJSON()));
});

test("profile - load prefers server settings over a stale local cache", async () => {
  // Arrange.

  asProfile();
  const serverSettings = new Settings().set(
    stringProp("prop", "abc"),
    "server",
  );
  const staleLocal = new Settings().set(stringProp("prop", "abc"), "stale");
  localStorage.setItem(PROFILE_KEY, JSON.stringify(staleLocal.toJSON()));
  fakeAdapter.on
    .GET(PROFILE_URL)
    .replyWith(JSON.stringify(serverSettings.toJSON()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  // Act.

  const loaded = await openSettingsStorage("u1", null).load();

  // Assert.

  deepEqual(loaded, serverSettings);
  deepEqual(
    JSON.parse(localStorage.getItem(PROFILE_KEY)!),
    serverSettings.toJSON(),
  );
});

test("profile - load migrates a pre-existing local-only settings once", async () => {
  // Arrange.

  asProfile();
  const legacy = new Settings().set(stringProp("prop", "abc"), "legacy");
  localStorage.setItem(PROFILE_KEY, JSON.stringify(legacy.toJSON()));
  fakeAdapter.on.GET(PROFILE_URL).replyWith("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  const recorder = new Recorder();
  fakeAdapter.on.PUT(PROFILE_URL).replyWith("", { status: 204 }, recorder);

  // Act.

  const loaded = await openSettingsStorage("u1", null).load();

  // Assert: the legacy value is what's returned, and it got pushed up.

  deepEqual(loaded, legacy);
  equal(recorder.requestCount, 1);
  equal(recorder.request?.body, JSON.stringify(legacy.toJSON()));
});

test("profile - load falls back to the local cache when offline", async () => {
  // Arrange.

  asProfile();
  const cached = new Settings().set(stringProp("prop", "abc"), "cached");
  localStorage.setItem(PROFILE_KEY, JSON.stringify(cached.toJSON()));
  localStorage.setItem(PROFILE_MIGRATED_KEY, "true");
  fakeAdapter.on.GET(PROFILE_URL).throwError(new Error("offline"));

  // Act.

  const loaded = await openSettingsStorage("u1", null).load();

  // Assert.

  deepEqual(loaded, cached);
});

test("profile - load creates fresh settings when nothing exists anywhere", async () => {
  // Arrange.

  asProfile();
  fakeAdapter.on.GET(PROFILE_URL).replyWith("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  // Act.

  const loaded = await openSettingsStorage("u1", null).load();

  // Assert.

  isTrue(loaded.isNew);
});
