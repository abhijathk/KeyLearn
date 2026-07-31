import { usePageData } from "@keybr/pages-shared";
import { Button } from "@keybr/widget";
import { clsx } from "clsx";
import { type CSSProperties, type ReactNode, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { ConfirmDialog } from "../ConfirmDialog.tsx";
import { type ProfileInput } from "../service.ts";
import { presetById, presetsFor } from "./avatars.ts";
import { ConsentDocument } from "./ConsentDocument.tsx";
import { useProfiles } from "./context.tsx";
import { KeybrImport } from "./KeybrImport.tsx";
import { ProfileAvatar } from "./ProfileAvatar.tsx";
import * as styles from "./Profiles.module.less";
import {
  adultProfiles,
  type Avatar,
  type Profile,
  type ProfileKind,
} from "./store.ts";
import { type ProfileStats, useProfileStats } from "./useProfileStats.ts";

// The Kid / Grown-up badge takes its colour from the learner's own avatar,
// so a row reads as one identity. Photo avatars fall back to the theme accent.
function badgeStyle(p: Profile): CSSProperties {
  if (p.avatar != null && p.avatar.type === "icon") {
    const preset = presetById(p.avatar.id);
    return { background: preset.bg, color: preset.fg };
  }
  return {};
}

// A learner's live progress: a bar plus a short summary. Kids read as letters
// learned out of their alphabet; grown-ups read as top speed and day streak.
function ProgressLine({
  p,
  st,
}: {
  readonly p: Profile;
  readonly st: ProfileStats | undefined;
}): ReactNode {
  if (st == null || st.resultCount === 0) {
    return (
      <div className={styles.prog}>
        <span className={styles.pbar}>
          <i style={{ inlineSize: 0 }} />
        </span>
        <span className={styles.pv}>
          <FormattedMessage
            id="profiles.noPractice"
            defaultMessage="No practice yet"
          />
        </span>
      </div>
    );
  }
  const wpm = Math.max(1, Math.round(st.topSpeed / 5));
  const hasLetters =
    st.unlockedLetters != null &&
    st.totalLetters != null &&
    st.totalLetters > 0;
  const pct = Math.max(
    0,
    Math.min(
      1,
      hasLetters
        ? st.unlockedLetters! / st.totalLetters!
        : Math.min(st.topSpeed / 350, 1),
    ),
  );
  return (
    <div className={styles.prog}>
      <span className={styles.pbar}>
        <i style={{ inlineSize: `${Math.round(pct * 100)}%` }} />
      </span>
      <span className={styles.pv}>
        {p.kind === "kid" && hasLetters ? (
          <FormattedMessage
            id="profiles.progressLetters"
            defaultMessage="{n} of {total} letters"
            values={{ n: st.unlockedLetters, total: st.totalLetters }}
          />
        ) : (
          <FormattedMessage
            id="profiles.progressSpeed"
            defaultMessage="{wpm} wpm · {streak}-day streak"
            values={{ wpm, streak: st.streakDays }}
          />
        )}
      </span>
    </div>
  );
}

type Editing =
  | { readonly mode: "add" }
  | { readonly mode: "edit"; readonly profile: Profile }
  | null;

/**
 * The household profile manager, embedded in the account page: a row of
 * learner tiles to switch between, plus add / edit / delete behind a
 * grown-ups-only gate. The caller only shows it to a signed-in admin.
 */
export function ProfilesManager(): ReactNode {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  const { household, active, maxProfiles, add, update, remove, reorder } =
    useProfiles();
  const [editing, setEditing] = useState<Editing>(null);
  const [importing, setImporting] = useState(false);
  const stats = useProfileStats(household.profiles);

  const adults = adultProfiles(household);

  // Profiles arrive already in the saved display order from the context.
  const ordered = household.profiles;

  return (
    <div className={styles.manager}>
      <div className={styles.rows}>
        {ordered.map((p, index) => {
          const isActive = active?.id === p.id;
          return (
            <div
              key={p.id}
              className={clsx(styles.row, isActive && styles.rowActive)}
            >
              {ordered.length > 1 && (
                <span className={styles.reorder}>
                  <button
                    className={styles.arrow}
                    disabled={index === 0}
                    title={formatMessage({
                      id: "profiles.moveUp",
                      defaultMessage: "Move up",
                    })}
                    onClick={() => reorder(p.id, -1)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden={true}>
                      <path d="M6 15l6-6 6 6" />
                    </svg>
                  </button>
                  <button
                    className={styles.arrow}
                    disabled={index === ordered.length - 1}
                    title={formatMessage({
                      id: "profiles.moveDown",
                      defaultMessage: "Move down",
                    })}
                    onClick={() => reorder(p.id, 1)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden={true}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </span>
              )}
              <div className={styles.rowMain}>
                <ProfileAvatar avatar={p.avatar} name={p.firstName} size={34} />
                <span className={styles.rowInfo}>
                  <span className={styles.rowName}>
                    {p.firstName}
                    {isActive && (
                      <span className={styles.activeChip}>
                        <FormattedMessage
                          id="profiles.active"
                          defaultMessage="Active"
                        />
                      </span>
                    )}
                  </span>
                  <ProgressLine p={p} st={stats.get(p.id)} />
                </span>
              </div>
              <span className={styles.kindBadge} style={badgeStyle(p)}>
                {p.kind === "kid" ? (
                  <FormattedMessage id="profiles.kid" defaultMessage="Kid" />
                ) : (
                  <FormattedMessage
                    id="profiles.adult"
                    defaultMessage="Grown-up"
                  />
                )}
              </span>
              <button
                className={styles.rowEdit}
                title={formatMessage(
                  defineMessage({
                    id: "profiles.edit",
                    defaultMessage: "Edit profile",
                  }),
                )}
                onClick={() => setEditing({ mode: "edit", profile: p })}
              >
                <FormattedMessage
                  id="profiles.editShort"
                  defaultMessage="Edit"
                />
              </button>
            </div>
          );
        })}
      </div>

      {household.profiles.length < maxProfiles && (
        <button
          className={styles.addRow}
          onClick={() => setEditing({ mode: "add" })}
        >
          <span className={styles.addPlus}>+</span>
          <FormattedMessage id="profiles.add" defaultMessage="Add a profile" />
        </button>
      )}

      {household.profiles.length >= maxProfiles && (
        <p className={styles.hint}>
          <FormattedMessage
            id="profiles.maxReached"
            defaultMessage="A household can have up to {max} profiles — kids and grown-ups in any mix. Delete one to add another."
            values={{ max: maxProfiles }}
          />
        </p>
      )}

      {publicUser.id != null && adults.length > 0 && (
        <button
          type="button"
          className={styles.importCta}
          onClick={() => setImporting(true)}
        >
          <svg
            className={styles.importCtaIcon}
            viewBox="0 0 24 24"
            aria-hidden={true}
          >
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
          </svg>
          <span className={styles.importCtaText}>
            <span className={styles.importCtaTitle}>
              <FormattedMessage
                id="profiles.importKeybr.title"
                defaultMessage="Coming from keybr?"
              />
            </span>
            <span className={styles.importCtaSub}>
              <FormattedMessage
                id="profiles.importKeybr.sub"
                defaultMessage="Bring your typing progress across →"
              />
            </span>
          </span>
        </button>
      )}

      {importing && publicUser.id != null && (
        <KeybrImport
          profiles={adults}
          userId={publicUser.id}
          onClose={() => setImporting(false)}
        />
      )}

      {editing != null && (
        <ProfileEditor
          profile={editing.mode === "edit" ? editing.profile : null}
          onSave={(data) => {
            if (editing.mode === "edit") {
              update(editing.profile.id, data);
            } else {
              add(data);
            }
            setEditing(null);
          }}
          onDelete={
            editing.mode === "edit"
              ? () => {
                  remove(editing.profile.id);
                  setEditing(null);
                }
              : null
          }
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ProfileEditor({
  profile,
  onSave,
  onDelete,
  onCancel,
}: {
  readonly profile: Profile | null;
  readonly onSave: (data: ProfileInput) => void;
  readonly onDelete: (() => void) | null;
  readonly onCancel: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [kind, setKind] = useState<ProfileKind>(profile?.kind ?? "kid");
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  // Last name is preserved on edit but no longer part of the simplified form.
  const [lastName] = useState(profile?.lastName ?? "");
  const [birthYear, setBirthYear] = useState(
    profile?.birthYear != null ? String(profile.birthYear) : "",
  );
  const [avatar, setAvatar] = useState<Avatar>(
    profile?.avatar ?? { type: "icon", id: presetsFor("kid")[0].id },
  );
  const [consent, setConsent] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A brand-new child profile needs the grown-up's consent; an existing kid
  // already has it recorded, so we don't re-ask on edit.
  const needConsent = profile == null && kind === "kid";

  // Switching between Kid and Grown-up swaps the palette; carry a selected
  // swatch over to the same colour slot in the other palette.
  const switchKind = (next: ProfileKind) => {
    setKind(next);
    if (avatar.type === "icon") {
      const index = presetsFor(kind).findIndex((p) => p.id === avatar.id);
      if (index >= 0) {
        setAvatar({ type: "icon", id: presetsFor(next)[index].id });
      }
    }
  };

  const save = () => {
    if (firstName.trim() === "") {
      setError(
        formatMessage({
          id: "profiles.needName",
          defaultMessage: "Please enter a first name.",
        }),
      );
      return;
    }
    if (needConsent && !consent) {
      setError(
        formatMessage({
          id: "profiles.needConsent",
          defaultMessage:
            "Please read and confirm the parental consent to create a child profile.",
        }),
      );
      return;
    }
    // Accept either a birth year ("2019") or a plain age ("7") — a small
    // number is converted so the stored value is always a birth year, and
    // the learner's age keeps counting up on its own.
    const raw = birthYear.trim() === "" ? null : Number(birthYear);
    const year =
      raw != null && Number.isFinite(raw)
        ? raw > 0 && raw < 120
          ? new Date().getFullYear() - raw
          : raw >= 1900
            ? raw
            : null
        : null;
    onSave({
      kind,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthYear: year,
      avatar,
      ...(kind === "kid"
        ? { parentalConsent: consent || profile != null }
        : {}),
    });
  };

  // Swatches echo the learner's initial once a name is typed; before that they
  // stay as plain colour chips rather than showing a placeholder glyph.
  const initial = firstName.trim().slice(0, 1).toUpperCase();

  return (
    <div className={styles.gate}>
      <div className={styles.editor}>
        <div className={styles.editorTape} aria-hidden={true} />
        <h2 className={styles.editorTitle}>
          {profile != null ? (
            <FormattedMessage
              id="profiles.editor.editTitle"
              defaultMessage="Edit <acc>learner</acc>"
              values={{
                acc: (chunks) => (
                  <span className={styles.titleAccent}>{chunks}</span>
                ),
              }}
            />
          ) : (
            <FormattedMessage
              id="profiles.editor.addTitle"
              defaultMessage="Add a <acc>learner</acc>"
              values={{
                acc: (chunks) => (
                  <span className={styles.titleAccent}>{chunks}</span>
                ),
              }}
            />
          )}
        </h2>

        <div className={styles.field2}>
          <p className={styles.editorLbl}>
            <FormattedMessage
              id="profiles.whoIsThis"
              defaultMessage="Who is this?"
            />
          </p>
          <div className={styles.kindRow}>
            <button
              className={clsx(styles.seg, kind === "adult" && styles.segOn)}
              onClick={() => switchKind("adult")}
            >
              <AdultIcon />
              <FormattedMessage id="profiles.adult" defaultMessage="Grown-up" />
            </button>
            <button
              className={clsx(
                styles.seg,
                styles.segKid,
                kind === "kid" && styles.segOn,
              )}
              onClick={() => switchKind("kid")}
            >
              <KidIcon />
              <FormattedMessage id="profiles.kid" defaultMessage="Kid" />
            </button>
          </div>
        </div>

        <div className={styles.two}>
          <div className={styles.field2}>
            <p className={styles.editorLbl}>
              <FormattedMessage
                id="profiles.firstName"
                defaultMessage="First name"
              />
            </p>
            <input
              className={styles.field}
              type="text"
              value={firstName}
              onChange={(ev) => setFirstName(ev.target.value)}
            />
          </div>
          <div className={styles.field2}>
            <p className={styles.editorLbl}>
              <FormattedMessage
                id="profiles.yearBorn"
                defaultMessage="Year born"
              />
            </p>
            <input
              className={styles.field}
              type="text"
              inputMode="numeric"
              placeholder={formatMessage({
                id: "profiles.yearBorn.hint",
                defaultMessage: "e.g. 2016",
              })}
              value={birthYear}
              onChange={(ev) => setBirthYear(ev.target.value)}
            />
          </div>
        </div>

        <div className={styles.field2}>
          <p className={styles.editorLbl}>
            <FormattedMessage id="profiles.colour" defaultMessage="Colour" />
          </p>
          <div className={styles.swatchGrid}>
            {presetsFor(kind).map((p) => (
              <button
                key={p.id}
                className={clsx(
                  styles.swatch,
                  avatar.type === "icon" &&
                    avatar.id === p.id &&
                    styles.swatchOn,
                )}
                style={{ background: p.bg, color: p.fg }}
                onClick={() => setAvatar({ type: "icon", id: p.id })}
                aria-label={p.id}
              >
                {initial}
              </button>
            ))}
          </div>
        </div>

        {needConsent && (
          <div className={styles.consentBox}>
            <button
              type="button"
              role="checkbox"
              aria-checked={consent}
              className={clsx(styles.cbox, consent && styles.cboxOn)}
              onClick={() => setConsent(!consent)}
            >
              {consent && (
                <svg viewBox="0 0 24 24" aria-hidden={true}>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
            <span className={styles.consentText}>
              <FormattedMessage
                id="profiles.consentLabel"
                defaultMessage="I'm the parent or guardian and I consent to my child using KeyLearn. "
              />
              <button
                type="button"
                className={styles.consentLink}
                onClick={() => setShowConsent(true)}
              >
                <FormattedMessage
                  id="profiles.consentRead"
                  defaultMessage="Read the policy"
                />
              </button>
            </span>
          </div>
        )}

        {error != null && <p className={styles.gateWrong}>{error}</p>}

        <div className={styles.editorActions}>
          {onDelete != null && (
            <button
              className={styles.deleteBtn}
              onClick={() => setConfirmDelete(true)}
            >
              <FormattedMessage id="profiles.delete" defaultMessage="Delete" />
            </button>
          )}
          <button className={styles.actionGhost} onClick={onCancel}>
            <FormattedMessage id="t_Cancel" defaultMessage="Cancel" />
          </button>
          <button className={styles.actionPrimary} onClick={save}>
            {profile != null ? (
              <FormattedMessage id="profiles.save" defaultMessage="Save" />
            ) : (
              <FormattedMessage
                id="profiles.addLearner"
                defaultMessage="Add learner"
              />
            )}
          </button>
        </div>
      </div>

      {confirmDelete && onDelete != null && (
        <ConfirmDialog
          title={formatMessage({
            id: "profiles.delete.confirmTitle",
            defaultMessage: "Delete this learner?",
          })}
          message={formatMessage(
            {
              id: "profiles.delete.confirmMessage",
              defaultMessage:
                "This removes {name} and their practice progress from this device. This can't be undone.",
            },
            { name: firstName.trim() || profile?.firstName || "" },
          )}
          confirmLabel={formatMessage({
            id: "profiles.delete",
            defaultMessage: "Delete",
          })}
          danger={true}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {showConsent && (
        <div
          className={styles.consentOverlay}
          onClick={() => setShowConsent(false)}
        >
          <div
            className={styles.consentModal}
            onClick={(ev) => ev.stopPropagation()}
          >
            <ConsentDocument />
            <div className={styles.editorActions}>
              <span className={styles.spacer} />
              <Button
                size={16}
                label={formatMessage({
                  id: "t_Close",
                  defaultMessage: "Close",
                })}
                onClick={() => setShowConsent(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdultIcon(): ReactNode {
  return (
    <svg className={styles.segIcon} viewBox="0 0 24 24" aria-hidden={true}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" />
    </svg>
  );
}

function KidIcon(): ReactNode {
  return (
    <svg className={styles.segIcon} viewBox="0 0 24 24" aria-hidden={true}>
      <circle cx="12" cy="9" r="3" />
      <path d="M6 20c0-3 2.7-5 6-5s6 2 6 5" />
    </svg>
  );
}
