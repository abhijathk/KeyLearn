import {
  activeProfileId,
  downloadBlob,
  exportFilename,
  loadNgramStats,
  usePageData,
} from "@keylearn/pages-shared";
import {
  type KeyStatsMap,
  makeKeyStatsMap,
  useResults,
} from "@keylearn/result";
import { openResultStorage } from "@keylearn/result-loader";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import { csvBlob, resultsToCsv } from "./csv.ts";
import * as dialog from "./dialog.module.less";
import { type Period, reportData } from "./report-data.ts";
import {
  type ReportOptions,
  type ReportPaper,
  ReportSheet,
  type ReportVoice,
} from "./ReportSheet.tsx";

/**
 * Fired by the "Save a report" button, which lives above the results provider
 * in the page tree and so cannot reach the learner's data directly. Sending an
 * event rather than threading state through the loader keeps the two pieces
 * independent — the same trick the accent theme uses for learner switches.
 */
export const REPORT_OPEN_EVENT = "keylearn:report-open";

export function openReport(): void {
  window.dispatchEvent(new CustomEvent(REPORT_OPEN_EVENT));
}

const DEFAULTS: ReportOptions = {
  period: "3m",
  voice: "parent",
  speedChart: true,
  accuracyChart: true,
  keys: true,
  calendar: true,
  transitions: true,
  lessons: false,
  paper: "a4",
};

export function ReportDialog({
  keyStatsMap,
}: {
  readonly keyStatsMap: KeyStatsMap;
}): ReactNode {
  const pageData = usePageData();
  const { results, namespace, profileName } = useResults();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ReportOptions>(DEFAULTS);
  // Frozen when the dialog opens, so a report generated at 23:59:59 does not
  // change its own dates while the print sheet is being drawn.
  const [now, setNow] = useState(() => Date.now());

  const profiles = useMemo(() => pageData?.profiles ?? [], [pageData]);
  // "Who" defaults to the learner whose tab is open, which is the one the page
  // behind the dialog is already showing.
  const [who, setWho] = useState<string | null>(null);
  const [other, setOther] = useState<{
    readonly name: string;
    readonly namespace: string | null;
    readonly results: readonly (typeof results)[number][];
  } | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setNow(Date.now());
      setWho(null);
      setOther(null);
      setOpen(true);
    };
    window.addEventListener(REPORT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(REPORT_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // A report about somebody else in the household reads their stored results
  // directly. Nothing is fetched that the account does not already hold, and
  // the active learner is not switched — the page behind stays where it was.
  useEffect(() => {
    if (!open || who == null) {
      setOther(null);
      return;
    }
    let cancelled = false;
    const userId = pageData?.publicUser?.id ?? null;
    const wanted =
      who === "*" ? profiles : profiles.filter((p) => p.id === who);
    void (async () => {
      const loaded = await Promise.all(
        wanted.map(async (p) => {
          const storage = openResultStorage({
            type: "private",
            userId,
            kids: p.kind === "kid",
            namespace: `profile-${p.id}`,
          });
          try {
            return await storage.load();
          } catch {
            // A learner whose local database will not open contributes
            // nothing rather than failing the whole report.
            return [];
          }
        }),
      );
      if (cancelled) {
        return;
      }
      setOther({
        name:
          who === "*"
            ? "Everyone"
            : (wanted[0]?.firstName ?? profileName ?? "Typing"),
        namespace: who === "*" ? null : `profile-${who}`,
        results: loaded.flat(),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, who, profiles, pageData, profileName]);

  const shown = useMemo(
    () => (who == null ? results : (other?.results ?? [])),
    [who, results, other],
  );
  const shownName =
    who == null ? (profileName ?? "Typing") : (other?.name ?? "");
  const shownNamespace = who == null ? namespace : (other?.namespace ?? null);

  const data = useMemo(
    () => reportData(shown, options.period, now),
    [shown, options.period, now],
  );

  const shownKeys = useMemo(
    () =>
      who == null ? keyStatsMap : makeKeyStatsMap(keyStatsMap.letters, shown),
    [who, keyStatsMap, shown],
  );

  const { transitions, floor } = useMemo(() => {
    const stats = loadNgramStats(shownNamespace);
    const median = stats.medianTime(2);
    const rows = stats.topWeak(2, 6).sort((a, b) => b.time - a.time);
    const label = (cp: number) =>
      cp === 0x20 ? "␣" : String.fromCodePoint(cp).toUpperCase();
    return {
      transitions: rows.map(({ seq, time, errors }) => ({
        from: label(seq[0]),
        to: label(seq[1]),
        time,
        errors,
      })),
      floor:
        median != null && median > 0
          ? median
          : Math.min(...rows.map((r) => r.time), 1),
    };
  }, [shownNamespace]);

  const formatDate = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return (at: number) => fmt.format(new Date(at));
  }, []);

  const set = <K extends keyof ReportOptions>(
    key: K,
    value: ReportOptions[K],
  ) => setOptions((prev) => ({ ...prev, [key]: value }));

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className={dialog.overlay}
        role="presentation"
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) {
            setOpen(false);
          }
        }}
      >
        <div className={dialog.win} role="dialog" aria-modal={true}>
          <div className={dialog.head}>
            <span>
              <FormattedMessage
                id="report.title"
                defaultMessage="Save a report"
              />
            </span>
            <span className={dialog.spacer} />
            <button
              type="button"
              className={dialog.close}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className={dialog.body}>
            <div className={dialog.cols}>
              <div>
                {profiles.length > 0 && (
                  <>
                    <div className={dialog.label}>
                      <FormattedMessage id="report.who" defaultMessage="Who" />
                    </div>
                    <div className={dialog.chips}>
                      {profiles.map((p) => {
                        // By id, never by name. Two learners in one household
                        // can share a first name, and matching on it lit both
                        // chips and reported one learner's figures under the
                        // other's heading.
                        const mine = who == null && p.id === activeProfileId();
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={clsx(
                              dialog.chip,
                              (mine || who === p.id) && dialog.on,
                            )}
                            onClick={() => setWho(mine ? null : p.id)}
                          >
                            {p.firstName}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className={clsx(dialog.chip, who === "*" && dialog.on)}
                        onClick={() => setWho("*")}
                      >
                        <FormattedMessage
                          id="report.everyone"
                          defaultMessage="Everyone"
                        />
                      </button>
                    </div>
                  </>
                )}

                <div className={dialog.label}>
                  <FormattedMessage
                    id="report.period"
                    defaultMessage="Period"
                  />
                </div>
                <div className={dialog.chips}>
                  {(
                    [
                      ["30d", "30 days"],
                      ["3m", "3 months"],
                      ["year", "This year"],
                      ["all", "All time"],
                    ] as const
                  ).map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      className={clsx(
                        dialog.chip,
                        options.period === id && dialog.on,
                      )}
                      onClick={() => set("period", id as Period)}
                    >
                      {text}
                    </button>
                  ))}
                </div>

                <div className={dialog.label}>
                  <FormattedMessage
                    id="report.voice"
                    defaultMessage="Written for"
                  />
                </div>
                <div className={dialog.chips}>
                  {(
                    [
                      ["parent", "A parent"],
                      ["teacher", "A teacher"],
                      ["numbers", "Just the numbers"],
                    ] as const
                  ).map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      className={clsx(
                        dialog.chip,
                        options.voice === id && dialog.on,
                      )}
                      onClick={() => set("voice", id as ReportVoice)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <p className={dialog.hint}>
                  <FormattedMessage
                    id="report.voice.hint"
                    defaultMessage="Changes the prose, not the data: a teacher’s copy names the curriculum stage and drops the encouragement."
                  />
                </p>
              </div>

              <div>
                <div className={dialog.label}>
                  <FormattedMessage
                    id="report.include"
                    defaultMessage="Charts to include"
                  />
                </div>
                {(
                  [
                    [
                      "speedChart",
                      "Speed over time",
                      "the line chart, with a fitted trend",
                    ],
                    [
                      "accuracyChart",
                      "Accuracy across lessons",
                      "the histogram from the profile page",
                    ],
                    [
                      "keys",
                      "Keys learned",
                      "the alphabet grid, shaded by confidence",
                    ],
                    [
                      "calendar",
                      "Practice calendar",
                      "a year of days, shaded by minutes",
                    ],
                    [
                      "transitions",
                      "Slowest transitions",
                      "the key-pairs to work on next",
                    ],
                    [
                      "lessons",
                      "Every lesson, listed",
                      "one row per session — long, and rarely what anybody wants",
                    ],
                  ] as const
                ).map(([key, text, hint]) => (
                  <label key={key} className={dialog.check}>
                    <input
                      type="checkbox"
                      checked={options[key]}
                      onChange={(ev) => set(key, ev.target.checked)}
                    />
                    <span>
                      {text}
                      <small>{hint}</small>
                    </span>
                  </label>
                ))}

                <div className={dialog.label}>
                  <FormattedMessage id="report.paper" defaultMessage="Paper" />
                </div>
                <div className={dialog.chips}>
                  {(
                    [
                      ["a4", "A4"],
                      ["letter", "Letter"],
                      ["grey", "Greyscale-safe"],
                    ] as const
                  ).map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      className={clsx(
                        dialog.chip,
                        options.paper === id && dialog.on,
                      )}
                      onClick={() => set("paper", id as ReportPaper)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {data == null && (
              <p className={dialog.empty}>
                <FormattedMessage
                  id="report.empty"
                  defaultMessage="There are no lessons in this period yet."
                />
              </p>
            )}
          </div>

          <div className={dialog.foot}>
            <span className={dialog.privacy}>
              <FormattedMessage
                id="report.local"
                defaultMessage="Made on this device. Nothing is uploaded."
              />
            </span>
            <span className={dialog.spacer} />
            <button
              type="button"
              className={dialog.btn}
              disabled={shown.length === 0}
              onClick={() => {
                downloadBlob(
                  csvBlob(resultsToCsv(shown)),
                  exportFilename(
                    "lessons",
                    shownName,
                    "csv",
                    new Date(now).toISOString().slice(0, 10),
                  ),
                );
              }}
            >
              <FormattedMessage
                id="report.csv"
                defaultMessage="⤓ Lessons as CSV"
              />
            </button>
            <button
              type="button"
              className={dialog.btn}
              onClick={() => setOpen(false)}
            >
              <FormattedMessage id="report.cancel" defaultMessage="Cancel" />
            </button>
            <button
              type="button"
              className={clsx(dialog.btn, dialog.go)}
              disabled={data == null}
              onClick={() => window.print()}
            >
              <FormattedMessage id="report.save" defaultMessage="Save PDF" />
            </button>
          </div>
        </div>
      </div>

      {data != null && (
        <ReportSheet
          name={shownName}
          data={data}
          options={options}
          keyStatsMap={shownKeys}
          transitions={options.transitions ? transitions : []}
          floor={floor}
          generatedAt={now}
          formatDate={formatDate}
        />
      )}
    </>
  );
}
