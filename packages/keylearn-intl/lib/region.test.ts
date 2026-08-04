import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import {
  coveredRegions,
  formatsForTimeZone,
  formattingLocale,
  regionFormats,
  regionOfTimeZone,
} from "./region.ts";

test("a time zone names the country", () => {
  equal(regionOfTimeZone("Australia/Sydney"), "AU");
  equal(regionOfTimeZone("America/New_York"), "US");
  equal(regionOfTimeZone("Asia/Kolkata"), "IN");
  equal(regionOfTimeZone("Europe/Berlin"), "DE");
  equal(regionOfTimeZone("Asia/Calcutta"), "IN", "the old spelling too");
  equal(regionOfTimeZone("Europe/Kiev"), "UA", "and the old spelling of Kyiv");
});

test("an unmapped zone admits it rather than guessing", () => {
  // Better to fall through to the locale hint than to claim a country.
  equal(regionOfTimeZone("Antarctica/Troll"), null);
  equal(regionOfTimeZone(""), null);
});

test("the language stays the language; the zone supplies the country", () => {
  // A family in Sydney may read the app in any language, and none of those
  // implies Australian dates — so the two are combined, not confused.
  equal(formattingLocale("en", "Australia/Sydney"), "en-AU");
  equal(formattingLocale("en", "America/Chicago"), "en-US");
  equal(formattingLocale("de", "Australia/Sydney"), "de-AU");
  equal(formattingLocale("hi", "Asia/Kolkata"), "hi-IN");
});

test("a locale's own region is the fallback, and is overridden by the zone", () => {
  equal(formattingLocale("pt-BR", "Antarctica/Troll"), "pt-BR", "kept");
  equal(formattingLocale("pt-BR", "Europe/Lisbon"), "pt-PT", "zone wins");
});

test("nothing known leaves the locale untouched", () => {
  // Never worse than before: the runtime falls back to its own default.
  equal(formattingLocale("en", "Antarctica/Troll"), "en");
  equal(formattingLocale("", "Australia/Sydney"), "");
});

test("dates are ordered the way each country writes them", () => {
  equal(regionFormats("US").dateOrder, "MDY");
  equal(regionFormats("GB").dateOrder, "DMY");
  equal(regionFormats("JP").dateOrder, "YMD");
  equal(regionFormats("DE").dateSep, ".", "Germany writes 07.08.2026");
  equal(regionFormats("SE").dateSep, "-", "Sweden writes 2026-08-07");
});

test("money sits on the side the country puts it", () => {
  const us = regionFormats("US");
  isTrue(us.currencyBefore);
  equal(us.currencySymbol, "$");

  const de = regionFormats("DE");
  isTrue(!de.currencyBefore, "Germany writes 1.234,56 €");
  equal(de.groupSep, ".");
  equal(de.decimalSep, ",");
});

test("South Asian grouping is its own thing", () => {
  // 12,34,567 rather than 1,234,567 — a shape typed constantly in India and
  // never met in a drill grouped the other way.
  isTrue(regionFormats("IN").southAsianGrouping);
  isTrue(!regionFormats("US").southAsianGrouping);
});

test("the clock is 12-hour only where it is read that way", () => {
  isTrue(regionFormats("US").hour12);
  isTrue(regionFormats("AU").hour12);
  isTrue(!regionFormats("DE").hour12);
  isTrue(!regionFormats("FR").hour12);
});

test("an unknown country gets unambiguous, not wrong", () => {
  // Showing a learner in an uncovered country another country's conventions
  // would be worse than showing them ISO order.
  const neutral = regionFormats(null);
  equal(neutral.region, "");
  equal(neutral.dateOrder, "YMD");
  isTrue(!neutral.hour12);
  equal(regionFormats("ZZ").region, "", "and so does a nonsense code");
});

test("the zone route and the region route agree", () => {
  equal(formatsForTimeZone("Asia/Tokyo").region, "JP");
  equal(formatsForTimeZone("Antarctica/Troll", "en-GB").region, "GB");
  equal(formatsForTimeZone("Antarctica/Troll").region, "");
});

test("every covered country is internally consistent", () => {
  // A table this size is where a typo hides: a phone pattern with no digits,
  // a separator that is also the decimal mark, a missing symbol.
  for (const region of coveredRegions()) {
    const f = regionFormats(region);
    equal(f.region, region);
    isTrue(f.phonePattern.includes("#"), `${region} phone has no digits`);
    isTrue(f.currencySymbol !== "", `${region} has no currency symbol`);
    isTrue(f.decimalSep !== "", `${region} has no decimal separator`);
    isTrue(
      f.groupSep !== f.decimalSep,
      `${region} groups and decimalises with the same character`,
    );
    isTrue(
      ["DMY", "MDY", "YMD"].includes(f.dateOrder),
      `${region} has no date order`,
    );
  }
});
