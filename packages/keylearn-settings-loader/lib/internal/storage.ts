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
    const url = `/_/sync/profile-settings/${profileId}`;
    return new (class implements SettingsStorage {
      async load(): Promise<Settings> {
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
        try {
          const response = await request.PUT(url).send(settings.toJSON());
          await response.blob(); // Ignore.
          storage.set(migratedKey, true);
        } catch {
          // Offline — the local write already succeeded. No retry queue in
          // this phase; the next successful load() or store() reconciles it.
        }
        return settings;
      }
    })();
  }
  if (userId != null) {
    return new (class implements SettingsStorage {
      async load(): Promise<Settings> {
        if (json != null) {
          return new Settings(json as any);
        } else {
          const value = storage.get(STORAGE_KEY);
          if (value != null) {
            storage.set(STORAGE_KEY, null);
            const settings = new Settings(value as any);
            await this.send(settings);
            return settings;
          } else {
            return new Settings();
          }
        }
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
