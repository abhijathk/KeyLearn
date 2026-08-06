// Gathering what the criteria are judged against.
//
// The rules live in @keylearn/certificate and are re-judged on the server.
// This only assembles: it reads one learner's stored practice and reduces it
// to the figures `assess()` expects, and it must count only course lessons —
// a quote or a custom word list has letters chosen by the text rather than by
// the curriculum, so it cannot evidence coverage of an alphabet.

import { brailleStats, loadProgress, practiceDays } from "@keylearn/braille";
import { type CertificateEvidence } from "@keylearn/certificate";
import { type ProfileDetails } from "@keylearn/pages-shared";
import { type Letter } from "@keylearn/phonetic-model";
import { makeKeyStatsMap, type Result } from "@keylearn/result";

const DAY = 24 * 60 * 60 * 1000;

/** A letter counts as reliable at the same pace the printed report uses. */
const RELIABLE_MS = 500;

function median(xs: readonly number[]): number {
  if (xs.length === 0) {
    return 0;
  }
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** The window the sustained figures are taken over. */
const RECENT = 50;

export function typingEvidence(
  profile: ProfileDetails,
  results: readonly Result[],
  letters: readonly Letter[],
): CertificateEvidence {
  const keyStats = makeKeyStatsMap(letters, results);
  const stats = [...keyStats];
  const days = new Set(results.map((r) => Math.floor(r.timeStamp / DAY)));
  const stamps = results.map((r) => r.timeStamp);
  const recent = [...results]
    .sort((a, b) => a.timeStamp - b.timeStamp)
    .slice(-RECENT);
  return {
    kind: "typing",
    audience: profile.kind === "kid" ? "kid" : "adult",
    age:
      profile.birthYear == null
        ? null
        : new Date().getFullYear() - profile.birthYear,
    learned: stats.filter((k) => k.timeToType != null).length,
    total: letters.length,
    settled: stats.filter(
      (k) => k.timeToType != null && k.timeToType <= RELIABLE_MS,
    ).length,
    volume: results.length,
    daysPractised: days.size,
    elapsedDays:
      stamps.length === 0
        ? 0
        : Math.round((Math.max(...stamps) - Math.min(...stamps)) / DAY) + 1,
    // Characters per minute in storage; a word is five of them by convention.
    speed: median(recent.map((r) => r.speed)) / 5,
    accuracy: median(recent.map((r) => r.accuracy)),
  };
}

/**
 * The same shape from a braille learner's very different data.
 *
 * Pace is cells per minute, and a cell counts as settled by the curriculum's
 * own definition rather than a second one invented here.
 */
export function brailleEvidence(profile: ProfileDetails): CertificateEvidence {
  const stats = brailleStats(profile.id);
  const progress = loadProgress(profile.id);
  const unlocked = progress.unlocked();
  const days = practiceDays(profile.id);
  const times = days
    .map((d) => Date.parse(d))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  // Mean join time across every cell in play, turned into cells per minute.
  const paces = unlocked
    .map((key) => progress.statOf(key))
    .flatMap((s) => (s.recentMs.length > 0 ? [meanOf(s.recentMs)] : []));
  const msPerCell = paces.length > 0 ? median(paces) : Infinity;
  const accuracies = unlocked.map((key) => progress.accuracy(key));
  return {
    kind: "braille",
    audience: profile.kind === "kid" ? "kid" : "adult",
    age:
      profile.birthYear == null
        ? null
        : new Date().getFullYear() - profile.birthYear,
    learned: stats.learned,
    total: stats.totalCells,
    settled: unlocked.filter((key) => progress.isSettled(key)).length,
    volume: stats.hits,
    daysPractised: days.length,
    elapsedDays:
      times.length === 0
        ? 0
        : Math.round((times[times.length - 1] - times[0]) / DAY) + 1,
    speed: Number.isFinite(msPerCell) ? 60000 / msPerCell : 0,
    accuracy: accuracies.length > 0 ? median(accuracies) : 0,
  };
}

const meanOf = (xs: readonly number[]) =>
  xs.reduce((a, b) => a + b, 0) / xs.length;
