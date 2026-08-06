import { downloadBlob } from "@keylearn/pages-shared";
import {
  type Accent,
  ACCENTS,
  addCustomAccent,
  checkAccent,
  contrastRatio,
  type CustomAccent,
  duplicateAccent,
  exportAccents,
  isHex,
  loadCustomAccents,
  parseAccents,
  removeCustomAccent,
  updateCustomAccent,
  useTheme,
} from "@keylearn/themes";
import { clsx } from "clsx";
import { type ReactNode, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ConfirmDialog } from "../ConfirmDialog.tsx";
import { FloatingShell } from "../FloatingShell.tsx";
import { accentNames } from "./accent-names.tsx";
import * as styles from "./ThemeWindow.module.less";

const NIGHT_GROUND = "#141620";
const DAY_GROUND = "#f5f6fa";

const ZONES = [
  "#c49b9b",
  "#a9bda1",
  "#c8b48c",
  "#94a8c6",
  "#b19cba",
  "#b5a292",
];

type Filter = "all" | "core" | "academic" | "kids" | "mine";

type Draft = {
  /** The theme being rewritten, or null when this will become a new one. */
  readonly editing: string | null;
  name: string;
  night: string;
  day: string;
  /** Which list it joins — children see only their own, as with the rest. */
  forKids: boolean;
};

/**
 * Every theme, and what you can do to each.
 *
 * A shipped theme can be used, copied and exported but never edited in place
 * or deleted — editing one opens the maker pre-filled and saves the result as
 * a theme of your own, so a KeyLearn update can never clobber somebody's work
 * and nobody can delete a colour out from under another learner.
 */
export function ThemeWindow(): ReactNode {
  const { formatMessage } = useIntl();
  const { accent: current, switchAccent } = useTheme();
  const [own, setOwn] = useState<readonly CustomAccent[]>(() =>
    loadCustomAccents(),
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CustomAccent | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const all: readonly Accent[] = [...ACCENTS, ...own];
  const shown = all.filter((accent) => {
    switch (filter) {
      case "core":
        return accent.group === "core";
      case "academic":
        return accent.group === "academic";
      case "kids":
        return accent.group === "kids";
      case "mine":
        return accent.group === "custom";
      default:
        return true;
    }
  });

  const importFile = (file: File) => {
    void file.text().then((text) => {
      let next = own;
      for (const parsed of parseAccents(text)) {
        next = addCustomAccent(parsed) ?? next;
      }
      setOwn(next);
    });
  };

  return (
    <FloatingShell
      title={
        draft != null ? (
          draft.editing != null ? (
            <FormattedMessage id="theme.win.edit" defaultMessage="Edit theme" />
          ) : (
            <FormattedMessage id="theme.win.new" defaultMessage="New theme" />
          )
        ) : (
          <FormattedMessage id="theme.win.title" defaultMessage="Themes" />
        )
      }
    >
      {draft != null ? (
        <ThemeMaker
          draft={draft}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={() => {
            const saved =
              draft.editing != null
                ? updateCustomAccent(draft.editing, draft)
                : addCustomAccent(draft);
            if (saved != null) {
              setOwn(saved);
              setDraft(null);
            }
          }}
        />
      ) : (
        <>
          <div className={styles.bar}>
            <div className={styles.seg} role="group">
              {(["all", "core", "academic", "kids", "mine"] as const).map(
                (id) => (
                  <button
                    key={id}
                    type="button"
                    className={clsx(
                      styles.segBtn,
                      filter === id && styles.segOn,
                    )}
                    aria-pressed={filter === id}
                    onClick={() => setFilter(id)}
                  >
                    <FilterLabel id={id} />
                  </button>
                ),
              )}
            </div>
            <span className={styles.spacer} />
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden={true}
              onChange={(ev) => {
                const file = ev.target.files?.[0];
                if (file != null) {
                  importFile(file);
                }
                ev.target.value = "";
              }}
            />
            <button
              type="button"
              className={styles.btn}
              onClick={() => fileRef.current?.click()}
            >
              <FormattedMessage
                id="theme.win.import"
                defaultMessage="Import…"
              />
            </button>
            <button
              type="button"
              className={clsx(styles.btn, styles.btnGo)}
              onClick={() =>
                setDraft({
                  editing: null,
                  name: "",
                  night: "#8fd9b6",
                  day: "#2f8a5d",
                  forKids: false,
                })
              }
            >
              <FormattedMessage
                id="theme.win.newBtn"
                defaultMessage="+ New theme"
              />
            </button>
          </div>

          <div className={styles.rows}>
            {shown.length === 0 && (
              <p className={styles.empty}>
                <FormattedMessage
                  id="theme.win.none"
                  defaultMessage="No themes of your own yet. Copy one you like, or start a new one."
                />
              </p>
            )}
            {shown.map((accent) => {
              const mine = accent.group === "custom";
              return (
                <div
                  key={accent.id}
                  className={clsx(
                    styles.row,
                    accent.id === current && styles.rowCurrent,
                  )}
                >
                  <Bands accent={accent} />
                  <div>
                    <span className={styles.rowName}>
                      {mine ? accent.name : accentNames[accent.id]}
                      <Badge group={accent.group} />
                    </span>
                    <span className={styles.rowMeta}>
                      {accent.night} night · {accent.day} day
                    </span>
                  </div>
                  {accent.id === current ? (
                    <span className={styles.current}>
                      <FormattedMessage
                        id="theme.win.current"
                        defaultMessage="✓ In use"
                      />
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => switchAccent(accent.id)}
                    >
                      <FormattedMessage
                        id="theme.win.use"
                        defaultMessage="Use"
                      />
                    </button>
                  )}
                  <div className={styles.ops}>
                    <button
                      type="button"
                      title={formatMessage({
                        id: "theme.win.duplicate",
                        defaultMessage: "Duplicate",
                      })}
                      onClick={() => {
                        const next = duplicateAccent(
                          {
                            ...accent,
                            name: mine
                              ? accent.name
                              : String(
                                  ACCENTS.find((a) => a.id === accent.id)
                                    ?.name ?? accent.name,
                                ),
                          },
                          formatMessage({
                            id: "theme.win.copySuffix",
                            defaultMessage: "copy",
                          }),
                        );
                        if (next != null) {
                          setOwn(next);
                        }
                      }}
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      title={formatMessage({
                        id: "theme.win.export",
                        defaultMessage: "Export",
                      })}
                      onClick={() =>
                        downloadBlob(
                          new Blob([exportAccents([accent])], {
                            type: "application/json",
                          }),
                          `keylearn-theme-${accent.id}.json`,
                        )
                      }
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      title={formatMessage(
                        mine
                          ? { id: "theme.win.edit", defaultMessage: "Edit" }
                          : {
                              id: "theme.win.editCopy",
                              defaultMessage: "Edit as a copy",
                            },
                      )}
                      onClick={() =>
                        setDraft({
                          // A shipped theme is never rewritten in place: the
                          // maker opens on a copy, and Save makes it yours.
                          editing: mine ? accent.id : null,
                          name: mine
                            ? accent.name
                            : `${accent.name} ${formatMessage({
                                id: "theme.win.copySuffix",
                                defaultMessage: "copy",
                              })}`,
                          night: accent.night,
                          day: accent.day,
                          forKids:
                            accent.group === "kids" ||
                            (mine && (accent as CustomAccent).forKids),
                        })
                      }
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      disabled={!mine}
                      title={formatMessage(
                        mine
                          ? { id: "theme.win.delete", defaultMessage: "Delete" }
                          : {
                              id: "theme.win.undeletable",
                              defaultMessage:
                                "Themes that ship with KeyLearn cannot be deleted",
                            },
                      )}
                      onClick={() => setConfirmDelete(accent as CustomAccent)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {confirmDelete != null && (
        <ConfirmDialog
          title={formatMessage({
            id: "theme.win.deleteTitle",
            defaultMessage: "Delete this theme?",
          })}
          message={formatMessage(
            {
              id: "theme.win.deleteMessage",
              defaultMessage:
                "“{name}” is removed from this device. Any learner wearing it goes back to the KeyLearn mint.",
            },
            { name: confirmDelete.name },
          )}
          confirmLabel={formatMessage({
            id: "theme.win.delete",
            defaultMessage: "Delete",
          })}
          onConfirm={() => {
            const next = removeCustomAccent(confirmDelete.id);
            if (next != null) {
              setOwn(next);
            }
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </FloatingShell>
  );
}

function FilterLabel({ id }: { readonly id: Filter }): ReactNode {
  switch (id) {
    case "core":
      return <FormattedMessage id="theme.group.core" defaultMessage="Core" />;
    case "academic":
      return (
        <FormattedMessage id="theme.group.academic" defaultMessage="Academic" />
      );
    case "kids":
      return <FormattedMessage id="theme.group.kids" defaultMessage="Kids" />;
    case "mine":
      return <FormattedMessage id="theme.win.mine" defaultMessage="Mine" />;
    default:
      return <FormattedMessage id="theme.win.all" defaultMessage="All" />;
  }
}

function Badge({ group }: { readonly group: Accent["group"] }): ReactNode {
  switch (group) {
    case "core":
      return (
        <span className={clsx(styles.badge, styles.bCore)}>
          <FormattedMessage id="theme.group.core" defaultMessage="Core" />
        </span>
      );
    case "academic":
      return (
        <span className={clsx(styles.badge, styles.bAcademic)}>
          <FormattedMessage
            id="theme.group.academic"
            defaultMessage="Academic"
          />
        </span>
      );
    case "kids":
      return (
        <span className={clsx(styles.badge, styles.bKids)}>
          <FormattedMessage id="theme.group.kids" defaultMessage="Kids" />
        </span>
      );
    case "custom":
      return (
        <span className={clsx(styles.badge, styles.bMine)}>
          <FormattedMessage id="theme.win.mine" defaultMessage="Mine" />
        </span>
      );
    default:
      return null;
  }
}

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const move = (c: number) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const parts = [move((n >> 16) & 255), move((n >> 8) & 255), move(n & 255)];
  return `#${parts.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function Bands({ accent }: { readonly accent: Accent }): ReactNode {
  return (
    <span className={styles.rowBands} aria-hidden={true}>
      <i style={{ backgroundColor: accent.night }} />
      <i style={{ backgroundColor: shade(accent.night, -0.18) }} />
      <i style={{ backgroundColor: shade(accent.night, 0.22) }} />
    </span>
  );
}

/**
 * The maker: a name and two hexes, with each colour shown on the ground it
 * will actually sit on. The finger zones are drawn under both previews to be
 * watched rather than adjusted — no theme can move them.
 */
function ThemeMaker({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  readonly draft: Draft;
  readonly onChange: (next: Draft) => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}): ReactNode {
  const problems = checkAccent(draft);
  const bad = (field: "name" | "night" | "day") =>
    problems.some((p) => p.field === field);

  return (
    <>
      <div className={styles.maker}>
        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              <FormattedMessage
                id="theme.maker.who"
                defaultMessage="Who is it for"
              />
            </span>
            <div className={styles.seg} role="group">
              {[false, true].map((kids) => (
                <button
                  key={String(kids)}
                  type="button"
                  className={clsx(
                    styles.segBtn,
                    draft.forKids === kids && styles.segOn,
                  )}
                  aria-pressed={draft.forKids === kids}
                  onClick={() => onChange({ ...draft, forKids: kids })}
                >
                  {kids ? (
                    <FormattedMessage
                      id="theme.maker.kids"
                      defaultMessage="Kids"
                    />
                  ) : (
                    <FormattedMessage
                      id="theme.maker.grownups"
                      defaultMessage="Grown-ups"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              <FormattedMessage id="theme.maker.name" defaultMessage="Name" />
            </span>
            <input
              className={styles.textbox}
              value={draft.name}
              maxLength={40}
              onChange={(ev) => onChange({ ...draft, name: ev.target.value })}
            />
          </label>

          <HexField
            label={
              <FormattedMessage
                id="theme.maker.night"
                defaultMessage="On the night ground"
              />
            }
            value={draft.night}
            ground={NIGHT_GROUND}
            onChange={(night) => onChange({ ...draft, night })}
          />
          <HexField
            label={
              <FormattedMessage
                id="theme.maker.day"
                defaultMessage="On the day ground"
              />
            }
            value={draft.day}
            ground={DAY_GROUND}
            onChange={(day) => onChange({ ...draft, day })}
          />

          {problems.length > 0 && (
            <div className={styles.refuse}>
              <span aria-hidden={true}>⚠</span>
              <span>
                {bad("name") ? (
                  <FormattedMessage
                    id="theme.maker.needName"
                    defaultMessage="Give it a name so you can find it again."
                  />
                ) : (
                  <FormattedMessage
                    id="theme.maker.tooFaint"
                    defaultMessage="Too faint against its ground — the next key would be invisible. Move it past 3:1 to save."
                  />
                )}
              </span>
            </div>
          )}

          <p className={styles.note}>
            <FormattedMessage
              id="theme.maker.twoHexes"
              defaultMessage="Two colours, not one. A colour that reads on a near-black ground is invisible on a near-white one, so the maker asks for both rather than guessing."
            />
          </p>
        </div>

        <div className={styles.fields}>
          <Preview hex={draft.night} night={true} />
          <Preview hex={draft.day} night={false} />
          <p className={styles.note}>
            <FormattedMessage
              id="theme.maker.zones"
              defaultMessage="The strip under each preview is the finger zones. They are here to be watched, not adjusted: no theme can move them."
            />
          </p>
        </div>
      </div>

      <div className={styles.foot}>
        <span className={styles.spacer} />
        <button type="button" className={styles.btn} onClick={onCancel}>
          <FormattedMessage id="theme.maker.cancel" defaultMessage="Cancel" />
        </button>
        <button
          type="button"
          className={clsx(styles.btn, styles.btnGo)}
          disabled={problems.length > 0}
          onClick={onSave}
        >
          <FormattedMessage id="theme.maker.save" defaultMessage="Save theme" />
        </button>
      </div>
    </>
  );
}

function HexField({
  label,
  value,
  ground,
  onChange,
}: {
  readonly label: ReactNode;
  readonly value: string;
  readonly ground: string;
  readonly onChange: (hex: string) => void;
}): ReactNode {
  const ok = isHex(value) && contrastRatio(value, ground) >= 3;
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.hexRow}>
        <input
          type="color"
          className={styles.hexDot}
          value={isHex(value) ? value : "#8fd9b6"}
          onChange={(ev) => onChange(ev.target.value)}
        />
        <input
          className={clsx(styles.textbox, styles.hexBox)}
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
        />
        <span
          className={clsx(styles.ratio, ok ? styles.ratioOk : styles.ratioBad)}
        >
          {isHex(value) ? `${contrastRatio(value, ground).toFixed(1)}:1` : "—"}
        </span>
      </div>
    </div>
  );
}

function Preview({
  hex,
  night,
}: {
  readonly hex: string;
  readonly night: boolean;
}): ReactNode {
  const accent = isHex(hex) ? hex : "#8fd9b6";
  const ink = night ? "#141620" : "#fff";
  const key = night ? "#232838" : "#eceff6";
  const dim = night ? "#9aa0b4" : "#5d6377";
  return (
    <div
      className={clsx(
        styles.preview,
        night ? styles.previewNight : styles.previewDay,
      )}
    >
      <span
        className={styles.caret}
        style={{ backgroundColor: accent, color: ink }}
      >
        t
      </span>
      <span>he quick brown </span>
      <span className={styles.dim}>fox</span>
      <div className={styles.keys}>
        <b style={{ backgroundColor: accent, color: ink }}>T</b>
        <b style={{ backgroundColor: key, color: dim }}>H</b>
        <b style={{ backgroundColor: key, color: dim }}>E</b>
      </div>
      <div className={styles.zones}>
        {ZONES.map((zone) => (
          <i
            key={zone}
            className={styles.zoneBar}
            style={{ backgroundColor: zone }}
          />
        ))}
      </div>
      <div className={styles.previewTag} style={{ color: dim }}>
        {night ? (
          <FormattedMessage id="theme.maker.tagNight" defaultMessage="Night" />
        ) : (
          <FormattedMessage id="theme.maker.tagDay" defaultMessage="Day" />
        )}
      </div>
    </div>
  );
}
