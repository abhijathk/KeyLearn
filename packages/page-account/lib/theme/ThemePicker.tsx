import {
  accessibilityActive,
  canChooseAccent,
  loadAccent,
  loadThemedZones,
  Pages,
  saveThemedZones,
  ZONES_CHANGED_EVENT,
} from "@keylearn/pages-shared";
import {
  type Accent,
  accentsFor,
  defaultAccentFor,
  findAccent,
  useTheme,
} from "@keylearn/themes";
import { clsx } from "clsx";
import { type ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useNavigate } from "react-router";
import { Toggle } from "../controls.tsx";
import { BrailleAvatar } from "../profiles/BrailleBadge.tsx";
import { useProfiles } from "../profiles/context.tsx";
import { accentHues, accentNames } from "./accent-names.tsx";
import * as styles from "./ThemePicker.module.less";

/**
 * Choose a learner, then choose their colour.
 *
 * One panel, a learner at a time: the list below the chooser changes with the
 * learner, so nobody has to sign in as their own child to give them a colour.
 * Which list a learner sees follows `kind` and never the page they are on —
 * adult and braille profiles are both `kind: "adult"`, so both get the core
 * and academic sets and braille needs no special case.
 */
export function ThemePicker(): ReactNode {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { household } = useProfiles();
  const { accent: liveAccent, switchAccent } = useTheme();

  const profiles = household.profiles;
  const [chosenId, setChosenId] = useState<string | null>(
    () => household.activeId ?? profiles[0]?.id ?? null,
  );
  // Dressing a learner who is not at the keyboard deliberately does not
  // repaint the app, which means nothing at all would move on screen — the
  // chip would not even take its selected border, and the pick would look
  // like it had failed. This forces the re-read that shows it landed.
  const [, setPicked] = useState(0);

  if (!canChooseAccent() || profiles.length === 0) {
    return <LockedThemes />;
  }

  const chosen = profiles.find((p) => p.id === chosenId) ?? profiles[0];
  // The learner at the keyboard wears what the app is actually painted in;
  // anyone else wears whatever is recorded for them.
  const current =
    chosen.id === household.activeId
      ? liveAccent
      : loadAccent(chosen.id, chosen.kind);
  const accent = findAccent(current);
  const pick = (id: string) => {
    switchAccent(id, chosen.id, chosen.kind);
    setPicked((n) => n + 1);
  };
  const list = accentsFor(chosen.kind);
  const core = list.filter((item) => item.group === "core");
  const academic = list.filter((item) => item.group === "academic");
  const kids = list.filter((item) => item.group === "kids");
  const themedHint = formatMessage({
    id: "theme.themedForLearner",
    defaultMessage: "Themed keyboard on for this learner",
  });

  return (
    <div className={styles.picker}>
      <div className={styles.who} role="group">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            className={clsx(
              styles.whoBtn,
              profile.id === chosen.id && styles.whoOn,
            )}
            aria-pressed={profile.id === chosen.id}
            onClick={() => setChosenId(profile.id)}
          >
            <BrailleAvatar
              avatar={profile.avatar}
              name={profile.firstName}
              size={28}
              braille={profile.visionSupport}
              kind={profile.kind}
              accessible={accessibilityActive(profile.id)}
            />
            <span className={styles.whoText}>
              <span className={styles.whoName}>
                {profile.firstName}
                {loadThemedZones(profile.id) && (
                  <span
                    className={styles.whoDot}
                    title={themedHint}
                    aria-label={themedHint}
                  />
                )}
              </span>
              <span className={styles.whoKind}>
                {profile.kind === "kid" ? (
                  <FormattedMessage id="profiles.kid" defaultMessage="Kid" />
                ) : (
                  <FormattedMessage
                    id="profiles.adult"
                    defaultMessage="Grown-up"
                  />
                )}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Belongs to the learner chosen above, not to whoever is signed in —
          so a parent can give one child the themed keyboard without changing
          it for the rest of the house. */}
      <ThemedZonesRow profileId={chosen.id} />

      <p className={styles.caption}>
        {chosen.kind === "kid" ? (
          <FormattedMessage
            id="theme.showingForKid"
            defaultMessage="Showing colours for {name} — kid"
            values={{ name: <b>{chosen.firstName}</b> }}
          />
        ) : (
          <FormattedMessage
            id="theme.showingForAdult"
            defaultMessage="Showing colours for {name} — grown-up"
            values={{ name: <b>{chosen.firstName}</b> }}
          />
        )}
      </p>

      <div className={styles.hero}>
        <span
          className={styles.heroSwatch}
          style={{ backgroundColor: accent.night }}
        />
        <span className={styles.heroText}>
          <span className={styles.heroName}>{accentNames[accent.id]}</span>
          <span className={styles.heroSub}>
            <FormattedMessage
              id="theme.hero.sub"
              defaultMessage="The caret, the next key, buttons, toggles and progress. Backgrounds and finger colours never move."
            />
          </span>
        </span>
      </div>

      {core.length > 0 && (
        <ThemeGroup
          label={
            <FormattedMessage id="theme.group.core" defaultMessage="Core" />
          }
          accents={core}
          current={accent.id}
          kind={chosen.kind}
          onPick={pick}
        />
      )}
      {academic.length > 0 && (
        <ThemeGroup
          label={
            <FormattedMessage
              id="theme.group.academic"
              defaultMessage="Academic"
            />
          }
          accents={academic}
          current={accent.id}
          kind={chosen.kind}
          onPick={pick}
        />
      )}
      {kids.length > 0 && (
        <ThemeGroup
          label={
            <FormattedMessage id="theme.group.kids" defaultMessage="Kids" />
          }
          accents={kids}
          current={accent.id}
          kind={chosen.kind}
          onPick={pick}
        />
      )}

      {chosen.kind !== "kid" && (
        <>
          <div className={styles.groupLabel}>
            <FormattedMessage id="theme.group.own" defaultMessage="Your own" />
          </div>
          <div className={styles.group}>
            <button
              type="button"
              className={styles.chip}
              onClick={() => navigate(Pages.design.path)}
            >
              <span className={styles.chipText}>
                <span className={styles.chipName}>
                  <FormattedMessage
                    id="theme.custom"
                    defaultMessage="Custom…"
                  />
                </span>
                <span className={styles.chipHue}>
                  <FormattedMessage
                    id="theme.custom.sub"
                    defaultMessage="open the designer"
                  />
                </span>
              </span>
              <span className={styles.customBand} aria-hidden={true} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ThemeGroup({
  label,
  accents,
  current,
  kind,
  onPick,
}: {
  readonly label: ReactNode;
  readonly accents: readonly Accent[];
  readonly current: string;
  readonly kind: "adult" | "kid";
  readonly onPick: (id: string) => void;
}): ReactNode {
  return (
    <>
      <div className={styles.groupLabel}>{label}</div>
      <div className={styles.group}>
        {accents.map((accent) => (
          <button
            key={accent.id}
            type="button"
            className={clsx(
              styles.chip,
              accent.id === current && styles.chipOn,
            )}
            style={{ "--chip-accent": accent.night } as never}
            aria-pressed={accent.id === current}
            onClick={() => onPick(accent.id)}
          >
            <span className={styles.chipText}>
              <span className={styles.chipName}>{accentNames[accent.id]}</span>
              <span className={styles.chipHue}>
                {accentHues[accent.hue]}
                {accent.id === defaultAccentFor(kind) && (
                  <>
                    {" · "}
                    <FormattedMessage
                      id="theme.default"
                      defaultMessage="default"
                    />
                  </>
                )}
              </span>
            </span>
            <ThemeBands accent={accent} />
          </button>
        ))}
      </div>
    </>
  );
}

/** The accent and its two shades, flush to the trailing edge of the chip. */
export function ThemeBands({
  accent,
  className,
}: {
  readonly accent: Accent;
  readonly className?: string;
}): ReactNode {
  return (
    <span className={clsx(styles.bands, className)} aria-hidden={true}>
      <i style={{ backgroundColor: accent.night }} />
      <i style={{ backgroundColor: shade(accent.night, -0.18) }} />
      <i style={{ backgroundColor: shade(accent.night, 0.22) }} />
    </span>
  );
}

/** Lightens (positive) or darkens (negative) a hex colour towards the ends. */
function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const move = (c: number) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const parts = [move((n >> 16) & 255), move((n >> 8) & 255), move(n & 255)];
  return `#${parts.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * What a signed-out visitor sees. The chips keep their real colours and names,
 * softened out of focus — enough to know the colours are there, not enough to
 * have them. The invitation above is the only crisp thing in the block.
 */
function LockedThemes(): ReactNode {
  const locked = accentsFor("adult").filter((item) => item.id !== "keylearn");
  return (
    <div className={styles.picker}>
      <div className={styles.lockedCap}>
        <span className={styles.lockedCapText}>
          <FormattedMessage
            id="theme.locked.title"
            defaultMessage="{count} more colours, one for each learner."
            values={{ count: locked.length }}
          />
        </span>
        <span className={styles.lockedCapSub}>
          <FormattedMessage
            id="theme.locked.sub"
            defaultMessage="sign in to bring them into focus"
          />
        </span>
      </div>
      <div className={styles.group} aria-hidden={true}>
        {locked.map((accent) => (
          <span
            key={accent.id}
            className={clsx(styles.chip, styles.lockedChip)}
          >
            <span className={styles.chipText}>
              <span className={styles.chipName}>{accentNames[accent.id]}</span>
              <span className={styles.chipHue}>{accentHues[accent.hue]}</span>
            </span>
            <ThemeBands accent={accent} />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The keyboard in this learner's theme colours.
 *
 * Loses to the colour-blind palette in Accessibility when both are asked for:
 * one is about how the keyboard looks, the other about whether it can be read.
 */
function ThemedZonesRow({
  profileId,
}: {
  readonly profileId: string;
}): ReactNode {
  const [themed, setThemed] = useState(() => loadThemedZones(profileId));
  const safe = accessibilityActive(profileId);
  // The switch is per learner, so it must re-read when the learner changes.
  const [seen, setSeen] = useState(profileId);
  if (seen !== profileId) {
    setSeen(profileId);
    setThemed(loadThemedZones(profileId));
  }
  return (
    <div className={styles.zoneRow}>
      <div className={styles.zoneText}>
        <span className={styles.zoneLabel}>
          <FormattedMessage
            id="account.appearance.themedZones"
            defaultMessage="Keyboard in my theme's colours"
          />
        </span>
        <span className={styles.zoneSub}>
          {safe ? (
            <FormattedMessage
              id="account.appearance.themedZones.blocked"
              defaultMessage="Turned off while the colour-blind keyboard is on, which keeps its own colours."
            />
          ) : (
            <FormattedMessage
              id="account.appearance.themedZones.sub"
              defaultMessage="The finger colours take their lead from your theme instead of the KeyLearn set. They stay as far apart from each other either way."
            />
          )}
        </span>
      </div>
      <Toggle
        on={themed && !safe}
        disabled={safe}
        onChange={(next) => {
          setThemed(next);
          saveThemedZones(next, profileId);
          window.dispatchEvent(new window.Event(ZONES_CHANGED_EVENT));
        }}
      />
    </div>
  );
}
