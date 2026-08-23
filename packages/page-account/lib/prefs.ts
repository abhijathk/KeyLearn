import {
  dateProps,
  deviceTimeZone,
  regionOfTimeZone,
  regionsWithZones,
  zonesForRegion,
} from "@keylearn/intl";
import { booleanProp, stringProp } from "@keylearn/settings";

/**
 * Account-level preferences. Unlike per-session Practice settings these apply
 * to the whole account; they persist through the same server-synced settings
 * blob (SettingsLoader), so no dedicated columns are needed.
 *
 * Note: storing an email-notification preference records the user's choice;
 * the scheduled job that actually sends reminder emails is a separate feature.
 */
export const accountProps = {
  // Declared in @keylearn/intl, where the date formatters read it, so the
  // settings screen and every date on every page cannot disagree about which
  // key holds the zone. Empty means "follow this device".
  timeZone: dateProps.timeZone,
  // Declared in @keylearn/intl beside the time zone, because the calendars read
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

/**
 * The countries offered, and the zones inside one.
 *
 * This used to hand the runtime's entire IANA list to a single select —
 * four hundred-odd entries, labelled with identifiers like
 * `America/Indiana/Vevay`, sorted by a slash. Almost nobody knows the name
 * of their own zone; they know their country. Two short lists answer a
 * question people can actually answer.
 *
 * It also closes a quieter bug. Everything downstream — the date and time
 * formats, the currency and phone shapes the number drills practise —
 * derives the COUNTRY from the chosen zone. The old list happily offered
 * zones that map to no country, and picking one silently dropped all of
 * that back to guessing from the interface language. Every zone offered
 * here has a country by construction.
 */
export function timeZoneCountries(): readonly string[] {
  return regionsWithZones();
}

/**
 * Zones for one country, with `current` guaranteed present.
 *
 * The guarantee matters for two people: someone whose saved zone predates
 * this list, and someone whose device reports a zone we do not carry.
 * Neither should open this screen and find their own setting missing from
 * it.
 */
export function timeZonesIn(
  country: string,
  current?: string,
): readonly string[] {
  const list = [...zonesForRegion(country)];
  if (current != null && current !== "" && !list.includes(current)) {
    list.unshift(current);
  }
  return list;
}

/**
 * Which country to show selected, given what we know.
 *
 * In order of how much it is worth: the zone they have already chosen,
 * then the country the network reported when they registered, then what
 * their device says, then the region carried by the interface language.
 *
 * The network country comes second rather than first on purpose. It is
 * where the packets surfaced, which a VPN or a corporate proxy answers for
 * them; a saved preference is a decision somebody made. But it beats the
 * device on the day someone lands in a new country with a laptop still set
 * to the old one, and it is the only signal available at registration.
 */
export function countryForTimeZone(
  saved: string,
  signupCountry?: string | null,
  locale?: string,
): string {
  const known = new Set(regionsWithZones());
  const fromSaved = saved === "" ? null : regionOfTimeZone(saved);
  const fromNetwork = (signupCountry ?? "").trim().toUpperCase() || null;
  const fromDevice = regionOfTimeZone(deviceTimeZone());
  const fromLocale = (locale ?? "").split(/[-_]/)[1]?.toUpperCase() ?? null;
  for (const guess of [fromSaved, fromNetwork, fromDevice, fromLocale]) {
    if (guess != null && known.has(guess)) {
      return guess;
    }
  }
  return "US";
}
