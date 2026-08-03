import {
  type Keyboard,
  KeyboardOptions,
  loadKeyboard,
} from "@keylearn/keyboard";
import { GuidedLesson } from "@keylearn/lesson";
import { usePageData } from "@keylearn/pages-shared";
import { type PhoneticModel } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import {
  DailyStatsMap,
  LocalDate,
  makeKeyStatsMap,
  makeSummaryStats,
  type Result,
} from "@keylearn/result";
import { openResultStorage } from "@keylearn/result-loader";
import { type Settings, useSettings } from "@keylearn/settings";
import { useEffect, useState } from "react";
import { historyNamespace, type Profile } from "./store.ts";

export type ProfileStats = {
  readonly resultCount: number;
  readonly topSpeed: number; // cpm; 0 if none
  readonly streakDays: number; // consecutive calendar days ending today
  readonly unlockedLetters: number | null; // null if not computable
  readonly totalLetters: number | null;
};

const emptyStats: ReadonlyMap<string, ProfileStats> = new Map();

/**
 * Computes per-profile progress stats (result count, top speed, day streak,
 * and best-effort unlocked-letter counts) for the account page's learner
 * list. Results are loaded imperatively, one profile at a time, from each
 * profile's own result-storage namespace.
 */
export function useProfileStats(
  profiles: readonly { id: string }[],
): ReadonlyMap<string, ProfileStats> {
  const { publicUser } = usePageData();
  const userId = publicUser.id;
  const { settings } = useSettings();

  const [stats, setStats] =
    useState<ReadonlyMap<string, ProfileStats>>(emptyStats);

  const profileIdsKey = profiles.map((profile) => profile.id).join(",");
  const settingsKey = safeStringify(settings);

  useEffect(() => {
    let cancelled = false;

    // Reset immediately so a stale profile's numbers never linger under a
    // different profile's row while the new batch is still loading.
    setStats(emptyStats);

    (async () => {
      const lesson = await buildLetterLesson(settings);
      if (cancelled) {
        return;
      }

      await Promise.all(
        profiles.map(async (profile) => {
          const entry = await computeProfileStats(profile.id, userId, lesson);
          if (!cancelled) {
            setStats((prev) => {
              const next = new Map(prev);
              next.set(profile.id, entry);
              return next;
            });
          }
        }),
      );
    })().catch(() => {
      // Never throw out of the effect — a failure here simply leaves
      // whichever profiles didn't resolve out of the map.
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, settingsKey, profileIdsKey]);

  return stats;
}

/** Best-effort lesson used purely to count unlocked/total letters. */
async function buildLetterLesson(
  settings: Settings,
): Promise<GuidedLesson | null> {
  let keyboard: Keyboard;
  try {
    keyboard = loadKeyboard(KeyboardOptions.from(settings));
  } catch {
    return null;
  }

  let model: PhoneticModel;
  try {
    model = await PhoneticModelLoader.loader(
      KeyboardOptions.from(settings).language,
    );
  } catch {
    return null;
  }

  try {
    // The word list only feeds text generation, which we never invoke here —
    // an empty dictionary is enough for update()/findIncludedKeys().
    return new GuidedLesson(settings, keyboard, model, []);
  } catch {
    return null;
  }
}

async function computeProfileStats(
  profileId: string,
  userId: string | null,
  lesson: GuidedLesson | null,
): Promise<ProfileStats> {
  let results: readonly Result[] = [];
  try {
    const storage = openResultStorage({
      type: "private",
      userId,
      namespace: historyNamespace({ id: profileId } as Profile),
    });
    results = await storage.load();
  } catch {
    results = [];
  }

  const resultCount = results.length;

  let topSpeed = 0;
  try {
    topSpeed = makeSummaryStats(results).speed.max;
  } catch {
    topSpeed = 0;
  }

  let streakDays = 0;
  try {
    const dailyStats = new DailyStatsMap(results);
    let cursor = LocalDate.now();
    while (dailyStats.has(cursor)) {
      streakDays += 1;
      cursor = cursor.minusDays(1);
    }
  } catch {
    streakDays = 0;
  }

  let unlockedLetters: number | null = null;
  let totalLetters: number | null = null;
  if (lesson != null) {
    try {
      const keyStatsMap = makeKeyStatsMap(lesson.letters, results);
      const includedKeys = lesson.update(keyStatsMap).findIncludedKeys();
      unlockedLetters = new Set(includedKeys.map((key) => key.letter)).size;
      totalLetters = lesson.letters.length;
    } catch {
      unlockedLetters = null;
      totalLetters = null;
    }
  }

  return {
    resultCount,
    topSpeed,
    streakDays,
    unlockedLetters,
    totalLetters,
  };
}

function safeStringify(settings: Settings): string {
  try {
    return JSON.stringify(settings);
  } catch {
    return "";
  }
}
