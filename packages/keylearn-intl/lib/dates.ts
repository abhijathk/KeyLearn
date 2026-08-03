import { stringProp, useSettings } from "@keylearn/settings";
import { useIntl } from "react-intl";

/**
 * Dates and times, in the reader's own terms.
 *
 * Two settings decide how a timestamp is shown, and they are not the same
 * thing:
 *
 *   - the **locale** decides the order and the separators, so the same day is
 *     `02/08/2026` in Australia and `8/2/2026` in the United States;
 *   - the **time zone** decides which day it even is. A session finished at
 *     23:30 in Sydney happened on the previous date in London, and a reader in
 *     London should see it that way.
 *
 * Before this, every date in the app was formatted in whatever zone the device
 * happened to be in, and the account's time zone preference — which the
 * settings screen has always offered — was stored and then never read.
 */

/**
 * Where the account's time zone lives.
 *
 * Declared here rather than in the account page so that anything showing a
 * date can read it without depending on the account screens. An empty value
 * means "follow this device", which is the right default and the one nobody
 * has to think about.
 */
export const dateProps = {
  timeZone: stringProp("account.timeZone", "", { maxLength: 64 }),
  /**
   * "mon", "sun", or empty to follow the locale.
   *
   * Empty is the default because the right answer is regional and the runtime
   * already knows it: Monday across most of Europe and Australia, Sunday in
   * the United States, Canada and Japan, Saturday in much of the Middle East.
   * Pinning it is for the reader whose habit differs from their region's.
   */
  weekStart: stringProp("account.weekStart", "", { maxLength: 3 }),
} as const;

/** The device's IANA zone, e.g. "Australia/Sydney". */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export type IntlDates = {
  /** The zone every method below resolves against. */
  readonly timeZone: string;
  /** `02/08/2026` or `8/2/2026`, whichever this locale writes. */
  formatDate(value: Date | number, style?: DateStyle): string;
  /** `2:32 pm`, or `14:32` where the locale uses a 24-hour clock. */
  formatTime(value: Date | number, style?: TimeStyle): string;
  /** Both, in the order the locale puts them. */
  formatDateTime(value: Date | number, style?: DateStyle): string;
  /** The month alone, for a chart axis. */
  formatMonth(value: Date | number, style?: "short" | "long"): string;
  /**
   * `2026-08-02`, in the account's zone.
   *
   * Not for showing to anyone — this is the sortable form, for grouping
   * results into days and for anything that has to compare two dates as
   * strings.
   */
  formatIsoDate(value: Date | number): string;
  /**
   * The date and time as a filename may hold them: the locale's own order,
   * with dashes, and no separator a filesystem would object to.
   */
  formatStamp(value: Date | number): string;
  /**
   * Anything the four named forms do not cover — a weekday with a month and
   * no year, say. The zone is merged in, which is the whole reason to come
   * through here rather than calling Intl directly.
   */
  format(value: Date | number, options: Intl.DateTimeFormatOptions): string;
  /**
   * Which day a week begins on, as an ISO number: 1 is Monday, 7 is Sunday.
   *
   * From the account's setting where one is pinned, and from the locale
   * otherwise — so a calendar starts on Monday in Sydney and on Sunday in
   * Chicago without anyone choosing.
   */
  readonly firstDayOfWeek: number;
  /**
   * The seven weekday names in this reader's week order, starting from
   * `firstDayOfWeek`, in their own language.
   */
  weekDayNames(style?: "narrow" | "short" | "long"): readonly string[];
};

export type DateStyle = "full" | "long" | "medium" | "short";
export type TimeStyle = "medium" | "short";

/**
 * Date formatting bound to the account's locale and time zone.
 *
 * A hook rather than a plain function because both come from React context,
 * and the formatters are rebuilt only when one of them actually changes —
 * `Intl.DateTimeFormat` is expensive enough to be worth not constructing on
 * every render.
 */
export function useIntlDates(): IntlDates {
  const intl = useIntl();
  const { settings } = useSettings();
  const timeZone = settings.get(dateProps.timeZone) || deviceTimeZone();
  const weekStart = settings.get(dateProps.weekStart);
  return intlDates(intl.locale, timeZone, weekStart);
}

const cache = new Map<string, IntlDates>();

/**
 * The formatters for one locale, zone and week start, without React.
 *
 * Exported so the behaviour can be tested against fixed values — the
 * assertions must not depend on the machine the suite runs on.
 */
export function intlDates(
  locale: string,
  timeZone: string,
  weekStart = "",
): IntlDates {
  const key = `${locale} ${timeZone} ${weekStart}`;
  const hit = cache.get(key);
  if (hit != null) {
    return hit;
  }

  // A zone the runtime rejects would otherwise throw on every render, so an
  // unknown one falls back to the device rather than taking the page down.
  const zone = usable(timeZone) ? timeZone : deviceTimeZone();
  const of = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: zone });

  const dates = new Map<string, Intl.DateTimeFormat>();
  const formatter = (options: Intl.DateTimeFormatOptions, id: string) => {
    let f = dates.get(id);
    if (f == null) {
      f = of(options);
      dates.set(id, f);
    }
    return f;
  };

  // Numeric parts in the account's zone, which is what the ISO and filename
  // forms are built from. Going through a formatter rather than the Date
  // getters is the whole point: the getters only know the device.
  //
  // Deliberately not the reader's locale. Arabic writes its digits as ٢٠٢٦
  // and Thai defaults to the Buddhist era, so an id or a filename built from
  // the reader's own numerals would neither sort nor round-trip. The order
  // these parts are arranged in still follows the locale — see formatStamp;
  // it is only the digits and the calendar that are pinned.
  const numeric = new Intl.DateTimeFormat("en-u-ca-gregory-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zone,
  });
  const partsOf = (value: Date | number) => {
    const parts = numeric.formatToParts(value);
    const find = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";
    return {
      year: find("year"),
      month: find("month"),
      day: find("day"),
      // Some locales render midnight as "24" under hour12: false.
      hour: find("hour").replace(/^24$/, "00"),
      minute: find("minute"),
    };
  };

  const firstDay = resolveFirstDay(locale, weekStart);

  const value: IntlDates = {
    timeZone: zone,
    formatDate: (value, style = "medium") =>
      formatter({ dateStyle: style }, `d:${style}`).format(value),
    formatTime: (value, style = "short") =>
      formatter({ timeStyle: style }, `t:${style}`).format(value),
    formatDateTime: (value, style = "medium") =>
      formatter({ dateStyle: style, timeStyle: "short" }, `dt:${style}`).format(
        value,
      ),
    formatMonth: (value, style = "short") =>
      formatter({ month: style }, `m:${style}`).format(value),
    formatIsoDate: (value) => {
      const { year, month, day } = partsOf(value);
      return `${year}-${month}-${day}`;
    },
    format: (value, options) =>
      formatter(options, `c:${JSON.stringify(options)}`).format(value),
    firstDayOfWeek: firstDay,
    weekDayNames: (style = "narrow") => {
      const names = formatter({ weekday: style }, `w:${style}`);
      // 4 January 1970 was a Sunday, so this walks one whole week from a
      // known anchor rather than depending on today.
      const sunday = Date.UTC(1970, 0, 4);
      return Array.from({ length: 7 }, (_, i) =>
        names.format(sunday + ((firstDay % 7) + i) * 86_400_000),
      );
    },
    formatStamp: (value) => {
      const { year, month, day, hour, minute } = partsOf(value);
      // The locale's own order, so an Australian reader gets 02-08-2026 and
      // an American 08-02-2026 — matching every other date they are shown.
      const order = dateOrder(locale);
      const ymd = order
        .map((part) => (part === "y" ? year : part === "m" ? month : day))
        .join("-");
      return `${ymd}-${hour}${minute}`;
    },
  };
  cache.set(key, value);
  return value;
}

/**
 * Which of year, month and day this locale writes first.
 *
 * Read out of the formatter rather than from a table of countries, so it is
 * right for every locale the runtime knows and stays right when the runtime's
 * data is updated.
 */
function dateOrder(locale: string): readonly ("y" | "m" | "d")[] {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(Date.UTC(2026, 7, 2));
    const order = parts
      .filter(
        (part) =>
          part.type === "year" || part.type === "month" || part.type === "day",
      )
      .map((part) => part.type.charAt(0) as "y" | "m" | "d");
    return order.length === 3 ? order : ["y", "m", "d"];
  } catch {
    return ["y", "m", "d"];
  }
}

/**
 * The first day of the week, 1 (Monday) to 7 (Sunday).
 *
 * An explicit setting wins. Failing that the locale is asked — `getWeekInfo`
 * is the standard answer and carries the regional convention, so nobody in
 * Chicago has to discover a setting to stop their calendar starting on Monday.
 */
function resolveFirstDay(locale: string, weekStart: string): number {
  if (weekStart === "mon") {
    return 1;
  }
  if (weekStart === "sun") {
    return 7;
  }
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    // getWeekInfo is the method form; some runtimes still expose the property.
    const first = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    if (typeof first === "number" && first >= 1 && first <= 7) {
      return first;
    }
  } catch {
    // Falls through to the ISO default below.
  }
  return 1;
}

function usable(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}
