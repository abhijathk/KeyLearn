import { profileStorageKey } from "@keylearn/pages-shared";
import { LANDS } from "./world.ts";

/**
 * The sticker album — everything the child has ever earned, kept.
 *
 * The page had two rewards in it, both landing between the eighth and tenth
 * unlocked key, and both of them vanishing the instant the message scrolled
 * away. A child who unlocked the eleventh key had, from that point on, nothing
 * left to collect and nothing to look back at.
 *
 * An album fixes both halves. Rewards are spread the length of the trail so
 * there is always a next one; and because the album is persistent and shows the
 * unearned ones as outlines, the child can see both what they have and what is
 * still out there — which is the part that makes a collection a collection
 * rather than a sequence of notifications.
 */

export type StickerKind = "companion" | "land" | "milestone";

export type Sticker = {
  readonly id: string;
  readonly label: string;
  /** Shown on the outline, so an unearned sticker says how to earn it. */
  readonly hint: string;
  readonly kind: StickerKind;
};

/** A creature that hatches from an egg as the trail grows. */
export type Hatchling = {
  /** The model name under `models/`, and the sticker id. */
  readonly id: string;
  readonly label: string;
  /** Unlocked keys at which the egg hatches. */
  readonly at: number;
};

/**
 * Companions, spread the whole length of the alphabet.
 *
 * Every four keys, which is roughly every week or two of real practice at the
 * pace the youngest bands actually work at — close enough that there is always
 * a visible next one, far enough apart that arriving at one still means
 * something. The old pair sat at eight and ten keys, so the reward architecture
 * of the page was over before a third of the alphabet.
 *
 * Both worlds have a table now. The hero world previously had none at all — its
 * two characters were free from the start — which meant the default world for
 * the two youngest bands had nothing whatsoever to earn.
 */
export const HATCHLINGS: Record<"dino" | "hero", readonly Hatchling[]> = {
  dino: [
    { id: "Velociraptor", label: "Vela", at: 4 },
    { id: "Stegosaurus", label: "Steggy", at: 8 },
    { id: "Triceratops", label: "Tops", at: 12 },
    { id: "Parasaurolophus", label: "Para", at: 16 },
    { id: "Apatosaurus", label: "Apa", at: 20 },
  ],
  hero: [
    { id: "Rogue", label: "Scout", at: 4 },
    { id: "Ranger", label: "Ranger", at: 8 },
    { id: "Mage", label: "Mage", at: 12 },
    { id: "Barbarian", label: "Bear", at: 16 },
    { id: "Rogue_Hooded", label: "Shadow", at: 20 },
  ],
};

/**
 * Moments worth keeping that are not creatures.
 *
 * Deliberately about effort rather than speed. A child who practises every day
 * and types slowly should fill an album; the one thing this page must never do
 * is make being slow feel like being bad at it.
 */
export const MILESTONES: readonly Sticker[] = [
  {
    id: "first-run",
    label: "First steps",
    hint: "reach your first camp flag",
    kind: "milestone",
  },
  {
    id: "streak-10",
    label: "Ten in a row",
    hint: "10 correct keys in a row",
    kind: "milestone",
  },
  {
    id: "keys-10",
    label: "Ten letters",
    hint: "10 keys on the trail",
    kind: "milestone",
  },
  {
    id: "keys-20",
    label: "Twenty letters",
    hint: "20 keys on the trail",
    kind: "milestone",
  },
  {
    id: "alphabet",
    label: "Whole alphabet",
    hint: "every letter unlocked",
    kind: "milestone",
  },
  {
    id: "week",
    label: "Seven days",
    hint: "practise on seven different days",
    kind: "milestone",
  },
];

/** Every sticker there is, for the world the child is playing. */
export function catalogue(world: "dino" | "hero"): readonly Sticker[] {
  return [
    ...HATCHLINGS[world].map(
      ({ id, label, at }): Sticker => ({
        id,
        label,
        hint: `hatches at ${at} keys`,
        kind: "companion",
      }),
    ),
    ...LANDS.map(
      ({ name }): Sticker => ({
        id: `land:${name}`,
        label: name,
        hint: "walk through it",
        kind: "land",
      }),
    ),
    ...MILESTONES,
  ];
}

const KEY = () => profileStorageKey("kids.album");
const DAYS_KEY = () => profileStorageKey("kids.days");

/** Sticker id → the day it was first earned, as `YYYY-MM-DD`. */
export type Album = Readonly<Record<string, string>>;

export function loadAlbum(): Album {
  try {
    const raw = localStorage.getItem(KEY());
    const parsed: unknown = raw == null ? null : JSON.parse(raw);
    // Anything else in that slot is somebody else's data or a half-written
    // write; an empty album is a better answer than a crash on a kids page.
    return parsed != null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? (parsed as Album)
      : {};
  } catch {
    return {};
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Records a sticker, keeping the day it was first earned.
 *
 * Returns the new album when this was genuinely new and null when it was
 * already there — so the caller knows whether to make a fuss, and re-earning
 * never re-fires the ceremony.
 */
export function earn(id: string): Album | null {
  const album = loadAlbum();
  if (id in album) {
    return null;
  }
  const next = { ...album, [id]: today() };
  try {
    localStorage.setItem(KEY(), JSON.stringify(next));
  } catch {
    // Storage full or blocked. The sticker is shown either way; only the
    // remembering is lost, and a crash here would end the session.
  }
  return next;
}

/**
 * Notes that the child practised today, and returns how many distinct days
 * they have practised in all.
 *
 * Days rather than sessions, because sessions reward opening the page twice and
 * days reward coming back.
 */
export function practiceDays(): number {
  const day = today();
  try {
    const raw = localStorage.getItem(DAYS_KEY());
    const parsed: unknown = raw == null ? null : JSON.parse(raw);
    const days: string[] = Array.isArray(parsed)
      ? parsed.filter((d): d is string => typeof d === "string")
      : [];
    if (!days.includes(day)) {
      days.push(day);
      localStorage.setItem(DAYS_KEY(), JSON.stringify(days));
    }
    return days.length;
  } catch {
    return 1;
  }
}

/** The next companion still to hatch, or null once they are all out. */
export function nextHatchling(
  world: "dino" | "hero",
  included: number,
): Hatchling | null {
  return HATCHLINGS[world].find(({ at }) => included < at) ?? null;
}

/**
 * Days practised in a row, ending today or yesterday.
 *
 * Yesterday still counts as alive — a child who practised every evening has
 * not broken their streak at breakfast — but today is what keeps it growing.
 */
export function kidsStreak(): number {
  try {
    const raw = localStorage.getItem(DAYS_KEY());
    const parsed: unknown = raw == null ? null : JSON.parse(raw);
    const days = new Set(
      Array.isArray(parsed)
        ? parsed.filter((d): d is string => typeof d === "string")
        : [],
    );
    const cursor = new Date();
    const key = () =>
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (!days.has(key())) {
      cursor.setDate(cursor.getDate() - 1);
    }
    let n = 0;
    while (days.has(key())) {
      n += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  } catch {
    return 0;
  }
}
