import { useEffort } from "@keybr/lesson-ui";
import { type DailyStatsMap, LocalDate } from "@keybr/result";
import { clsx } from "clsx";
import { type ReactNode, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./road.module.less";

const WEEKS = 52;
const DAY = 24 * 60 * 60 * 1000;

/**
 * The practice calendar as a compact heat grid: one cell per day for the last
 * year, tinted by how much of the daily goal was met, with month and
 * weekday labels and the exact date and time on hover.
 */
export function CalendarHeat({
  dailyStatsMap,
}: {
  readonly dailyStatsMap: DailyStatsMap;
}): ReactNode {
  const { formatDate } = useIntl();
  const effort = useEffort();
  const { cells, months } = useMemo(() => {
    const timeByDay = new Map<string, number>();
    for (const { date, stats } of dailyStatsMap) {
      timeByDay.set(String(date), stats.time);
    }
    const now = Date.now();
    // align the grid to end on the current week
    const endDow = (new Date(now).getDay() + 6) % 7; // Monday = 0
    const total = (WEEKS - 1) * 7 + endDow + 1;
    const cells = [];
    const months: { column: number; label: string }[] = [];
    let lastMonth = -1;
    for (let i = 0; i < WEEKS * 7; i++) {
      const back = total - 1 - i;
      if (back < 0) {
        cells.push(null);
        continue;
      }
      const ms = now - back * DAY;
      const date = new Date(ms);
      const time = timeByDay.get(String(new LocalDate(ms))) ?? 0;
      const value = Math.max(0, Math.min(1, effort.effort(time)));
      const column = Math.floor(i / 7);
      if (i % 7 === 0 && date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth();
        const prev = months[months.length - 1];
        if (prev == null || column - prev.column >= 3) {
          months.push({
            column,
            label: date.toLocaleString("en", { month: "short" }),
          });
        }
      }
      cells.push({ ms, time, value });
    }
    return { cells, months };
  }, [dailyStatsMap, effort]);
  return (
    <>
      <div className={styles.calwrap}>
        <div className={styles.caldays}>
          <span>Mon</span>
          <span />
          <span>Wed</span>
          <span />
          <span>Fri</span>
          <span />
          <span />
        </div>
        <div>
          <div className={styles.calmonths}>
            {months.map(({ column, label }) => (
              <span
                key={`${column}${label}`}
                style={{ gridColumn: column + 1 }}
              >
                {label}
              </span>
            ))}
          </div>
          <div className={styles.cal}>
            {cells.map((cell, i) =>
              cell == null ? (
                <span key={i} style={{ visibility: "hidden" }} />
              ) : (
                <span
                  key={i}
                  className={styles.cell}
                  style={
                    cell.value > 0
                      ? {
                          backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(
                            20 + cell.value * 80,
                          )}%, var(--primary-l1))`,
                        }
                      : undefined
                  }
                  title={`${formatDate(cell.ms, { dateStyle: "medium" })} — ${Math.round(cell.time / 60000)}min`}
                />
              ),
            )}
          </div>
        </div>
      </div>
      <div className={styles.legendRow}>
        <FormattedMessage
          id="profile.calendar.goalLegend"
          defaultMessage="daily practice goal"
        />
        <i style={{ backgroundColor: "var(--primary-l1)" }} /> 0%
        <i
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--accent) 30%, var(--primary-l1))",
          }}
        />{" "}
        25%
        <i
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--accent) 55%, var(--primary-l1))",
          }}
        />{" "}
        50%
        <i
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--accent) 80%, var(--primary-l1))",
          }}
        />{" "}
        75%
        <i style={{ backgroundColor: "var(--accent)" }} /> 100%
      </div>
    </>
  );
}
