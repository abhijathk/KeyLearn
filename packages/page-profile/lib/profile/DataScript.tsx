import type { DailyStatsMap, SummaryStats } from "@keylearn/result";

export function DataScript({
  stats,
  dailyStatsMap,
}: {
  stats: SummaryStats;
  dailyStatsMap: DailyStatsMap;
}) {
  return (
    <script
      id="profile-data"
      type="application/json"
      dangerouslySetInnerHTML={{
        // Escaped the same way as PageDataScript. The payload is numeric today,
        // so nothing here can break out — but this is a raw HTML sink one field
        // away from carrying a user-supplied string, and `</script>` inside JSON
        // ends the element.
        __html: JSON.stringify({
          allTime: stats,
          today: dailyStatsMap.today.stats,
          byDate: Object.fromEntries(
            [...dailyStatsMap].map(({ date, stats }) => [date, stats]),
          ),
        })
          .replaceAll("<", "\\u003c")
          .replaceAll(">", "\\u003e")
          .replaceAll("&", "\\u0026"),
      }}
    ></script>
  );
}
