import { Button, Field, FieldList, TextField } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode, useRef, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { useNavigate } from "react-router";
import { photoToDataUrl,presetsFor } from "./avatars.ts";
import { useProfiles } from "./context.tsx";
import { ParentGate } from "./ParentGate.tsx";
import { ProfileAvatar } from "./ProfileAvatar.tsx";
import * as styles from "./Profiles.module.less";
import {
  type Avatar,
  MAX_PROFILES,
  type Profile,
  type ProfileKind,
} from "./store.ts";

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
  const navigate = useNavigate();
  const { household, active, add, update, remove, select } = useProfiles();
  const [editing, setEditing] = useState<Editing>(null);
  // One gate covers every admin action; once passed it stays open for the visit.
  const [unlocked, setUnlocked] = useState(false);
  const [gateNext, setGateNext] = useState<(() => void) | null>(null);

  const guard = (action: () => void) => {
    if (unlocked) {
      action();
    } else {
      setGateNext(() => action);
    }
  };

  const openProfile = (p: Profile) => {
    select(p.id);
    navigate(p.kind === "kid" ? "/kids" : "/");
  };

  return (
    <div className={styles.manager}>
      <div className={styles.grid}>
        {household.profiles.map((p) => (
          <div key={p.id} className={styles.tileWrap}>
            <button
              className={clsx(
                styles.tile,
                active?.id === p.id && styles.tileActive,
              )}
              onClick={() => openProfile(p)}
            >
              <ProfileAvatar avatar={p.avatar} name={p.firstName} size={72} />
              <span className={styles.tileName}>{p.firstName}</span>
              <span className={styles.tileKind}>
                {p.kind === "kid" ? (
                  <FormattedMessage id="profiles.kid" defaultMessage="Kid" />
                ) : (
                  <FormattedMessage
                    id="profiles.adult"
                    defaultMessage="Grown-up"
                  />
                )}
              </span>
            </button>
            <button
              className={styles.editBtn}
              title={formatMessage(
                defineMessage({
                  id: "profiles.edit",
                  defaultMessage: "Edit profile",
                }),
              )}
              onClick={() =>
                guard(() => setEditing({ mode: "edit", profile: p }))
              }
            >
              <FormattedMessage id="profiles.editShort" defaultMessage="Edit" />
            </button>
          </div>
        ))}

        {household.profiles.length < MAX_PROFILES && (
          <button
            className={clsx(styles.tile, styles.tileAdd)}
            onClick={() => guard(() => setEditing({ mode: "add" }))}
          >
            <span className={styles.plus}>+</span>
            <span className={styles.tileName}>
              <FormattedMessage
                id="profiles.add"
                defaultMessage="Add a profile"
              />
            </span>
          </button>
        )}
      </div>

      {household.profiles.length >= MAX_PROFILES && (
        <p className={styles.hint}>
          <FormattedMessage
            id="profiles.maxReached"
            defaultMessage="A household can have up to {max} profiles — kids and grown-ups in any mix. Delete one to add another."
            values={{ max: MAX_PROFILES }}
          />
        </p>
      )}

      {active != null && (
        <p className={styles.hint}>
          <FormattedMessage
            id="profiles.activeHint"
            defaultMessage="Active profile: {name}. Each profile keeps its own progress on this device."
            values={{ name: active.firstName }}
          />
        </p>
      )}

      {gateNext != null && (
        <ParentGate
          a={7}
          b={3}
          onPass={() => {
            setUnlocked(true);
            const next = gateNext;
            setGateNext(null);
            next();
          }}
          onCancel={() => setGateNext(null)}
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
  readonly onSave: (data: Omit<Profile, "id">) => void;
  readonly onDelete: (() => void) | null;
  readonly onCancel: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ProfileKind>(profile?.kind ?? "kid");
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [birthYear, setBirthYear] = useState(
    profile?.birthYear != null ? String(profile.birthYear) : "",
  );
  const [avatar, setAvatar] = useState<Avatar>(
    profile?.avatar ?? { type: "icon", id: presetsFor("kid")[0].id },
  );
  const [error, setError] = useState<string | null>(null);

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

  const pickPhoto = (file: File | undefined) => {
    if (file == null) {
      return;
    }
    photoToDataUrl(file)
      .then((dataUrl) => setAvatar({ type: "photo", dataUrl }))
      .catch((err) => setError(err.message));
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
    const year = birthYear.trim() === "" ? null : Number(birthYear);
    onSave({
      kind,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthYear: Number.isFinite(year) ? year : null,
      avatar,
    });
  };

  return (
    <div className={styles.gate}>
      <div className={styles.editor}>
        <h2 className={styles.gateTitle}>
          {profile != null ? (
            <FormattedMessage
              id="profiles.editor.editTitle"
              defaultMessage="Edit profile"
            />
          ) : (
            <FormattedMessage
              id="profiles.editor.addTitle"
              defaultMessage="New profile"
            />
          )}
        </h2>

        <div className={styles.kindRow}>
          <button
            className={clsx(styles.seg, kind === "kid" && styles.segOn)}
            onClick={() => switchKind("kid")}
          >
            <FormattedMessage id="profiles.kid" defaultMessage="Kid" />
          </button>
          <button
            className={clsx(styles.seg, kind === "adult" && styles.segOn)}
            onClick={() => switchKind("adult")}
          >
            <FormattedMessage id="profiles.adult" defaultMessage="Grown-up" />
          </button>
        </div>

        <div className={styles.avatarRow}>
          <ProfileAvatar avatar={avatar} name={firstName || "?"} size={72} />
          <div className={styles.presetGrid}>
            {presetsFor(kind).map((p) => (
              <button
                key={p.id}
                className={clsx(
                  styles.swatch,
                  avatar.type === "icon" &&
                    avatar.id === p.id &&
                    styles.swatchOn,
                )}
                style={{ background: p.bg }}
                onClick={() => setAvatar({ type: "icon", id: p.id })}
                aria-label={p.id}
              />
            ))}
            <button
              className={styles.uploadBtn}
              onClick={() => fileRef.current?.click()}
            >
              <FormattedMessage
                id="profiles.uploadPhoto"
                defaultMessage="Photo…"
              />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(ev) => pickPhoto(ev.target.files?.[0])}
            />
          </div>
        </div>

        <FieldList>
          <Field>
            <TextField
              size={24}
              type="text"
              placeholder={formatMessage({
                id: "profiles.firstName",
                defaultMessage: "First name",
              })}
              value={firstName}
              onChange={setFirstName}
            />
          </Field>
        </FieldList>
        {kind === "adult" && (
          <FieldList>
            <Field>
              <TextField
                size={24}
                type="text"
                placeholder={formatMessage({
                  id: "profiles.lastName",
                  defaultMessage: "Last name (optional)",
                })}
                value={lastName}
                onChange={setLastName}
              />
            </Field>
          </FieldList>
        )}
        <FieldList>
          <Field>
            <TextField
              size={24}
              type="text"
              placeholder={formatMessage({
                id: "profiles.birthYear",
                defaultMessage: "Birth year (e.g. 2016)",
              })}
              value={birthYear}
              onChange={setBirthYear}
            />
          </Field>
        </FieldList>

        {error != null && <p className={styles.gateWrong}>{error}</p>}

        <div className={styles.editorActions}>
          {onDelete != null && (
            <button className={styles.deleteBtn} onClick={onDelete}>
              <FormattedMessage id="profiles.delete" defaultMessage="Delete" />
            </button>
          )}
          <span className={styles.spacer} />
          <Button
            size={16}
            label={formatMessage({ id: "t_Cancel", defaultMessage: "Cancel" })}
            onClick={onCancel}
          />
          <Button
            size={16}
            label={formatMessage({
              id: "profiles.save",
              defaultMessage: "Save",
            })}
            onClick={save}
          />
        </div>
      </div>
    </div>
  );
}
