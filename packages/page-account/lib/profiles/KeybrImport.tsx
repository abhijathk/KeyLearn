import { Layout } from "@keylearn/keyboard";
import { Result, TextType } from "@keylearn/result";
import { openResultStorage } from "@keylearn/result-loader";
import { Histogram } from "@keylearn/textinput";
import { clsx } from "clsx";
import { type ReactNode, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Overlay } from "../Overlay.tsx";
import * as styles from "./Profiles.module.less";
import { type Profile } from "./store.ts";

// Parse one record of a keybr "typing-data.json" export (which is the
// Result.toJSON() shape: full field names, ISO timeStamp) into a Result.
// Returns null for anything malformed or on an unsupported layout/text type.
function resultFromExport(o: unknown): Result | null {
  if (o == null || typeof o !== "object") {
    return null;
  }
  const r = o as Record<string, unknown>;
  const { layout, textType, timeStamp, length, time, errors, histogram } = r;
  if (typeof layout !== "string" || typeof textType !== "string") {
    return null;
  }
  const ts =
    typeof timeStamp === "number" ? timeStamp : Date.parse(String(timeStamp));
  if (
    !Number.isFinite(ts) ||
    typeof length !== "number" ||
    typeof time !== "number" ||
    typeof errors !== "number" ||
    !Array.isArray(histogram)
  ) {
    return null;
  }
  try {
    const samples = histogram.map((h: any) => ({
      codePoint: Number(h.codePoint),
      hitCount: Number(h.hitCount),
      missCount: Number(h.missCount),
      timeToType: Number(h.timeToType),
    }));
    return new Result(
      Layout.ALL.get(layout),
      TextType.ALL.get(textType),
      ts,
      length,
      time,
      errors,
      new Histogram(samples),
    );
  } catch {
    return null;
  }
}

export function KeybrImport({
  profiles,
  userId,
  onClose,
}: {
  /** See `importTargets`: every learner not on braille. */
  readonly profiles: readonly Profile[];
  readonly userId: string;
  readonly onClose: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const fileRef = useRef<HTMLInputElement>(null);
  const [targetId, setTargetId] = useState(profiles[0]?.id ?? "");
  const [results, setResults] = useState<Result[] | null>(null);
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * THE WAIT ON EITHER SIDE OF THE FILE WINDOW (owner, 5 Oct 2026). The
   * browser takes a moment to open the system picker, and a big keybr
   * export takes a moment to read — and in both the button just sat there,
   * so it looked as if the click had gone nowhere.
   */
  const [picking, setPicking] = useState<"idle" | "opening" | "reading">(
    "idle",
  );
  const unwatch = useRef<(() => void) | null>(null);

  const choose = () => {
    const input = fileRef.current;
    if (input == null || picking !== "idle") {
      return;
    }
    setPicking("opening");
    // The picker says nothing when it APPEARS, only when it closes: a pick
    // fires `change`, a cancel fires `cancel`, and either way the page gets
    // its focus back. Whichever comes first ends "Opening…".
    const done = () => {
      unwatch.current?.();
      setPicking((p) => (p === "opening" ? "idle" : p));
    };
    // `change` can land just after focus returns, so focus waits a beat.
    const onFocus = () => window.setTimeout(done, 500);
    // Never stuck: a browser that sends neither still lets go.
    const fallback = window.setTimeout(done, 20_000);
    input.addEventListener("cancel", done);
    window.addEventListener("focus", onFocus);
    unwatch.current = () => {
      input.removeEventListener("cancel", done);
      window.removeEventListener("focus", onFocus);
      window.clearTimeout(fallback);
      unwatch.current = null;
    };
    input.click();
  };

  const onFile = (file: File | undefined) => {
    unwatch.current?.();
    if (file == null) {
      setPicking("idle");
      return;
    }
    setPicking("reading");
    setError(null);
    setSummary(null);
    setResults(null);
    file
      .text()
      .then((text) => {
        let arr: unknown;
        try {
          arr = JSON.parse(text);
        } catch {
          arr = null;
        }
        if (!Array.isArray(arr)) {
          setError(
            formatMessage({
              id: "import.badFile.any",
              defaultMessage:
                "That doesn’t look like a KeyLearn or keybr export — expected a JSON file.",
            }),
          );
          return;
        }
        const parsed = arr
          .map(resultFromExport)
          .filter((r): r is Result => r != null);
        setTotal(arr.length);
        setResults(parsed);
      })
      .catch(() => {
        setError(
          formatMessage({
            id: "import.readError",
            defaultMessage: "Could not read that file.",
          }),
        );
      })
      .finally(() => setPicking("idle"));
  };

  const run = async () => {
    if (results == null || targetId === "" || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const storage = openResultStorage({
        type: "private",
        userId,
        namespace: `profile-${targetId}`,
      });
      const existing = await storage.load();
      if (mode === "replace") {
        if (existing.length > 0 && !confirmReplace) {
          setConfirmReplace(true);
          setBusy(false);
          return;
        }
        await storage.clear();
        await storage.append(results);
        setSummary(
          formatMessage(
            {
              id: "import.done.replace",
              defaultMessage: "Replaced — imported {n} lessons.",
            },
            { n: results.length },
          ),
        );
      } else {
        const seen = new Set(existing.map((r) => r.timeStamp));
        const toAdd = results.filter((r) => !seen.has(r.timeStamp));
        await storage.append(toAdd);
        setSummary(
          formatMessage(
            {
              id: "import.done.merge",
              defaultMessage:
                "Imported {added} of {total} lessons ({dupes} were already there).",
            },
            {
              added: toAdd.length,
              total: results.length,
              dupes: results.length - toAdd.length,
            },
          ),
        );
      }
      setConfirmReplace(false);
    } catch (err: any) {
      setError(err?.message ?? "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className={styles.gate} onClick={onClose}>
        <div className={styles.editor} onClick={(ev) => ev.stopPropagation()}>
          <div className={styles.editorTape} aria-hidden={true} />
          <h2 className={styles.editorTitle}>
            <FormattedMessage
              id="import.title.any"
              defaultMessage="Import <acc>typing progress</acc>"
              values={{
                acc: (chunks) => (
                  <span className={styles.titleAccent}>{chunks}</span>
                ),
              }}
            />
          </h2>
          <p className={styles.hint}>
            <FormattedMessage
              id="import.intro.any"
              defaultMessage="Upload a typing-data.json exported from KeyLearn or downloaded from keybr. It’s added to the learner you choose, so their history and learned keys carry over."
            />{" "}
            <button
              type="button"
              className={styles.consentLink}
              onClick={() => setShowHelp((v) => !v)}
            >
              <FormattedMessage
                id="import.help.toggle"
                defaultMessage="How do I get this file?"
              />
            </button>
          </p>
          {showHelp && (
            <ol className={styles.helpSteps}>
              <li>
                <FormattedMessage
                  id="import.help.keylearn"
                  defaultMessage="From KeyLearn: open the profile page and click Export your data."
                />
              </li>
              <li>
                <FormattedMessage
                  id="import.help.1"
                  defaultMessage="Open your profile page on keybr.com."
                />
              </li>
              <li>
                <FormattedMessage
                  id="import.help.2"
                  defaultMessage="Scroll to the bottom of the page and click the Download data button."
                />
              </li>
              <li>
                <FormattedMessage
                  id="import.help.3"
                  defaultMessage="Save the JSON file, then upload it below."
                />
              </li>
            </ol>
          )}

          {summary != null ? (
            <>
              <p className={styles.importOk}>{summary}</p>
              <div className={styles.editorActions}>
                <button className={styles.actionPrimary} onClick={onClose}>
                  <FormattedMessage id="t_Close" defaultMessage="Close" />
                </button>
              </div>
            </>
          ) : (
            <>
              <label className={styles.importField}>
                <span className={styles.editorLbl}>
                  <FormattedMessage
                    id="import.target"
                    defaultMessage="Import into"
                  />
                </span>
                <select
                  className={styles.field}
                  value={targetId}
                  onChange={(ev) => setTargetId(ev.target.value)}
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.importField}>
                <button
                  type="button"
                  className={styles.uploadBtn}
                  onClick={choose}
                  aria-busy={picking !== "idle"}
                  aria-live="polite"
                >
                  {picking !== "idle" && (
                    <span className={styles.uploadSpin} aria-hidden="true" />
                  )}
                  {picking === "opening" ? (
                    <FormattedMessage
                      id="import.choose.opening"
                      defaultMessage="Opening…"
                    />
                  ) : picking === "reading" ? (
                    <FormattedMessage
                      id="import.choose.reading"
                      defaultMessage="Reading file…"
                    />
                  ) : (
                    <FormattedMessage
                      id="import.choose.any"
                      defaultMessage="Choose file…"
                    />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: "none" }}
                  onChange={(ev) => {
                    const file = ev.target.files?.[0];
                    // Cleared so choosing the same file again still fires.
                    ev.target.value = "";
                    onFile(file);
                  }}
                />
                {results != null && (
                  <p className={styles.hint}>
                    <FormattedMessage
                      id="import.parsed"
                      defaultMessage="Found {ok} valid lessons in this file ({total} records)."
                      values={{ ok: results.length, total }}
                    />
                  </p>
                )}
              </div>

              <div className={styles.optCards}>
                <button
                  type="button"
                  className={clsx(
                    styles.optCard,
                    mode === "merge" && styles.optCardOn,
                  )}
                  onClick={() => {
                    setMode("merge");
                    setConfirmReplace(false);
                  }}
                >
                  <span className={styles.optTitle}>
                    <FormattedMessage
                      id="import.merge.title"
                      defaultMessage="Add to my progress"
                    />
                  </span>
                  <span className={styles.optSub}>
                    <FormattedMessage
                      id="import.merge.sub"
                      defaultMessage="Keep what’s here and add the imported lessons."
                    />
                  </span>
                </button>
                <button
                  type="button"
                  className={clsx(
                    styles.optCard,
                    mode === "replace" && styles.optCardOn,
                  )}
                  onClick={() => setMode("replace")}
                >
                  <span className={styles.optTitle}>
                    <FormattedMessage
                      id="import.replace.title"
                      defaultMessage="Start fresh"
                    />
                  </span>
                  <span className={styles.optSub}>
                    <FormattedMessage
                      id="import.replace.sub"
                      defaultMessage="Erase this profile’s history and use the file."
                    />
                  </span>
                </button>
              </div>

              {confirmReplace && (
                <p className={styles.gateWrong}>
                  <FormattedMessage
                    id="import.confirmReplace"
                    defaultMessage="This profile already has progress. Replacing will permanently erase it. Click Import again to confirm."
                  />
                </p>
              )}
              {error != null && <p className={styles.gateWrong}>{error}</p>}

              <div className={styles.editorActions}>
                <button className={styles.actionGhost} onClick={onClose}>
                  <FormattedMessage id="t_Cancel" defaultMessage="Cancel" />
                </button>
                <button
                  className={styles.actionPrimary}
                  disabled={results == null || results.length === 0 || busy}
                  onClick={run}
                >
                  {confirmReplace ? (
                    <FormattedMessage
                      id="import.confirmBtn"
                      defaultMessage="Yes, replace"
                    />
                  ) : (
                    <FormattedMessage
                      id="import.import"
                      defaultMessage="Import"
                    />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}
