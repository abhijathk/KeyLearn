import {
  dateProps,
  deviceTimeZone,
  formatsForTimeZone,
  type RegionFormats,
} from "@keylearn/intl";
import { type Keyboard } from "@keylearn/keyboard";
import { Letter, type PhoneticModel } from "@keylearn/phonetic-model";
import {
  randomSample,
  type RNGStream,
  weightedRandomSample,
} from "@keylearn/rand";
import { type KeyStatsMap } from "@keylearn/result";
import { type Settings } from "@keylearn/settings";
import { LessonKeys } from "./key.ts";
import { Lesson } from "./lesson.ts";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";

/**
 * One shape numbers take in the world.
 *
 * Every shape is written the way the learner's own country writes it: the
 * account's time zone names a place, and the place decides whether a date
 * reads 07/08 or 08/07, which side the currency symbol sits on, and what a
 * phone number looks like. Drilling a learner in Berlin on "(555) 867-5309"
 * teaches a shape they will never type.
 *
 * `needs` lists every non-digit character the shape can emit for this
 * country — a layout that cannot type one of them drops the whole shape
 * rather than serving untypeable text.
 */
type NumberFormat = {
  readonly id: string;
  readonly needs: (f: RegionFormats) => string;
  readonly next: (
    lesson: NumbersLesson,
    rng: RNGStream,
    f: RegionFormats,
  ) => string;
};

const int = (rng: RNGStream, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1));

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Thousands separators in this country's style.
 *
 * Most of the world groups in threes; South Asia groups the last three and
 * then twos, so 1234567 is written 12,34,567 — a shape a learner there types
 * constantly and would never meet in a drill grouped the other way.
 */
function grouped(n: number, f: RegionFormats): string {
  const digits = String(n);
  if (f.groupSep === "") {
    return digits;
  }
  if (f.southAsianGrouping && digits.length > 3) {
    const last = digits.slice(-3);
    const rest = digits
      .slice(0, -3)
      .replace(/\B(?=(\d{2})+(?!\d))/g, f.groupSep);
    return `${rest}${f.groupSep}${last}`;
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, f.groupSep);
}

/** A date in this country's order and separator. */
function dateIn(f: RegionFormats, rng: RNGStream): string {
  const d = pad(int(rng, 1, 28));
  const m = pad(int(rng, 1, 12));
  const y = String(int(rng, 1950, 2035));
  const parts =
    f.dateOrder === "MDY"
      ? [m, d, y]
      : f.dateOrder === "YMD"
        ? [y, m, d]
        : [d, m, y];
  return parts.join(f.dateSep);
}

/** A wall clock as this country reads one. */
function timeIn(f: RegionFormats, rng: RNGStream): string {
  if (f.hour12) {
    const h = int(rng, 1, 12);
    const suffix = rng() < 0.5 ? "am" : "pm";
    return `${h}:${pad(int(rng, 0, 59))} ${suffix}`;
  }
  const base = `${pad(int(rng, 0, 23))}:${pad(int(rng, 0, 59))}`;
  // Seconds sometimes, so the shape does not become a rubber stamp.
  return rng() < 0.3 ? `${base}:${pad(int(rng, 0, 59))}` : base;
}

/** Money with this country's symbol, on the side it actually goes. */
function moneyIn(f: RegionFormats, rng: RNGStream): string {
  const kind = rng();
  let amount: string;
  if (kind < 0.4) {
    // Price-tag money.
    amount = `${int(rng, 1, 199)}${f.decimalSep}${pad(int(rng, 0, 99))}`;
  } else if (kind < 0.8) {
    // Invoice money. The range runs past a million on purpose: below seven
    // digits every grouping system agrees, so a smaller ceiling would never
    // once show a South Asian learner the 12,34,567 shape this drill exists
    // to teach them.
    amount = `${grouped(int(rng, 1000, 9_999_999), f)}${f.decimalSep}${pad(int(rng, 0, 99))}`;
  } else {
    // Round money.
    amount = grouped(int(rng, 10, 9999), f);
  }
  if (f.currencySymbol === "") {
    return amount;
  }
  return f.currencyBefore
    ? `${f.currencySymbol}${amount}`
    : `${amount} ${f.currencySymbol}`;
}

/** A phone number, digits poured into this country's shape. */
function phoneIn(f: RegionFormats, rng: RNGStream): string {
  let out = "";
  for (const ch of f.phonePattern) {
    // A leading zero is part of the shape, so only interior digits are free
    // to be anything — otherwise half the numbers start 0 by accident.
    out += ch === "#" ? String(int(rng, 0, 9)) : ch;
  }
  return out;
}

/** Every non-digit character a shape can emit, for the typeability check. */
function charsOf(text: string): string {
  return [...new Set(text.replace(/[0-9#]/g, ""))].join("");
}

const FORMATS: readonly NumberFormat[] = [
  {
    id: "plain",
    needs: () => "",
    next: (lesson, rng) => lesson.plainDigits(rng),
  },
  {
    id: "dates",
    needs: (f) => f.dateSep,
    next: (_, rng, f) => dateIn(f, rng),
  },
  {
    id: "times",
    // A 12-hour country needs the letters of "am"/"pm" as well as the colon.
    needs: (f) => (f.hour12 ? ": amp" : ":"),
    next: (_, rng, f) => timeIn(f, rng),
  },
  {
    // The symbol is resolved against the keyboard before we get here (see
    // `#typeableMoney`), so only the separators can still rule this out.
    id: "currency",
    needs: (f) => charsOf(f.currencySymbol + f.groupSep + f.decimalSep + " "),
    next: (_, rng, f) => moneyIn(f, rng),
  },
  {
    id: "phone",
    needs: (f) => charsOf(f.phonePattern),
    next: (_, rng, f) => phoneIn(f, rng),
  },
];

export class NumbersLesson extends Lesson {
  /** The shapes this lesson serves: chosen in settings AND typeable here. */
  readonly formats: readonly NumberFormat[];
  /** How the learner's own country writes dates, money and phone numbers. */
  readonly regionFormats: RegionFormats;

  constructor(settings: Settings, keyboard: Keyboard, model: PhoneticModel) {
    super(settings, keyboard, model);
    // The account's time zone names the place; an unset one means "follow this
    // device", which is what every other date in the app does too.
    const timeZone = settings.get(dateProps.timeZone) || deviceTimeZone();
    this.regionFormats = this.#typeableMoney(formatsForTimeZone(timeZone));
    const f = this.regionFormats;
    const chosen = new Set(settings.get(lessonProps.numbers.formats));
    const typeable = FORMATS.filter(
      (format) =>
        chosen.has(format.id) &&
        [...format.needs(f)].every((ch) =>
          this.codePoints.has(ch.codePointAt(0)!),
        ),
    );
    // A settings state that leaves nothing (every shape off, or a layout that
    // cannot type this country's punctuation — a Cyrillic layout has no "₹")
    // still has to produce a lesson.
    this.formats = typeable.length > 0 ? typeable : [FORMATS[0]];
  }

  /**
   * The region's conventions, with a currency symbol this keyboard can reach.
   *
   * A US layout has no "€" and no layout here has "₹", and dropping the whole
   * money shape over one glyph would take the grouping and the decimal mark
   * with it — which is the part that actually differs between countries and
   * the part worth drilling. So the symbol degrades and the shape survives:
   * the local one where it can be typed, else a plain "$", else none at all
   * and just the amount.
   */
  #typeableMoney(f: RegionFormats): RegionFormats {
    const canType = (text: string) =>
      [...text].every((ch) => this.codePoints.has(ch.codePointAt(0)!));
    if (canType(f.currencySymbol)) {
      return f;
    }
    if (canType("$")) {
      return { ...f, currencySymbol: "$", currencyBefore: true };
    }
    return { ...f, currencySymbol: "", currencyBefore: true };
  }

  override get letters() {
    return Letter.digits;
  }

  override update(keyStatsMap: KeyStatsMap) {
    return LessonKeys.includeAll(keyStatsMap, new Target(this.settings));
  }

  override generate(lessonKeys: LessonKeys, rng: RNGStream) {
    const words = [];
    let wordsLength = 0;
    while (true) {
      const word = this.nextWord(rng);
      words.push(word);
      wordsLength += word.length;
      if (wordsLength >= 50) {
        break;
      }
    }
    return words.join(" ");
  }

  nextWord(rng: RNGStream) {
    // With a single shape there is nothing to choose, and skipping the draw
    // keeps the plain-digits stream identical to what it always was.
    const format =
      this.formats.length === 1
        ? this.formats[0]
        : randomSample(this.formats, rng);
    return format.next(this, rng, this.regionFormats);
  }

  plainDigits(rng: RNGStream) {
    const benford = this.settings.get(lessonProps.numbers.benford);
    const [zeroDigit, ...nonZeroDigits] = Letter.digits;
    const allDigits = [zeroDigit, ...nonZeroDigits];
    const length = Math.floor(3 + rng() * 4);
    const word = [];
    let last = null;
    for (let i = 0; i < length; i++) {
      while (true) {
        const digit =
          i === 0
            ? benford
              ? weightedRandomSample(nonZeroDigits, ({ f }) => f, rng)
              : randomSample(nonZeroDigits, rng)
            : randomSample(allDigits, rng);
        if (digit !== last) {
          word.push(digit);
          last = digit;
          break;
        }
      }
    }
    return String.fromCodePoint(...word.map(({ codePoint }) => codePoint));
  }
}
