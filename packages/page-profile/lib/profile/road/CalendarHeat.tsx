import { useIntlDates } from "@keybr/intl";
import { useEffort } from "@keybr/lesson-ui";
import { type DailyStatsMap, LocalDate } from "@keybr/result";
import { clsx } from "clsx";
import { type ReactNode, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./road.module.less";

const WEEKS = 52;
/** Cells in a day that counts as a full one, for shading the grid. */
const BRAILLE_DAY = 120;
const DAY = 24 * 60 * 60 * 1000;

/**
 * The practice calendar as a compact heat grid: one cell per day for the last
 * year, tinted by how much of the daily goal was met, with month and
 * weekday labels and the exact date and time on hover.
 */
export function CalendarHeat({
  dailyStatsMap,
  brailleDays,
}: {
  readonly dailyStatsMap?: DailyStatsMap;
  /**
   * A braille learner's day tallies, which count cells rather than minutes.
   *
   * The same grid, shaded against a day's-worth of cells instead of against
   * the typing goal — braille records what was entered, not how long it took
   * in total, so there is no minutes figure to hold it to.
   */
  readonly brailleDays?: ReadonlyMap<string, { readonly hits: number }>;
}): ReactNode {
  const { formatDate, formatMonth, firstDayOfWeek, weekDayNames } =
    useIntlDates();
  const effort = useEffort();
  const [tip, setTip] = useState<{
    left: number;
    top: number;
    date: string;
    time: number;
    value: number;
    cells: number;
  } | null>(null);
  const { cells, months } = useMemo(() => {
    const timeByDay = new Map<string, number>();
    for (const { date, stats } of dailyStatsMap ?? []) {
      timeByDay.set(String(date), stats.time);
    }
    const now = Date.now();
    // Align the grid to end on the current week. getDay() is Sunday = 0 and
    // firstDayOfWeek is ISO (Monday = 1), so this converts both to "days
    // since this reader's week began".
    const endDow = (new Date(now).getDay() + 7 - (firstDayOfWeek % 7)) % 7;
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
      const day = String(new LocalDate(ms));
      const time = timeByDay.get(day) ?? 0;
      const cellsDone = brailleDays?.get(day)?.hits ?? 0;
      const value =
        brailleDays != null
          ? Math.max(0, Math.min(1, cellsDone / BRAILLE_DAY))
          : Math.max(0, Math.min(1, effort.effort(time)));
      const column = Math.floor(i / 7);
      if (i % 7 === 0 && date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth();
        const prev = months[months.length - 1];
        if (prev == null || column - prev.column >= 3) {
          months.push({
            column,
            label: formatMonth(date),
          });
        }
      }
      cells.push({ ms, time, value, cells: cellsDone });
    }
    return { cells, months };
    // formatMonth is stable per locale and zone, so this only recomputes
    // when the reader actually changes one of them — which it must.
  }, [dailyStatsMap, brailleDays, effort, formatMonth, firstDayOfWeek]);
  return (
    <>
      <div className={styles.calwrap}>
        <div className={styles.caldays}>
          {/* Every other row is labelled, which is the convention for a heat
              map this dense — and the names now follow the reader's language
              and week order rather than being three English words. */}
          {weekDayNames("short").map((name, i) => (
            <span key={i}>{i % 2 === 0 ? name : ""}</span>
          ))}
        </div>
        <div className={styles.calcol}>
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
          <div className={styles.cal} onMouseLeave={() => setTip(null)}>
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
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    setTip({
                      left: el.offsetLeft + el.offsetWidth / 2,
                      top: el.offsetTop,
                      date: formatDate(cell.ms, "full"),
                      time: cell.time,
                      value: cell.value,
                      cells: cell.cells,
                    });
                  }}
                />
              ),
            )}
          </div>
          {tip != null && (
            <div
              className={styles.calTip}
              style={{ left: tip.left, top: tip.top }}
            >
              <b>
                {brailleDays != null ? (
                  tip.cells > 0 ? (
                    <FormattedMessage
                      id="profile.calendar.tip.cells"
                      defaultMessage="{cells} cells entered"
                      values={{ cells: tip.cells }}
                    />
                  ) : (
                    <FormattedMessage
                      id="profile.calendar.tip.rest"
                      defaultMessage="No practice"
                    />
                  )
                ) : tip.time > 0 ? (
                  <FormattedMessage
                    id="profile.calendar.tip.practised"
                    defaultMessage="{minutes} min practised"
                    values={{ minutes: Math.round(tip.time / 60000) }}
                  />
                ) : (
                  <FormattedMessage
                    id="profile.calendar.tip.rest"
                    defaultMessage="No practice"
                  />
                )}
              </b>
              <span>{tip.date}</span>
            </div>
          )}
        </div>
      </div>
      <div
        className={styles.legendRow}
        hidden={brailleDays != null}
        aria-hidden={brailleDays != null}
      >
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
