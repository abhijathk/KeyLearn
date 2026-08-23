/**
 * Which country a learner is in, and how that country writes things down.
 *
 * The account already stores an IANA time zone, and until now it only decided
 * when a day rolled over. But a time zone names a *place*, and a place is the
 * only thing in the app that knows whether "07/08" is July the eighth or the
 * seventh of August, whether a price is "$1,234.56" or "1.234,56 €", and what
 * a phone number looks like when somebody writes one down.
 *
 * The interface language cannot answer that. A family in Sydney may well read
 * the app in English, German or Hindi, and none of those implies Australian
 * dates. So the region comes from the zone, and the language stays the
 * language.
 */

/**
 * IANA zone to ISO 3166-1 country.
 *
 * Only the zones people actually select — a few hundred exist and most name a
 * town of nine hundred people. Anything absent falls back through
 * {@link formattingLocale} to the interface language's own region, which is
 * the next best guess available.
 */
const ZONE_REGION: Readonly<Record<string, string>> = {
  // Americas
  "America/New_York": "US",
  "America/Detroit": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Winnipeg": "CA",
  "America/Edmonton": "CA",
  "America/Vancouver": "CA",
  "America/Halifax": "CA",
  "America/St_Johns": "CA",
  "America/Mexico_City": "MX",
  "America/Monterrey": "MX",
  "America/Tijuana": "MX",
  "America/Cancun": "MX",
  "America/Sao_Paulo": "BR",
  "America/Bahia": "BR",
  "America/Fortaleza": "BR",
  "America/Recife": "BR",
  "America/Manaus": "BR",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Santiago": "CL",
  "America/Bogota": "CO",
  "America/Lima": "PE",
  // Europe
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Lisbon": "PT",
  "Europe/Madrid": "ES",
  "Europe/Paris": "FR",
  "Europe/Brussels": "BE",
  "Europe/Amsterdam": "NL",
  "Europe/Berlin": "DE",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Rome": "IT",
  "Europe/Copenhagen": "DK",
  "Europe/Oslo": "NO",
  "Europe/Stockholm": "SE",
  "Europe/Helsinki": "FI",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Budapest": "HU",
  "Europe/Bucharest": "RO",
  "Europe/Athens": "GR",
  "Europe/Kyiv": "UA",
  "Europe/Kiev": "UA",
  "Europe/Moscow": "RU",
  "Europe/Kaliningrad": "RU",
  "Europe/Samara": "RU",
  "Asia/Yekaterinburg": "RU",
  "Asia/Novosibirsk": "RU",
  "Asia/Vladivostok": "RU",
  "Europe/Istanbul": "TR",
  // Asia
  "Asia/Jerusalem": "IL",
  "Asia/Tel_Aviv": "IL",
  "Asia/Riyadh": "SA",
  "Asia/Dubai": "AE",
  "Asia/Tehran": "IR",
  "Asia/Karachi": "PK",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Kathmandu": "NP",
  "Asia/Colombo": "LK",
  "Asia/Dhaka": "BD",
  "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Saigon": "VN",
  "Asia/Jakarta": "ID",
  "Asia/Makassar": "ID",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Singapore": "SG",
  "Asia/Manila": "PH",
  "Asia/Hong_Kong": "HK",
  "Asia/Taipei": "TW",
  "Asia/Shanghai": "CN",
  "Asia/Chongqing": "CN",
  "Asia/Urumqi": "CN",
  "Asia/Seoul": "KR",
  "Asia/Tokyo": "JP",
  // Africa
  "Africa/Casablanca": "MA",
  "Africa/Lagos": "NG",
  "Africa/Cairo": "EG",
  "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA",
  // Oceania
  "Australia/Perth": "AU",
  "Australia/Darwin": "AU",
  "Australia/Adelaide": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Hobart": "AU",
  "Pacific/Auckland": "NZ",
  "Pacific/Fiji": "FJ",
};

/** The country a time zone names, or null when we do not have it mapped. */
export function regionOfTimeZone(timeZone: string): string | null {
  return ZONE_REGION[timeZone.trim()] ?? null;
}

/**
 * Every country this table names, for a picker that asks for the country
 * first.
 *
 * Asking "which of four hundred IANA identifiers are you?" is a question
 * almost nobody can answer — a person in Perth is looking for Australia,
 * not for the string `Australia/Perth`, and someone in Ohio has no reason
 * to know their zone is called `America/New_York`. Country first turns one
 * impossible list into two short ones.
 *
 * Deliberately built from this table rather than from the runtime's full
 * zone list: an unmapped zone formats worse anyway, because everything
 * below keys off the country.
 */
export function regionsWithZones(): readonly string[] {
  return [...new Set(Object.values(ZONE_REGION))].sort();
}

/**
 * The zones this table holds for one country, in the order they are
 * written above — which is roughly by population, so the first is the
 * right default for most people who live there.
 */
export function zonesForRegion(region: string): readonly string[] {
  const want = region.trim().toUpperCase();
  return Object.keys(ZONE_REGION).filter((zone) => ZONE_REGION[zone] === want);
}

/** The region already written into a locale tag, e.g. "pt-BR" → "BR". */
function regionOfLocale(locale: string): string | null {
  const part = locale.split(/[-_]/)[1];
  return part != null && /^[A-Za-z]{2}$/.test(part) ? part.toUpperCase() : null;
}

/**
 * The locale to format dates, times and numbers with.
 *
 * The learner's language, spoken in the learner's country: an English page in
 * Sydney formats as `en-AU`, the same page in Chicago as `en-US`. Where the
 * zone is one we have not mapped, any region already carried by the interface
 * locale is kept, and failing that the locale is returned untouched so the
 * runtime falls back to its own default — never worse than before.
 */
export function formattingLocale(uiLocale: string, timeZone: string): string {
  const language = uiLocale.split(/[-_]/)[0];
  if (language === "") {
    return uiLocale;
  }
  const region = regionOfTimeZone(timeZone) ?? regionOfLocale(uiLocale);
  return region != null ? `${language}-${region}` : uiLocale;
}

/** How one country writes down the things a number drill asks for. */
export type RegionFormats = {
  /** ISO country, or "" for the neutral fallback. */
  readonly region: string;
  readonly dateOrder: "DMY" | "MDY" | "YMD";
  readonly dateSep: string;
  /** True where a wall clock is read as 1–12 with am/pm. */
  readonly hour12: boolean;
  readonly currencySymbol: string;
  /** False where the symbol trails the amount, as most of Europe writes it. */
  readonly currencyBefore: boolean;
  readonly groupSep: string;
  readonly decimalSep: string;
  /**
   * South Asian grouping: the last three digits, then twos — 12,34,567 rather
   * than 1,234,567. Wrong often enough to be worth its own flag.
   */
  readonly southAsianGrouping: boolean;
  /** A phone number shape, `#` standing for a digit. */
  readonly phonePattern: string;
};

/**
 * The neutral fallback: ISO-ordered dates, a 24-hour clock, and no currency
 * claimed. Used when the zone is unmapped and the locale carries no region —
 * it is nobody's local convention, but it is unambiguous, which is the right
 * property for "we do not know".
 */
const NEUTRAL: RegionFormats = {
  region: "",
  dateOrder: "YMD",
  dateSep: "-",
  hour12: false,
  currencySymbol: "$",
  currencyBefore: true,
  groupSep: ",",
  decimalSep: ".",
  southAsianGrouping: false,
  phonePattern: "### ### ####",
};

function make(
  region: string,
  over: Partial<Omit<RegionFormats, "region">>,
): RegionFormats {
  return { ...NEUTRAL, ...over, region };
}

// Common shapes, named so the table below reads as data rather than repetition.
const DMY_SLASH = { dateOrder: "DMY", dateSep: "/" } as const;
const DMY_DOT = { dateOrder: "DMY", dateSep: "." } as const;
const MDY_SLASH = { dateOrder: "MDY", dateSep: "/" } as const;
/** Most of the euro area and the Nordics: symbol after, comma for decimals. */
const EURO_TRAILING = {
  currencySymbol: "€",
  currencyBefore: false,
  decimalSep: ",",
} as const;

const REGIONS: Readonly<Record<string, RegionFormats>> = {
  US: make("US", {
    ...MDY_SLASH,
    hour12: true,
    phonePattern: "(###) ###-####",
  }),
  CA: make("CA", {
    ...MDY_SLASH,
    hour12: true,
    phonePattern: "(###) ###-####",
  }),
  GB: make("GB", {
    ...DMY_SLASH,
    currencySymbol: "£",
    phonePattern: "0#### ######",
  }),
  // Ireland takes the euro but keeps British punctuation: €1,234.56, symbol
  // leading — so it is spelled out rather than built from EURO_TRAILING.
  IE: make("IE", {
    ...DMY_SLASH,
    currencySymbol: "€",
    phonePattern: "0## ### ####",
  }),
  AU: make("AU", { ...DMY_SLASH, hour12: true, phonePattern: "0### ### ###" }),
  NZ: make("NZ", { ...DMY_SLASH, hour12: true, phonePattern: "0## ### ####" }),
  IN: make("IN", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "₹",
    southAsianGrouping: true,
    phonePattern: "##### #####",
  }),
  PK: make("PK", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "Rs",
    southAsianGrouping: true,
    phonePattern: "0### #######",
  }),
  BD: make("BD", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "৳",
    southAsianGrouping: true,
    phonePattern: "0#### ######",
  }),
  LK: make("LK", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "Rs",
    southAsianGrouping: true,
    phonePattern: "0## ### ####",
  }),
  NP: make("NP", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "Rs",
    southAsianGrouping: true,
    phonePattern: "0##-#######",
  }),
  DE: make("DE", {
    ...DMY_DOT,
    ...EURO_TRAILING,
    groupSep: ".",
    phonePattern: "0### ########",
  }),
  AT: make("AT", {
    ...DMY_DOT,
    ...EURO_TRAILING,
    groupSep: ".",
    phonePattern: "0### ######",
  }),
  CH: make("CH", {
    ...DMY_DOT,
    currencySymbol: "CHF",
    groupSep: "'",
    phonePattern: "0## ### ## ##",
  }),
  FR: make("FR", {
    ...DMY_SLASH,
    ...EURO_TRAILING,
    groupSep: " ",
    phonePattern: "0# ## ## ## ##",
  }),
  BE: make("BE", {
    ...DMY_SLASH,
    ...EURO_TRAILING,
    groupSep: ".",
    phonePattern: "0### ## ## ##",
  }),
  NL: make("NL", {
    dateOrder: "DMY",
    dateSep: "-",
    ...EURO_TRAILING,
    currencyBefore: true,
    groupSep: ".",
    phonePattern: "06 ########",
  }),
  ES: make("ES", {
    ...DMY_SLASH,
    ...EURO_TRAILING,
    groupSep: ".",
    phonePattern: "### ## ## ##",
  }),
  IT: make("IT", {
    ...DMY_SLASH,
    ...EURO_TRAILING,
    groupSep: ".",
    phonePattern: "3## ### ####",
  }),
  PT: make("PT", {
    ...DMY_SLASH,
    ...EURO_TRAILING,
    groupSep: " ",
    phonePattern: "9## ### ###",
  }),
  GR: make("GR", {
    ...DMY_SLASH,
    ...EURO_TRAILING,
    groupSep: ".",
    phonePattern: "69# ### ####",
  }),
  DK: make("DK", {
    ...DMY_DOT,
    currencySymbol: "kr",
    currencyBefore: false,
    groupSep: ".",
    decimalSep: ",",
    phonePattern: "## ## ## ##",
  }),
  NO: make("NO", {
    ...DMY_DOT,
    currencySymbol: "kr",
    currencyBefore: false,
    groupSep: " ",
    decimalSep: ",",
    phonePattern: "### ## ###",
  }),
  SE: make("SE", {
    dateOrder: "YMD",
    dateSep: "-",
    currencySymbol: "kr",
    currencyBefore: false,
    groupSep: " ",
    decimalSep: ",",
    phonePattern: "0##-### ## ##",
  }),
  FI: make("FI", {
    ...DMY_DOT,
    ...EURO_TRAILING,
    groupSep: " ",
    phonePattern: "0## ### ####",
  }),
  PL: make("PL", {
    ...DMY_DOT,
    currencySymbol: "zł",
    currencyBefore: false,
    groupSep: " ",
    decimalSep: ",",
    phonePattern: "### ### ###",
  }),
  CZ: make("CZ", {
    ...DMY_DOT,
    currencySymbol: "Kč",
    currencyBefore: false,
    groupSep: " ",
    decimalSep: ",",
    phonePattern: "### ### ###",
  }),
  HU: make("HU", {
    dateOrder: "YMD",
    dateSep: ".",
    currencySymbol: "Ft",
    currencyBefore: false,
    groupSep: " ",
    decimalSep: ",",
    phonePattern: "0## ### ####",
  }),
  RO: make("RO", {
    ...DMY_DOT,
    currencySymbol: "lei",
    currencyBefore: false,
    groupSep: ".",
    decimalSep: ",",
    phonePattern: "07## ### ###",
  }),
  UA: make("UA", {
    ...DMY_DOT,
    currencySymbol: "₴",
    currencyBefore: false,
    groupSep: " ",
    decimalSep: ",",
    phonePattern: "0## ### ## ##",
  }),
  RU: make("RU", {
    ...DMY_DOT,
    currencySymbol: "₽",
    currencyBefore: false,
    groupSep: " ",
    decimalSep: ",",
    phonePattern: "8 (###) ###-##-##",
  }),
  TR: make("TR", {
    ...DMY_DOT,
    currencySymbol: "₺",
    groupSep: ".",
    decimalSep: ",",
    phonePattern: "0### ### ## ##",
  }),
  IL: make("IL", {
    ...DMY_SLASH,
    currencySymbol: "₪",
    phonePattern: "0##-###-####",
  }),
  SA: make("SA", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "SR",
    phonePattern: "05# ### ####",
  }),
  AE: make("AE", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "AED",
    phonePattern: "05# ### ####",
  }),
  IR: make("IR", {
    dateOrder: "YMD",
    dateSep: "/",
    currencySymbol: "﷼",
    currencyBefore: false,
    phonePattern: "0### ### ####",
  }),
  EG: make("EG", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "E£",
    phonePattern: "01## ### ####",
  }),
  MA: make("MA", {
    ...DMY_SLASH,
    currencySymbol: "DH",
    currencyBefore: false,
    phonePattern: "06## ## ## ##",
  }),
  NG: make("NG", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "₦",
    phonePattern: "0### ### ####",
  }),
  KE: make("KE", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "KSh",
    phonePattern: "07## ######",
  }),
  ZA: make("ZA", {
    dateOrder: "YMD",
    dateSep: "/",
    currencySymbol: "R",
    groupSep: " ",
    decimalSep: ",",
    phonePattern: "0## ### ####",
  }),
  CN: make("CN", {
    dateOrder: "YMD",
    dateSep: "/",
    currencySymbol: "¥",
    phonePattern: "### #### ####",
  }),
  HK: make("HK", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "HK$",
    phonePattern: "#### ####",
  }),
  TW: make("TW", {
    dateOrder: "YMD",
    dateSep: "/",
    hour12: true,
    currencySymbol: "NT$",
    phonePattern: "09##-###-###",
  }),
  JP: make("JP", {
    dateOrder: "YMD",
    dateSep: "/",
    currencySymbol: "¥",
    phonePattern: "0##-####-####",
  }),
  KR: make("KR", {
    dateOrder: "YMD",
    dateSep: ".",
    hour12: true,
    currencySymbol: "₩",
    phonePattern: "0##-####-####",
  }),
  SG: make("SG", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "S$",
    phonePattern: "#### ####",
  }),
  MY: make("MY", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "RM",
    phonePattern: "0##-### ####",
  }),
  TH: make("TH", {
    ...DMY_SLASH,
    currencySymbol: "฿",
    phonePattern: "0##-###-####",
  }),
  VN: make("VN", {
    ...DMY_SLASH,
    currencySymbol: "₫",
    currencyBefore: false,
    groupSep: ".",
    decimalSep: ",",
    phonePattern: "0## ### ## ##",
  }),
  ID: make("ID", {
    ...DMY_SLASH,
    currencySymbol: "Rp",
    groupSep: ".",
    decimalSep: ",",
    phonePattern: "08##-####-####",
  }),
  PH: make("PH", {
    ...MDY_SLASH,
    hour12: true,
    currencySymbol: "₱",
    phonePattern: "09## ### ####",
  }),
  MX: make("MX", { ...DMY_SLASH, hour12: true, phonePattern: "## #### ####" }),
  BR: make("BR", {
    ...DMY_SLASH,
    currencySymbol: "R$",
    groupSep: ".",
    decimalSep: ",",
    phonePattern: "(##) #####-####",
  }),
  AR: make("AR", {
    ...DMY_SLASH,
    groupSep: ".",
    decimalSep: ",",
    phonePattern: "## ####-####",
  }),
  CL: make("CL", {
    ...DMY_SLASH,
    groupSep: ".",
    decimalSep: ",",
    phonePattern: "# #### ####",
  }),
  CO: make("CO", {
    ...DMY_SLASH,
    hour12: true,
    groupSep: ".",
    decimalSep: ",",
    phonePattern: "### ### ####",
  }),
  PE: make("PE", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "S/",
    phonePattern: "### ### ###",
  }),
  FJ: make("FJ", {
    ...DMY_SLASH,
    hour12: true,
    currencySymbol: "FJ$",
    phonePattern: "### ####",
  }),
};

/**
 * How this country writes dates, money and phone numbers.
 *
 * An unmapped region gets {@link NEUTRAL} rather than an arbitrary stand-in:
 * showing a learner in an uncovered country the wrong country's conventions
 * would be worse than showing them unambiguous ones.
 */
export function regionFormats(region: string | null): RegionFormats {
  if (region == null) {
    return NEUTRAL;
  }
  return REGIONS[region.toUpperCase()] ?? NEUTRAL;
}

/** The conventions for a time zone, with the locale as the fallback hint. */
export function formatsForTimeZone(
  timeZone: string,
  uiLocale = "",
): RegionFormats {
  return regionFormats(
    regionOfTimeZone(timeZone) ?? (uiLocale ? regionOfLocale(uiLocale) : null),
  );
}

/** Every country the drill can imitate — for tests and for the settings copy. */
export function coveredRegions(): readonly string[] {
  return Object.keys(REGIONS);
}
