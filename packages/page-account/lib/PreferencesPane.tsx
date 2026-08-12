import {
  allLocales,
  defaultLocale,
  formatsForTimeZone,
  useIntlDates,
  useIntlDisplayNames,
} from "@keylearn/intl";
import {
  A11Y_CHANGED_EVENT,
  type A11yPrefs,
  accessibilityActive,
  type ContrastPref,
  defaultA11y,
  downloadBlob,
  exportFilename,
  isPremiumUser,
  loadA11y,
  loadContrast,
  loadSafeZones,
  loadThemedZones,
  myCertificates,
  Pages,
  saveA11y,
  saveContrast,
  saveSafeZones,
  saveThemedZones,
  usePageData,
  ZONES_CHANGED_EVENT,
} from "@keylearn/pages-shared";
import { SpeedUnit, uiProps } from "@keylearn/result";
import { openResultStorage } from "@keylearn/result-loader";
import { useSettings } from "@keylearn/settings";
import { useTheme } from "@keylearn/themes";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./AccountPage.module.less";
import { Segmented, Toggle } from "./controls.tsx";
import { accountProps, allTimeZones, deviceTimeZone } from "./prefs.ts";
import { ProfileChooser } from "./ProfileChooser.tsx";
import { useProfiles } from "./profiles/context.tsx";
import { ThemePicker } from "./theme/ThemePicker.tsx";

// The three interface themes, mapped to the mock's Light / Dark / System.
const THEME_IDS = ["keylearn-day", "keylearn", "auto"] as const;
type ThemeId = (typeof THEME_IDS)[number];

const THEME_OPTIONS: readonly { id: ThemeId; label: ReactNode }[] = [
  {
    id: "keylearn-day",
    label: (
      <FormattedMessage id="account.prefs.theme.light" defaultMessage="Light" />
    ),
  },
  {
    id: "keylearn",
    label: (
      <FormattedMessage id="account.prefs.theme.dark" defaultMessage="Dark" />
    ),
  },
  {
    id: "auto",
    label: (
      <FormattedMessage id="account.prefs.theme.auto" defaultMessage="Auto" />
    ),
  },
];

/**
 * Account-level Preferences: theme, speed unit, language, region, email
 * notifications and privacy — distinct from the per-profile Practice settings.
 */
/**
 * What this time zone's country actually writes, on one line.
 *
 * A worked example rather than a description: the same date, clock, price and
 * phone number the drill will serve, rendered for the zone currently chosen.
 * Changing the select changes this line, which is the fastest way to see that
 * the setting does something beyond streaks.
 */
function regionSample(timeZone: string): string {
  const f = formatsForTimeZone(timeZone);
  const date =
    f.dateOrder === "MDY"
      ? ["08", "07", "2026"]
      : f.dateOrder === "YMD"
        ? ["2026", "08", "07"]
        : ["07", "08", "2026"];
  const time = f.hour12 ? "2:32 pm" : "14:32";
  // 1234567.89 in this country's grouping, so the sample shows the shape a
  // large amount takes and not just the symbol.
  const digits = "1234567";
  const whole = f.southAsianGrouping
    ? `${digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, f.groupSep)}${f.groupSep}${digits.slice(-3)}`
    : digits.replace(/\B(?=(\d{3})+(?!\d))/g, f.groupSep);
  const amount = `${whole}${f.decimalSep}89`;
  const money = f.currencyBefore
    ? `${f.currencySymbol}${amount}`
    : `${amount} ${f.currencySymbol}`;
  const phone = f.phonePattern.replace(/#/g, () => "5");
  return [date.join(f.dateSep), time, money, phone].join("  ·  ");
}

export function PreferencesPane(): ReactNode {
  return (
    <div className={styles.paneScroll}>
      <h2 className={styles.paneTitle}>
        <FormattedMessage
          id="account.prefs.title"
          defaultMessage="Preferences"
        />
      </h2>
      <p className={styles.note}>
        <FormattedMessage
          id="account.prefs.note"
          defaultMessage="These apply to your whole account. Typing, keyboard and language-of-practice settings live in Practice settings and are kept per profile."
        />
      </p>

      <LanguageRegionCard />
      <NotificationsCard />
      <PrivacyCard />
    </div>
  );
}

/**
 * Appearance has a section of its own rather than a card inside Preferences:
 * it now carries a colour for every learner in the household, which is more
 * than a card's worth of panel and more than a settings list wants to scroll
 * past to reach the privacy switches.
 */
export function AppearancePane(): ReactNode {
  return (
    <div className={styles.paneScroll}>
      <h2 className={styles.paneTitle}>
        <FormattedMessage
          id="account.appearance.title"
          defaultMessage="Appearance"
        />
      </h2>
      <AppearanceCard />
    </div>
  );
}

/**
 * The colour-blind-friendly keyboard.
 *
 * Above the colour picker on purpose: somebody who needs this needs it more
 * than they need a favourite colour, and a setting that matters is not one to
 * put at the bottom of a scroll.
 */
/**
 * What a preset asks for.
 *
 * Presets rather than a wall of switches, because a wall of switches is itself
 * a barrier to the people it is for: a parent at nine in the evening does not
 * know which four of eleven their child needs, and the research that would
 * tell them is what this page is supposed to be carrying. Every switch is
 * still there underneath for anyone who wants to disagree with a preset.
 *
 * Named for what they do, never for a condition. Nobody should have to
 * identify themselves with a diagnosis to make an app usable.
 */
type Preset = {
  readonly id: string;
  readonly label: ReactNode;
  readonly sub: ReactNode;
  readonly prefs: Partial<A11yPrefs>;
  readonly contrast?: ContrastPref;
  readonly safeZones?: boolean;
};

const PRESETS: readonly Preset[] = [
  {
    id: "calm",
    label: (
      <FormattedMessage id="account.a11y.preset.calm" defaultMessage="Calm" />
    ),
    sub: (
      <FormattedMessage
        id="account.a11y.preset.calm.sub"
        defaultMessage="Nothing moves, nothing counts, nothing is timed. A missed day does not break the run."
      />
    ),
    prefs: {
      motion: "reduce",
      calm: true,
      timers: false,
      scores: false,
      streakGrace: true,
    },
  },
  {
    id: "read",
    label: (
      <FormattedMessage
        id="account.a11y.preset.read"
        defaultMessage="Easier to read"
      />
    ),
    sub: (
      <FormattedMessage
        id="account.a11y.preset.read.sub"
        defaultMessage="Stronger text against the page, and letters that cannot be mistaken for one another."
      />
    ),
    prefs: { typeface: "dyslexic" },
    contrast: "clearer",
  },
  {
    id: "colour",
    label: (
      <FormattedMessage
        id="account.a11y.preset.colour"
        defaultMessage="Colours apart"
      />
    ),
    sub: (
      <FormattedMessage
        id="account.a11y.preset.colour.sub"
        defaultMessage="Finger colours that stay distinct, and mistakes said in sound as well as in red."
      />
    ),
    prefs: { cues: true },
    contrast: "clearer",
    safeZones: true,
  },
  {
    id: "hands",
    label: (
      <FormattedMessage
        id="account.a11y.preset.hands"
        defaultMessage="Steadier hands"
      />
    ),
    sub: (
      <FormattedMessage
        id="account.a11y.preset.hands.sub"
        defaultMessage="Bigger things to press, no two keys at once, and a shake is not read as a mistake."
      />
    ),
    prefs: { targets: "large", chords: false, bounceMs: 80 },
  },
];

export function AccessibilityPane(): ReactNode {
  const { household } = useProfiles();
  const profiles = household.profiles;
  const [chosenId, setChosenId] = useState<string | null>(
    () => household.activeId ?? profiles[0]?.id ?? null,
  );
  const chosen = profiles.find((p) => p.id === chosenId) ?? profiles[0] ?? null;
  const id = chosen?.id ?? null;
  const [safe, setSafe] = useState(() => loadSafeZones(id));
  const [contrast, setContrast] = useState<ContrastPref>(() =>
    loadContrast(id),
  );
  const [prefs, setPrefs] = useState<A11yPrefs>(() => loadA11y(id));
  const [tuning, setTuning] = useState(false);
  // Per learner, so everything on the page must re-read when the learner
  // changes — a switch left showing the last learner's answer is worse than no
  // switch, because it invites somebody to turn off what they never turned on.
  const [seen, setSeen] = useState(id);
  if (seen !== id) {
    setSeen(id);
    setSafe(loadSafeZones(id));
    setContrast(loadContrast(id));
    setPrefs(loadA11y(id));
  }

  // One place that says "this changed", so the provider repaints and every
  // other page reading these agrees with this one.
  const announce = () => {
    window.dispatchEvent(new window.Event(A11Y_CHANGED_EVENT));
    window.dispatchEvent(new window.Event(ZONES_CHANGED_EVENT));
  };
  const set = (patch: Partial<A11yPrefs>) => {
    setPrefs({ ...prefs, ...patch });
    saveA11y(patch, id);
    announce();
  };
  // A preset that is already satisfied is shown as such rather than offered
  // again — and it stays satisfied if somebody has since turned on more than
  // it asked for, because a preset is a floor and not a straitjacket.
  const applied = (preset: Preset) =>
    Object.entries(preset.prefs).every(
      ([key, want]) => prefs[key as keyof A11yPrefs] === want,
    ) &&
    (preset.contrast == null || contrast === preset.contrast) &&
    (preset.safeZones == null || safe === preset.safeZones);
  /**
   * Press it to get the preset; press it again to give it back.
   *
   * A control that looks pressed and does nothing when pressed again is a
   * control that has lied about what it is. Undoing puts only the switches
   * that preset owns back to how the app ships — it does not reach for
   * anything somebody set themselves.
   */
  const toggle = (preset: Preset) => {
    const on = applied(preset);
    const patch = on
      ? Object.fromEntries(
          Object.keys(preset.prefs).map((key) => [
            key,
            defaultA11y[key as keyof A11yPrefs],
          ]),
        )
      : preset.prefs;
    setPrefs({ ...prefs, ...patch });
    saveA11y(patch, id);
    if (preset.contrast != null) {
      const next = on ? "default" : preset.contrast;
      setContrast(next);
      saveContrast(next, id);
    }
    if (preset.safeZones != null) {
      const next = on ? false : preset.safeZones;
      setSafe(next);
      saveSafeZones(next, id);
    }
    announce();
  };

  return (
    <div className={styles.paneScroll}>
      <h2 className={styles.paneTitle}>
        <FormattedMessage
          id="account.accessibility.title"
          defaultMessage="Accessibility"
        />
      </h2>
      <div className={styles.prefCard}>
        {profiles.length > 0 && (
          <ProfileChooser
            profiles={profiles}
            chosenId={id}
            onChoose={setChosenId}
            marked={(each) => accessibilityActive(each)}
          />
        )}

        <div className={styles.prefSect}>
          <FormattedMessage
            id="account.a11y.presets"
            defaultMessage="Start from one of these"
          />
        </div>

        {PRESETS.map((preset) => (
          <div key={preset.id} className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>{preset.label}</span>
              <span className={styles.rowSub}>{preset.sub}</span>
            </div>
            <button
              type="button"
              className={clsx(
                styles.presetBtn,
                applied(preset) && styles.presetOn,
              )}
              aria-pressed={applied(preset)}
              onClick={() => toggle(preset)}
            >
              {applied(preset) ? (
                <FormattedMessage
                  id="account.a11y.preset.on"
                  defaultMessage="✓ On"
                />
              ) : (
                <FormattedMessage
                  id="account.a11y.preset.apply"
                  defaultMessage="Use this"
                />
              )}
            </button>
          </div>
        ))}

        {/* Nothing is taken away without being asked for, so there has to be a
            way back that does not mean finding eleven switches again. */}
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowSub}>
              <FormattedMessage
                id="account.a11y.reset.sub"
                defaultMessage="Every one of these is off until somebody asks for it. This puts them all back."
              />
            </span>
          </div>
          <button
            type="button"
            className={styles.presetBtn}
            onClick={() => {
              const off: Partial<A11yPrefs> = {
                motion: "system",
                typeface: "default",
                targets: "default",
                calm: false,
                chords: true,
                bounceMs: 0,
                cues: false,
                scores: true,
                streakGrace: false,
                timers: true,
              };
              setPrefs({ ...prefs, ...off });
              saveA11y(off, id);
              setContrast("default");
              saveContrast("default", id);
              setSafe(false);
              saveSafeZones(false, id);
              announce();
            }}
          >
            <FormattedMessage
              id="account.a11y.reset"
              defaultMessage="Turn everything off"
            />
          </button>
        </div>

        {/* One row that opens the rest, rather than a heading with a link
            under it. Closed is the point: sixteen switches met on arrival is
            its own barrier, and the people who want them will look. */}
        <button
          type="button"
          className={styles.tuneToggle}
          aria-expanded={tuning}
          onClick={() => setTuning(!tuning)}
        >
          <span className={styles.tuneText}>
            <span className={styles.tuneLabel}>
              <FormattedMessage
                id="account.a11y.tuning"
                defaultMessage="Set each one myself"
              />
            </span>
            <span className={styles.rowSub}>
              <FormattedMessage
                id="account.a11y.tuning.sub"
                defaultMessage="Every switch a preset touches, and a few it does not."
              />
            </span>
          </span>
          {/* Points down when closed, up when open — the direction the panel
              will move, not an arbitrary mark. */}
          <svg
            className={clsx(styles.tuneCaret, tuning && styles.tuneCaretOpen)}
            viewBox="0 0 12 12"
            aria-hidden={true}
          >
            <path d="M3 4.5 L6 7.5 L9 4.5" />
          </svg>
        </button>

        {tuning && (
          <>
            <div className={styles.prefSect}>
              <FormattedMessage
                id="account.a11y.seeing"
                defaultMessage="Seeing the page"
              />
            </div>

            <div className={clsx(styles.row, styles.rowStack)}>
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>
                  <FormattedMessage
                    id="account.a11y.contrast"
                    defaultMessage="Text contrast"
                  />
                </span>
                <span className={styles.rowSub}>
                  <FormattedMessage
                    id="account.a11y.contrast.sub"
                    defaultMessage="How hard the words work to be read. Each step is a measured level rather than a matter of taste — the theme keeps its colours, the text is lifted away from them."
                  />
                </span>
              </div>
              <Segmented<ContrastPref>
                value={contrast}
                onChange={(next) => {
                  setContrast(next);
                  saveContrast(next, id);
                  announce();
                }}
                options={[
                  {
                    id: "default",
                    label: (
                      <FormattedMessage
                        id="account.a11y.contrast.default"
                        defaultMessage="Theme"
                      />
                    ),
                  },
                  {
                    id: "clearer",
                    label: (
                      <FormattedMessage
                        id="account.a11y.contrast.clearer"
                        defaultMessage="Clearer"
                      />
                    ),
                  },
                  {
                    id: "strongest",
                    label: (
                      <FormattedMessage
                        id="account.a11y.contrast.strongest"
                        defaultMessage="Strongest"
                      />
                    ),
                  },
                ]}
              />
            </div>

            {SafeRow({ safe, setSafe, profileId: id })}

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.typeface"
                  defaultMessage="Typeface for dyslexia"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.typeface.sub"
                  defaultMessage="Letters with weighted bottoms and shapes that cannot be mistaken for one another when they rotate — b for d, p for q."
                />
              }
              on={prefs.typeface === "dyslexic"}
              onChange={(next) =>
                set({ typeface: next ? "dyslexic" : "default" })
              }
            />

            <div className={styles.prefSect}>
              <FormattedMessage
                id="account.a11y.using"
                defaultMessage="Using the app"
              />
            </div>

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.motion"
                  defaultMessage="Hold animations still"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.motion.sub"
                  defaultMessage="Your device's own setting is already followed. This one is for wanting the rest of the machine to move and this page not to."
                />
              }
              on={prefs.motion === "reduce"}
              onChange={(next) => set({ motion: next ? "reduce" : "system" })}
            />

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.calm"
                  defaultMessage="Celebrations that hold still"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.calm.sub"
                  defaultMessage="The kids world shakes after a wrong key and throws sparks when something goes right. The colours stay; the movement goes."
                />
              }
              on={prefs.calm}
              onChange={(next) => set({ calm: next })}
            />

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.targets"
                  defaultMessage="Larger things to press"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.targets.sub"
                  defaultMessage="Buttons and links grow to the size a hand that is not quite steady can reach without aiming."
                />
              }
              on={prefs.targets === "large"}
              onChange={(next) => set({ targets: next ? "large" : "default" })}
            />

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.chords"
                  defaultMessage="Never two keys at once"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.chords.sub"
                  defaultMessage="Capitals and most punctuation need Shift and a letter together. Off, the lessons ask only for what one finger at a time can reach."
                />
              }
              on={!prefs.chords}
              onChange={(next) => set({ chords: !next })}
            />

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.bounce"
                  defaultMessage="Ignore a key that repeats itself"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.bounce.sub"
                  defaultMessage="A hand that shakes sends one press twice. The second is dropped rather than counted as a mistake — the window is far shorter than a deliberate double letter."
                />
              }
              on={prefs.bounceMs > 0}
              onChange={(next) => set({ bounceMs: next ? 80 : 0 })}
            />

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.cues"
                  defaultMessage="Say mistakes in sound"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.cues.sub"
                  defaultMessage="A wrong key is shown in red, and red is the thing some eyes cannot pick out. This says the same in a tone, so nothing depends on colour alone."
                />
              }
              on={prefs.cues}
              onChange={(next) => set({ cues: next })}
            />

            <div className={styles.prefSect}>
              <FormattedMessage
                id="account.a11y.pressure"
                defaultMessage="Being measured"
              />
            </div>

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.timers"
                  defaultMessage="Practise without a clock"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.timers.sub"
                  defaultMessage="Hides every countdown and running time. The practice is exactly the same; what goes is being watched while you do it."
                />
              }
              on={!prefs.timers}
              onChange={(next) => set({ timers: !next })}
            />

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.scores"
                  defaultMessage="Practise without a score"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.scores.sub"
                  defaultMessage="The speed, the accuracy and the score come off the screen while you type. Nothing stops being recorded — they are shown afterwards, when they are information rather than a race."
                />
              }
              on={!prefs.scores}
              onChange={(next) => set({ scores: !next })}
            />

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.streak"
                  defaultMessage="A rest day keeps the streak"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.streak.sub"
                  defaultMessage="A missed day is forgiven rather than counted, so the number stays a true count of days practised. Nobody should have to choose between resting and starting again."
                />
              }
              on={prefs.streakGrace}
              onChange={(next) => set({ streakGrace: next })}
            />

            {chosen?.visionSupport === true && (
              <>
                <div className={styles.prefSect}>
                  <FormattedMessage
                    id="account.a11y.hearing"
                    defaultMessage="The reading voice"
                  />
                </div>
                <VoiceRows prefs={prefs} set={set} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** One switch and the two lines that say what it does. */
function Row({
  label,
  sub,
  on,
  onChange,
}: {
  readonly label: ReactNode;
  readonly sub: ReactNode;
  readonly on: boolean;
  readonly onChange: (next: boolean) => void;
}): ReactNode {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowSub}>{sub}</span>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

const SPEECH_RATES: readonly number[] = [0.75, 1, 1.5, 2, 2.5, 3];

function VoiceRows({
  prefs,
  set,
}: {
  readonly prefs: A11yPrefs;
  readonly set: (patch: Partial<A11yPrefs>) => void;
}): ReactNode {
  const [voices, setVoices] = useState<readonly string[]>([]);
  useEffect(() => {
    // The list arrives late in Chrome and is empty for the first moments, so
    // it is asked for again when the browser says it has one.
    const read = () => {
      try {
        setVoices(window.speechSynthesis.getVoices().map((v) => v.name));
      } catch {
        setVoices([]);
      }
    };
    read();
    window.speechSynthesis?.addEventListener?.("voiceschanged", read);
    return () => {
      window.speechSynthesis?.removeEventListener?.("voiceschanged", read);
    };
  }, []);
  return (
    <>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.a11y.speechRate"
              defaultMessage="Reading speed"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.a11y.speechRate.sub"
              defaultMessage="Somebody who listens all day listens fast. This is the same speed the braille page uses for every word it speaks."
            />
          </span>
        </div>
        <select
          className={styles.prefSelect}
          value={String(prefs.speechRate)}
          onChange={(ev) => set({ speechRate: Number(ev.target.value) })}
        >
          {SPEECH_RATES.map((rate) => (
            <option key={rate} value={String(rate)}>
              {rate === 1 ? "1× (normal)" : `${rate}×`}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.a11y.speechVoice"
              defaultMessage="Voice"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.a11y.speechVoice.sub"
              defaultMessage="Your device's voices. Left alone, the app uses whichever one matches the language of the page."
            />
          </span>
        </div>
        <select
          className={styles.prefSelect}
          value={prefs.speechVoice ?? ""}
          onChange={(ev) => set({ speechVoice: ev.target.value || null })}
        >
          <option value="">
            {/* Deliberately not a voice name: the list is full of novelty
                voices, and the language match is the sane default. */}
            —
          </option>
          {voices.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function SafeRow({
  safe,
  setSafe,
  profileId,
}: {
  readonly safe: boolean;
  readonly setSafe: (v: boolean) => void;
  readonly profileId: string | null;
}): ReactNode {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>
          <FormattedMessage
            id="account.appearance.safeZones"
            defaultMessage="Keyboard colours for colour blindness"
          />
        </span>
        <span className={styles.rowSub}>
          <FormattedMessage
            id="account.appearance.safeZones.sub"
            defaultMessage="The finger colours are what the keyboard teaches with. These ones stay apart for red-green colour blindness, where the usual set can look almost the same."
          />
        </span>
      </div>
      <Toggle
        on={safe}
        onChange={(next) => {
          setSafe(next);
          saveSafeZones(next, profileId);
          // The provider paints them, because it is the thing that knows
          // whether this device is on night or day.
          window.dispatchEvent(new window.Event(ZONES_CHANGED_EVENT));
        }}
      />
    </div>
  );
}

/**
 * The keyboard in the learner's own colours.
 *
 * Below the colour-blind row and disabled by it: when both are asked for, the
 * one about being able to read the keyboard wins, and saying so is kinder than
 * silently ignoring the switch somebody just moved.
 */

function LanguageRegionCard(): ReactNode {
  const { locale } = usePageData();
  const { formatLocalLanguageName } = useIntlDisplayNames();
  const { settings, updateSettings } = useSettings();
  const timeZone = settings.get(accountProps.timeZone) || deviceTimeZone();
  const weekStart = settings.get(accountProps.weekStart);
  const speedUnit = settings.get(uiProps.speedUnit).id;

  const switchLocale = (next: string) => {
    const base = Pages.intlBase(locale);
    const path = window.location.pathname.startsWith(base)
      ? window.location.pathname.slice(base.length) || "/"
      : window.location.pathname;
    window.location.assign(Pages.intlPath(path, next) || "/");
  };

  return (
    <div className={styles.prefCard}>
      <div className={styles.prefSect}>
        <FormattedMessage
          id="account.prefs.language"
          defaultMessage="Language & region"
        />
      </div>

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.language.label"
              defaultMessage="App & email language"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.language.sub"
              defaultMessage="The language for menus, buttons and the emails we send."
            />
          </span>
        </div>
        <select
          className={styles.prefSelect}
          value={allLocales.includes(locale) ? locale : defaultLocale}
          onChange={(ev) => switchLocale(ev.target.value)}
        >
          {allLocales.map((id) => (
            <option key={id} value={id}>
              {formatLocalLanguageName(id)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.hr} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.timezone"
              defaultMessage="Time zone"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.timezone.sub"
              defaultMessage="More than when your day rolls over for streaks and goals: this is how KeyLearn knows which country you are in. Dates, times, prices and phone numbers are written your country’s way because of this, and the number drills practise those local shapes rather than another country’s. Your language stays whatever you chose above — only the local conventions follow the zone."
            />
          </span>
          {/* Prose can describe the effect; showing it is quicker to read and
              impossible to misunderstand. This is exactly what the drill will
              serve for the zone currently selected. */}
          <span className={styles.rowExample}>
            <FormattedMessage
              id="account.prefs.timezone.example"
              defaultMessage="Here that looks like: {sample}"
              values={{ sample: <b>{regionSample(timeZone)}</b> }}
            />
          </span>
        </div>
        <select
          className={styles.prefSelect}
          value={timeZone}
          onChange={(ev) =>
            updateSettings(settings.set(accountProps.timeZone, ev.target.value))
          }
        >
          {allTimeZones().map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.hr} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.weekStart"
              defaultMessage="Week starts on"
            />
          </span>
        </div>
        <Segmented
          value={weekStart === "mon" || weekStart === "sun" ? weekStart : ""}
          onChange={(id) =>
            updateSettings(settings.set(accountProps.weekStart, id))
          }
          options={[
            {
              // The default, and right for most people without their knowing:
              // Monday across Europe and Australia, Sunday in the US and
              // Japan, Saturday in much of the Middle East.
              id: "",
              label: (
                <FormattedMessage
                  id="account.prefs.weekStart.auto"
                  defaultMessage="Automatic"
                />
              ),
            },
            {
              id: "mon",
              label: (
                <FormattedMessage
                  id="account.prefs.weekStart.mon"
                  defaultMessage="Mon"
                />
              ),
            },
            {
              id: "sun",
              label: (
                <FormattedMessage
                  id="account.prefs.weekStart.sun"
                  defaultMessage="Sun"
                />
              ),
            },
          ]}
        />
      </div>

      <div className={styles.hr} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.speedUnit"
              defaultMessage="Typing speed shown as"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.speedUnit.sub"
              defaultMessage="Words or characters per minute, everywhere across your account."
            />
          </span>
        </div>
        <Segmented
          value={
            speedUnit === SpeedUnit.CPM.id ? SpeedUnit.CPM.id : SpeedUnit.WPM.id
          }
          onChange={(id) =>
            updateSettings(
              settings.set(uiProps.speedUnit, SpeedUnit.ALL.get(id)),
            )
          }
          options={[
            { id: SpeedUnit.WPM.id, label: "WPM" },
            { id: SpeedUnit.CPM.id, label: "CPM" },
          ]}
        />
      </div>
    </div>
  );
}

function NotificationsCard(): ReactNode {
  const { settings, updateSettings } = useSettings();
  const reminders = settings.get(accountProps.emailReminders);
  const news = settings.get(accountProps.emailProductNews);
  const frequency = settings.get(accountProps.reminderFrequency);
  const level = settings.get(accountProps.newsLevel);

  return (
    <div className={styles.prefCard}>
      <div className={styles.prefSect}>
        <FormattedMessage
          id="account.prefs.notifications"
          defaultMessage="Email & notifications"
        />
      </div>

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.reminders"
              defaultMessage="Practice reminders"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.reminders.sub"
              defaultMessage="A nudge when you haven’t practised in a while."
            />
          </span>
        </div>
        <Toggle
          on={reminders}
          onChange={(v) =>
            updateSettings(settings.set(accountProps.emailReminders, v))
          }
        />
      </div>

      {reminders && (
        <div className={styles.subRow}>
          <span className={styles.subLabel}>
            <FormattedMessage
              id="account.prefs.reminders.frequency"
              defaultMessage="At most"
            />
          </span>
          <Segmented
            value={
              frequency === "few-days" || frequency === "monthly"
                ? frequency
                : "weekly"
            }
            onChange={(id) =>
              updateSettings(settings.set(accountProps.reminderFrequency, id))
            }
            options={[
              {
                id: "few-days",
                label: (
                  <FormattedMessage
                    id="account.prefs.reminders.freq.days"
                    defaultMessage="Every few days"
                  />
                ),
              },
              {
                id: "weekly",
                label: (
                  <FormattedMessage
                    id="account.prefs.reminders.freq.weekly"
                    defaultMessage="Weekly"
                  />
                ),
              },
              {
                id: "monthly",
                label: (
                  <FormattedMessage
                    id="account.prefs.reminders.freq.monthly"
                    defaultMessage="Monthly"
                  />
                ),
              },
            ]}
          />
        </div>
      )}

      <div className={styles.hr} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.news"
              defaultMessage="Product news"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.news.sub"
              defaultMessage="Occasional updates about new KeyLearn features."
            />
          </span>
        </div>
        <Toggle
          on={news}
          onChange={(v) =>
            updateSettings(settings.set(accountProps.emailProductNews, v))
          }
        />
      </div>

      {news && (
        <div className={styles.subRow}>
          <span className={styles.subLabel}>
            <FormattedMessage
              id="account.prefs.news.level"
              defaultMessage="Send me"
            />
          </span>
          <Segmented
            value={level === "all" ? "all" : "major"}
            onChange={(id) =>
              updateSettings(settings.set(accountProps.newsLevel, id))
            }
            options={[
              {
                id: "major",
                label: (
                  <FormattedMessage
                    id="account.prefs.news.level.major"
                    defaultMessage="Major updates only"
                  />
                ),
              },
              {
                id: "all",
                label: (
                  <FormattedMessage
                    id="account.prefs.news.level.all"
                    defaultMessage="Everything"
                  />
                ),
              },
            ]}
          />
        </div>
      )}

      <div className={styles.hr} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.security"
              defaultMessage="Security alerts"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.security.sub"
              defaultMessage="New sign-ins and account changes. Always on."
            />
          </span>
        </div>
        <Toggle on={true} disabled={true} onChange={() => {}} />
      </div>
    </div>
  );
}

function AppearanceCard(): ReactNode {
  const { color, switchColor } = useTheme();

  return (
    <>
      {/* Light and dark is a device setting; the colour belongs to a learner.
          Two different scopes, so two cards rather than one with a rule
          through it. */}
      <div className={styles.prefCard}>
        <div className={styles.prefSect}>
          <FormattedMessage
            id="account.prefs.appearance"
            defaultMessage="Display"
          />
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowLabel}>
              <FormattedMessage
                id="account.prefs.displayMode"
                defaultMessage="Mode"
              />
            </span>
          </div>
          <Segmented
            value={
              THEME_IDS.includes(color as ThemeId) ? (color as ThemeId) : "auto"
            }
            onChange={switchColor}
            options={THEME_OPTIONS}
          />
        </div>
      </div>

      <div className={styles.prefCard}>
        <div className={styles.prefSect}>
          <FormattedMessage
            id="account.prefs.themeSect"
            defaultMessage="Theme"
          />
        </div>

        <ThemePicker />
      </div>
    </>
  );
}

function PrivacyCard(): ReactNode {
  const { formatStamp } = useIntlDates();
  const { settings, updateSettings } = useSettings();
  const { user, publicUser, profiles } = usePageData();

  const [exporting, setExporting] = useState(false);

  /**
   * Everything this account holds, not just what the account page knows.
   *
   * The first version exported the account record, the profile list and the
   * settings — and called itself "Export my data" while leaving out the
   * practice history, which is the only part anybody actually means by that.
   * A file that looks complete and is not is worse than no button at all.
   *
   * The history lives per learner in this browser's own database, so it is
   * gathered a learner at a time; the certificates come from the server,
   * because that is where they are issued.
   */
  const exportData = async () => {
    setExporting(true);
    const list = profiles ?? [];
    const learners = await Promise.all(
      list.map(async (profile) => {
        let results: unknown[] = [];
        try {
          const storage = await openResultStorage({
            type: "private",
            userId: publicUser.id ?? null,
            kids: profile.kind === "kid",
            namespace: `profile-${profile.id}`,
          });
          results = (await storage.load()).map((r) => ({
            at: new Date(r.timeStamp).toISOString(),
            layout: String(r.layout),
            textType: String(r.textType),
            length: r.length,
            timeMs: r.time,
            errors: r.errors,
            // Characters a minute, as stored. Named so nobody reads it as
            // words and quietly divides by five twice.
            charsPerMinute: Math.round(r.speed * 10) / 10,
            accuracy: Math.round(r.accuracy * 1000) / 1000,
          }));
        } catch {
          // A learner whose local database will not open exports with an
          // empty history rather than failing the whole download.
          results = [];
        }
        return { profile, lessons: results };
      }),
    );

    const certificates = await myCertificates().catch(() => []);
    const data = {
      exportedAt: new Date().toISOString(),
      account: {
        name: publicUser.name,
        email: user?.email ?? null,
        premium: isPremiumUser(publicUser),
      },
      learners,
      certificates,
      settings: settings.toJSON(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    downloadBlob(
      blob,
      exportFilename(
        "account",
        publicUser.name,
        "json",
        formatStamp(Date.now()),
      ),
    );
    setExporting(false);
  };

  return (
    <div className={styles.prefCard}>
      <div className={styles.prefSect}>
        <FormattedMessage
          id="account.prefs.privacy"
          defaultMessage="Privacy & data"
        />
      </div>

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.analytics"
              defaultMessage="Anonymous usage analytics"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.analytics.sub"
              defaultMessage="Helps us improve KeyLearn. No typing content is ever sent."
            />
          </span>
        </div>
        <Toggle
          on={settings.get(accountProps.analytics)}
          onChange={(v) =>
            updateSettings(settings.set(accountProps.analytics, v))
          }
        />
      </div>

      <div className={styles.hr} />

      <div className={styles.miniRow}>
        <span>
          <FormattedMessage
            id="account.prefs.export"
            defaultMessage="Export my data"
          />
        </span>
        <button
          className={styles.subtleBtn}
          disabled={exporting}
          onClick={() => {
            void exportData();
          }}
        >
          {exporting ? (
            <FormattedMessage
              id="account.prefs.export.working"
              defaultMessage="Gathering…"
            />
          ) : (
            <FormattedMessage
              id="account.prefs.export.action"
              defaultMessage="Download"
            />
          )}
        </button>
      </div>
    </div>
  );
}
