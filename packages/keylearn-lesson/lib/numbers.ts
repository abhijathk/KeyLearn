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
 * One shape numbers take in the world. `needs` lists every non-digit
 * character the shape can emit — a layout that cannot type one of them
 * silently drops the whole shape rather than serving untypeable text.
 */
type NumberFormat = {
  readonly id: string;
  readonly needs: string;
  readonly next: (lesson: NumbersLesson, rng: RNGStream) => string;
};

const int = (rng: RNGStream, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1));

const pad = (n: number): string => String(n).padStart(2, "0");

/** Thousands separators, "1,234,567" style. */
const grouped = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const FORMATS: readonly NumberFormat[] = [
  {
    id: "plain",
    needs: "",
    next: (lesson, rng) => lesson.plainDigits(rng),
  },
  {
    id: "dates",
    needs: "/",
    next: (_, rng) =>
      `${pad(int(rng, 1, 28))}/${pad(int(rng, 1, 12))}/${int(rng, 1950, 2035)}`,
  },
  {
    id: "times",
    needs: ":",
    next: (_, rng) => {
      const base = `${pad(int(rng, 0, 23))}:${pad(int(rng, 0, 59))}`;
      // Seconds sometimes, so the shape does not become a rubber stamp.
      return rng() < 0.3 ? `${base}:${pad(int(rng, 0, 59))}` : base;
    },
  },
  {
    id: "currency",
    needs: "$,.",
    next: (_, rng) => {
      const kind = rng();
      if (kind < 0.4) {
        // Price-tag money: $19.99
        return `$${int(rng, 1, 199)}.${pad(int(rng, 0, 99))}`;
      }
      if (kind < 0.8) {
        // Invoice money: $1,234.56
        return `$${grouped(int(rng, 1000, 99999))}.${pad(int(rng, 0, 99))}`;
      }
      // Round money: $450
      return `$${grouped(int(rng, 10, 9999))}`;
    },
  },
  {
    id: "phone",
    needs: "()- ",
    next: (_, rng) =>
      `(${int(rng, 200, 999)}) ${int(rng, 200, 999)}-${pad(int(rng, 0, 99))}${pad(int(rng, 0, 99))}`,
  },
];

export class NumbersLesson extends Lesson {
  /** The shapes this lesson serves: chosen in settings AND typeable here. */
  readonly formats: readonly NumberFormat[];

  constructor(settings: Settings, keyboard: Keyboard, model: PhoneticModel) {
    super(settings, keyboard, model);
    const chosen = new Set(settings.get(lessonProps.numbers.formats));
    const typeable = FORMATS.filter(
      (format) =>
        chosen.has(format.id) &&
        [...format.needs].every((ch) =>
          this.codePoints.has(ch.codePointAt(0)!),
        ),
    );
    // A settings state that leaves nothing (every shape off, or a layout with
    // none of the punctuation) still has to produce a lesson.
    this.formats = typeable.length > 0 ? typeable : [FORMATS[0]];
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
    return format.next(this, rng);
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
