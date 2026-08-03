import { Screen } from "@keylearn/pages-shared";
import {
  DailyStatsMap,
  type KeyStatsMap,
  makeSummaryStats,
} from "@keylearn/result";
import { ExplainerBoundary } from "@keylearn/widget";
import { DataScript } from "./profile/DataScript.tsx";
import { ResultGrouper } from "./profile/ResultGrouper.tsx";
import { RoadProfile } from "./profile/road/RoadProfile.tsx";

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

function Content({ keyStatsMap }: { keyStatsMap: KeyStatsMap }) {
  const { results } = keyStatsMap;
  const stats = makeSummaryStats(results);
  const dailyStatsMap = new DailyStatsMap(results);
  return (
    <>
      <DataScript stats={stats} dailyStatsMap={dailyStatsMap} />
      <RoadProfile
        keyStatsMap={keyStatsMap}
        dailyStatsMap={dailyStatsMap}
        stats={stats}
      />
    </>
  );
}
