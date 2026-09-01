import {
  allLocales,
  cityOfTimeZone,
  defaultLocale,
  formatsForTimeZone,
  useCollator,
  useIntlDates,
  useIntlDisplayNames,
  utcOffsetLabel,
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
import { say } from "@keylearn/speech";
import { FONTS, useTheme } from "@keylearn/themes";
import { OptionList } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./AccountPage.module.less";
import { Segmented, Toggle } from "./controls.tsx";
import {
  accountProps,
  countryForTimeZone,
  deviceTimeZone,
  timeZoneCountries,
  timeZonesIn,
} from "./prefs.ts";
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

/**
 * Every setting a preset can touch, at the value the app ships with.
 *
 * One constant because two callers need exactly the same list: turning a
 * preset on rebuilds from here, and "put everything back" clears to here. When
 * these were written out twice the reset forgot six of them, so a learner who
 * had turned on Easier to read kept the letter spacing forever.
 */
const PRESET_BASE: Partial<A11yPrefs> = {
  motion: "system",
  typeface: "default",
  targets: "default",
  calm: false,
  chords: true,
  bounceMs: 0,
  captions: false,
  fingerMarks: false,
  letterSpacing: 0,
  lineHeight: 1.2,
  plain: false,
  predictable: false,
  cues: false,
  scores: true,
  streakGrace: false,
  timers: true,
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
    id: "focus",
    label: (
      <FormattedMessage
        id="account.a11y.preset.focus"
        defaultMessage="Fewer things at once"
      />
    ),
    sub: (
      <FormattedMessage
        id="account.a11y.preset.focus.sub"
        defaultMessage="Practice opens with the words and the keyboard, and nothing else asking to be looked at."
      />
    ),
    prefs: { plain: true, scores: false },
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
    prefs: { typeface: "dyslexic", letterSpacing: 0.06, lineHeight: 1.6 },
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
    prefs: { cues: true, fingerMarks: true },
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
  // Which presets are on. Recorded rather than worked out from the values,
  // because presets share switches: two of them turn the running figures off,
  // so "do this one's values hold?" lit two badges from a single click.
  const applied = (preset: Preset) => prefs.presets.includes(preset.id);
  /**
   * Turn a preset on or off. Any number of them can be on at once.
   *
   * Every preset-touched setting is put back to its default and then the
   * chosen presets are laid over it in order, so the result is always exactly
   * the union of what is on — never a leftover from something switched off.
   * That matters because they overlap: Calm and Fewer things at once both hide
   * the running figures, and turning Calm off must not un-hide them while the
   * other one is still on.
   *
   * They combine because the needs do. Somebody dyslexic with a tremor needs
   * two of these, and making them exclusive asked them to pick a disability.
   */
  const toggle = (preset: Preset) => {
    const nextIds = applied(preset)
      ? prefs.presets.filter((each) => each !== preset.id)
      : [...prefs.presets, preset.id];
    const chosen = PRESETS.filter((each) => nextIds.includes(each.id));
    const patch: Partial<A11yPrefs> = Object.assign(
      { ...PRESET_BASE },
      ...chosen.map((each) => each.prefs),
      { presets: nextIds },
    );
    setPrefs({ ...prefs, ...patch });
    saveA11y(patch, id);
    // Contrast and the colour-safe zones are not switches on this page, so
    // they are folded the same way: on if any preset still on asks for them.
    const nextContrast: ContrastPref = chosen.some(
      (each) => each.contrast === "clearer",
    )
      ? "clearer"
      : "default";
    setContrast(nextContrast);
    saveContrast(nextContrast, id);
    const nextSafe = chosen.some((each) => each.safeZones === true);
    setSafe(nextSafe);
    saveSafeZones(nextSafe, id);
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
            defaultMessage="Turn on as many of these as you need"
          />
        </div>

        {PRESETS.map((preset) => (
          <div key={preset.id} className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>{preset.label}</span>
              <span className={styles.rowSub}>{preset.sub}</span>
            </div>
            <Toggle on={applied(preset)} onChange={() => toggle(preset)} />
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
                ...PRESET_BASE,
                presets: [],
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
      </div>

      {/* A card of its own, below the presets: the individual switches are a
          different question from "which of these fits", and putting them in the
          same panel made the presets look like the top of a long list rather
          than the answer for most people. Closed until asked for. */}
      <div className={styles.prefCard}>
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

            <div className={clsx(styles.row, styles.rowStack)}>
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>
                  <FormattedMessage
                    id="account.a11y.spacing"
                    defaultMessage="Room between the letters"
                  />
                </span>
                <span className={styles.rowSub}>
                  <FormattedMessage
                    id="account.a11y.spacing.sub"
                    defaultMessage="Spacing helps a struggling reader more than any typeface does. This applies to the practice text — the words being read one letter at a time."
                  />
                </span>
              </div>
              <Segmented<string>
                value={
                  prefs.letterSpacing >= 0.12
                    ? "wide"
                    : prefs.letterSpacing > 0
                      ? "some"
                      : "none"
                }
                onChange={(next) =>
                  set({
                    letterSpacing:
                      next === "wide" ? 0.14 : next === "some" ? 0.06 : 0,
                    lineHeight:
                      next === "wide" ? 2 : next === "some" ? 1.6 : 1.2,
                  })
                }
                options={[
                  {
                    id: "none",
                    label: (
                      <FormattedMessage
                        id="account.a11y.spacing.none"
                        defaultMessage="As set"
                      />
                    ),
                  },
                  {
                    id: "some",
                    label: (
                      <FormattedMessage
                        id="account.a11y.spacing.some"
                        defaultMessage="More"
                      />
                    ),
                  },
                  {
                    id: "wide",
                    label: (
                      <FormattedMessage
                        id="account.a11y.spacing.wide"
                        defaultMessage="Most"
                      />
                    ),
                  },
                ]}
              />
            </div>

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.fingerMarks"
                  defaultMessage="A finger number on every key"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.fingerMarks.sub"
                  defaultMessage="The zones say which finger with colour. This says it in a character as well, so nothing depends on telling the colours apart."
                />
              }
              on={prefs.fingerMarks}
              onChange={(next) => set({ fingerMarks: next })}
            />

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
                  defaultMessage="Your device’s own setting is already followed. This one is for wanting the rest of the machine to move and this page not to."
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
                  id="account.a11y.captions"
                  defaultMessage="Write down what is said aloud"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.captions.sub"
                  defaultMessage="The braille page and the kids coach both speak. This puts every line on screen as it is said, for a learner who cannot hear it — or a grown-up sitting beside one."
                />
              }
              on={prefs.captions}
              onChange={(next) => set({ captions: next })}
            />

            <Row
              label={
                <FormattedMessage
                  id="account.a11y.predictable"
                  defaultMessage="Always the same words"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.predictable.sub"
                  defaultMessage="The coach picks its encouragement at random so it does not become wallpaper. This makes it say the same line every time, for a learner who is listening for what the app will say."
                />
              }
              on={prefs.predictable}
              onChange={(next) => set({ predictable: next })}
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
                  id="account.a11y.plain"
                  defaultMessage="One thing on screen"
                />
              }
              sub={
                <FormattedMessage
                  id="account.a11y.plain.sub"
                  defaultMessage="Practice opens with the words and the keyboard. The figures, the trend and the journey strip stay away until you ask for them back."
                />
              }
              on={prefs.plain}
              onChange={(next) => set({ plain: next })}
            />

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

            {/* The reading voice is chosen on the learner's own profile, not
                here — it is part of setting a learner up, like their name and
                their year, rather than an accessibility adjustment made
                afterwards. What stays here is the braille drill's rate and the
                device’s own voice list, which belong to its learners. */}
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
              defaultMessage="Your device’s voices. Left alone, the app uses whichever one matches the language of the page."
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
  const { locale, networkCountry } = usePageData();
  const { formatMessage } = useIntl();
  const { formatLocalLanguageName, formatRegionName } = useIntlDisplayNames();
  // Sorted the way the reader's own language sorts, so "Österreich" lands
  // where a German speaker expects it rather than after "Z".
  const collator = useCollator();
  const collate = (a: string, b: string) => collator.compare(a, b);
  const { settings, updateSettings } = useSettings();
  const timeZone = settings.get(accountProps.timeZone) || deviceTimeZone();

  // The two readings the support desk also sees, shown to the person they
  // are about. Consent is the ONLY gate — an earlier version also hid this
  // whenever the device agreed with the account setting, which sounds
  // tidy and meant it never appeared at all: with no zone explicitly
  // chosen, `timeZone` above already falls back to the device's, so the
  // two were equal by construction.
  const deviceZone = deviceTimeZone();
  const deviceRegion = countryForTimeZone(deviceZone);
  const deviceNote = {
    zone: cityOfTimeZone(deviceZone) || deviceZone,
    region: deviceRegion === "" ? null : formatRegionName(deviceRegion),
    // Absent without Cloudflare in front — development, or a host that
    // does not set it. Rendered only when there is something to render.
    network:
      networkCountry == null || networkCountry === ""
        ? null
        : formatRegionName(networkCountry),
  };
  const weekStart = settings.get(accountProps.weekStart);
  const speedUnit = settings.get(uiProps.speedUnit).id;
  // Nothing is written until they choose: an unset preference still means
  // "follow this device", and pre-filling the country must not quietly
  // become a saved answer they never gave.
  const country = countryForTimeZone(
    settings.get(accountProps.timeZone),
    null,
    locale,
  );
  const zones = timeZonesIn(country, timeZone);

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
        {/* The same picker as the zone below it, for the same reason: a
            native select of thirty-odd languages opens as a list the
            window decides the height of, and two controls in one card
            behaving differently is one control too many to learn.

            Sorted by the name as it is written, not by locale id — `de`
            and `da` next to each other is a sorted list of identifiers,
            not of languages. */}
        <div className={styles.prefStack}>
          <OptionList
            title={formatMessage({
              id: "account.prefs.language.label",
              defaultMessage: "App & email language",
            })}
            value={allLocales.includes(locale) ? locale : defaultLocale}
            options={[...allLocales]
              .map((id) => ({ value: id, name: formatLocalLanguageName(id) }))
              .sort((a, b) => collate(a.name, b.name))}
            onSelect={switchLocale}
          />
        </div>
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
            {/* Short on purpose. The example line underneath shows the
                effect in one glance, so the words only have to say that
                there IS one beyond streaks — the rest is a paragraph
                nobody in a settings list reads. */}
            <FormattedMessage
              id="account.prefs.timezone.sub"
              defaultMessage="Sets when your day rolls over, and how dates, times, prices and phone numbers are written. Your language doesn’t change."
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
          {/* What this device reports, as against what the account is set
              to. Shown ONLY with analytics consent on, because it is the
              one place the app says out loud that it can read this — a
              line telling somebody what was collected, on a screen where
              they never agreed to the collecting, is worse than saying
              nothing.

              Quiet by design: a note, not a setting. Nothing here is
              editable, and the account's own choice above always wins —
              this exists so a traveller can see why the two differ
              instead of wondering whether something is broken. */}
          {settings.get(accountProps.analytics) && (
            <span className={styles.rowDeviceNote}>
              <FormattedMessage
                id="account.prefs.timezone.device"
                defaultMessage="This device reports {zone}{region}. Your account setting above is what KeyLearn uses."
                values={{
                  zone: <b>{deviceNote.zone}</b>,
                  region:
                    deviceNote.region == null ? "" : ` — ${deviceNote.region}`,
                }}
              />
              {deviceNote.network != null && (
                <>
                  {" "}
                  <FormattedMessage
                    id="account.prefs.timezone.network"
                    defaultMessage="Your connection looks like it is coming from {country}."
                    values={{ country: <b>{deviceNote.network}</b> }}
                  />
                </>
              )}
            </span>
          )}
        </div>
        {/* Country first, then the zone inside it. Two questions somebody
            can answer instead of one they cannot.

            KeyLearn's own OptionList rather than a native select, because
            the offset has to sit in its own right-aligned column. A native
            <option> holds text and nothing else, so "Sydney UTC+10" would
            ragged-edge down the list and stop being scannable — which is
            the entire reason for showing the offset. */}
        <div className={styles.prefStack}>
          <OptionList
            title={formatMessage({
              id: "account.prefs.timezone.country",
              defaultMessage: "Country",
            })}
            value={country}
            // By the country's NAME, not its ISO code. Sorting the codes
            // put the United Arab Emirates at the top of the list, above
            // Argentina, because "AE" sorts before "AR" — correct, and
            // useless to anyone looking for their own country.
            options={timeZoneCountries()
              .map((id) => ({ value: id, name: formatRegionName(id) }))
              .sort((a, b) => collate(a.name, b.name))}
            onSelect={(id) => {
              // Moving country lands on that country's main zone. Keeping
              // the old one would leave "Australia" showing a zone in Peru
              // until they noticed the second list.
              const next = timeZonesIn(id)[0];
              if (next != null) {
                updateSettings(settings.set(accountProps.timeZone, next));
              }
            }}
          />
          <OptionList
            title={formatMessage({
              id: "account.prefs.timezone.zone",
              defaultMessage: "Time zone",
            })}
            value={timeZone}
            options={zones.map((tz) => ({
              value: tz,
              name: (
                <span className={styles.zoneRow}>
                  <span>{cityOfTimeZone(tz)}</span>
                  <span className={styles.zoneOffset}>
                    {utcOffsetLabel(tz)}
                  </span>
                </span>
              ),
            }))}
            onSelect={(tz) =>
              updateSettings(settings.set(accountProps.timeZone, tz))
            }
          />
        </div>
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

      {/* Font sits with language rather than with the display switches: both
          are choices about how words are set on the page, and somebody who
          has just changed the language is the same person most likely to
          want a face that suits it. Same row shape as the two controls above
          it, so the card reads as one set of decisions. */}
      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.fontSect"
              defaultMessage="Font"
            />
          </span>
          <span className={styles.rowSub}>
            <FormattedMessage
              id="account.prefs.font.sub"
              defaultMessage="Used across every page. The text you type in practice is set separately and does not change."
            />
          </span>
        </div>
        <div className={styles.prefStack}>
          <FontPicker />
          <TextSizePicker />
        </div>
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

/**
 * The pointer-fog toggle, under Display mode.
 *
 * Two things it says out loud rather than hiding:
 *
 * The subtitle names the automatic behaviour, because a setting that is on
 * while the effect is invisible looks broken. It stops itself while keys are
 * landing, and it does not run on a touch screen at all — a learner on a
 * tablet who turns this on and sees nothing would reasonably file a bug.
 *
 * And when the device asks for reduced motion, the row is disabled with the
 * reason given, instead of being hidden or silently ignored. The system
 * setting wins; saying so is more respectful than pretending the choice is
 * available and then not honouring it.
 */
function CursorEffectRow(): ReactNode {
  const { settings, updateSettings } = useSettings();
  const on = settings.get(uiProps.cursorEffect);

  const [stilled, setStilled] = useState(false);
  useEffect(() => {
    // A browser API, not a DOM one — jsdom has neither the media query nor a
    // motion preference to report, so absent the API nothing is stilled.
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStilled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            <FormattedMessage
              id="account.prefs.cursorEffect"
              defaultMessage="Pointer trail"
            />
          </span>
          {/* Two different lines. The reduced-motion one explains a control
            that will not respond, which is otherwise indistinguishable from a
            broken one; the ordinary one says what the effect actually is,
            since "Pointer trail" names it without describing it and every
            other row on this card carries a description. */}
          {stilled ? (
            <span className={styles.rowSub}>
              <FormattedMessage
                id="account.prefs.cursorEffect.stilled"
                defaultMessage="Unavailable because this device asks for reduced motion. Nothing on this screen will move until that is changed in your system settings."
              />
            </span>
          ) : (
            <span className={styles.rowSub}>
              <FormattedMessage
                id="account.prefs.cursorEffect.sub"
                defaultMessage="A soft glow that follows your pointer around the page."
              />
            </span>
          )}
        </div>
        <Toggle
          on={on && !stilled}
          disabled={stilled}
          onChange={(next) =>
            updateSettings(settings.set(uiProps.cursorEffect, next))
          }
        />
      </div>
      {on && !stilled ? <CursorIntensityRow /> : null}
    </>
  );
}

/**
 * How much of it — shown only while the trail is on.
 *
 * Hidden rather than disabled when the switch is off. A disabled slider is a
 * thing to wonder about; an absent one is simply not a question yet, and the
 * switch above it is the only decision at that point.
 *
 * No number is printed beside it. There is no correct value here and nobody
 * is going to write theirs down — showing "62" would invite treating it as a
 * measurement rather than a feel, and the effect itself is the readout.
 */
function CursorIntensityRow(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const value = settings.get(uiProps.cursorEffectIntensity);

  return (
    <div className={styles.tuneRow}>
      <span className={styles.subLabel}>
        <FormattedMessage
          id="account.prefs.cursorEffect.intensity"
          defaultMessage="Intensity"
        />
      </span>
      <input
        type="range"
        className={styles.thinSlider}
        min={10}
        max={100}
        step={5}
        value={value}
        aria-label={formatMessage({
          id: "account.prefs.cursorEffect.intensity",
          defaultMessage: "Intensity",
        })}
        onChange={(ev) =>
          updateSettings(
            settings.set(
              uiProps.cursorEffectIntensity,
              Number(ev.target.value),
            ),
          )
        }
      />
    </div>
  );
}

/**
 * Whether the header announces who is signed in.
 *
 * Lives beside the display mode rather than under privacy: what a learner is
 * deciding here is what their header looks like. The privacy benefit — a name
 * not sitting on screen in a classroom or an office — is real, but it is a
 * consequence of the choice, not the framing of it.
 */
/**
 * The body font for every page of the site.
 *
 * The app's own OptionList, like the language and time zone controls it sits
 * with — but every option is set in its own face, open and closed alike.
 * `name` takes a ReactNode, so the preview costs nothing structural, and a
 * list of font names all set in one font would answer none of the only
 * question anybody brings here.
 *
 * Grouped, because seventeen ungrouped options are read by scanning
 * seventeen. Grouped by what they FEEL like rather than by classification —
 * somebody picking a font wants "rounded", not "geometric humanist sans".
 *
 * Nothing new is persisted: `font` has always been part of ThemePrefs and
 * applied as `data-font` on the root. It simply had no control anywhere.
 */
/**
 * Group order, and the order options must be handed over in.
 *
 * OptionListMenu writes a heading whenever an option's group differs from the
 * one before it — so an unsorted list does not group, it just prints the same
 * heading again every time the list wanders back. The FONTS registry is in
 * the order the fonts were added, which interleaves them, so the options are
 * sorted into this order before they go in.
 */
const GROUP_ORDER = ["Rounded", "Plain", "Serif", "Handwritten", "System"];

const FONT_GROUPS: Record<string, string> = {
  "nunito": "Rounded",
  "lexend": "Rounded",
  "questrial": "Rounded",
  "sora": "Rounded",
  "rubik": "Rounded",
  "roboto": "Plain",
  "open-sans": "Plain",
  "inter": "Plain",
  "manrope": "Plain",
  "ubuntu": "Plain",
  "spectral": "Serif",
  "cormorant": "Serif",
  "shantell-sans": "Handwritten",
};

/**
 * What to set each preview in.
 *
 * The families the app ships need naming explicitly — an option's id is a
 * slug ("open-sans"), not a family name, so `font-family: open-sans` would
 * fall through to the default and every preview would look identical. The
 * four generics pass straight through, which is the whole point of them.
 */
const FONT_STACK: Record<string, string> = {
  "roboto": '"Roboto", sans-serif',
  "open-sans": '"Open Sans", sans-serif',
  "rubik": '"Rubik", sans-serif',
  "shantell-sans": '"Shantell Sans", cursive',
  "spectral": '"Spectral", serif',
  "nunito": '"Nunito", sans-serif',
  "ubuntu": '"Ubuntu", sans-serif',
  "cormorant": '"Cormorant", serif',
  "inter": '"Inter", sans-serif',
  "manrope": '"Manrope", sans-serif',
  "lexend": '"Lexend", sans-serif',
  "questrial": '"Questrial", sans-serif',
  "sora": '"Sora", sans-serif',
};

function FontPicker(): ReactNode {
  const { formatMessage } = useIntl();
  const { font, switchFont } = useTheme();
  return (
    <OptionList
      title={formatMessage({
        id: "account.prefs.fontSect",
        defaultMessage: "Font",
      })}
      value={font}
      options={[...FONTS]
        .map(({ id, name }) => ({
          value: id,
          name: (
            <span style={{ fontFamily: FONT_STACK[id] ?? id }}>{name}</span>
          ),
          group: FONT_GROUPS[id] ?? "System",
        }))
        .sort(
          (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
        )}
      onSelect={switchFont}
    />
  );
}

/**
 * How large the interface is set, under the face it is set in.
 *
 * Listed small-to-large because that is the order the words are read in,
 * which is not the order TEXT_SIZES declares them: medium is first there
 * because ThemeList treats its first entry as the default. The two orders
 * answer different questions and are meant to differ.
 */
const TEXT_SIZE_OPTIONS: readonly { id: string; label: ReactNode }[] = [
  {
    id: "small",
    label: (
      <FormattedMessage
        id="account.prefs.textSize.small"
        defaultMessage="Small"
      />
    ),
  },
  {
    id: "medium",
    label: (
      <FormattedMessage
        id="account.prefs.textSize.medium"
        defaultMessage="Medium"
      />
    ),
  },
  {
    id: "large",
    label: (
      <FormattedMessage
        id="account.prefs.textSize.large"
        defaultMessage="Large"
      />
    ),
  },
];

function TextSizePicker(): ReactNode {
  const { textSize, switchTextSize } = useTheme();
  return (
    <Segmented
      value={textSize}
      onChange={switchTextSize}
      options={TEXT_SIZE_OPTIONS}
    />
  );
}

function HeaderIdentityRow(): ReactNode {
  const { settings, updateSettings } = useSettings();
  const on = settings.get(accountProps.showHeaderIdentity);
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>
          <FormattedMessage
            id="account.prefs.headerIdentity"
            defaultMessage="Show me in the header"
          />
        </span>
        <span className={styles.rowSub}>
          <FormattedMessage
            id="account.prefs.headerIdentity.sub"
            defaultMessage="Your avatar and first name, beside the header controls. Off by default — your account and profiles are always in the menu either way."
          />
        </span>
      </div>
      <Toggle
        on={on}
        onChange={(v) =>
          updateSettings(settings.set(accountProps.showHeaderIdentity, v))
        }
      />
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

        <CursorEffectRow />
        <HeaderIdentityRow />
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
