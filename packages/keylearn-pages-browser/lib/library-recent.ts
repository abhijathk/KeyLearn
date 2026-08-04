import { profileStorageKey } from "@keylearn/pages-shared";

/**
 * The Practice Library's memory: what this learner actually practised.
 *
 * One entry per distinct choice — a lesson type, or a type plus the thing
 * chosen inside it (which book, which code course). Recorded when the
 * practice page opens with that choice active, kept per profile on this
 * device, newest first.
 */
export type RecentPractice = {
  /** LessonType id — "guided", "books", "code", … */
  readonly type: string;
  /** The choice inside the type: a book id or a code syntax id, or null. */
  readonly detail: string | null;
  /** Human label for the detail, stored at record time ("TypeScript code"). */
  readonly label: string | null;
  /** When it was last practised, epoch milliseconds. */
  readonly at: number;
};

const KEY_BASE = "library.recent";
const MAX_ENTRIES = 6;

function storageKey(): string {
  return profileStorageKey(KEY_BASE);
}

export function recentPractice(): readonly RecentPractice[] {
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw != null ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (e): e is RecentPractice =>
        e != null && typeof e === "object" && typeof e.type === "string",
    );
  } catch {
    return [];
  }
}

export function rememberPractice(entry: {
  readonly type: string;
  readonly detail?: string | null;
  readonly label?: string | null;
}): void {
  const next: RecentPractice = {
    type: entry.type,
    detail: entry.detail ?? null,
    label: entry.label ?? null,
    at: Date.now(),
  };
  const rest = recentPractice().filter(
    (e) => e.type !== next.type || e.detail !== next.detail,
  );
  try {
    localStorage.setItem(
      storageKey(),
      JSON.stringify([next, ...rest].slice(0, MAX_ENTRIES)),
    );
  } catch {
    // Storage may be unavailable; the library just forgets.
  }
}
