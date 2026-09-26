import { activeProfileId } from "@keylearn/pages-shared";
import { expectType, request } from "@keylearn/request";
import { Settings, type SettingsStorage } from "@keylearn/settings";
import { ObjectStorage } from "./objectstore.ts";

export const STORAGE_KEY = "settings";

export function openSettingsStorage(
  userId: string | null,
  json: unknown | null,
): SettingsStorage {
  const storage = new ObjectStorage();
  // A household profile is its own sync scope, separate from the admin
  // account's — see /_/sync/profile-settings. `activeProfileId()` only ever
  // resolves once signed in (it is keyed by the account id), so reaching
  // this branch means `userId` is set too.
  const profileId = activeProfileId();
  if (profileId != null) {
    const key = `profile-${profileId}.${STORAGE_KEY}`;
    const migratedKey = `${key}.migrated`;
    // A change saved while the server could not be reached. Until it lands,
    // this device's copy is the newest there is, and a load must send it up
    // rather than let the server's older copy overwrite it — which is what
    // happened before: settings changed offline were quietly undone the next
    // time the page opened with a connection.
    const pendingKey = `${key}.pending`;
    const url = `/_/sync/profile-settings/${profileId}`;
    const put = async (json: unknown): Promise<void> => {
      const response = await request.PUT(url).send(json as any);
      await response.blob(); // Ignore.
      storage.set(migratedKey, true);
      storage.set(pendingKey, null);
    };
    globalThis.addEventListener?.("online", () => {
      const value = storage.get(key);
      if (storage.get(pendingKey) != null && value != null) {
        put(value).catch(() => {});
      }
    });
    return new (class implements SettingsStorage {
      async load(): Promise<Settings> {
        const pending = storage.get(key);
        if (storage.get(pendingKey) != null && pending != null) {
          try {
            await put(pending);
          } catch {
            // Still offline: this device's copy is the one to use.
          }
          return new Settings(pending as any);
        }
        try {
          const response = await request
            .use(expectType("application/json"))
            .GET(url)
            .send();
          const remote = (await response.json()) as Record<string, unknown>;
          // An empty object is indistinguishable from "nothing stored yet"
          // over this wire format — treat it as the latter so a legacy
          // local-only value beneath it still gets migrated up.
          if (Object.keys(remote).length > 0) {
            const settings = new Settings(remote);
            storage.set(key, settings.toJSON());
            return settings;
          }
        } catch {
          // Offline, or the request failed — fall through to whatever this
          // device already has rather than losing the learner's settings.
        }
        const value = storage.get(key);
        if (value != null) {
          const settings = new Settings(value as any);
          if (storage.get(migratedKey) == null) {
            // Pre-existing local-only settings (from before this profile
            // synced, or from a previous offline session) — push it up
            // once, best-effort; a failure here just means the next
            // store() tries again.
            this.store(settings).catch(() => {});
          }
          return settings;
        }
        const settings = new Settings(undefined, true);
        storage.set(key, settings.toJSON());
        return settings;
      }

      async store(settings: Settings): Promise<Settings> {
        // Written locally first — the write-through cache — so a caller
        // never waits on the network, and so it survives being offline.
        storage.set(key, settings.toJSON());
        storage.set(pendingKey, true);
        try {
          await put(settings.toJSON());
        } catch {
          // Offline — the local write already succeeded and is marked
          // pending; it goes up when the connection returns or on the next
          // load, whichever comes first.
        }
        return settings;
      }
    })();
  }
  if (userId != null) {
    return new (class implements SettingsStorage {
      async load(): Promise<Settings> {
        // The device's own `settings` belong to whoever used it signed out.
        // They are not carried into the account: a guest's choices landing on
        // somebody's account is exactly the wrong data in the wrong place.
        // Progress moves across deliberately, by export and import.
        return json != null ? new Settings(json as any) : new Settings();
      }

      async store(settings: Settings): Promise<Settings> {
        await this.send(settings);
        return settings;
      }

      async send(settings: Settings): Promise<void> {
        const response = await request
          .PUT("/_/sync/settings")
          .send(settings.toJSON());
        await response.blob(); // Ignore.
      }
    })();
  } else {
    return new (class implements SettingsStorage {
      async load(): Promise<Settings> {
        const value = storage.get(STORAGE_KEY);
        if (value != null) {
          return new Settings(value as any);
        } else {
          const settings = new Settings(undefined, true);
          storage.set(STORAGE_KEY, settings.toJSON());
          return settings;
        }
      }

      async store(settings: Settings): Promise<Settings> {
        storage.set(STORAGE_KEY, settings.toJSON());
        return settings;
      }
    })();
  }
}
