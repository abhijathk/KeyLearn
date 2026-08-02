import { dateProps, deviceTimeZone } from "@keybr/intl";
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
  // Declared in @keybr/intl, where the date formatters read it, so the
  // settings screen and every date on every page cannot disagree about which
  // key holds the zone. Empty means "follow this device".
  timeZone: dateProps.timeZone,
  // Declared in @keybr/intl beside the time zone, because the calendars read
  // it from there. Empty means "follow the locale".
  weekStart: dateProps.weekStart,
  emailReminders: booleanProp("account.emailReminders", true),
  // "few-days" | "weekly" | "monthly" — how often a lapsed learner may be
  // nudged. This is a ceiling, not a schedule: the sweep only writes when
  // someone has actually stopped practising, so a daily user gets nothing.
  reminderFrequency: stringProp("account.reminderFrequency", "weekly", {
    maxLength: 16,
  }),
  emailProductNews: booleanProp("account.emailProductNews", false),
  // "major" | "all" — how much news counts as news.
  newsLevel: stringProp("account.newsLevel", "major", { maxLength: 8 }),
  analytics: booleanProp("account.analytics", false),
} as const;

export { deviceTimeZone };

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
