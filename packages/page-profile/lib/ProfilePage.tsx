import { Screen } from "@keylearn/pages-shared";
import {
  DailyStatsMap,
  type KeyStatsMap,
  makeSummaryStats,
  useResults,
} from "@keylearn/result";
import { ExplainerBoundary } from "@keylearn/widget";
import { DataScript } from "./profile/DataScript.tsx";
import { ResultGrouper } from "./profile/ResultGrouper.tsx";
import { RoadProfile } from "./profile/road/RoadProfile.tsx";
import { ReportDialog } from "./report/ReportDialog.tsx";
import { ShareDialog,type ShareFacts } from "./report/ShareDialog.tsx";

export function ProfilePage() {
  return (
    <Screen>
      <ExplainerBoundary>
        <ResultGrouper>
          {(keyStatsMap) => <Content keyStatsMap={keyStatsMap} />}
        </ResultGrouper>
      </ExplainerBoundary>
    </Screen>
  );
}

const DAY = 24 * 60 * 60 * 1000;

function Content({ keyStatsMap }: { keyStatsMap: KeyStatsMap }) {
  const { results } = keyStatsMap;
  const { profileName, kidProfile = false } = useResults();
  const stats = makeSummaryStats(results);
  const dailyStatsMap = new DailyStatsMap(results);
  const facts = shareFacts(keyStatsMap, profileName ?? null, kidProfile);
  return (
    <>
      <DataScript stats={stats} dailyStatsMap={dailyStatsMap} />
      {/* Opened by the button in the account block above, which sits outside
          this provider and so reaches it by event rather than by prop. */}
      <ReportDialog keyStatsMap={keyStatsMap} />
      <ShareDialog facts={facts} />
      <RoadProfile
        keyStatsMap={keyStatsMap}
        dailyStatsMap={dailyStatsMap}
        stats={stats}
      />
    </>
  );
}

/**
 * The typing profile's figures, reduced to what a card may say.
 *
 * Speeds are stored as characters per minute; a word is five characters by the
 * usual convention, and the card shows the same unit as the rest of the app.
 */
function shareFacts(
  keyStatsMap: KeyStatsMap,
  name: string | null,
  kid: boolean,
): ShareFacts {
  const { results } = keyStatsMap;
  const speeds = results.map((r) => r.speed).sort((a, b) => a - b);
  const accuracies = results.map((r) => r.accuracy).sort((a, b) => a - b);
  const mid = <T,>(xs: readonly T[]): T | null =>
    xs.length === 0 ? null : xs[xs.length >> 1];
  const days = new Set(results.map((r) => Math.floor(r.timeStamp / DAY)));
  const from =
    results.length > 0 ? Math.min(...results.map((r) => r.timeStamp)) : 0;
  const to =
    results.length > 0 ? Math.max(...results.map((r) => r.timeStamp)) : 0;
  const typical = mid(speeds);
  return {
    name,
    kid,
    letters: [...keyStatsMap].filter((k) => k.timeToType != null).length,
    alphabet: keyStatsMap.letters.length,
    daysPractised: days.size,
    weeks:
      results.length === 0 ? 0 : Math.max(1, Math.ceil((to - from) / DAY / 7)),
    lessons: results.length,
    wpm: typical == null ? null : Math.round((typical / 5) * 10) / 10,
    accuracy: mid(accuracies),
    best: speeds.length === 0 ? null : speeds[speeds.length - 1] / 5,
    points: [...results]
      .sort((a, b) => a.timeStamp - b.timeStamp)
      .map((r) => ({ at: r.timeStamp, speed: r.speed })),
  };
}
