import { booleanProp, stringProp } from "@keybr/settings";

/**
 * Account-level preferences. Unlike per-session Practice settings these apply
 * to the whole account; they persist through the same server-synced settings
 * blob (SettingsLoader), so no dedicated columns are needed.
 *
 * Note: storing an email-notification preference records the user's choice;
 * the scheduled job that actually sends reminder emails is a separate feature.
 */
export const accountProps = {
  // Empty string means "follow this device's time zone".
  timeZone: stringProp("account.timeZone", "", { maxLength: 64 }),
  // "mon" | "sun"
  weekStart: stringProp("account.weekStart", "mon", { maxLength: 3 }),
  emailReminders: booleanProp("account.emailReminders", true),
  emailProductNews: booleanProp("account.emailProductNews", false),
  analytics: booleanProp("account.analytics", false),
} as const;

/** The device's current IANA time zone, e.g. "Australia/Sydney". */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** All IANA time zones the runtime knows, with the device zone guaranteed in. */
export function allTimeZones(): readonly string[] {
  let list: string[] = [];
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf;
    if (typeof supported === "function") {
      list = supported("timeZone");
    }
  } catch {
    list = [];
  }
  const device = deviceTimeZone();
  if (!list.includes(device)) {
    list = [device, ...list];
  }
  return list;
}
