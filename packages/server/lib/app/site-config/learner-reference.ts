import { keyboardProps } from "@keylearn/keyboard";
import { lessonProps } from "@keylearn/lesson";
import { accountProps } from "@keylearn/page-account";
import { typingTestProps } from "@keylearn/page-typing-test/lib/settings.ts";
import { defaultA11y } from "@keylearn/pages-shared";
import { uiProps } from "@keylearn/result";
import { type AnyProp } from "@keylearn/settings";
import { textDisplayProps, textInputProps } from "@keylearn/textinput";
import { soundProps } from "@keylearn/textinput-sounds";
import {
  COLORS,
  DEFAULT_ACCENT,
  findAccent,
  FONTS,
  TEXT_SIZES,
} from "@keylearn/themes";

/**
 * The read-only reference of every small per-learner setting (spec §5, §6.3).
 *
 * The spec asks for "a read-only reference of every per-learner setting with
 * its shipped value", and why it is read-only is worth stating plainly: these
 * are a person's own choices about their own screen. Fonts, caret shapes,
 * keyboard colours and sound volume are not site policy, and an admin able to
 * set them for everyone would be reaching into somebody's preferences. What
 * an admin needs here is the answer to one question, "what does a learner who
 * changes nothing get?", and that is exactly what this list is.
 *
 * Every value is read from the SAME prop object the client reads, so the page
 * cannot drift from what a new learner actually gets: a default changed in
 * `lessonProps` changes this page with it, with nobody having to remember.
 * The labels are the one thing written by hand, because an admin reads "Caret
 * shape" and not `textDisplay.caretShapeStyle`. The contract test refuses a
 * prop with no label, so a new learner setting cannot be added without one
 * appearing here.
 */

export type LearnerReferenceRow = {
  readonly key: string;
  readonly label: string;
  readonly group: string;
  readonly value: unknown;
};

/** A prop tree, as the settings packages actually declare them. */
type PropTree = { readonly [name: string]: AnyProp<any> | PropTree };

function isProp(value: unknown): value is AnyProp<any> {
  return (
    typeof value === "object" &&
    value != null &&
    typeof (value as any).key === "string" &&
    "defaultValue" in (value as any)
  );
}

/** Depth-first, because `lessonProps` nests `guided`, `books`, `code` and more. */
function walk(tree: PropTree, out: AnyProp<any>[] = []): AnyProp<any>[] {
  for (const value of Object.values(tree)) {
    if (isProp(value)) {
      out.push(value);
    } else if (typeof value === "object" && value != null) {
      walk(value as PropTree, out);
    }
  }
  return out;
}

const LABELS: Readonly<Record<string, string>> = {
  // Lesson
  "lesson.type": "Lesson type",
  "lesson.length": "Lesson length",
  "lesson.targetSpeed": "Target speed",
  "lesson.dailyGoal": "Daily goal",
  "lesson.capitals": "How much capitalisation",
  "lesson.punctuators": "How much punctuation",
  "lesson.repeatWords": "Times each word repeats",
  "lesson.guided.naturalWords": "Guided: use real words",
  "lesson.guided.kidsWords": "Guided: children's vocabulary",
  "lesson.guided.keyboardOrder": "Guided: introduce keys in layout order",
  "lesson.guided.alphabetSize": "Guided: letters unlocked",
  "lesson.guided.recoverKeys": "Guided: bring weak keys back",
  "lesson.guided.spacedRepetition": "Guided: spaced repetition",
  "lesson.guided.bottleneckDrill": "Guided: drill weak letter pairs",
  "lesson.guided.smartConfidence": "Guided: accuracy-aware confidence",
  "lesson.guided.skillDecay": "Guided: confidence fades when unpractised",
  "lesson.curriculum.stageSize": "Classic course: new keys per stage",
  "lesson.wordList.wordListSize": "Word list: words drawn from",
  "lesson.wordList.longWordsOnly": "Word list: long words only",
  "lesson.wordList.useCustom": "Word list: use the learner's own words",
  "lesson.wordList.custom": "Word list: the learner's own words",
  "lesson.books.book": "Books: which book",
  "lesson.books.paragraphIndex": "Books: starting paragraph",
  "lesson.books.lettersOnly": "Books: letters only",
  "lesson.books.lowercase": "Books: lower case only",
  "lesson.customText.content": "Own text: the text",
  "lesson.customText.lettersOnly": "Own text: letters only",
  "lesson.customText.lowercase": "Own text: lower case only",
  "lesson.customText.randomize": "Own text: shuffle the words",
  "lesson.quotes.attribution": "Quotes: show who said it",
  "lesson.numbers.benford": "Numbers: realistic first digits",
  "lesson.numbers.formats": "Numbers: which shapes",
  "lesson.code.syntax": "Code: language",
  "lesson.code.flags": "Code: topics and grammar",
  "lesson.code.theme": "Code: colour scheme",
  "lesson.code.themeBackground": "Code: scheme brings its own background",
  // Keyboard
  "keyboard.language": "Keyboard language",
  "keyboard.style": "Keyboard style",
  "keyboard.colour": "Keyboard colour",
  "keyboard.backlight": "Backlight",
  "keyboard.backlightIntensity": "Backlight brightness",
  "keyboard.layout": "Layout",
  "keyboard.geometry": "Key geometry",
  "keyboard.zones": "Finger zones",
  "keyboard.emulation": "Layout emulation",
  "keyboard.colors": "Colour the finger zones",
  "keyboard.pointers": "Show which finger to use",
  // Text on screen
  "textDisplay.font": "Font",
  "textDisplay.caretShapeStyle": "Caret shape",
  "textDisplay.caretMovementStyle": "Caret movement",
  "textDisplay.whitespaceStyle": "How spaces are drawn",
  // Typing behaviour
  "textInput.stopOnError": "Stop on a mistake",
  "textInput.forgiveErrors": "Forgive a mistyped key",
  "textInput.spaceSkipsWords": "Space skips to the next word",
  "textInput.bounceMs": "Ignore repeated keys within",
  // Sound
  "textInput.playSounds": "Sounds while typing",
  "textInput.soundVolume": "Sound volume",
  "textInput.soundTheme": "Sound theme",
  // Screen
  "ui.speedUnit": "Speed shown in",
  "ui.ghostRace": "Race your previous run",
  "ui.hideKeyboard": "Hide the on-screen keyboard",
  "ui.hideHeaderWhileTyping": "Slide the header away while typing",
  "ui.tourSeen": "Has seen the tour",
  "ui.allowSkip": "May skip a lesson",
  "ui.cursorEffect": "Cursor effect",
  "ui.cursorEffectIntensity": "Cursor effect strength",
  // Typing test
  "typingTest.textSource.type": "Test: where the words come from",
  "typingTest.textSource.language": "Test: language",
  "typingTest.wordList.wordListSize": "Test: words drawn from",
  "typingTest.book": "Test: which book",
  "typingTest.book.paragraphIndex": "Test: starting paragraph",
  "typingTest.duration.type": "Test: measured by",
  "typingTest.duration.value": "Test: length",
  "typingTest.testStyle": "Test: style",
  // Account and email
  "account.timeZone": "Time zone",
  "account.weekStart": "Week starts on",
  "account.emailReminders": "Practice reminders by email",
  "account.reminderFrequency": "How often a reminder may be sent",
  "account.emailProductNews": "Product news by email",
  "account.newsLevel": "How much news counts as news",
  "account.showHeaderIdentity": "Show who is signed in, in the header",
  "account.analytics": "Anonymous analytics",
};

/**
 * The groups, named and ordered as the control-centre mock names them.
 *
 * A learner's own settings screen groups these the same way, so an admin
 * looking for "what does the caret do by default" looks in the same place
 * they would if they were the learner.
 */
const GROUPS: readonly {
  readonly group: string;
  readonly props: PropTree;
}[] = [
  { group: "Appearance", props: {} as PropTree },
  { group: "Lesson", props: lessonProps as PropTree },
  {
    group: "Keyboard and typing",
    props: {
      ...keyboardProps,
      ...textDisplayProps,
      ...textInputProps,
      ...soundProps,
      ...uiProps,
    } as PropTree,
  },
  { group: "Typing test", props: typingTestProps as PropTree },
  { group: "Accessibility and voice", props: {} as PropTree },
  { group: "Account and email", props: accountProps as PropTree },
];

/**
 * The settings that are not `AnyProp` objects.
 *
 * Appearance is stored in a cookie of its own (`ThemePrefs`) and the
 * accessibility preferences in a per-learner blob (`defaultA11y`), so
 * neither can be walked like the rest. They are still read from the real
 * defaults rather than transcribed, which is the part that matters: the
 * first entry of each theme list IS the default for a fresh visit, and
 * `defaultA11y` IS what a learner starts from.
 */
function looseRows(): readonly LearnerReferenceRow[] {
  const appearance: LearnerReferenceRow[] = [
    {
      key: "prefs.color",
      label: "Theme",
      group: "Appearance",
      value: COLORS.default.name,
    },
    {
      key: "prefs.font",
      label: "Font",
      group: "Appearance",
      value: FONTS.default.name,
    },
    {
      key: "prefs.textSize",
      label: "Text size",
      group: "Appearance",
      value: TEXT_SIZES.default.name,
    },
    {
      key: "prefs.accent",
      label: "Accent colour",
      group: "Appearance",
      // A child's profile starts on a different accent; this is the adult
      // one, which is what a fresh visit gets.
      value: findAccent(DEFAULT_ACCENT).name,
    },
  ];
  const a11y: LearnerReferenceRow[] = A11Y_LABELS.map(([key, label]) => ({
    key: `a11y.${key}`,
    label,
    group: "Accessibility and voice",
    value: readableA11y((defaultA11y as Record<string, unknown>)[key]),
  }));
  return [...appearance, ...a11y];
}

/** The accessibility preferences, in the order the learner's own screen shows them. */
const A11Y_LABELS: readonly (readonly [string, string])[] = [
  ["motion", "Motion"],
  ["calm", "Calm mode"],
  ["chords", "Chord shortcuts"],
  ["bounceMs", "Ignore repeated keys within"],
  ["fingerMarks", "Finger marks on the keys"],
  ["captions", "Captions on spoken prompts"],
  ["predictable", "Predictable layout"],
  ["letterSpacing", "Extra letter spacing"],
  ["lineHeight", "Line height"],
  ["plain", "Plain language"],
  ["scores", "Show scores"],
  ["streakGrace", "Forgive a broken streak"],
  ["typeface", "Accessible typeface"],
  ["targets", "Touch target size"],
  ["cues", "Extra cues"],
  ["timers", "Show timers"],
  ["speechRate", "Speech rate"],
  ["speechVoice", "Speech voice"],
  ["appVoice", "App voice"],
];

/** A11y values are plain data, so "off" reads better than "false". */
function readableA11y(value: unknown): unknown {
  if (typeof value === "boolean") {
    return value ? "on" : "off";
  }
  if (value == null) {
    return "follow the device";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "none" : value.join(", ");
  }
  return value;
}

/**
 * A default as a person reads it, not as the code stores it.
 *
 * An enum prop holds a number and an item prop holds an object; neither is
 * something to put in front of an admin, so each becomes the name it goes by.
 * A volume between zero and one becomes a percentage for the same reason, and
 * a long free-text default is trimmed rather than filling the row.
 */
export function readable(prop: AnyProp<any>, value: unknown): unknown {
  const p = prop as any;
  // "on" and "off", not "true" and "false": the accessibility rows beside
  // these already read that way, and a reference page an admin skims should
  // not switch vocabulary halfway down.
  if (p.type === "boolean") {
    return value === true ? "on" : "off";
  }
  if (p.type === "item" || p.type === "xitem") {
    return (value as any)?.name ?? (value as any)?.id ?? p.toJson(value);
  }
  if (p.type === "enum") {
    const found = Object.entries(p.all).find(
      ([, v]) => typeof v === "number" && v === value,
    );
    return found?.[0] ?? value;
  }
  if (p.type === "flags") {
    return Array.isArray(value) ? value.join(", ") : value;
  }
  if (
    p.type === "number" &&
    p.min === 0 &&
    p.max === 1 &&
    typeof value === "number"
  ) {
    return `${Math.round(value * 100)}%`;
  }
  if (p.type === "string" && typeof value === "string") {
    if (value === "") {
      return "empty";
    }
    return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  }
  return p.toJson(value);
}

/** Every per-learner setting with its shipped value, grouped for the page. */
export function learnerReferenceRows(): readonly LearnerReferenceRow[] {
  const rows: LearnerReferenceRow[] = [];
  const seen = new Set<string>();
  const loose = looseRows();
  for (const { group, props } of GROUPS) {
    for (const row of loose.filter((r) => r.group === group)) {
      rows.push(row);
      seen.add(row.key);
    }
    for (const prop of walk(props)) {
      if (seen.has(prop.key)) {
        // The sound props are declared in two places, and `showHeaderIdentity`
        // belongs with Appearance rather than with the email preferences it
        // sits beside in the code. First group to claim one keeps it.
        continue;
      }
      seen.add(prop.key);
      rows.push({
        key: prop.key,
        label: LABELS[prop.key] ?? prop.key,
        group: MOVED[prop.key] ?? group,
        value: readable(prop, prop.defaultValue),
      });
    }
  }
  // A moved row is pushed in its source group's turn, so put it back where
  // it belongs before the page reads the order.
  const order = GROUPS.map((g) => g.group);
  return rows.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

/**
 * Rows whose group is not the package they are declared in.
 *
 * The cursor effect and the header chip are declared beside the settings
 * they share a store with, and read as appearance to everybody else.
 */
const MOVED: Readonly<Record<string, string>> = {
  "ui.cursorEffect": "Appearance",
  "ui.cursorEffectIntensity": "Appearance",
  "account.showHeaderIdentity": "Appearance",
};

/**
 * For the contract test: props this page reaches that nobody has named.
 *
 * A learner setting added without a label would appear on an admin's screen
 * as a dotted code, which is the thing the owner asked us to stop doing.
 */
export function unlabelledLearnerProps(): readonly string[] {
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const { props } of GROUPS) {
    for (const prop of walk(props)) {
      if (!seen.has(prop.key) && LABELS[prop.key] == null) {
        missing.push(prop.key);
      }
      seen.add(prop.key);
    }
  }
  return missing;
}
