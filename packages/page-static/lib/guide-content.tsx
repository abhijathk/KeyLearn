import { type ReactNode } from "react";
import { GUIDE_BY_LOCALE } from "./guide-i18n.ts";

// The User Guide is a large prose document. Rather than fragment it into
// hundreds of react-intl catalog keys, it lives as structured DATA: each
// section is a list of typed blocks whose strings can be translated wholesale.
// Translations live in ./guide-i18n.ts, keyed by locale, and fall back to
// English (GUIDE_EN) whenever a locale — or an individual field — is missing.

export type GuideBlock =
  | { readonly p: string } // a paragraph (supports *emphasis*)
  | { readonly lab: string } // a "how to" sub-heading
  | { readonly steps: readonly string[] } // an ordered step list
  | { readonly tips: readonly string[] }; // a bulleted tip list

export type GuideSection = {
  readonly id: string; // stable anchor — never translated
  readonly nav: string;
  readonly heading: string;
  readonly blocks: readonly GuideBlock[];
};

export type GuideDoc = {
  readonly kicker: string;
  readonly title: string;
  readonly dateline: string;
  readonly navLabel: string;
  readonly sections: readonly GuideSection[];
};

// A translation may fill any subset of the doc; missing fields (or whole
// sections, matched by id) fall back to English in guideFor().
export type GuideTranslation = {
  readonly kicker?: string;
  readonly title?: string;
  readonly dateline?: string;
  readonly navLabel?: string;
  readonly sections?: readonly {
    readonly id: string;
    readonly nav?: string;
    readonly heading?: string;
    readonly blocks?: readonly GuideBlock[];
  }[];
};

export const GUIDE_EN: GuideDoc = {
  kicker: "Everything you can do",
  title: "User Guide",
  dateline:
    "The complete guide to KeyLearn — from your first visit to signing out",
  navLabel: "On this page",
  sections: [
    {
      id: "account",
      nav: "Do I need an account?",
      heading: "Do I need an account?",
      blocks: [
        {
          p: "No. You can start typing the moment you arrive, and your progress is saved right here on this device. Create a free account only if you want your history to follow you to other devices, keep a backup, or share a profile link. Nothing useful is locked behind signing in.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Sign in and passwords",
      heading: "Signing up, logging in, and passwords",
      blocks: [
        { p: "Everything lives in the menu at the top-right." },
        { lab: "Create an account" },
        {
          steps: [
            "Open the menu (top-right).",
            "Choose Register.",
            "Enter an email and a password.",
            "Confirm — you are in.",
          ],
        },
        { lab: "Log in" },
        {
          steps: [
            "Open the menu and choose Log In.",
            "Enter your email and password.",
          ],
        },
        { lab: "Reset a forgotten password" },
        {
          steps: [
            "On the Log In screen, choose Forgot Password.",
            "Enter your email address.",
            "Open the reset link we send you.",
            "Choose a new password and log in.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profiles",
      heading: "Profiles for the whole household",
      blocks: [
        {
          p: "KeyLearn is built like a household: one account holds up to four profiles (eight with premium), grown-ups and children in any mix. Each profile keeps its *own* separate progress on this device — nothing is ever mixed together.",
        },
        { lab: "Add a profile" },
        {
          steps: [
            "Open the menu and choose Account (or “Set up profiles”).",
            "Select Add a profile.",
            "Type a first name.",
            "Mark it as a Grown-up or a Kid.",
            "Pick an avatar — a friendly icon, or a Photo from your device.",
            "For a child, add a birth year (it only tunes the words and pacing to their age).",
            "Save.",
          ],
        },
        { lab: "Switch to another learner" },
        {
          steps: [
            "Open the menu.",
            "Tap a face under Learners — the app resumes where they left off.",
          ],
        },
        { lab: "Edit or remove a profile" },
        {
          steps: [
            "Open the menu and choose Account.",
            "Select Edit on a profile, or delete it to free a slot.",
          ],
        },
        {
          p: "Kid profiles get a simplified, locked-down menu, and grown-up actions sit behind a quick “what is A times B?” maths gate, so little ones cannot wander into the settings.",
        },
      ],
    },
    {
      id: "screen",
      nav: "The practice screen",
      heading: "The practice screen",
      blocks: [
        {
          p: "Just start typing. The word you need floats just above the on-screen keyboard; a glowing comet points to the very next key; the keys are tinted by finger zone so you learn which finger reaches where; and a faint pair of resting hands shows where your fingers live between presses. The whole skill is one habit: keep your eyes on the words, not your hands.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Your journey",
      heading: "How lessons grow — your journey",
      blocks: [
        {
          p: "KeyLearn is *adaptive*. It measures how quickly and cleanly you hit each key and only adds a new letter to your set once you can type the current ones both fast and accurately. That growing set is your journey, from a handful of letters to the whole alphabet — the difficulty rises exactly as fast as you do, never faster, so you are always working right at your edge.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Live stats",
      heading: "The live readout",
      blocks: [
        {
          p: "As you type, the floating panel shows your current speed and accuracy, a little sparkline of recent runs, your goal tracks and your streak. It is there to encourage you, not to nag.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Practice tools",
      heading: "Practice tools",
      blocks: [
        {
          p: "The small tools beside the text let you open a guided tour, restart the current lesson (Ctrl + Left), skip to the next one (Ctrl + Right), show or hide the on-screen keyboard, and resize the practice text. The gear opens the full Settings, described next.",
        },
      ],
    },
    {
      id: "content",
      nav: "What you type",
      heading: "Choosing what you type",
      blocks: [
        {
          p: "Open Settings and go to Practice Content to choose how your words are made:",
        },
        {
          tips: [
            "*Guided practice* — the adaptive default that grows your alphabet key by key.",
            "*Classic course* — a fixed, ordered march through the keys.",
            "*Frequent words* — the most common words in your language.",
            "*Book Text* — type your way through real books built into the app.",
            "*Your Own Text* — paste anything you like and practise on it.",
            "*Code Snippets* — brackets, symbols and the rhythm of code.",
            "*Number Drills* — the number row and the keypad.",
          ],
        },
        { lab: "Change what you type" },
        {
          steps: [
            "Open Settings (the gear near the practice text).",
            "Go to Practice Content.",
            "Pick a mode — for Book Text choose a book, for Your Own Text paste your words.",
            "Close Settings and keep typing.",
          ],
        },
        {
          p: "The same screen sets your alphabet size, a target speed, how long each lesson runs, and a daily goal.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Smart Practice",
      heading: "Smart Practice helpers",
      blocks: [
        {
          p: "On top of guided practice, Smart Practice adds gentle helpers: a bottleneck drill that hunts down your slowest key-pairs, spaced repetition, skill-decay refreshers that revisit rusty keys, smart confidence, and key recovery. They are all on by default.",
        },
        { lab: "Turn a helper on or off" },
        {
          steps: [
            "Open Settings.",
            "Go to Smart Practice.",
            "Toggle any helper you like — or leave them all on.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Keyboard setup",
      heading: "Setting up your keyboard",
      blocks: [
        {
          p: "Settings, Keyboard Setup is where you match KeyLearn to your keyboard and to the layout you want to learn.",
        },
        { lab: "Change your keyboard layout" },
        {
          steps: [
            "Open Settings.",
            "Go to Keyboard Setup.",
            "Pick your language, then your layout (QWERTY, Dvorak, Colemak and more).",
            "Leave “Simulate this layout” on so you can practise it whatever your computer is set to.",
            "Watch the live preview to confirm.",
          ],
        },
        {
          p: "On the same screen you can choose the keyboard shape, colour the keys by finger zone, and spotlight the next key while you are still learning where things are.",
        },
      ],
    },
    {
      id: "display",
      nav: "Display",
      heading: "Display and feel",
      blocks: [
        {
          p: "The Display and Text Input settings let you show your speed as words- or characters-per-minute and fine-tune how typing feels. Restore Defaults is always a click away if you want to start fresh.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Your progress",
      heading: "Your progress — the Profile page",
      blocks: [
        {
          p: "The Profile page is your full record: Lifetime and Today stats up top (time practised, lessons done, your best and typical speed and accuracy, and how today compares); a map of every letter you have unlocked; the story of how each individual key has sped up, with a smoothing slider; the big picture of every key over time; and the slowest transitions still holding you back. You can even race your own last run as a ghost to feel the progress directly.",
        },
        { lab: "Open your progress" },
        {
          steps: [
            "Open the menu.",
            "Choose Profile.",
            "Use the filter row to focus on Letters, Digits, Punctuation or Symbols.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Your data",
      heading: "Looking after your data",
      blocks: [
        { lab: "Clear a profile’s statistics" },
        {
          steps: [
            "Open Profile for the learner you want to reset.",
            "Scroll to the reset control at the bottom of the page.",
            "Confirm “Erase everything” — only this profile is cleared.",
          ],
        },
        { lab: "Download your data" },
        {
          steps: [
            "Open Profile.",
            "Use the download option to save your history as a file.",
          ],
        },
        {
          p: "Sign in if you want your history to sync across devices and to share a public profile link. There are no ads and no trackers, and you can delete your data — or your whole account — whenever you like.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Kids mode",
      heading: "Kids mode",
      blocks: [
        {
          p: "Children practise on a playful trail. Every correct key walks their character a step closer home, and the character grows from a tiny baby into a fully-grown hero as more letters unlock. A newly-learned key sets off a little celebration, and each session ends at a cosy campfire.",
        },
        { lab: "Switch to Kids" },
        {
          steps: [
            "Open the menu.",
            "Choose Kids — or pick a kid profile under Learners.",
          ],
        },
        {
          p: "There are two worlds to choose from — Dino Run, with a friendly dinosaur, and Hero Trail, where a knight quests through a forest — each with a character to pick.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Kids toy-box",
      heading: "The kids toy-box",
      blocks: [
        { lab: "Open the toy-box" },
        {
          steps: [
            "On the kids screen, tap the gear at the top of the play area.",
          ],
        },
        {
          p: "Inside you can set the world and character, Big letters, Sounds, Helper hands (the glowing finger guide), the Keyboard (hidden, simple, or the full grown-up board), Letters on the trail (the words shown as blocks right in the game), a session Timer, Cheers (encouraging little messages), and — tucked under Advanced — sliders for Brightness, Colour and how lively the world feels. There is a calm night look as well as the bright day one.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Growing up",
      heading: "Growing with your child",
      blocks: [
        {
          p: "KeyLearn quietly tunes itself to a child’s age. The youngest see big, friendly letters, forgiving pacing, letter blocks right on the trail and the gentlest help; older children graduate to longer words, the full keyboard and a cleaner look. Just set the birth year on the profile and the rest follows on its own.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Other modes",
      heading: "Other ways to practise",
      blocks: [
        {
          p: "Beyond your daily practice there is a *Speed Test* — a quick one-off passage that reports your words-per-minute and accuracy with no lesson attached; a *Layouts* explorer for comparing keyboard layouts and their finger maps; *High Scores* to see how you stack up; and *Multiplayer* races to push your speed against others in real time.",
        },
        { lab: "Find them" },
        {
          steps: [
            "Open the menu.",
            "Choose Speed Test, Layouts, High Scores or Multiplayer.",
          ],
        },
      ],
    },
    {
      id: "yours",
      nav: "Make it yours",
      heading: "Make it yours",
      blocks: [
        { lab: "Change the theme" },
        {
          steps: [
            "Open the menu.",
            "Use the theme switch — a light, dark, or the KeyLearn look.",
          ],
        },
        { lab: "Change the site language" },
        {
          steps: ["Open the menu.", "Under Site language, pick your language."],
        },
        {
          p: "On the practice screen you can also resize the text and turn sounds on or off whenever you please.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privacy",
      heading: "Privacy, in a sentence",
      blocks: [
        {
          p: "No ads, and no trackers. A child’s profile never leaves your browser. Sign in only if you want syncing or sharing; otherwise everything stays on this device, and you are free to delete it at any time.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Signing out",
      heading: "Signing out",
      blocks: [
        { lab: "Log out" },
        { steps: ["Open the menu.", "Choose Log out and confirm."] },
        {
          p: "Your practice history stays safely on this device — and on your account, if you made one — ready for the next time you sit down to type.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Tips",
      heading: "A few habits that really help",
      blocks: [
        {
          tips: [
            "Accuracy before speed — clean typing is what sticks.",
            "Fix mistakes calmly; do not race to catch up.",
            "Rest your fingers on the home row — F and J have little bumps.",
            "A few minutes every day beats an hour once a week.",
          ],
        },
      ],
    },
  ],
};

// Render a string that may contain *emphasis* markers into a ReactNode,
// turning each *…* run into an <em>. Falls back to plain text otherwise.
export function renderRich(text: string): ReactNode {
  if (!text.includes("*")) {
    return text;
  }
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
      <em key={i}>{part.slice(1, -1)}</em>
    ) : (
      part
    ),
  );
}

// Merge a locale's translation over the English doc so any missing field or
// section silently falls back to English. Matches on the exact locale, then
// its base language (e.g. "pt-br" → "pt").
export function guideFor(locale: string): GuideDoc {
  const base = locale.split("-")[0];
  const tr = GUIDE_BY_LOCALE[locale] ?? GUIDE_BY_LOCALE[base];
  if (tr == null) {
    return GUIDE_EN;
  }
  const byId = new Map(tr.sections?.map((s) => [s.id, s]) ?? []);
  return {
    kicker: tr.kicker ?? GUIDE_EN.kicker,
    title: tr.title ?? GUIDE_EN.title,
    dateline: tr.dateline ?? GUIDE_EN.dateline,
    navLabel: tr.navLabel ?? GUIDE_EN.navLabel,
    sections: GUIDE_EN.sections.map((en) => {
      const t = byId.get(en.id);
      if (t == null) {
        return en;
      }
      return {
        id: en.id,
        nav: t.nav ?? en.nav,
        heading: t.heading ?? en.heading,
        blocks: t.blocks ?? en.blocks,
      };
    }),
  };
}
