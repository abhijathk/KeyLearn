export * from "./SettingsLoader.tsx";
// The anonymous-visitor storage key, needed by whoever creates a household's
// first profile — that's the moment a guest's local-only settings become
// worth migrating into the new profile's own synced slot. See
// ProfilesContext's `add` in page-account.
export { STORAGE_KEY as ANONYMOUS_SETTINGS_KEY } from "./internal/storage.ts";
