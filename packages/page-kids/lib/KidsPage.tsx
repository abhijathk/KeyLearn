import {
  useAssessment,
  useAssessmentPartial,
  useAssessmentReset,
} from "@keylearn/assessment";
import { keyboardProps, KeyboardProvider } from "@keylearn/keyboard";
import { Lesson, lessonProps, LessonType } from "@keylearn/lesson";
import { LessonLoader } from "@keylearn/lesson-loader";
import {
  A11Y_CHANGED_EVENT,
  clearProfileProgress,
  loadA11y,
  loadNgramStats,
  motionStilled,
  profileIdOfNamespace,
  profileStorageKey,
  saveNgramStats,
  streakGraceDays,
  usePageData,
} from "@keylearn/pages-shared";
import {
  DailyStatsMap,
  dailyStreak,
  MutableKeyStatsMap,
  Result,
  useResults,
} from "@keylearn/result";
import { SettingsContext, useSettings } from "@keylearn/settings";
import {
  Feedback,
  flattenStyledText,
  makeStats,
  TextInput,
  toTextInputSettings,
} from "@keylearn/textinput";
import {
  makeSoundPlayer,
  PlaySounds,
  soundProps,
  SoundTheme,
} from "@keylearn/textinput-sounds";
import { useTheme } from "@keylearn/themes";
import { clsx } from "clsx";
import {
  memo,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  type AgeBand,
  bandConfig,
  classicOffered,
  currentAge,
  currentBand,
  setKidsPaceOverrides,
} from "./age.ts";
import {
  type Album,
  catalogue,
  earn,
  type Hatchling,
  HATCHLINGS,
  loadAlbum,
  nextHatchling,
  practiceDays,
  type Sticker,
} from "./album.ts";
import { kidsAudio } from "./audio.ts";
import {
  CLOTHING_REGIONS,
  type ClothingColours,
  DEFAULT_COLOURS,
  REGION_LABEL,
  SWATCHES,
} from "./character-tint.ts";
import { ClassicScreen, ClassicTour, ClassicUnlock } from "./classic.tsx";
import {
  BranchIcon,
  ChatIcon,
  ClassicIcon,
  ClockIcon,
  DinoFill,
  EggIcon,
  FlagIcon,
  FlameIcon,
  GearIcon,
  HandIcon,
  KeysIcon,
  MoonIcon,
  PawIcon,
  SoundIcon,
  SproutIcon,
  StarIcon,
  SunIcon,
  TentIcon,
  TrophyIcon,
  WorldIcon,
} from "./icons.tsx";
import {
  FINGER_DOTS,
  FINGER_NAMES,
  FINGER_OF,
  FULL_ROWS,
  type KeyDef,
  SIMPLE_ROWS,
  ZONE_OF,
  ZONE_OF_LABEL,
} from "./keyboard-data.ts";
import * as styles from "./kids.module.less";
import { deviceTier, type NightOverride, resolveNightStyle } from "./night.ts";
import { paceTarget } from "./pace.ts";
import { isSpoken, speakLine, stopSpeaking, unlockVoice } from "./voice.ts";
import {
  createKidsWorld,
  createLoaderScene,
  DINO_THEME,
  HERO_THEME,
  type KidsWorld,
  LANDS,
  pickLand,
} from "./world.ts";

// Storage keys are namespaced by the active household profile so every
// learner keeps their own scores and toy-box settings.
/**
 * The healthy ceiling on a day's practice, in minutes.
 *
 * The grown-up page stops encouraging past forty-five: beyond that, extra
 * typing buys little skill, because the gains consolidate during rest and
 * fine-motor accuracy fatigues. Children reach that point sooner and are far
 * less likely to stop on their own — the game is a game — so this sits lower,
 * and the nudge is a card they have to answer rather than a line they can
 * type straight past.
 */
const KIDS_REST_CEILING_MINUTES = 30;

/** The rest nudge fires at most once a calendar day, across reloads. */
const REST_NUDGED_KEY = () => profileStorageKey("kids.restNudged");

function nudgedToday(): boolean {
  try {
    return (
      localStorage.getItem(REST_NUDGED_KEY()) === new Date().toDateString()
    );
  } catch {
    return false;
  }
}

function markNudgedToday(): void {
  try {
    localStorage.setItem(REST_NUDGED_KEY(), new Date().toDateString());
  } catch {
    // Storage may be unavailable; showing it twice is harmless.
  }
}

/** Minutes practised today, from the same records the stats read. */
function minutesToday(results: readonly Result[]): number {
  const today = new DailyStatsMap(results).today.results;
  return Math.round(today.reduce((sum, { time }) => sum + time, 0) / 60000);
}

const BEST_KEY = () => profileStorageKey("kids.best");
// Shown once per learner, the first time they land on Classic.
const CLASSIC_TOUR_KEY = () => profileStorageKey("kids.classicTour");
const PREFS_KEY = () => profileStorageKey("kids.prefs");

type KbMode = "off" | "simple" | "full";

type Prefs = {
  world: "dino" | "hero";
  dino: string;
  hero: string;
  /**
   * Who walks the trail beside them, or null for nobody.
   *
   * A companion never types and never scores — it copies what the player
   * does, a beat later. Off by default: a second character on screen is a
   * second thing to look at, and that is a choice, not a gift.
   */
  companion: string | null;
  /**
   * What the Explorer is wearing.
   *
   * Only the garments a child has actually changed are stored, so an
   * untouched outfit is an empty object and stays whatever the artist
   * painted — including if those colours are ever repainted.
   */
  explorerColours?: ClothingColours;
  name: string;
  bigLetters: boolean;
  sounds: boolean;
  hands: boolean;
  kbMode: KbMode;
  timerVisible: boolean;
  timerMin: number;
  cheers: boolean;
  night: boolean;
  /**
   * Whether the child has ever been ASKED about sound.
   *
   * Distinct from `sounds` itself, which starts off. Off-by-default plus never
   * asking is how the entire audio design — every cheer, every hatch, and the
   * spoken coaching the youngest bands depend on — reached almost nobody: the
   * setting is buried in a toy-box a five-year-old cannot read.
   */
  soundAsked: boolean;
  /**
   * Whether the coach reads its lines aloud. Defaults from the age band —
   * on for the bands who cannot yet read them — and stays a knob because a
   * classroom of eight children is a different room from a bedroom.
   */
  readAloud: boolean;
  /**
   * Whether somebody actually chose the read-aloud setting.
   *
   * Without this the band default gets baked into storage on the first save
   * and follows the child for ever — a five-year-old's "on" would still be
   * on at ten, not because anyone wanted it but because nobody ever asked
   * again. Until the toggle is pressed, the default tracks the band.
   */
  readAloudChosen: boolean;
  /**
   * How far past the alphabet the trail goes.
   *
   * The page used to simply stop: the twenty-sixth letter was the last thing
   * that ever happened, and a child who got there had a game with nothing left
   * in it and no idea that a grown-up page existed. Offered at the graduation
   * and changeable here afterwards, because Shift is genuinely harder and a
   * child who is not ready should be able to say so.
   */
  grownupKeys: "off" | "caps" | "punct";
  /**
   * Who is out after dark on the Hero Trail — see night.ts.
   *
   * "auto" follows the age band: the youngest get the quiet night, and the
   * Lost Travellers only appear for children old enough to enjoy them. The
   * override exists so a grown-up can move a child either way.
   */
  nightStyle: NightOverride;
  /**
   * The drier voice for older learners (see PLAYFUL_SAYS). Off by default and
   * only offered from 9-10 up — the younger bands need the plain lines, which
   * are frequently the only prose on the page they read for themselves.
   */
  playful: boolean;
  /** Scene look: brightness (~0.7–1.3) and paleness (0 = full colour, 1 = pale). */
  brightness: number;
  paleness: number;
  /** Ambient character motion: 1 = full liveliness, 0 = characters hold still. */
  motion: number;
  /** Show the practice word as 3-D letter blocks in the world (older bands opt
   * in; the youngest always get it). */
  wordBlocks: boolean;
  /**
   * Which face of practice this learner is on: the dino trail, or the
   * grown-up-shaped Classic screen.
   *
   * Defaults from the age band — the trail up to ten, Classic from eleven —
   * and is a knob because eleven is an average, not a rule. Both faces run
   * the same lesson engine over the same saved progress, so switching costs
   * a child nothing.
   */
  classic: boolean;
  /**
   * Practice-text scale on the Classic screen, 0.75–1.5.
   *
   * The trail has one big-letters switch because its words sit in a fixed
   * panel. Classic gives the grown-up page's slider instead: the text is the
   * screen's centrepiece there, and how big it wants to be depends on the
   * desk, the eyes and the room rather than on the age.
   */
  textScale: number;
  /**
   * Whether the board's keys wear their finger-zone colours.
   *
   * On by default: the colours are how a learner sees which hand owns which
   * key without being told. Some find them busy once they no longer need
   * them, so they come off — the glowing next key does not depend on them.
   */
  fingerColours: boolean;
  /**
   * Which board is drawn.
   *
   * "crayon" is the white cap ringed in its finger colour that the kids mode
   * has always drawn. "rainbow" is the primary-colour learning board: green
   * for the frame, red for the numbers and punctuation, blue for the
   * alphabet, with the vowels set apart in a lighter blue.
   *
   * A finish, not a second keyboard — the key positions, sizes and labels are
   * identical, so this follows the learner between Classic and the trail
   * without either having to know about it.
   */
  board: KidsBoard;
};

export type KidsBoard = "crayon" | "rainbow";

// Kids defaults: light mode, quiet sounds, a silent session, and the text
// size, helper hands, keyboard guide and timer length tuned to the learner's
// age band. Anything saved in the toy-box settings still wins.
function defaultPrefs(): Prefs {
  const band = currentBand();
  const cfg = bandConfig(band);
  return {
    // Little ones start in the friendly Hero Trail; big kids get Dino Run.
    // Either can switch worlds any time in the toy-box.
    world: band === "5-6" || band === "7-8" ? "hero" : "dino",
    dino: "TRex",
    // A child their own size, in both directions.
    //
    // Little Drew for 5-6 and 7-8, Dave for 9-10 and 11+. Nobody starts as
    // the Knight any more: a child playing as a child is the point of these
    // two, and the fantasy figures stay in the toy-box for whoever wants one.
    hero: band === "5-6" || band === "7-8" ? "Explorer6" : "Explorer",
    companion: null,
    explorerColours: {},
    name: "",
    bigLetters: cfg.bigLetters,
    sounds: false,
    hands: cfg.hands,
    kbMode: cfg.kbMode,
    timerVisible: false,
    timerMin: cfg.timerMin,
    cheers: true,
    night: false,
    soundAsked: false,
    readAloud: cfg.readAloud,
    readAloudChosen: false,
    grownupKeys: "off",
    nightStyle: "auto",
    playful: false,
    brightness: 1,
    paleness: 0,
    motion: 0.7,
    wordBlocks: false,
    classic: cfg.classic,
    textScale: 1.25,
    fingerColours: true,
    board: "crayon",
  };
}

/**
 * Whether this learner is on Classic right now.
 *
 * Exported because the page that wraps KidsPage has to know before it mounts:
 * Classic is a separate course with its own history, so the store to open is
 * decided outside, not inside.
 */
export function classicActive(): boolean {
  try {
    return loadPrefs().classic === true && classicOffered();
  } catch {
    return false;
  }
}

/**
 * The same question about a learner who is not the one at the keyboard.
 *
 * The account window has to ask it: a course pane showing every learner's
 * progress must read the course each of them is actually on, or it reports
 * one learner's guided history as their Classic one.
 */

function loadPrefs(): Prefs {
  try {
    const prefs: Prefs = {
      ...defaultPrefs(),
      ...JSON.parse(localStorage.getItem(PREFS_KEY()) ?? "{}"),
    };
    // A stored override the band no longer offers loads as "by age" rather
    // than lingering invisibly — the pill it belonged to is not on screen.
    if (currentBand() === "5-6" && prefs.nightStyle === "full") {
      prefs.nightStyle = "auto";
    }
    // The voice follows the band until somebody says otherwise: on for the
    // bands who cannot yet read the coach, off for the big kids — including
    // a child who has aged out of needing it since the pref was written.
    if (!prefs.readAloudChosen) {
      prefs.readAloud = bandConfig(currentBand()).readAloud;
    }
    // Repair a preference Classic used to write by mistake. Its board control
    // saved "full" (and switched the helper hands off), which then followed
    // the learner back to the trail. Classic never needed the value, so a
    // profile still carrying it is put back on its band's own board.
    if (prefs.classic && prefs.kbMode === "full") {
      const cfg = bandConfig(currentBand());
      prefs.kbMode = cfg.kbMode;
      prefs.hands = cfg.hands;
    }
    return prefs;
  } catch {
    return defaultPrefs();
  }
}

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY()) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * A drier, cheekier voice for the older bands, mixed in when "playful" is on.
 *
 * Written by hand rather than generated from a slang corpus, and the reason is
 * worth stating because the corpus was the obvious shortcut. StudyBuddy's
 * Gen Alpha bible is a COMPREHENSION dataset — intent signals, confidence
 * scores, and sixteen censorship-evasion terms carried expressly so a system
 * can recognise a child hiding distress ("unalive"). Pointed backwards as a
 * style source it is a way to have a character say something awful to a
 * nine-year-old, and every line would need re-curating each time the slang
 * cycle turned. That bible belongs in the support agent, where the HCL spec
 * already puts it, and where it is used to understand what a child writes
 * rather than to imitate it.
 *
 * So: no slang, no abbreviations, no emoji. What makes these read as older is
 * the register — short, dry, understated, occasionally deadpan — which does
 * not expire. Two rules held throughout:
 *
 * - The joke is never at the child's expense. It is always on the character,
 *   the trail, or nobody. A learner who has just mistyped is not the target.
 * - Nothing here is instructional. These mix into the pool alongside the
 *   normal lines, so anything a child actually needs to be told is still said
 *   plainly by the line next to it.
 *
 * Offered from 9-10 upward; the younger bands never see the toggle.
 */
const PLAYFUL_SAYS: Partial<Record<string, readonly string[]>> = {
  start: [
    "Right. The trail is not going to walk itself.",
    "Let's make this look easy.",
    "{name} is ready. The question is the fingers.",
    "New run, same fingers. Go on then.",
  ],
  cheer: [
    "Okay, that was clean.",
    "No notes.",
    "You have clearly done this before.",
    "That was smooth and you know it.",
    "Genuinely quick, that.",
    "{name} is trying to keep up.",
  ],
  miss: [
    "We do not talk about that one.",
    "Pretend that did not happen. I will.",
    "One for the bloopers.",
    "Rogue finger. It happens to everyone.",
  ],
  streak: [
    "You are on one.",
    "This streak is getting silly.",
    "Do not look down.",
  ],
  grow: [
    "A new key. Try not to make it weird.",
    "Fresh letter. Be nice to it.",
  ],
  idle: [
    "{name} is pretending not to check on you.",
    "The trail is still here. So is {name}.",
  ],
  wave: ["{name} waves. Still around?", "{name} is waving. This is your cue."],
  crouch: [
    "{name} is pretending not to wait for you.",
    "{name} has found a rock and is making it a whole thing.",
  ],
  sit: [
    "{name} has fully committed to sitting down.",
    "{name} is sitting. It has been a journey. Press a key.",
  ],
  crossed: ["New chapter. {name} acts unimpressed but is delighted."],
};

// The say-line between the world and the keyboard. Many voices per moment so
// the trail never repeats itself — and the praise is for EFFORT, because
// that's what keeps a kid trying after the next miss. {name}, {letter},
// {finger} and {land} are filled in at speak time.
const SAYS = {
  start: [
    "The herd is walking home to the Green Valley — every letter is a step!",
    "A long trail, a brave dino, and you — every letter is a step home!",
    "{name} sniffs the morning air. The Green Valley is far — start walking!",
    "The herd is ready. Your fingers lead the way today!",
    "Every key you press is one pawstep closer to home.",
  ],
  cheer: [
    "Your fingers worked so hard!",
    "You didn't give up!",
    "Steady steps — that's how the herd walks!",
    "The herd is cheering for YOU!",
    "Great try after try!",
    "Camp flag ahead — keep going!",
    "{name} loves running next to you!",
    "One letter at a time — that's the way!",
    "Look at those fingers go!",
    "The little dinos are copying your steps!",
  ],
  // Extra-warm lines mixed in for the youngest walkers.
  cheerYoung: [
    "WOW! Look at you go!",
    "You pressed it all by yourself!",
    "Super duper typing!",
    "{name} does a happy wiggle!",
    "High five! Well… high claw!",
  ],
  // Cooler phrasing for the 9-and-up crowd — praise without the baby talk.
  cheerCool: [
    "Clean hit. Keep the rhythm.",
    "Smooth — the herd barely keeps up.",
    "Nice streak building.",
    "{name} nods, impressed.",
    "That's the pace — steady and sharp.",
  ],
  camp: [
    "CAMP! +10 — the whole herd cheers for {name}!",
    "CAMP! You led {name} all the way to the flag!",
    "The tents are up — {name} gets a berry snack. +10!",
    "Camp reached! The herd stomps their feet for you. +10!",
    "Flag! {name} takes a big happy breath. +10!",
  ],
  miss: [
    "Whoops — {name} stopped! The glowing key shows the way.",
    "Oops! No rush — find the glowing key.",
    "{name} tripped on a pebble. The glowing key helps you both up!",
    "Not that one — but you're SO close. Look for the glow!",
    "Wrong stone! Peek at the glowing key and try again.",
  ],
  roar: [
    "RAWWRR!! Take a breath — look for the glowing key!",
    "RAWWRR!! Even big dinos rest. Breathe, then find the glow.",
    "A big roar! Shake your hands, smile, and try the glowing key.",
    "RAWWRR!! {name} says: slow is smooth, smooth is fast!",
  ],
  grow: [
    "{name} grew — a brand new key joined your trail!",
    "A new key! {name} stretches taller than ever!",
    "Your trail got bigger — and so did {name}!",
    "New key unlocked! The herd gasps — {name} is bigger now!",
    "Whoa — {name} just grew into a {stage}!",
    "A new key, a bigger {name}! Now a proud {stage}.",
    "{name} shot up a little — hello, {stage}!",
  ],
  // Growth feels different for a baby than for a nearly-grown dino.
  growYoung: [
    "Baby {name} wobbles up a size — so cute and growing!",
    "Little {name} squeaks with joy — a new key, a bigger baby!",
    "{name} is still tiny, but growing bigger every key!",
  ],
  growOld: [
    "Towering {name} rumbles — nearly full-grown now!",
    "{name} lets out a deep, proud roar — almost an adult!",
    "The earth trembles as mighty {name} grows again!",
  ],
  hatch: [
    "An egg hatched — {dino} joined the herd!",
    "Crack… crack… out popped {dino}!",
    "A wild egg wobbled, and there was {dino}!",
  ],
  streak: [
    "{name} is SO proud — 10 in a row!",
    "TEN in a row! {name} does a happy hop!",
    "Ten perfect steps — the herd can't believe it!",
    "10 straight! Your fingers know the trail by heart!",
  ],
  // ── waiting out a pause ───────────────────────────────────────────────
  //
  // Three moments, spaced further and further apart, matching the poses the
  // character takes when nobody is typing (see world.ts, the idle chain).
  // They get calmer as the wait gets longer, never naggier: a child who has
  // wandered off is not helped by being chased, and one who is thinking is
  // helped by being told there is no hurry. Every line ends with a way back
  // in, and none of them mentions how long they have been gone.
  wave: [
    "{name} waves a paw. Hello — still there?",
    "Hello! {name} is waving at you.",
    "{name} stands up tall and waves. Ready when you are!",
    "A little wave from {name} — shall we walk on?",
    "{name} turns round and gives you a big wave.",
    "Hello again! {name} spotted you.",
    "{name} waves, just in case you were looking.",
    "A wave from the trail — whenever you're ready.",
  ],
  waveYoung: [
    "Hiiii! {name} is waving BOTH arms!",
    "{name} waves and waves and waves!",
    "Yoo-hoo! {name} can see you!",
    "{name} is doing a great big hello wave!",
  ],
  waveOld: [
    "{name} waves. Still with me?",
    "A wave from {name}. Ready when you are.",
    "{name} looks up and waves.",
  ],
  crouch: [
    "{name} crouches down to wait. No rush!",
    "{name} is having a little rest. Press a key when you're ready.",
    "Still waiting for your fingers — {name} doesn't mind at all.",
    "{name} crouches low and watches the trail.",
    "{name} kneels down in the grass. Take as long as you like.",
    "A little breather. {name} will be right here.",
    "{name} rests on one knee and waits for you.",
    "No rush at all — {name} is happy waiting.",
  ],
  crouchYoung: [
    "{name} is waiting for youuu!",
    "{name} sits on their heels and waits. Ready?",
    "{name} is being very, very patient!",
  ],
  crouchOld: [
    "{name} settles in. Take your time.",
    "{name} drops to a crouch. In your own time.",
    "No hurry. {name} will hold this spot.",
  ],
  sit: [
    "{name} sits right down. Press any key when you're ready!",
    "Comfy here! One key and we're off again.",
    "{name} is sitting in the grass, waiting for you.",
    "No hurry — {name} will wait. Press a key when you want to go.",
    "{name} crosses their legs and gets comfy. Come back whenever.",
    "{name} is watching the clouds go by. One key wakes them up.",
    "Sitting down for a proper rest. Press a key when you'd like to walk on.",
    "{name} has found a nice spot to wait. Ready when you are.",
  ],
  sitYoung: [
    "{name} is sitting down! Press a key and we can play!",
    "{name} is having a sit-down. Wake them up with a key!",
    "Plonk! {name} sits in the grass. Press a key when you want to go!",
  ],
  sitOld: [
    "{name} takes a seat. Press a key whenever you want to carry on.",
    "{name} sits down to wait it out. No rush.",
    "{name} settles cross-legged. Pick it up whenever you like.",
  ],
  idle: [
    "{name} is waiting — press the glowing key!",
    "{name} looks back at you. Ready to walk on?",
    "The trail is quiet… one glowing key starts it again!",
    "{name} taps a claw. Shall we keep going?",
    "{name} sniffs the breeze, then glances at the glowing key.",
    "A butterfly lands on {name}'s nose. Press a key to shoo it!",
    "{name} is counting clouds. Wake them with the glowing key!",
    "Still here! {name} would love one more step.",
  ],
  // Little dinos idle in cute, wobbly ways; grown dinos wait with quiet power.
  idleYoung: [
    "Baby {name} peeps up at you — press the glowing key!",
    "Tiny {name} does a wobbly spin, waiting for a key.",
    "{name} chews a leaf and blinks — one glowing key, please!",
    "Wee {name} plops down for a rest. Press a key to bounce up!",
    "{name} chirps a tiny squeak — the glowing key wakes it!",
  ],
  idleOld: [
    "Mighty {name} stands tall, waiting for your next key.",
    "{name} scans the horizon. One glowing key and you march on.",
    "The ground stills under grown {name} — press the glowing key.",
    "{name} gives a slow, steady nod. Ready when you are.",
    "Big {name} flexes a claw and waits, calm and strong.",
  ],
  stuck: [
    "Look — the {letter} key! Your {finger} presses it.",
    "The {letter} key is right there, under your {finger}!",
    "Try this: peek at your {finger}, then press {letter} gently.",
  ],
  stuckSpace: [
    "Look — the space bar! A thumb presses it.",
    "The BIG long key — give it a thumb tap!",
  ],
  wake: [
    "The {letter} key is awake — back to the trail!",
    "{letter} is your friend now — onward!",
    "You woke up {letter}! The trail continues!",
  ],
  crossed: [
    "A brand new land! Smell that fresh air!",
    "Chapter {chapter}! New trees, new stones, same brave typist.",
    "The herd crossed over — welcome to {land}!",
    "New land, new adventure — the flag is waiting ahead!",
  ],
  graduate: [
    "You know every single letter! {name} has never been so proud.",
    "That's the WHOLE alphabet — every letter on the trail is yours.",
    "Twenty-six letters, all of them learned by you. What a day!",
  ],
  timerEnd: [
    "The herd makes camp. Wonderful typing today!",
    "The sun sets on the trail — you did wonderfully today!",
    "Campfire time! {name} curls up, warm and proud of you.",
    "That's the session — the whole herd sleeps happy tonight!",
  ],
} as const;

// Hero Trail voice: the same warm, effort-first coaching, re-flavoured for a
// little band of adventurers questing home. Only the world-specific lines are
// overridden; the key/finger help (stuck, wake, …) is shared with SAYS.
/**
 * Lines only the night says.
 *
 * The story is never told outright — no card, no narrator. It is implied
 * through what the world does and the few things the coach says after dark:
 * the party keeps a watch, the lanterns matter, and the Lost Travellers out
 * in the mist are lost rather than frightening. Merged into the hero pools
 * when it is night; the Traveller lines only once the night style has any.
 */
const HERO_NIGHT_SAYS: Partial<Record<string, readonly string[]>> = {
  start: [
    "The lanterns are lit — the party walks on through the night.",
    "It is dark, but the road is the same road. One letter, one step.",
    "Night on the trail. Stay close to the light and keep walking.",
  ],
  idle: [
    "The mist curls round the lanterns while {name} waits for you.",
    "The fire crackles. The party waits. One glowing key walks us on.",
    "It is very quiet out there. Your next key keeps the lanterns bright.",
  ],
  wave: [
    "{name} waves in the lantern light. Still there?",
    "A wave out of the dark — {name} is still with you.",
  ],
  crouch: [
    "{name} crouches down beside the lantern to wait.",
    "The mist is cold. {name} settles in and waits for you.",
  ],
  sit: [
    "{name} sits down by the lantern. Press a key when you're ready.",
    "The fire crackles. {name} is sitting, waiting for you.",
  ],
};

const HERO_NIGHT_TRAVELLER_SAYS: Partial<Record<string, readonly string[]>> = {
  start: [
    "The Lost Travellers are out tonight. They walked this road once too.",
    "Eyes in the mist — just the Lost Travellers, watching the lanterns go by.",
  ],
  idle: [
    "A Lost Traveller waves from the treeline. {name} waves back.",
    "The Lost Travellers keep their distance. They only want to watch.",
    "Far off, two pale eyes blink. Lost, not scary. Walk on.",
  ],
};

const HERO_SAYS = {
  ...SAYS,
  start: [
    "The party is marching home through the forest — every letter is a step!",
    "A long trail, a brave hero, and you — every letter is a step home!",
    "{name} lifts their lantern. The village is far — let's walk!",
    "The heroes are ready. Your fingers lead the way today!",
    "Every key you press is one step closer to home.",
  ],
  cheer: [
    "Your fingers worked so hard!",
    "You didn't give up!",
    "Steady steps — that's how heroes walk!",
    "The whole party is cheering for YOU!",
    "Great try after try!",
    "Campfire ahead — keep going!",
    "{name} loves adventuring next to you!",
    "One letter at a time — that's the way!",
    "Look at those fingers go!",
    "The other heroes copy your brave steps!",
  ],
  cheerYoung: [
    "WOW! Look at you go!",
    "You pressed it all by yourself!",
    "Super duper typing!",
    "{name} does a happy twirl!",
    "High five, brave one!",
  ],
  cheerCool: [
    "Clean hit. Keep the rhythm.",
    "Smooth — the party barely keeps up.",
    "Nice streak building.",
    "{name} nods, impressed.",
    "That's the pace — steady and sharp.",
  ],
  camp: [
    "CAMP! +10 — the whole party cheers for {name}!",
    "CAMP! You led {name} all the way to the campfire!",
    "The tents are up — {name} gets a warm snack. +10!",
    "Campfire reached! The heroes stomp for you. +10!",
    "Rest stop! {name} takes a big happy breath. +10!",
  ],
  miss: [
    "Whoops — {name} paused! The glowing key shows the way.",
    "Oops! No rush — find the glowing key.",
    "{name} stepped on a twig. The glowing key helps you both up!",
    "Not that one — but you're SO close. Look for the glow!",
    "Wrong stone! Peek at the glowing key and try again.",
  ],
  roar: [
    "HYAA!! Take a breath — look for the glowing key!",
    "Even brave heroes rest. Breathe, then find the glow.",
    "A mighty shout! Shake your hands, smile, and try the glowing key.",
    "{name} says: slow is smooth, smooth is fast!",
  ],
  grow: [
    "{name} grew braver — a brand new key joined your trail!",
    "A new key! {name} stands a little taller!",
    "Your trail got longer — and {name} grew braver!",
    "New key unlocked! The party gasps — {name} is a {stage} now!",
    "Whoa — {name} just became a {stage}!",
    "A new key, and a prouder {name}! Now a {stage}.",
    "{name} leveled up — hello, {stage}!",
  ],
  growYoung: [
    "Little {name} puffs up with courage — a new key!",
    "Brave little {name} beams — a new key, a bigger heart!",
    "{name} is still learning, but braver every key!",
  ],
  growOld: [
    "Mighty {name} stands tall — nearly a Champion now!",
    "{name} gives a proud, calm nod — almost a Champion!",
    "The forest cheers as {name} grows braver again!",
  ],
  streak: [
    "{name} is SO proud — 10 in a row!",
    "TEN in a row! {name} does a happy hop!",
    "Ten perfect steps — the party can't believe it!",
    "10 straight! Your fingers know the trail by heart!",
  ],
  // ── waiting out a pause ───────────────────────────────────────────────
  // See the note on the dino set: the same three moments, told for the trail.
  wave: [
    "{name} waves from the trail. Hello — still there?",
    "Hello! {name} is waving at you.",
    "{name} turns and waves. Ready when you are!",
    "A little wave from {name} — shall we walk on?",
    "{name} stops on the road and waves back at you.",
    "Hello again! {name} spotted you.",
    "{name} waves, just in case you were looking.",
    "A wave from the trail — whenever you're ready.",
  ],
  waveYoung: [
    "Hiiii! {name} is waving BOTH arms!",
    "{name} waves and waves and waves!",
    "Yoo-hoo! {name} can see you!",
    "{name} is doing a great big hello wave!",
  ],
  waveOld: [
    "{name} waves. Still with me?",
    "A wave from {name}. Ready when you are.",
    "{name} looks up and waves.",
  ],
  crouch: [
    "{name} crouches down by the path. No rush!",
    "{name} is having a little rest. Press a key when you're ready.",
    "Still waiting for your fingers — {name} doesn't mind at all.",
    "{name} crouches low and watches the road ahead.",
    "{name} kneels beside the path. Take as long as you like.",
    "A little breather. {name} will be right here.",
    "{name} rests on one knee and waits for you.",
    "No rush at all — {name} is happy waiting.",
  ],
  crouchYoung: [
    "{name} is waiting for youuu!",
    "{name} sits on their heels and waits. Ready?",
    "{name} is being very, very patient!",
  ],
  crouchOld: [
    "{name} settles in. Take your time.",
    "{name} drops to a crouch. In your own time.",
    "No hurry. {name} will hold this spot.",
  ],
  sit: [
    "{name} sits right down on the trail. Press any key when you're ready!",
    "Comfy here! One key and we're off again.",
    "{name} is sitting by the path, waiting for you.",
    "No hurry — {name} will wait. Press a key when you want to go.",
    "{name} sets down the pack and sits cross-legged. Come back whenever.",
    "{name} is watching the clouds go by. One key wakes them up.",
    "Sitting down for a proper rest. Press a key when you'd like to walk on.",
    "{name} has found a good spot to wait. Ready when you are.",
  ],
  sitYoung: [
    "{name} is sitting down! Press a key and we can play!",
    "{name} is having a sit-down. Wake them up with a key!",
    "Plonk! {name} sits in the grass. Press a key when you want to go!",
  ],
  sitOld: [
    "{name} takes a seat. Press a key whenever you want to carry on.",
    "{name} sits down to wait it out. No rush.",
    "{name} settles cross-legged. Pick it up whenever you like.",
  ],
  idle: [
    "{name} is waiting — press the glowing key!",
    "{name} looks back at you. Ready to walk on?",
    "The trail is quiet… one glowing key starts it again!",
    "{name} taps a boot. Shall we keep going?",
    "{name} watches a firefly, then glances at the glowing key.",
    "A butterfly lands on {name}'s nose. Press a key to shoo it!",
    "{name} is counting clouds. Wake them with the glowing key!",
    "Still here! {name} would love one more step.",
  ],
  idleYoung: [
    "Little {name} peeps up at you — press the glowing key!",
    "{name} does a wobbly spin, waiting for a key.",
    "{name} hums a tune and blinks — one glowing key, please!",
    "Wee {name} sits for a rest. Press a key to bounce up!",
  ],
  idleOld: [
    "Brave {name} stands tall, waiting for your next key.",
    "{name} scans the horizon. One glowing key and you march on.",
    "{name} rests a hand on their sword — press the glowing key.",
    "{name} gives a slow, steady nod. Ready when you are.",
  ],
  crossed: [
    "A brand new land! Smell that fresh forest air!",
    "Chapter {chapter}! New trees, new stones, same brave hero.",
    "The party crossed over — welcome to {land}!",
    "New land, new adventure — the campfire is waiting ahead!",
  ],
  timerEnd: [
    "The party makes camp. Wonderful typing today!",
    "The sun sets on the trail — you did wonderfully today!",
    "Campfire time! {name} rests, warm and proud of you.",
    "That's the quest for today — the whole party sleeps happy!",
  ],
} as const;

/**
 * The Classic voice: the same encouragement with nothing to look at.
 *
 * The trail's lines narrate a picture — a herd walking home, a camp reached,
 * a new land. On Classic there is no picture, so those lines describe a
 * journey the learner cannot see, and an eleven-year-old notices immediately
 * that the game is talking about somewhere else. This says the same things
 * about the only things actually on screen: the words, the keys and the
 * progress.
 */
const CLASSIC_SAYS = {
  start: [
    "A fresh set of words. Take them at your own pace.",
    "New words up. Eyes on the text, not your hands.",
    "Ready when you are — the glowing key starts it.",
    "Fresh line. Smooth beats fast.",
    "Here we go. Let your fingers find the rhythm.",
  ],
  cheer: [
    "Nice and steady.",
    "Good rhythm — keep it.",
    "That's the pace.",
    "Clean work.",
    "Smooth. Keep going.",
  ],
  cheerYoung: [
    "Lovely typing!",
    "You're doing so well!",
    "Great going!",
    "Look at those fingers!",
  ],
  cheerCool: [
    "Clean hit. Keep the rhythm.",
    "Smooth — that's the pace.",
    "Nice streak building.",
    "Steady and sharp.",
    "That's how it's done.",
  ],
  camp: [
    "Set finished. +10.",
    "Whole line, done. +10!",
    "That's the set — nicely held together. +10.",
    "Finished. Your accuracy is holding. +10!",
  ],
  miss: [
    "Not that one — look for the glowing key.",
    "Close. The glowing key is the one.",
    "No rush. Find the glow and try again.",
    "Wrong key — the glow shows the way.",
    "Easy does it. The glowing key next.",
  ],
  roar: [
    "Take a breath — then the glowing key.",
    "Pause a second. Shake out your hands.",
    "Slow is smooth, smooth is fast.",
    "Breathe. The key is not going anywhere.",
  ],
  grow: [
    "A brand new key just joined your set!",
    "New key unlocked — your alphabet grew!",
    "That's another key earned.",
    "New letter in the mix. Nicely done.",
  ],
  growYoung: [
    "A new key, all yours!",
    "You unlocked another letter!",
    "Your set is getting bigger!",
  ],
  growOld: [
    "Another key earned — the set is filling out.",
    "New letter unlocked. Not many left now.",
    "That's one more off the list.",
  ],
  hatch: [
    "Something new unlocked!",
    "A new one joins the set!",
    "Unlocked — nice work.",
  ],
  streak: [
    "Ten in a row — that's control.",
    "TEN clean. Your fingers know this.",
    "Ten straight without a slip.",
    "Ten in a row. That's the rhythm.",
  ],
  idle: [
    "Still here — the glowing key is waiting.",
    "Whenever you're ready.",
    "The glowing key starts it again.",
    "Take your time.",
  ],
  idleYoung: [
    "Ready when you are!",
    "The glowing key is waiting for you!",
    "Press the glowing key to start!",
  ],
  idleOld: [
    "Waiting on you — the glowing key.",
    "Pick it up whenever you like.",
    "Still here when you're ready.",
  ],
  stuck: ["The {letter} key — your {finger} presses it."],
  stuckSpace: ["The space bar — a thumb presses it."],
  wake: ["Back to it — the {letter} key."],
  crossed: ["Onward — the set keeps growing."],
  graduate: [
    "You know every single letter. That is the whole alphabet.",
    "Every letter, learned. The whole board is yours.",
  ],
  timerEnd: [
    "That's your session — good work today.",
    "Time's up. You held your pace well.",
  ],
} as const;

const saysOf = (world: "dino" | "hero", classic = false) =>
  classic
    ? (CLASSIC_SAYS as unknown as typeof SAYS)
    : world === "hero"
      ? (HERO_SAYS as unknown as typeof SAYS)
      : SAYS;

// The dino grows from a just-hatched baby (few keys) to a full adult (whole
// alphabet). Age is 0→1 across that span; the stage name is shown to the kid.
const DINO_MIN_KEYS = 6;
function dinoAgeOf(included: number, total: number): number {
  const span = Math.max(1, total - DINO_MIN_KEYS);
  return Math.max(0, Math.min(1, (included - DINO_MIN_KEYS) / span));
}
function dinoStage(age: number): string {
  if (age < 0.05) {
    return "Baby";
  }
  if (age < 0.3) {
    return "Toddler";
  }
  if (age < 0.6) {
    return "Youngster";
  }
  if (age < 0.95) {
    return "Teen";
  }
  return "Adult";
}

// Hero Trail growth reads as ranks earned on the quest, not ages.
function heroStage(age: number): string {
  if (age < 0.05) {
    return "Novice";
  }
  if (age < 0.3) {
    return "Squire";
  }
  if (age < 0.6) {
    return "Adventurer";
  }
  if (age < 0.95) {
    return "Hero";
  }
  return "Champion";
}

/**
 * One of the coach's lines.
 *
 * Random by default, because hearing the same sentence every time is how
 * encouragement turns into wallpaper. For a learner who has asked for
 * predictability it is the first line every time instead — an autistic child
 * may be listening for what the app will say, and a surprise in the place
 * where reassurance should be is not a delight, it is a reason to stop. The
 * lists are written first-line-first, so the fixed choice is a good one.
 */
const pickSay = (list: readonly string[]) =>
  loadA11y().predictable
    ? list[0]
    : list[Math.floor(Math.random() * list.length)];

const fillSay = (t: string, vars: Record<string, string>) =>
  t.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

// One calibrating line for parents: kids' speeds are NOT adult speeds, and
// most worry evaporates once the realistic range for the age is on screen.
function grownupsAgeNote(words: number, practicedSecs: number): string {
  const age = currentAge();
  const [lo, hi] = bandConfig(currentBand()).typicalWpm;
  const mins = Math.max(1, Math.round(practicedSecs / 60));
  const wpm = Math.round(words / mins);
  const who = age != null ? `age ${age}` : "this age group";
  const track =
    words > 0 && wpm >= lo
      ? " — right on track"
      : words > 0
        ? " — every session builds it"
        : "";
  return `typical for ${who} is ${lo}–${hi} WPM${track} · `;
}

// The praise pool leans warmer for little kids and cooler for older ones.
function cheerPool(s: typeof SAYS, band: AgeBand): readonly string[] {
  switch (band) {
    case "5-6":
      return [...s.cheer, ...s.cheerYoung, ...s.cheerYoung];
    case "9-10":
    case "11+":
      return [...s.cheer.slice(0, 5), ...s.cheerCool, ...s.cheerCool];
    default:
      return s.cheer;
  }
}

// Messages flavour themselves to the dino's own age: a baby's lines are cute
// and wobbly, an adult's are mighty and calm. Categories with "…Young"/"…Old"
// variants mix those in when the dino is little / nearly grown.
function agedPool(
  s: typeof SAYS,
  key: keyof typeof SAYS,
  age: number,
): readonly string[] {
  const any = s as unknown as Record<string, readonly string[]>;
  const base = any[key] ?? [];
  const young = any[`${key}Young`];
  const old = any[`${key}Old`];
  if (age < 0.35 && young) {
    return [...base, ...young];
  }
  if (age > 0.65 && old) {
    return [...base, ...old];
  }
  return base;
}

// The Hero Trail heroes you can BE — reserved for the main character so the
// trail companions never look like you.

/**
 * How many recent keystrokes decide the character's gait.
 *
 * Short enough that slowing down shows up within a word or two; long enough
 * that one slow letter in a fast line does not drop them out of a run.
 */
const GAIT_SAMPLE = 6;

const HERO_CHARACTERS = [
  { id: "Knight", label: "Knight" },
  { id: "Skeleton_Warrior", label: "Skeleton" },
  // A child rather than a fantasy figure, for the older band who have
  // grown out of playing as a skeleton.
  { id: "Explorer", label: "Dave" },
  // Little Drew, the same character at six: rounder, shorter, and the default for
  // the two younger bands, who are being asked to see themselves in him.
  //
  // The ids stay `Explorer` and `Explorer6` — they are the model filenames,
  // and they are also what a saved profile has stored. Renaming those would
  // silently reset every child's choice back to the Knight.
  { id: "Explorer6", label: "Little Drew" },
] as const;

/**
 * Who may come along, for now.
 *
 * Only the two children — a companion is somebody a child recognises as
 * another child, and a skeleton walking behind them is a different idea
 * entirely. The list is filtered against the current hero at the point of
 * use, so it can never offer you yourself.
 */
const COMPANIONS = [
  { id: "Explorer", label: "Dave" },
  { id: "Explorer6", label: "Little Drew" },
] as const;

function peekNextLandName(): string {
  try {
    const n = Number(localStorage.getItem(profileStorageKey("kids.land")) ?? 0);
    return LANDS[n % LANDS.length].name;
  } catch {
    return LANDS[0].name;
  }
}

/**
 * How long a gap in typing may be before the child counts as "not playing".
 *
 * Ten seconds, which is the same moment the runner turns around and beckons —
 * so the rule has one visible meaning: when your buddy is waiting for you, the
 * clock is waiting too.
 *
 * It has to be generous. A five-year-old hunting for a letter they met last
 * week can take six or seven seconds over a single key, and that is the child
 * this page exists for; pausing on them would be worse than not pausing at all.
 */
const IDLE_MS = 10_000;
/**
 * How still the fingers must be before the coach says anything out loud.
 *
 * One second is enough to be sure they have stopped rather than paused
 * between two letters, and short enough that a line about what just happened
 * still lands while it is what just happened.
 */
const SPEECH_QUIET_MS = 1_000;
/**
 * Which bands are offered the drier voice.
 *
 * The same line as Classic, and for the same reason: below it the coach's
 * lines are often the only prose the child reads unaided, and understatement
 * is the one register that does not survive being read by someone still
 * decoding the words.
 */
function playfulOffered(band: AgeBand = currentBand()): boolean {
  return band === "9-10" || band === "11+";
}
/** After this long unspoken, a queued line is dropped rather than said late. */
const SPEECH_STALE_MS = 20_000;

// Each world ends the day in its own voice: the herd on its long migration to
// the green valley, the party on the road home. They used to share one pool,
// which had dinosaurs walking home and heroes in a herd.
const DINO_FINISH = [
  "Your fingers are getting SO fast — the herd can barely keep up!",
  "Your dino grew because of YOU. Amazing typing today!",
  "Every letter marched the herd closer to the green valley!",
  "The whole herd is cheering around the campfire. You did that!",
  "Super steady fingers today — see you on the trail tomorrow!",
];
const HERO_FINISH = [
  "Every letter you typed was a step home. Brilliant walking!",
  "The party makes camp — a whole day's road behind you!",
  "The lanterns are warm and the village is closer. Wonderful typing!",
  "Steady steps the whole way — heroes rest well tonight.",
];
const finishPool = (world: "dino" | "hero") =>
  world === "hero" ? HERO_FINISH : DINO_FINISH;

export function KidsPage() {
  // Control centre: the unlock target floor/ceiling per band, and whether
  // children's certificates are on at all.
  const { learnerDefaults } = usePageData();
  useEffect(() => {
    const floor = learnerDefaults?.["kids.paceFloor"];
    const ceil = learnerDefaults?.["kids.paceCeil"];
    setKidsPaceOverrides(
      Array.isArray(floor) ? (floor as number[]) : null,
      Array.isArray(ceil) ? (ceil as number[]) : null,
    );
  }, [learnerDefaults]);
  return (
    <KeyboardProvider>
      <KidsSettings>
        <LessonLoader>{(lesson) => <KidsGame lesson={lesson} />}</LessonLoader>
      </KidsSettings>
    </KeyboardProvider>
  );
}

/**
 * Kids mode runs the same guided algorithm with the kid vocabulary switched
 * on. The override lives only inside this page — the grown-up settings are
 * untouched.
 */
function KidsSettings({ children }: { readonly children: ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const { results } = useResults();
  // The target follows the child: the middle of their recent sessions plus a
  // small stretch, held inside the band's floor and ceiling. A fixed number per
  // band asked a five-year-old for roughly double what five-year-olds do, and
  // measured on a real profile that meant twenty-seven sessions without a
  // single new letter.
  const target = useMemo(
    () => paceTarget(results, bandConfig(currentBand())),
    [results],
  );
  // How far past the alphabet this child has chosen to go. Read from the same
  // prefs the game writes, and re-read when it says it has changed.
  const [grownupKeys, setGrownupKeys] = useState(() => loadPrefs().grownupKeys);
  useEffect(() => {
    const reread = () => setGrownupKeys(loadPrefs().grownupKeys);
    window.addEventListener("keylearn:kids-prefs", reread);
    return () => window.removeEventListener("keylearn:kids-prefs", reread);
  }, []);

  const kids = useMemo(
    () =>
      settings
        .set(lessonProps.type, LessonType.GUIDED)
        .set(lessonProps.guided.kidsWords, true)
        .set(lessonProps.targetSpeed, target)
        // Past the alphabet the trail carries on into the keys grown-ups use.
        // Sparse on purpose: a capital costs two hands and a whole new motion,
        // and one in seven words is enough to learn it without the passage
        // turning into a Shift drill.
        .set(lessonProps.capitals, grownupKeys === "off" ? 0 : 0.15)
        .set(lessonProps.punctuators, grownupKeys === "punct" ? 0.1 : 0)
        // A new letter arrives only once EVERY letter already known is above
        // target — and judged on current speed, not best-ever. Without this a
        // single lucky keystroke pushes bestConfidence over the line and the
        // next letter appears, which is why the trail kept growing faster than
        // the child actually was.
        .set(lessonProps.guided.recoverKeys, true),
    [settings, target, grownupKeys],
  );
  return (
    <SettingsContext.Provider value={{ settings: kids, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

function KidsGame({ lesson }: { readonly lesson: Lesson }) {
  const { settings } = useSettings();
  const { results, appendResults, namespace } = useResults();
  const kidsPageData = usePageData();

  /**
   * Local kids progress that the server has no history to justify.
   *
   * The best score, album, stars and day count live in this device's
   * localStorage; the practice history lives on the server, per profile.
   * Clear the account's data server-side and the two disagree — the trail is
   * empty and the HUD still reads someone's old best, which looks to a parent
   * exactly like the deletion did not work.
   *
   * Safe to act on ONLY because of how the result store behaves for a
   * signed-in profile: `load()` flushes anything typed offline up to the
   * server and then returns what the SERVER holds. Being offline does not
   * produce an empty list — it falls back to the local copy, and if that is
   * empty too it throws, which leaves the loader on its loading state and
   * never reaches here. So results being ready AND empty means the server
   * genuinely holds nothing for this learner.
   *
   * Both guards are load-bearing. Without a namespace there is no profile and
   * no server history to compare against, and without a signed-in account the
   * device IS the record — clearing there would delete the only copy of a
   * child's progress. Kids results with no profile selected never sync at all
   * (see openResultStorage), so this must never run for them.
   *
   * Progress only: preferences are not a record of what they did, and survive.
   */
  const reconciledRef = useRef(false);
  useEffect(() => {
    // Signed in means the server is the record. Signed out, this device is.
    const signedIn = (kidsPageData.publicUser?.id ?? null) != null;
    if (reconciledRef.current || namespace == null || !signedIn) {
      return;
    }
    reconciledRef.current = true;
    if (results.length > 0) {
      return;
    }
    const profileId = profileIdOfNamespace(namespace);
    if (Number(localStorage.getItem(BEST_KEY()) ?? 0) > 0) {
      clearProfileProgress(profileId);
      setBest(0);
    }
  }, [namespace, kidsPageData, results.length]);
  const [, forceTick] = useReducer((n: number) => n + 1, 0);
  // The age band is fixed for the visit; the page remounts on profile switch.
  const band = useMemo(currentBand, []);
  const cfg = bandConfig(band);

  const { accent } = useTheme();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  /**
   * Timestamps of the last few keystrokes, for the character's gait.
   *
   * A ref and not state: this changes on every key and nothing renders from
   * it — the only reader is the 3-D world, which is told directly.
   */
  const recentKeysRef = useRef<number[]>([]);
  /**
   * Whether this character has the waiting poses (wave, crouch, sit).
   *
   * Set the first time the world reports one. The old ten-second beckon says
   * the same thing far more crudely — it spins the character round and reads a
   * line — so where the chain exists it takes over, and where it does not (a
   * model without the clips) the beckon still covers the wait.
   */
  const restChainRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [nameOpen, setNameOpen] = useState(() => loadPrefs().name === "");
  const [mapOpen, setMapOpen] = useState(false);
  const [ceremony, setCeremony] = useState<{
    letter: string;
    presses: number;
  } | null>(null);
  const [chapter, setChapter] = useState(1);
  const [landName, setLandName] = useState("");
  const [stuckHelp, setStuckHelp] = useState(false);
  // A wrong key reddens the caret for a moment, the way the grown-up page
  // marks a slip — cleared by the next good key or by a short timer.
  const [missFlash, setMissFlash] = useState(false);
  // Classic borrows the grown-up page's focus behaviour: the lesson waits
  // behind an Enter, the chrome steps back while the fingers are moving,
  // and a long silence puts the line back to the start rather than
  // recording a speed nobody typed at.
  const [armed, setArmed] = useState(false);
  // The key actually pressed on a miss, flashed on the board for a moment so
  // a learner sees WHICH key they hit, not just that something was wrong.
  const [wrongKey, setWrongKey] = useState<string | null>(null);
  const wrongKeyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Consecutive misses on the same expected character raise the help: 1 a
  // nudge, 2 an urgent pulse, 3 the resting hands come back to show the
  // finger. A flat hint that never changes is one a stuck learner stops
  // seeing.
  const [helpLevel, setHelpLevel] = useState(0);
  const helpAtRef = useRef("");
  const helpMissesRef = useRef(0);
  // Said out loud when a long pause puts the line back to the start — a line
  // that simply vanishes reads as the app breaking.
  const [resetNotice, setResetNotice] = useState(false);
  // Raised once a day when the child has practised past the healthy ceiling.
  const [restOpen, setRestOpen] = useState(false);
  const resetNoticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const missFlashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // On-screen full-board modifier state — mirrors the real keyboard so Caps and
  // Shift flip the letters to capitals (lowercase by default) and Tab/Enter/
  // Backspace light up when pressed, just like the grown-up board.
  const [capsOn, setCapsOn] = useState(false);
  const [shiftOn, setShiftOn] = useState(false);
  const [specialKey, setSpecialKey] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(() => loadPrefs().name);
  // What to call the companion before the child names it. Each world has its
  // own, so the placeholder and the sound question agree with the card above
  // them.
  const companionName = prefs.world === "hero" ? "Robin" : "Rexy";
  // The album, and the creature currently coming out of its egg.
  const [album, setAlbum] = useState<Album>(loadAlbum);
  const [hatched, setHatched] = useState<Hatchling | null>(null);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [graduated, setGraduated] = useState(false);
  // Pre-selected yes, because the audio is the point: sounds off and never
  // mentioned is how the whole design stayed unheard.
  const [draftSounds, setDraftSounds] = useState(true);

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(loadBest);
  const [combo, setCombo] = useState(1);
  const [maxCombo, setMaxCombo] = useState(1);
  const [words, setWords] = useState(0);
  const [say, setSay] = useState(() =>
    fillSay(pickSay(saysOf(loadPrefs().world, loadPrefs().classic).start), {
      name:
        loadPrefs().name ||
        (loadPrefs().world === "hero" ? "Your hero" : "Your dino"),
    }),
  );
  const [growNonce, setGrowNonce] = useState(0);
  const [sessionSecs, setSessionSecs] = useState(prefs.timerMin * 60);
  const [sessionOver, setSessionOver] = useState(false);
  const [regenNonce, setRegenNonce] = useState(0);
  const [landNonce, setLandNonce] = useState(0);
  const [finishMsg, setFinishMsg] = useState(DINO_FINISH[0]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loaderRef = useRef<HTMLCanvasElement>(null);
  const sceneCardRef = useRef<HTMLDivElement>(null);
  const kbCardRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<KidsWorld | null>(null);
  const textInputRef = useRef<TextInput | null>(null);
  const passageRef = useRef("");
  // The subtitle strip: the card that clips, the strip that slides, and the
  // letter the slide is measured against.
  const wordsViewRef = useRef<HTMLDivElement | null>(null);
  const wordsTrackRef = useRef<HTMLSpanElement | null>(null);
  const wordsCurRef = useRef<HTMLSpanElement | null>(null);
  const lastStampRef = useRef(0);
  const lastKeyAtRef = useRef(0);
  const missStreakRef = useRef(0);
  const comboRunRef = useRef(0);
  const roundsRef = useRef(0);
  const streakRef = useRef(0);
  const stuckRef = useRef({ pos: -1, misses: 0 });
  const beckonedRef = useRef(false);
  // Per-profile n-gram weakness stats: kids get the same bottleneck drill as
  // grown-ups, accruing across sessions so awkward transitions get smoothed out.
  const ngramsRef = useRef(loadNgramStats());
  const prevLettersRef = useRef<ReadonlySet<number> | null>(null);
  const ceremonyRef = useRef(ceremony);
  ceremonyRef.current = ceremony;
  const [pressed, setPressed] = useState<string | null>(null);
  const pressedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /**
   * Adds a sticker to the album, silently if it was already there.
   *
   * Every milestone runs through here rather than tracking its own flag, so
   * "have they got this one" has exactly one answer and re-earning cannot
   * re-fire a ceremony.
   */
  const collect = (id: string) => {
    const next = earn(id);
    if (next != null) {
      setAlbum(next);
    }
  };

  const savePrefs = (patch: Partial<Prefs>) => {
    setPrefs((old) => {
      const next = { ...old, ...patch };
      try {
        localStorage.setItem(PREFS_KEY(), JSON.stringify(next));
      } catch {
        // Storage may be unavailable.
      }
      // The lesson settings live in a component above this one and cannot see
      // this state, but they decide whether Shift and punctuation are in play.
      try {
        window.dispatchEvent(new CustomEvent("keylearn:kids-prefs"));
      } catch {
        // Not a browser.
      }
      return next;
    });
  };

  /**
   * Close the naming card, keeping the sound answer if this was the first run.
   *
   * The card reopens from the toy-box for renaming, and that visit must not
   * silently re-answer a question it never asked.
   */
  const finishNaming = () => {
    const name = draftName.trim() || "Rexy";
    savePrefs(
      prefs.soundAsked
        ? { name }
        : { name, sounds: draftSounds, soundAsked: true },
    );
    setNameOpen(false);
    // This click is a user gesture, which is the only kind of moment a browser
    // will start audio in — and the greeting is the one line worth saying
    // before any typing has happened.
    if (draftSounds && cfg.readAloud) {
      unlockVoice();
      speakLine(
        fillSay(pickSay(saysOf(prefs.world, prefs.classic).start), { name }),
        cfg.speechRate,
      );
    }
  };

  // Past the day's healthy ceiling, stop encouraging and suggest a break.
  // Checked when the results change — that is, once a round is filed — rather
  // than on a timer, so it never interrupts a line mid-word.
  const restMinutes = minutesToday(results);
  useEffect(() => {
    if (restMinutes >= KIDS_REST_CEILING_MINUTES && !nudgedToday()) {
      markNudgedToday();
      setRestOpen(true);
    }
  }, [restMinutes]);

  // ── the adaptive engine: same stats, same unlock rules ─────────────────
  const { lessonKeys, included } = useMemo(() => {
    const map = new MutableKeyStatsMap(lesson.letters);
    for (const result of lesson.filter(results)) {
      map.append(result);
    }
    const keys = lesson.update(map);
    return { lessonKeys: keys, included: keys.findIncludedKeys().length };
  }, [lesson, results]);

  // Publish the kids day/night theme on <body> so the app header (outside this
  // page's tree) can reskin itself to match while a child is practising.
  useEffect(() => {
    document.body.dataset.kids = prefs.night ? "night" : "day";
    return () => {
      delete document.body.dataset.kids;
    };
  }, [prefs.night]);

  // The kids controls (sound, day/night, settings) live in the app header now.
  // Publish their state to it, and act on the header's toggle requests.
  useEffect(() => {
    window.dispatchEvent(
      new window.CustomEvent("keylearn:kids-state", {
        detail: {
          sounds: prefs.sounds,
          night: prefs.night,
          keys: included,
          // The same number the lane under the words shows, derived from the
          // results themselves. It used to come from a list of days kept in
          // local storage, which is a second answer to one question: a learner
          // whose history had gone was told "no streak" by the lane and "two
          // days" by the flame in the header, on the same screen.
          streak: dailyStreak(results, streakGraceDays()),
        },
      }),
    );
  }, [prefs.sounds, prefs.night, included, results]);
  // Each world has its own voice: the dino arcade blips, the hero storybook
  // chimes (and its bored idle babble).
  useEffect(() => {
    kidsAudio.setTheme(prefs.world === "hero" ? "hero" : "dino");
  }, [prefs.world]);
  // The night, heard: a far-off cricket now and then, only on the hero
  // world's real night and only with sound on. Quiet enough to be the night
  // being there rather than a soundtrack.
  useEffect(() => {
    if (prefs.world === "hero" && prefs.night && prefs.sounds) {
      kidsAudio.startCrickets();
      return () => kidsAudio.stopCrickets();
    }
    kidsAudio.stopCrickets();
    return undefined;
  }, [prefs.world, prefs.night, prefs.sounds]);
  // Live brightness/paleness/motion sliders — apply to the running scene now.
  useEffect(() => {
    worldRef.current?.setLook(prefs.brightness, prefs.paleness);
  }, [prefs.brightness, prefs.paleness]);
  // The game's own liveliness slider, and the learner's accessibility
  // settings on top of it. Those win: a slider inside the game is a matter of
  // taste, and "hold animations still" is not.
  //
  // This is the only place the motion preference can be honoured at all — the
  // world is drawn frame by frame on a canvas, where a stylesheet has no
  // reach, which is precisely where the movement a learner wants stopped is.
  useEffect(() => {
    const apply = () => {
      worldRef.current?.setMotion(motionStilled() ? 0 : prefs.motion);
      worldRef.current?.setCalm(loadA11y().calm || motionStilled());
    };
    apply();
    window.addEventListener(A11Y_CHANGED_EVENT, apply);
    return () => window.removeEventListener(A11Y_CHANGED_EVENT, apply);
  }, [prefs.motion]);

  // The letter tile on the trail wears the learner's colour. It is read from
  // the live custom property rather than the accent id, so a theme the
  // household mixed itself works with no extra case.
  useEffect(() => {
    const hex = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
    if (hex !== "") {
      worldRef.current?.setAccent(hex);
    }
  }, [accent, prefs.world]);
  // Reflect the real keyboard's Caps/Shift/Tab/Enter/Backspace on the on-screen
  // full board (a separate listener so it never touches the typing hot path).
  useEffect(() => {
    const SPECIAL: Record<string, string> = {
      Backspace: "back",
      Tab: "tab",
      Enter: "enter",
    };
    const sync = (ev: KeyboardEvent) => {
      setCapsOn(ev.getModifierState?.("CapsLock") ?? false);
      setShiftOn(ev.shiftKey);
    };
    const onDown = (ev: KeyboardEvent) => {
      sync(ev);
      const s = SPECIAL[ev.key];
      if (s != null) setSpecialKey(s);
    };
    const onUp = (ev: KeyboardEvent) => {
      sync(ev);
      const s = SPECIAL[ev.key];
      if (s != null) setSpecialKey((cur) => (cur === s ? null : cur));
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);
  useEffect(() => {
    const onToggle = (ev: Event) => {
      const what = (ev as CustomEvent<string>).detail;
      if (what === "sound") {
        savePrefs({ sounds: !prefsRef.current.sounds });
      } else if (what === "night") {
        const night = !prefsRef.current.night;
        savePrefs({ night });
        worldRef.current?.setNight(night);
      } else if (what === "settings") {
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keylearn:kids-toggle", onToggle);
    return () => window.removeEventListener("keylearn:kids-toggle", onToggle);
  }, []);

  // A new key joining the practice set is THE growth moment: the dino grows,
  // the letter introduces itself, and sometimes an egg hatches.
  const prevIncluded = useRef(-1);
  useEffect(() => {
    // Not during a sitting. Every branch below opens something over the page —
    // the letter's introduction, a hatching egg, the graduation window — and a
    // window over a thirty-second timed run costs the child the run.
    //
    // Skipped rather than queued, and nothing here is marked as collected: the
    // moment is not spent, so the graduation they have earned still arrives,
    // the next time they are practising and free to enjoy it.
    if (assessmentRef.current != null) {
      return;
    }
    const letters = new Set(
      lessonKeys.findIncludedKeys().map(({ letter }) => letter.codePoint),
    );
    if (prevIncluded.current !== -1 && included > prevIncluded.current) {
      worldRef.current?.setAge(dinoAgeOf(included, lesson.letters.length));
      worldRef.current?.grow();
      setGrowNonce((n) => n + 1);
      setScore((s) => saveBest(s + 10));
      if (prefsRef.current.sounds) {
        kidsAudio.playWin();
      }
      speak("grow");
      // Introduce the newcomer: the kid wakes it up with three slow presses.
      const prev = prevLettersRef.current;
      const fresh = [...letters].find((cp) => prev == null || !prev.has(cp));
      if (fresh != null) {
        const letter = String.fromCodePoint(fresh).toLowerCase();
        if (FINGER_OF[letter] != null) {
          setCeremony({ letter, presses: 0 });
        }
      }
      // Did the trail reach an egg? The creature arrives here, in the scene
      // the child is looking at — the old line told them to go and find it in
      // a settings menu, which is not a reward, it is an errand.
      const world = prefsRef.current.world;
      for (const hatchling of HATCHLINGS[world]) {
        const { id, label, at } = hatchling;
        if (prevIncluded.current < at && included >= at) {
          speak("hatch", { dino: label });
          if (prefsRef.current.sounds) {
            kidsAudio.playSuccess();
          }
          worldRef.current?.burstAtPlayer(
            [0xffd94a, 0xfff3c4, 0x8ecb64],
            40,
            1,
          );
          collect(id);
          setHatched(hatchling);
        }
      }
      // Letter-count milestones, kept for good.
      for (const n of [10, 20]) {
        if (prevIncluded.current < n && included >= n) {
          collect(`keys-${n}`);
        }
      }
    }
    // The last letter. Everything on this page has been building to it and
    // nothing marked it — the trail simply had no more moves in it, and a child
    // who finished the alphabet was never told that a grown-up page existed,
    // let alone shown the door to it.
    //
    // Outside the "did it just go up" branch on purpose: a child can arrive
    // here already knowing every letter, having earned them on the grown-up
    // page, and that child has graduated too.
    if (
      included > 0 &&
      included >= lesson.letters.length &&
      !("alphabet" in loadAlbum())
    ) {
      collect("alphabet");
      worldRef.current?.celebrate();
      worldRef.current?.burstAtPlayer(
        [0xffd94a, 0x8ecb64, 0xff8fa3, 0x8ecfff],
        90,
        1.4,
      );
      if (prefsRef.current.sounds) {
        kidsAudio.playWin();
      }
      speak("graduate");
      setGraduated(true);
    }
    prevIncluded.current = included;
    prevLettersRef.current = letters;
  }, [included, lessonKeys]);

  // The first arrival on Classic, and only the first. Anything already open —
  // the settings panel, a ceremony — takes precedence; the walk-through waits
  // rather than stacking on top of it.
  useEffect(() => {
    if (!(prefs.classic && classicOffered(band)) || tourOpen) {
      return;
    }
    let seen = "1";
    try {
      seen = localStorage.getItem(CLASSIC_TOUR_KEY()) ?? "";
    } catch {
      seen = "1"; // Storage denied: never nag.
    }
    if (seen === "") {
      setTourOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.classic, band]);

  const dinoName = () =>
    prefsRef.current.name ||
    (prefsRef.current.world === "hero" ? "Your hero" : "Your dino");
  // The runner's current growth (0 → 1), kept fresh for the say-lines.
  const dinoAgeRef = useRef(0);
  dinoAgeRef.current = dinoAgeOf(included, lesson.letters.length);

  const speak = (key: keyof typeof SAYS, vars: Record<string, string> = {}) => {
    const age = dinoAgeRef.current;
    const world = prefsRef.current.world;
    let pool = agedPool(saysOf(world, prefsRef.current.classic), key, age);
    // The after-dark lines describe the Hero Trail's night scene, which
    // Classic does not draw.
    if (
      !prefsRef.current.classic &&
      world === "hero" &&
      prefsRef.current.night
    ) {
      const extra = [
        ...(HERO_NIGHT_SAYS[key] ?? []),
        ...(resolveNightStyle(band, prefsRef.current.nightStyle) !== "quiet"
          ? (HERO_NIGHT_TRAVELLER_SAYS[key] ?? [])
          : []),
      ];
      if (extra.length > 0) {
        // Half night lines, half the usual pool, so the dark changes the
        // voice without replacing it.
        pool = [...pool, ...extra, ...extra];
      }
    }
    // The drier lines sit alongside the plain ones rather than replacing
    // them, so anything a learner actually needs to be told is still said
    // straight by whichever line comes up next.
    if (prefsRef.current.playful && playfulOffered(band)) {
      const extra = PLAYFUL_SAYS[key] ?? [];
      if (extra.length > 0) {
        pool = [...pool, ...extra];
      }
    }
    const line = fillSay(pickSay(pool), {
      name: dinoName(),
      stage: (world === "hero" ? heroStage : dinoStage)(age),
      ...vars,
    });
    setSay(line);
    // And read it out, for the bands who cannot read it themselves. Only the
    // moments — see `voice.ts` for why the cheers are excluded.
    //
    // Queued rather than spoken, and only released once the fingers have been
    // still for a moment. Most of these lines fire BECAUSE of a keystroke —
    // a new key unlocked, a streak, a chapter crossed — so speaking on the
    // spot means talking over the very typing that earned them, and the
    // stop-on-keypress rule above would cut the sentence off a syllable in.
    //
    // Dropping them instead of queueing was the other option and it is worse:
    // those lines fire at most a keystroke after the last one, so they would
    // never be spoken at all, which quietly turns the voice off for the
    // learners who need it.
    if (
      prefsRef.current.readAloud &&
      prefsRef.current.sounds &&
      isSpoken(key)
    ) {
      pendingSpeechRef.current = { line, at: performance.now() };
    }
  };

  /**
   * A line waiting for a gap in the typing, and the gap it is waiting for.
   *
   * Checked often enough that the pause does not feel like a delay, and
   * abandoned if it goes stale — a sentence about a moment thirty seconds gone
   * is worse than silence.
   */
  const pendingSpeechRef = useRef<{ line: string; at: number } | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const pending = pendingSpeechRef.current;
      if (pending == null) {
        return;
      }
      const now = performance.now();
      if (now - pending.at > SPEECH_STALE_MS) {
        pendingSpeechRef.current = null;
        return;
      }
      if (now - lastKeyAtRef.current < SPEECH_QUIET_MS) {
        return;
      }
      pendingSpeechRef.current = null;
      speakLine(pending.line, cfg.speechRate);
    }, 200);
    return () => clearInterval(id);
  }, [cfg.speechRate]);

  // A fresh passage whenever the lesson or the stats move on. Kids runs are
  // short — the starting length, the ceiling and the preferred word size all
  // come from the age band, growing by a word for every few unlocked keys.
  // Older kids graduate to the full grown-up passage sooner.
  useEffect(() => {
    // Bottleneck drill: steer the next passage toward the child's slowest key
    // transition, exactly as grown-up mode does.
    if (settings.get(lessonProps.guided.bottleneckDrill)) {
      const included = lessonKeys.findIncludedKeys();
      const among = new Set(included.map(({ letter }) => letter.codePoint));
      const worst = ngramsRef.current.worst(among);
      if (worst != null) {
        const target = included.find(
          ({ letter }) => letter.codePoint === worst.to,
        );
        if (target != null) {
          lessonKeys.focus(target.letter);
        }
      }
    }
    let flat = flattenStyledText(lesson.generate(lessonKeys, Lesson.rng));
    if (prefs.classic) {
      // Classic sits between the two pages. The grown-up passage is a long
      // sitting for an eleven-year-old and the trail's handful of words is
      // too short to find a rhythm in, so it runs at seven tenths of the
      // grown-up length — the band's word caps do not apply here.
      const ws = flat.split(" ");
      flat = ws.slice(0, Math.max(1, Math.round(ws.length * 0.7))).join(" ");
    } else if (
      included < lesson.letters.length &&
      included < cfg.fullPassageAt
    ) {
      const wordCount = Math.min(
        cfg.capWords,
        cfg.baseWords + Math.floor(Math.max(0, included - 6) / 5),
      );
      let ws = flat.split(" ");
      if (Number.isFinite(cfg.maxWordLen)) {
        const short = ws.filter((w) => w.length <= cfg.maxWordLen);
        // Prefer short words for little hands; if the generator produced too
        // few, take the shortest of what it gave us instead.
        ws =
          short.length >= wordCount
            ? short
            : [...ws].sort((a, b) => a.length - b.length);
      }
      flat = ws.slice(0, wordCount).join(" ");
    }
    passageRef.current = flat;
    textInputRef.current = new TextInput(flat, toTextInputSettings(settings));
    lastStampRef.current = 0;
    missStreakRef.current = 0;
    worldRef.current?.startRun();
    forceTick();
  }, [lesson, lessonKeys, included, settings, regenNonce, prefs.classic]);

  // A run here is thirty or forty-five seconds, and the words are long enough
  // that a small child can spend the whole of one without reaching the end of
  // the passage. Whatever they did type counts.
  useAssessmentPartial(() => {
    const textInput = textInputRef.current;
    if (textInput == null || textInput.steps.length === 0) {
      return null;
    }
    const result = Result.fromStats(
      settings.get(keyboardProps.layout),
      settings.get(lessonProps.type).textType,
      Date.now(),
      makeStats(textInput.steps),
    );
    return result.validate()
      ? {
          // Storage counts characters a minute; a word is five of them.
          speed: result.speed / 5,
          accuracy: result.accuracy,
          time: result.time,
        }
      : null;
  });
  // A fresh passage for each run, so none is ever counted by two of them.
  useAssessmentReset(() => {
    setRegenNonce((n) => n + 1);
  });

  const saveBest = (s: number) => {
    setBest((b) => {
      if (s > b) {
        try {
          localStorage.setItem(BEST_KEY(), String(s));
        } catch {
          // Storage may be unavailable.
        }
        return s;
      }
      return b;
    });
    return s;
  };

  // ── the 3D world (rebuilt with a fresh land every three rounds) ────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }
    // Same engine, different theme: the toggle picks the dino world or the
    // hero world, each with its own cast, companions and biomes.
    const theme = prefsRef.current.world === "hero" ? HERO_THEME : DINO_THEME;
    const chosen =
      prefsRef.current.world === "hero"
        ? prefsRef.current.hero
        : prefsRef.current.dino;
    // Before the world, deliberately. Both want the same character file, and
    // three de-duplicates requests already in flight — but the world queues
    // a dozen models of its own, and whichever is asked for first is the one
    // the browser fetches first. Created after it, the loading screen stood
    // empty until every tree and companion had been fetched, which is most of
    // the wait it exists to fill.
    const loader =
      loaderRef.current != null
        ? createLoaderScene(loaderRef.current, theme, chosen)
        : null;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const world = createKidsWorld(canvas, pickLand(theme.lands), theme, {
      nightStyle: resolveNightStyle(band, prefsRef.current.nightStyle),
      tier: deviceTier({
        memoryGb: nav.deviceMemory,
        cores: navigator.hardwareConcurrency,
        dpr: window.devicePixelRatio,
      }),
      // The character's waiting poses get a voice. `speak` already picks by
      // age band and by world, so the wave a six-year-old hears is not the one
      // a ten-year-old does, and the accessibility "predictable" setting still
      // pins the choice to the first line.
      onRest: (stage) => {
        restChainRef.current = true;
        speak(stage);
        // The crouch lands where the old beckon used to, so it inherits its
        // sound — a cue that matters most to anyone not watching the screen.
        if (stage === "crouch" && prefsRef.current.sounds) {
          kidsAudio.playIdle();
        }
      },
    });
    worldRef.current = world;
    // A fresh world may be a character without the waiting clips.
    restChainRef.current = false;
    setLandName(world.land.name);
    // Walking into a land is what earns it, including the one the session
    // opens in — otherwise the very first land is the one land nobody gets.
    collect(`land:${world.land.name}`);
    world.startRun();
    let cancelled = false;
    world.ready
      .then(() => {
        if (cancelled) {
          // Unmounted (or rebuilt for a new theme/style) while the world was
          // still loading. world.dispose() already ran; calling these now
          // would recreate resources — e.g. setWord/setAccent allocating new
          // letter textures — that dispose() will never get a chance to free.
          return;
        }
        if (prefsRef.current.night) {
          world.setNight(true);
        }
        world.setLook(prefsRef.current.brightness, prefsRef.current.paleness);
        world.setMotion(motionStilled() ? 0 : prefsRef.current.motion);
        world.setCalm(loadA11y().calm || motionStilled());
        // The world is built asynchronously, so the accent effect below has
        // usually already run and found no world to talk to. Apply it here as
        // well, or a fresh scene starts on the built-in colour.
        {
          const hex = getComputedStyle(document.documentElement)
            .getPropertyValue("--accent")
            .trim();
          if (hex !== "") {
            world.setAccent(hex);
          }
        }
        // Push the passage straight away so the 3-D letters appear on a fresh
        // world (e.g. after switching games) without needing a refresh.
        if (currentBand() === "5-6") {
          world.setWord(passageRef.current, textInputRef.current?.pos ?? 0);
        }
        // The runner carries its age (baby → adult, size and all) across
        // rebuilds and character swaps.
        world.setAge(dinoAgeOf(included, lesson.letters.length));
        // The friend loads after the player, deliberately: the character a
        // child is actually controlling should never wait behind one they are
        // only watching.
        const friend = prefsRef.current.companion;
        if (chosen !== theme.defaultPlayer) {
          return world.setPlayer(chosen).then(() => {
            if (friend != null && prefsRef.current.world === "hero") {
              return world.setCompanion(friend);
            }
            return;
          });
        }
        if (friend != null && prefsRef.current.world === "hero") {
          return world.setCompanion(friend);
        }
        return;
      })
      .finally(() => {
        loader?.dispose();
        if (!cancelled) {
          setLoaded(true);
        }
      });
    const observer = new ResizeObserver(() => world.resize());
    observer.observe(canvas);
    return () => {
      cancelled = true;
      observer.disconnect();
      loader?.dispose();
      world.dispose();
      worldRef.current = null;
    };
    // The style override rebuilds the world: the plan decides what was
    // planted, which is not a thing that can be re-lit in place.
    // `classic` matters here even though the world does not use it: while
    // Classic is on there is no canvas to draw into, so this effect bails out
    // early. Coming back to the trail must rebuild the world, or the learner
    // lands on an empty scene that never loads.
  }, [landNonce, prefs.world, prefs.nightStyle, band, prefs.classic]);

  // The world pane never grows more than 50% taller than the helper card.
  useEffect(() => {
    const scene = sceneCardRef.current;
    const kb = kbCardRef.current;
    if (scene == null) {
      return;
    }
    const cap = () => {
      if (kb != null && prefsRef.current.kbMode !== "off") {
        scene.style.maxHeight = `${Math.round(kb.offsetHeight * 1.5)}px`;
      } else {
        scene.style.maxHeight = "";
      }
    };
    cap();
    const observer = new ResizeObserver(cap);
    observer.observe(document.documentElement);
    if (kb != null) {
      observer.observe(kb);
    }
    return () => observer.disconnect();
    // Re-measured on the way back from Classic too: while it was on there was
    // no scene card to size, so the cap never ran and the trail returned with
    // a 3-D pane taller than the screen.
  }, [prefs.kbMode, prefs.hands, prefs.classic]);

  // Refs mirror the bits of state the one-time key listener needs.
  const assessmentOffered = useAssessment();
  // Control centre, kids.certificates: off hides the test and its certificate.
  const kidsCertificatesOn = usePageData().certificates?.kids !== false;
  const assessment = kidsCertificatesOn ? assessmentOffered : null;
  // Read through a ref inside the global keydown handler, which is installed
  // once: closing over the session directly would freeze it at whatever it was
  // when the game mounted.
  const assessmentRef = useRef(assessment);
  assessmentRef.current = assessment;

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  // Which screen this session is on. Needed here because the input gate below
  // asks whether there is a 3-D world to wait for, and Classic has none.
  const classic = prefs.classic && classicOffered(band);
  const blockedRef = useRef(false);
  blockedRef.current =
    settingsOpen ||
    finishOpen ||
    sessionOver ||
    nameOpen ||
    mapOpen ||
    albumOpen ||
    graduated ||
    restOpen ||
    tourOpen ||
    hatched != null ||
    ceremony != null ||
    // Keys pressed at the loading screen are not practice. They used to land
    // on a run that had not started: the letters counted, the mistakes
    // counted, and the trail they were scored against was still being built.
    // Classic never sets this — it has no world to wait for — so it is
    // excluded rather than left permanently blocked.
    (!classic && !loaded);

  useEffect(() => {
    // Back to the top of the same line, and back behind the Enter gate. Told
    // out loud when it was a pause that caused it, so nobody thinks the words
    // disappeared on their own.
    const restartLine = (announce: boolean) => {
      textInputRef.current = new TextInput(
        passageRef.current,
        toTextInputSettings(settings),
      );
      lastStampRef.current = 0;
      missStreakRef.current = 0;
      helpAtRef.current = "";
      helpMissesRef.current = 0;
      setHelpLevel(0);
      setArmed(false);
      setTyping(false);
      clearTimeout(idleTimer.current);
      if (announce) {
        setResetNotice(true);
        clearTimeout(resetNoticeTimer.current);
        resetNoticeTimer.current = setTimeout(
          () => setResetNotice(false),
          5000,
        );
      }
      forceTick();
    };
    restartLineRef.current = restartLine;

    const onKeyDown = (ev: KeyboardEvent) => {
      // Enter, Backspace and Tab are named keys, so a plain "one character
      // only" test throws them away before anything downstream can act on
      // them — which is why the board's own Backspace typed a "b" and why
      // Classic's Enter gate could never open.
      const named =
        ev.key === "Enter" || ev.key === "Backspace" || ev.key === "Tab";
      if (ev.key.length !== 1 && !named) {
        return;
      }
      // Ctrl/Cmd/Alt combinations belong to the browser — except the
      // delete-a-word chord, which is the board's own.
      if ((ev.ctrlKey || ev.metaKey || ev.altKey) && ev.key !== "Backspace") {
        return;
      }
      // The new-letter ceremony listens only for its own letter.
      const cer = ceremonyRef.current;
      if (cer != null) {
        ev.preventDefault();
        if (ev.key.toLowerCase() === cer.letter) {
          kidsAudio.init();
          worldRef.current?.burstAtPlayer([0x37c871, 0xffd66b], 6, 0.2);
          if (prefsRef.current.sounds) {
            kidsAudio.playPoint();
          }
          // Three presses teaches a six-year-old where the key is. At the age
          // Classic is for, it is a chore standing between them and the thing
          // they just earned.
          if (cer.presses + 1 >= (prefsRef.current.classic ? 1 : 3)) {
            setCeremony(null);
            worldRef.current?.hop();
            if (prefsRef.current.sounds) {
              kidsAudio.playWin();
            }
            speak("wake", { letter: cer.letter.toUpperCase() });
          } else {
            setCeremony({ ...cer, presses: cer.presses + 1 });
          }
        }
        return;
      }
      if (blockedRef.current) {
        return;
      }
      beckonedRef.current = false;
      const textInput = textInputRef.current;
      if (textInput == null || textInput.completed) {
        return;
      }
      // Classic waits behind an Enter, like the grown-up page: a stray key
      // pressed while somebody is reading the screen should not start the
      // clock, and should certainly not be recorded as a mistake.
      if (classicRef.current && !armedRef.current) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          setArmed(true);
        }
        return;
      }
      kidsAudio.init(); // browsers unlock audio on first input
      unlockVoice(); // and speech, which is gated the same way
      // Typing wins over talking. A coach line still playing over the child's
      // own keys is noise: they cannot hear their rhythm and the sentence is
      // about a moment that has already passed.
      stopSpeaking();
      const now = performance.now();
      if (now - lastKeyAtRef.current < 25) {
        return; // synthetic double-dispatch guard
      }
      lastKeyAtRef.current = now;
      ev.preventDefault();
      if (classicRef.current) {
        // The chrome steps back while the fingers move, and comes back a beat
        // after they stop.
        setTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 1200);
        // Fifteen seconds of silence puts the line back to the start. A
        // lesson clock that kept running while somebody answered the door
        // would otherwise record a speed they never typed at.
        clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => {
          restartLine(true);
        }, 15_000);
      }
      // The keys that are not letters, behaving the way the grown-up board
      // behaves. Without this they arrive as whatever their name starts
      // with — `ev.key` for Backspace is the word "Backspace", so lowercasing
      // it and taking the first code point types a "b", and Tab types a "t".
      if (ev.key === "Backspace") {
        // Whole word with a modifier held, one letter without: the same pair
        // the grown-up page offers.
        if (ev.ctrlKey || ev.metaKey || ev.altKey) {
          textInput.clearWord();
        } else {
          textInput.clearChar();
        }
        forceTick();
        return;
      }
      if (ev.key === "Tab") {
        textInput.appendIndent(ev.timeStamp, 0);
        forceTick();
        return;
      }
      // Shift, Caps Lock, arrows, function keys: the board lights them (see
      // the modifier listener above) but there is nothing to type.
      if (ev.key.length > 1 && ev.key !== "Enter") {
        return;
      }
      // Capitals only reach the engine once the lesson actually contains
      // them. Until then a child who left Caps Lock on would fail every key
      // on the trail through no fault of their own.
      const key =
        ev.key === "Enter"
          ? "\n"
          : prefsRef.current.grownupKeys === "off"
            ? ev.key.toLowerCase()
            : ev.key;
      setPressed(key.toLowerCase());
      clearTimeout(pressedTimer.current);
      pressedTimer.current = setTimeout(() => setPressed(null), 110);

      const { sounds, cheers } = prefsRef.current;
      if (key === " ") {
        worldRef.current?.jump(); // space always jumps, right or wrong
        // The jump is the trail's own sound effect. On Classic the space bar
        // is just another key and should sound like one — the real key click
        // is played below with every other press.
        if (sounds && !prefsRef.current.classic) {
          kidsAudio.playJump();
        }
      }
      const timeStamp = ev.timeStamp;
      const timeToType =
        lastStampRef.current > 0 ? timeStamp - lastStampRef.current : 0;
      lastStampRef.current = timeStamp;
      // The character's gait follows the last few keystrokes, and is pushed
      // from here rather than derived from the WPM shown on the chip. That
      // figure averages the whole passage, so it can only crawl downwards: a
      // learner who sprinted through one line and then slowed to hunt for
      // keys kept sprinting on screen for the rest of the round. A short
      // window falls as fast as the fingers do, and a pause widens it on its
      // own — the gap counts as elapsed time the moment the next key lands.
      // Any key at all wakes him — a wrong one included. It does not advance
      // the trail, so without this he would still be sitting down while
      // somebody is very much there and typing.
      worldRef.current?.wake();
      {
        const recent = recentKeysRef.current;
        recent.push(timeStamp);
        if (recent.length > GAIT_SAMPLE) {
          recent.shift();
        }
        if (recent.length >= 2) {
          const span = recent[recent.length - 1]! - recent[0]!;
          if (span > 0) {
            worldRef.current?.setPace(
              (((recent.length - 1) / (span / 1000)) * 60) / 5,
            );
          }
        }
      }
      const feedback = textInput.appendChar(
        timeStamp,
        key.codePointAt(0)!,
        timeToType,
      );
      // One real key sound per press on Classic, right where the engine
      // decides whether the press landed — the trail's own blips below are
      // skipped so the two never double up.
      if (prefsRef.current.classic && sounds) {
        classicKeySoundRef.current(feedback);
      }
      const passage = passageRef.current;
      const pos = textInput.pos;
      if (feedback === Feedback.Succeeded || feedback === Feedback.Recovered) {
        missStreakRef.current = 0;
        stuckRef.current = { pos: -1, misses: 0 };
        setStuckHelp(false);
        worldRef.current?.setProgress(pos / Math.max(1, passage.length));
        worldRef.current?.burstAtPlayer([0xd9c9a3, 0xcbb98f], 4, 0.1);
        // A key that lands clears the ladder — help should vanish the moment
        // it is no longer needed.
        if (helpMissesRef.current > 0) {
          helpAtRef.current = "";
          helpMissesRef.current = 0;
          setHelpLevel(0);
        }
        streakRef.current += 1;
        if (streakRef.current % cfg.hopEvery === 0) {
          worldRef.current?.hop();
          speak("streak");
          collect("streak-10");
        }
        comboRunRef.current += 1;
        if (comboRunRef.current >= 5) {
          comboRunRef.current = 0;
          setCombo((c) => {
            const next = Math.min(c + 1, 9);
            setMaxCombo((m) => Math.max(m, next));
            return next;
          });
        }
        // One point per right key, space included, and nothing else. The word
        // bonus used to add five more on the space itself, which made space
        // the most valuable key on the board — a child could watch the score
        // leap on every gap and learn that the gaps are where the points are.
        // Finishing a word still counts and still chimes; it just is not paid.
        setScore((s) => saveBest(s + 1));
        if (sounds && key !== " " && !prefsRef.current.classic) {
          kidsAudio.playMove();
        }
        if (pos > 0 && passage[pos - 1] === " ") {
          setWords((w) => w + 1);
          // Another of the trail's game chimes: Classic keeps to the sound a
          // keyboard makes, and its own key click has already played.
          if (sounds && !prefsRef.current.classic) {
            kidsAudio.playPoint();
          }
        }
        if (cheers && Math.random() < cfg.cheerChance) {
          setSay(
            fillSay(
              pickSay(
                cheerPool(
                  saysOf(prefsRef.current.world, prefsRef.current.classic),
                  band,
                ),
              ),
              {
                name: dinoName(),
              },
            ),
          );
        }
        if (textInput.completed) {
          // Reaching the camp flag is the one moment the run is won; the world
          // decides what that looks like for a dino and for a hero.
          worldRef.current?.celebrate();
          setScore((s) => saveBest(s + 10));
          setWords((w) => w + 1);
          speak("camp");
          // Reaching a flag is what counts as having practised, not running
          // the timer to zero — most children close the tab long before it
          // gets there, and none of them should lose the day for it.
          collect("first-run");
          if (practiceDays() >= 7) {
            collect("week");
          }
          if (sounds) {
            kidsAudio.playPoint();
          }
          // Learn this run's key transitions so the bottleneck drill improves.
          ngramsRef.current.append(textInput.steps);
          saveNgramStats(ngramsRef.current);
          const result = Result.fromStats(
            settings.get(keyboardProps.layout),
            settings.get(lessonProps.type).textType,
            Date.now(),
            makeStats(textInput.steps),
          );
          if (result.validate()) {
            if (assessmentRef.current != null) {
              // A sitting is measured, not recorded: assessment runs stay out
              // of the practice history, because the retention rule judges the
              // assessment against the pace this learner practises at.
              assessmentRef.current.report({
                // Storage counts characters a minute; a word is five of them.
                speed: result.speed / 5,
                accuracy: result.accuracy,
                time: result.time,
              });
            } else {
              // The same record the grown-up mode saves — the algorithm learns
              // from every kids run too.
              appendResults([result]);
            }
          } else {
            setRegenNonce((n) => n + 1);
          }
          // Every third camp, the trail map opens and the herd crosses into
          // a brand-new land — but never mid-sitting, where it would cover the
          // words with the clock still running.
          roundsRef.current += 1;
          if (roundsRef.current % 3 === 0 && assessmentRef.current == null) {
            setTimeout(() => setMapOpen(true), 900);
          }
        }
      } else {
        setMissFlash(true);
        clearTimeout(missFlashTimer.current);
        missFlashTimer.current = setTimeout(() => setMissFlash(false), 420);
        // Show the key that was actually pressed, briefly. Knowing you hit D
        // instead of F is the correction; knowing only that you were wrong
        // is not.
        setWrongKey(key);
        clearTimeout(wrongKeyTimer.current);
        wrongKeyTimer.current = setTimeout(() => setWrongKey(null), 450);
        // Same character missed again? Raise the help a step.
        const stuckOn = passageRef.current[textInput.pos] ?? "";
        if (stuckOn === helpAtRef.current) {
          helpMissesRef.current += 1;
        } else {
          helpAtRef.current = stuckOn;
          helpMissesRef.current = 1;
        }
        setHelpLevel(Math.min(3, helpMissesRef.current));
        missStreakRef.current += 1;
        streakRef.current = 0;
        comboRunRef.current = 0;
        setCombo(1);
        // A wrong key takes one point back — but the score never goes below
        // zero, the best is never touched, and the youngest walkers are
        // forgiven entirely.
        if (cfg.missPenalty) {
          setScore((v) => Math.max(0, v - 1));
        }
        worldRef.current?.stumble();
        // The same key missed three times gets louder, friendlier help.
        if (stuckRef.current.pos === pos) {
          stuckRef.current.misses += 1;
        } else {
          stuckRef.current = { pos, misses: 1 };
        }
        const expected = passage[pos];
        if (stuckRef.current.misses >= cfg.rescueMisses && expected != null) {
          setStuckHelp(true);
          const finger = FINGER_OF[expected];
          if (expected === " ") {
            speak("stuckSpace");
          } else {
            speak("stuck", {
              letter: expected.toUpperCase(),
              finger: finger != null ? FINGER_NAMES[finger] : "finger",
            });
          }
        }
        if (missStreakRef.current >= 3) {
          missStreakRef.current = 0;
          worldRef.current?.roar();
          if (sounds && !prefsRef.current.classic) {
            kidsAudio.playRoar();
          }
          if (cheers && stuckRef.current.misses < cfg.rescueMisses) {
            speak("roar");
          }
        } else {
          // Classic's own miss sound comes from the key player above.
          if (sounds && !prefsRef.current.classic) {
            kidsAudio.playDrop();
          }
          if (cheers && stuckRef.current.misses < cfg.rescueMisses) {
            speak("miss");
          }
        }
      }
      forceTick();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(pressedTimer.current);
    };
  }, [settings, appendResults]);

  // ── the session timer ─────────────────────────────────────────────────
  //
  // Counts time spent PLAYING, not time spent with the tab open. It used to
  // run on the wall clock, so a page left open on a table burned a child's
  // whole session without a key being pressed — and the "practised N min"
  // figure shown to a parent, along with the words-per-minute derived from it,
  // was measuring how long the browser had been idle.
  //
  // This matches the grown-up page, where a lesson's time runs from the first
  // keystroke to the last and the gaps between lessons cost nothing.
  const [timerIdle, setTimerIdle] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      // A sitting has its own clock across the top. The play timer would end
      // the game underneath it, mid-run, for reasons nobody could see.
      if (blockedRef.current || assessmentRef.current != null) {
        return;
      }
      // Nothing typed yet this session, or nothing for a while: the clock
      // holds. `lastKeyAtRef` is 0 until the very first key, which is exactly
      // the "opened it and walked away" case.
      const last = lastKeyAtRef.current;
      const idle = last === 0 || performance.now() - last > IDLE_MS;
      setTimerIdle(idle);
      if (idle) {
        return;
      }
      setSessionSecs((secs) => {
        if (secs <= 1) {
          setSessionOver(true);
          setFinishMsg(pickSay(finishPool(prefsRef.current.world)));
          speak("timerEnd");
          if (prefsRef.current.sounds) {
            kidsAudio.playSuccess();
          }
          setTimeout(() => setFinishOpen(true), 1200);
          return 0;
        }
        return secs - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // A patient dino: after ten quiet seconds it turns around and beckons.
  useEffect(() => {
    const id = setInterval(() => {
      if (blockedRef.current || !loaded || beckonedRef.current) {
        return;
      }
      // The waiting chain has this covered, and better.
      if (restChainRef.current) {
        return;
      }
      const last = lastKeyAtRef.current;
      if (performance.now() - (last || 0) > IDLE_MS) {
        beckonedRef.current = true;
        worldRef.current?.beckon();
        speak("idle");
        if (prefsRef.current.sounds) {
          kidsAudio.playIdle();
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [loaded]);

  const crossIntoNextLand = () => {
    setMapOpen(false);
    const land = peekNextLandName();
    speak("crossed", { chapter: String(chapter + 1), land });
    collect(`land:${land}`);
    setChapter((c) => c + 1);
    setLoaded(false);
    setLandNonce((n) => n + 1);
  };

  const playAgain = () => {
    setFinishOpen(false);
    setSessionOver(false);
    setSessionSecs(prefs.timerMin * 60);
    // Or the new session would run for up to IDLE_MS on the strength of a key
    // pressed in the old one.
    lastKeyAtRef.current = 0;
    setTimerIdle(true);
    setScore(0);
    setWords(0);
    setCombo(1);
    setMaxCombo(1);
    comboRunRef.current = 0;
    setRegenNonce((n) => n + 1);
  };

  // ── render ─────────────────────────────────────────────────────────────
  const textInput = textInputRef.current;
  const passage = passageRef.current;
  const pos = textInput?.pos ?? 0;
  const nextChar = passage[pos] ?? null;
  const nextFinger = nextChar != null ? FINGER_OF[nextChar] : undefined;
  // The very youngest always read the word as 3-D blocks in the world instead
  // of the subtitle panel; 7-8 and 9-10 can opt in from the toy-box; everyone
  // else keeps the panel.
  const use3dWord =
    band === "5-6" || ((band === "7-8" || band === "9-10") && prefs.wordBlocks);
  useEffect(() => {
    // Feed the whole passage; the world lays it out as one gliding ribbon so
    // there is no jumpy per-word rebuild.
    worldRef.current?.setWord(use3dWord ? passage : "", pos);
  }, [use3dWord, passage, pos, loaded, landNonce]);
  // The whole passage is rendered and the strip is slid under the card, rather
  // than re-slicing a character window each keystroke.
  //
  // The window came first and had to go: it shifted by one character per key,
  // so the text jumped left at the same moment the transform below moved it
  // right to compensate. The two cancel in the final position and not in the
  // animation, which reads as a shudder on every keystroke. A passage is 9-16
  // words for the kid bands and a few hundred characters at most in classic,
  // so there is nothing to save by slicing it.
  const passageChars = [...passage];
  // Keep the letter being typed at a fixed spot near the left of the card, so
  // what is coming stays visible. Layout effect, not effect: this runs before
  // paint, so the strip is never shown at the previous keystroke's offset.
  useLayoutEffect(() => {
    const view = wordsViewRef.current;
    const track = wordsTrackRef.current;
    if (view == null || track == null) {
      return;
    }
    const vw = view.clientWidth;
    const tw = track.scrollWidth;
    // Short enough to fit: leave it alone and let the card shrink around it,
    // which is the look every passage under about eight words gets.
    if (tw <= vw) {
      track.style.transform = "translateX(0px)";
      return;
    }
    const cur = wordsCurRef.current;
    if (cur == null) {
      return;
    }
    const centre = cur.offsetLeft + cur.offsetWidth / 2;
    // Clamped at both ends so the strip never pulls away from the card edge
    // and leaves a gap — at the start it sits flush left, at the end flush
    // right, and only in between does the letter hold the anchor line.
    const x = Math.min(0, Math.max(vw - tw, vw * 0.38 - centre));
    track.style.transform = `translateX(${x}px)`;
  }, [pos, passage, prefs.bigLetters, use3dWord, loaded]);

  const sessionTotal = prefs.timerMin * 60;
  // During a sitting the plan decides, not the saved preference — and for the
  // youngest band the plan leaves the board on, because their certificate is
  // about finishing the trail rather than about technique.
  const hideHints = assessment?.plan.hideKeyboard === true;
  const kbVisible = !hideHints && prefs.kbMode !== "off";
  // ── Classic: the same lesson, wearing the grown-up page's anatomy ──────
  //
  // Classic always draws the whole board — it is the screen's centrepiece,
  // not a hint that fades — and never the helper hands: the finger colours
  // and the home bumps do that work, and a child who chose this face has
  // asked for the grown-up shape.
  // Never for the youngest bands, whatever is in storage — a profile that
  // was switched at eleven and handed down to a younger sibling would
  // otherwise open on a screen built for somebody else. Declared further up,
  // beside blockedRef, which needs it before this point.
  // Classic types on a picture of a real board, so it should sound like one
  // — but like the boards these learners have actually used. The mechanical
  // samples are a nostalgia most eleven-year-olds do not share; the soft
  // modern click of a laptop is the sound they know a key to make.
  const classicKeySound = useMemo(
    () =>
      makeSoundPlayer(
        settings
          .set(soundProps.playSounds, PlaySounds.All)
          .set(soundProps.soundTheme, SoundTheme.DEFAULT)
          .set(soundProps.soundVolume, 0.5),
      ),
    [settings],
  );
  const classicRef = useRef(classic);
  classicRef.current = classic;
  const armedRef = useRef(armed);
  armedRef.current = armed;
  // Set by the keydown effect, which owns the lesson's TextInput.
  const restartLineRef = useRef<((announce: boolean) => void) | null>(null);
  const classicKeySoundRef = useRef(classicKeySound);
  classicKeySoundRef.current = classicKeySound;
  // Leaving the window or the tab puts the line back, the way the grown-up
  // page does. A clock that kept running while somebody watched a video would
  // otherwise record a speed they never typed at — and the average they are
  // measured against is the thing that suffers.
  useEffect(() => {
    const away = () => {
      if (!classicRef.current) {
        return;
      }
      restartLineRef.current?.(false);
    };
    // Clicking anywhere that is not the words or the board hands the page
    // back: the hands return, the invitation comes back, and the line starts
    // over — the same thing the grown-up page does when its text area loses
    // focus. A learner who wandered off to press a button was not typing.
    const clickedAway = (ev: PointerEvent) => {
      if (!classicRef.current || !armedRef.current) {
        return;
      }
      const target = ev.target;
      if (
        target instanceof Element &&
        target.closest("[data-practice]") != null
      ) {
        return;
      }
      away();
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") {
        away();
      }
    };
    window.addEventListener("blur", away);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("pointerdown", clickedAway, true);
    return () => {
      window.removeEventListener("blur", away);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("pointerdown", clickedAway, true);
    };
  }, []);
  const kbFull = classic || prefs.kbMode === "full";
  const showHands = !classic && !hideHints && prefs.hands;
  const helperVisible = kbVisible || (!hideHints && prefs.hands);
  /**
   * Whether the keyboard and hands are actually offered yet.
   *
   * They used to draw beside the loading screen, glowing the next key and
   * pointing a finger at it while the trail behind them was still being built.
   * A child who took the invitation typed into a world that had not started.
   *
   * The card still occupies its space while it waits — `.sceneCard` is
   * `flex: 1 1 auto`, so taking the card out of the flow hands its height to
   * the 3-D pane and the scene jumps taller for the length of the load and
   * back again when it finishes. Held with `visibility` rather than unmounted,
   * the layout is the same before and after; only the invitation waits.
   *
   * Classic has no 3-D world to wait for — its effect bails out before
   * anything sets `loaded` — so it is never held back.
   */
  const helperReady = classic || loaded;
  const wide = kbVisible && (kbFull || prefs.hands);

  // Finished passages for this lesson, oldest first — the spark, the delta
  // and the accuracy all read the very records the unlock rules read, so the
  // island can never disagree with the trail about how it is going.
  const pastResults = useMemo(
    () => (classic ? lesson.filter(results) : []),
    [classic, lesson, results],
  );
  const speeds = pastResults.slice(-20).map(({ speed }) => speed / 5);
  const lastWpm = speeds.length > 0 ? Math.round(speeds[speeds.length - 1]) : 0;
  const prevWpm =
    speeds.length > 1 ? Math.round(speeds[speeds.length - 2]) : null;
  // Live while the fingers are moving, the last recorded figure when they are
  // not — a big number that sat at zero between passages would read as lost
  // progress rather than as a pause.
  const liveWpm = (() => {
    const steps = textInput?.steps ?? [];
    if (steps.length < 2) {
      return 0;
    }
    const ms = steps.at(-1)!.timeStamp - steps[0]!.timeStamp;
    // chars/sec → chars/min → words/min (five characters to a word).
    return ms > 0 ? Math.round(((steps.length / (ms / 1000)) * 60) / 5) : 0;
  })();
  const shownWpm = liveWpm > 0 ? liveWpm : lastWpm;

  // Coming back after a break, the first round is a warm-up and its delta
  // means nothing. Without this every learner who returns after school is
  // met by a red minus for something that is not their doing.
  const warmingUp = (() => {
    const last = pastResults[pastResults.length - 1];
    if (last == null) {
      return false;
    }
    return Date.now() - last.timeStamp > 30 * 60 * 1000;
  })();
  // "On target" reads the round being typed, not the last one filed away.
  // Taking it from the finished results left it frozen — a learner who had
  // ever finished one clean round saw 100% for the rest of the session, no
  // matter how the current line was going.
  const liveAccuracy = (() => {
    const steps = textInput?.steps ?? [];
    if (steps.length > 0) {
      return Math.round(makeStats(steps).accuracy * 100);
    }
    return pastResults.length > 0
      ? Math.round(pastResults[pastResults.length - 1].accuracy * 100)
      : null;
  })();

  // One board, drawn once and worn by both faces — the trail sets it inside
  // the helper card beside the hands, Classic stands it on its own. Built
  // here rather than twice so the two can never drift apart.
  // Nothing on the board glows until the lesson has actually started: a key
  // lit while the screen is still saying "press Enter" is inviting a press
  // that will be thrown away.
  const showNext = !classic || armed;
  const rainbow = prefs.board === "rainbow";
  const board = kbVisible ? (
    <div
      className={clsx(
        styles.kb,
        classic && styles.kbClassic,
        rainbow && styles.kbRainbow,
      )}
    >
      {(kbFull ? FULL_ROWS : SIMPLE_ROWS).map((row, r) => (
        <div key={r} className={styles.krow}>
          {row.map((def, i) => (
            <Key
              key={i}
              def={def}
              next={showNext && def.char != null && def.char === nextChar}
              pressed={def.char != null && def.char === pressed}
              stuck={stuckHelp || helpLevel >= 1}
              urgent={helpLevel >= 2}
              wrong={def.char != null && def.char === wrongKey}
              colours={prefs.fingerColours}
              rainbow={rainbow}
              // The full board mirrors the real keyboard: lowercase by
              // default, capitals while Caps/Shift are on.
              upper={kbFull ? capsOn !== shiftOn : undefined}
              active={
                kbFull &&
                def.mod === true &&
                ((def.label === "caps" && capsOn) ||
                  (def.label === "shift" && shiftOn) ||
                  def.label === specialKey)
              }
            />
          ))}
        </div>
      ))}
      <div className={styles.krow}>
        <Key
          def={SPACE_KEY_DEF}
          space={true}
          colours={prefs.fingerColours}
          rainbow={rainbow}
          next={showNext && nextChar === " "}
          pressed={pressed === " "}
          stuck={stuckHelp}
        />
      </div>
      {/* Classic says nothing here: the coach line sits under this card and
          the glowing key speaks for itself. */}
      {!classic && (
        <div className={styles.kbHint}>
          {showHands
            ? "the glowing key is next — the dots mark where your pointers rest"
            : "the glowing key is next"}
        </div>
      )}
    </div>
  ) : null;

  /**
   * What the scene shows, for somebody who cannot see it.
   *
   * Deliberately a description and not a narration. It names where they are,
   * who is with them and how far they have come — the things that would be
   * obvious at a glance and are otherwise completely absent — and it does not
   * try to keep up with the running game. A learner using a screen reader
   * previously got the lesson text and no indication that a world existed at
   * all.
   *
   * It changes as the journey does, so asking again after crossing a land
   * gives the new one; the moments themselves are announced by the coach
   * line, which is a live region.
   */
  const sceneDescription = classic
    ? "Typing practice."
    : [
        landName !== "" ? `Chapter ${chapter}, ${landName}.` : "On the trail.",
        prefs.world === "hero"
          ? `${dinoName()} the hero is walking with you.`
          : `${dinoName()} is walking with you.`,
        `${included} ${included === 1 ? "key" : "keys"} unlocked so far.`,
      ].join(" ");

  return (
    <div
      className={clsx(styles.root, prefs.night && styles.rootDark)}
      style={{ fontFamily: cfg.font }}
    >
      {classic && (
        <ClassicScreen
          lessonKeys={lessonKeys}
          included={included}
          passage={passage}
          pos={pos}
          bigLetters={prefs.bigLetters}
          say={say}
          wpm={shownWpm}
          wpmDelta={warmingUp || prevWpm == null ? null : lastWpm - prevWpm}
          speeds={speeds}
          accuracy={liveAccuracy}
          score={score}
          best={best}
          streakDays={dailyStreak(results, streakGraceDays())}
          minutesDone={Math.floor((sessionTotal - sessionSecs) / 60)}
          minutesGoal={prefs.timerMin}
          target={Math.round(paceTarget(results, cfg) / 5)}
          keyboard={board}
          textScale={prefs.textScale}
          boardShown={prefs.kbMode !== "off"}
          missed={missFlash}
          armed={armed}
          typing={typing}
          resetNotice={resetNotice}
          helpLevel={helpLevel}
          onArm={() => setArmed(true)}
          onRestart={() => {
            // The same words again from the top — a fresh TextInput over the
            // passage already on screen, rather than a new passage.
            textInputRef.current = new TextInput(
              passageRef.current,
              toTextInputSettings(settings),
            );
            lastStampRef.current = 0;
            missStreakRef.current = 0;
            forceTick();
          }}
          onSkip={() => setRegenNonce((n) => n + 1)}
          onToggleBoard={() =>
            // Back to the band's own board, not "full" — Classic draws the
            // whole board regardless, and writing "full" here followed the
            // learner back to the trail and left them with a grown-up board
            // they never asked for.
            savePrefs({ kbMode: prefs.kbMode === "off" ? cfg.kbMode : "off" })
          }
          onTextScale={(textScale) => savePrefs({ textScale })}
        />
      )}
      {!classic && (
        <>
          <div className={styles.sceneCard} ref={sceneCardRef}>
            {/* Described, not narrated.
                The scene is a canvas, which to a screen reader is a blank
                box: a learner using one got the lesson text and no idea
                there was a world around it — no companion, no land, no
                sense of having travelled anywhere.
                What it says is what is DRAWN, refreshed as the journey
                moves. Narrating the running game was considered and
                rejected: a combo or a step announced per keystroke is
                noise that would bury the lesson text underneath it. The
                moments that matter — a key unlocked, a land crossed, a
                companion hatched — are already announced by the coach line
                below, which is a polite live region.
                `role="img"` because that is what it is here: a picture of
                where they are, not a control and not a document. */}
            <canvas
              className={styles.canvas}
              ref={canvasRef}
              role="img"
              aria-label={sceneDescription}
            />
            <span className={styles.keysChip}>
              <b>{included}</b> keys on your trail
            </span>
            {!loaded && (
              <div className={styles.loading}>
                <div>
                  <canvas
                    ref={loaderRef}
                    width={360}
                    height={240}
                    style={{ width: "12rem", height: "8rem" }}
                  />
                  <div className={styles.loadGround}>
                    <i />
                  </div>
                  <div className={styles.loadLabel}>
                    {landName !== ""
                      ? `Chapter ${chapter} · ${landName}`
                      : "Running to the valley…"}
                  </div>
                </div>
              </div>
            )}
            <div
              className={clsx(styles.hudRight, use3dWord && styles.hudBottom)}
            >
              {prefs.timerVisible && !noClock() && (
                <div className={styles.chip}>
                  <span
                    className={styles.ringT}
                    style={{
                      ["--tp" as never]: Math.round(
                        (sessionSecs / Math.max(1, sessionTotal)) * 100,
                      ),
                    }}
                  />
                  <div>
                    <div className={styles.chipLab}>
                      {timerIdle && !sessionOver ? "Waiting…" : "Timer"}
                    </div>
                    <div
                      className={clsx(
                        styles.chipVal,
                        sessionSecs <= 60 && !sessionOver && styles.timerLow,
                        timerIdle && !sessionOver && styles.timerHeld,
                      )}
                    >
                      {Math.floor(sessionSecs / 60)}:
                      {String(sessionSecs % 60).padStart(2, "0")}
                    </div>
                  </div>
                </div>
              )}
              <div className={styles.chip}>
                <span className={styles.ci}>
                  <StarIcon />
                </span>
                <div>
                  <div className={styles.chipLab}>Score</div>
                  <div className={styles.chipVal}>{score}</div>
                </div>
              </div>
              <div className={styles.chip}>
                <span className={styles.ci}>
                  <FlameIcon />
                </span>
                <div>
                  <div className={styles.chipLab}>Combo</div>
                  <div className={styles.chipVal}>×{combo}</div>
                </div>
              </div>
              <div className={styles.chip}>
                <span className={styles.ci}>
                  <SproutIcon />
                </span>
                <div>
                  <div className={styles.chipLab}>
                    {prefs.world === "hero" ? "Hero level" : "Dino stage"}
                  </div>
                  <div className={styles.chipVal}>
                    {(prefs.world === "hero" ? heroStage : dinoStage)(
                      dinoAgeOf(included, lesson.letters.length),
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.chip}>
                <span className={styles.ci}>
                  <TrophyIcon />
                </span>
                <div>
                  <div className={styles.chipLab}>Best</div>
                  <div className={styles.chipVal}>{best}</div>
                </div>
              </div>
            </div>
            {!use3dWord && (
              <div className={styles.words} ref={wordsViewRef}>
                <span className={styles.wordsTrack} ref={wordsTrackRef}>
                  {passageChars.map((ch, at) => (
                    <span
                      key={at}
                      ref={at === pos ? wordsCurRef : undefined}
                      className={
                        at < pos
                          ? styles.hit
                          : at === pos
                            ? styles.cur
                            : undefined
                      }
                    >
                      {/* A real space, not U+00A0. The strip is `nowrap`, so
                      neither one can break a line any more — but a real space
                      is what the child is being asked to type, and it is what
                      the measurement above walks over. */}
                      {ch === " "
                        ? " "
                        : prefs.bigLetters
                          ? ch.toUpperCase()
                          : ch}
                    </span>
                  ))}
                </span>
              </div>
            )}
            <div
              key={growNonce}
              className={clsx(
                styles.growBanner,
                growNonce > 0 && styles.growBannerShow,
              )}
            >
              <BranchIcon /> NEW KEY UNLOCKED — your dino grew!
            </div>
          </div>

          {/* The coach's line is the only thing on this page that tells a
              learner what to do next, and it changes without anything else
              changing — which for somebody listening rather than looking is a
              page that says nothing at all. Polite, so it lands after
              whatever they were reading. */}
          <div className={styles.say} role="status" aria-live="polite">
            {say}
          </div>

          {helperVisible && (
            <div
              ref={kbCardRef}
              className={clsx(
                styles.kbWrap,
                prefs.kbMode === "full" && styles.kbWrapFull,
                wide && styles.kbWrapWide,
                !helperReady && styles.kbWrapWaiting,
              )}
              aria-hidden={!helperReady || undefined}
            >
              {!prefs.sounds && (
                <span
                  className={styles.mutedMark}
                  title="Sounds are off"
                  aria-label="Sounds are off"
                >
                  <SoundIcon muted={true} />
                </span>
              )}
              {showHands && (
                <div className={styles.hands}>
                  <div className={styles.handsArt}>
                    <img src="/kids-assets/hands.png" alt="" />
                    {FINGER_DOTS.map(({ id, left, top }) => (
                      <span
                        key={id}
                        className={clsx(
                          styles.fingerDot,
                          id === nextFinger && styles.fingerDotOn,
                          id === nextFinger &&
                            stuckHelp &&
                            styles.fingerDotStrong,
                        )}
                        style={{ left: `${left}%`, top: `${top}%` }}
                      />
                    ))}
                  </div>
                  <div className={styles.handsHint}>
                    <b>
                      {nextFinger != null
                        ? FINGER_NAMES[nextFinger]
                        : "the glowing finger"}
                    </b>{" "}
                    presses it
                  </div>
                </div>
              )}
              {board}
            </div>
          )}
        </>
      )}

      {/*
        Past the day's healthy ceiling. Deliberately a card that has to be
        answered rather than a line that fades: a child who is enjoying
        themselves will type straight through a notice, and the whole point
        is to interrupt. It says the honest reason — the practice keeps
        working while they are away from it — rather than telling them off.
      */}
      {restOpen && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span className={styles.hIcon}>
                <MoonIcon />
              </span>
              That&rsquo;s a good long practice!
            </div>
            <p className={styles.cardText}>
              You&rsquo;ve typed for {restMinutes} minutes today — plenty for
              one day. Your fingers keep learning while you rest, so coming back
              tomorrow does more good than carrying on now.
            </p>
            <button
              type="button"
              className={styles.cta}
              onClick={() => setRestOpen(false)}
            >
              Okay!
            </button>
          </div>
        </div>
      )}

      {finishOpen && (
        <div className={styles.overlay}>
          <div className={clsx(styles.card, styles.finishCard)}>
            <div className={styles.finishBadge}>
              <TentIcon />
            </div>
            <div
              className={styles.cardTitle}
              style={{ justifyContent: "center" }}
            >
              Campfire time!
            </div>
            <div className={styles.finishMsg}>{finishMsg}</div>
            <div className={styles.finishStats}>
              <div className={styles.fstat}>
                <div className={styles.sd}>Score</div>
                <div
                  className={styles.fstatVal}
                  style={{ color: "var(--sunny-d)" }}
                >
                  {score}
                </div>
              </div>
              <div className={styles.fstat}>
                <div className={styles.sd}>Words</div>
                <div
                  className={styles.fstatVal}
                  style={{ color: "var(--leaf-d)" }}
                >
                  {words}
                </div>
              </div>
              <div className={styles.fstat}>
                <div className={styles.sd}>Best combo</div>
                <div
                  className={styles.fstatVal}
                  style={{ color: "var(--coral)" }}
                >
                  ×{maxCombo}
                </div>
              </div>
              <div className={styles.fstat}>
                <div className={styles.sd}>
                  {prefs.world === "hero" ? "Hero level" : "Dino stage"}
                </div>
                <div
                  className={styles.fstatVal}
                  style={{ color: "var(--leaf-d)" }}
                >
                  {(prefs.world === "hero" ? heroStage : dinoStage)(
                    dinoAgeOf(included, lesson.letters.length),
                  )}
                </div>
              </div>
            </div>
            <div className={styles.finishBest}>
              {score >= best && score > 0
                ? "NEW BEST SCORE — WOW!!"
                : `your best ever: ${best}`}
            </div>

            {/*
              The album at the end of every session, not buried behind a gear
              icon. A score resets; this is the thing that accumulates, and it
              is what makes the next four keys worth walking to.
            */}
            <AlbumStrip
              album={album}
              world={prefs.world}
              included={included}
              onOpen={() => setAlbumOpen(true)}
            />

            <button type="button" className={styles.cta} onClick={playAgain}>
              Run again!
            </button>
            <div className={styles.grownups}>
              <span className={styles.grownupsTitle}>For grown-ups</span>
              Practiced{" "}
              {Math.max(1, Math.round((sessionTotal - sessionSecs) / 60))} min ·{" "}
              {included} keys on the trail · {words} words typed ·{" "}
              {grownupsAgeNote(words, sessionTotal - sessionSecs)}
              <a className={styles.grownupsLink} href="/profile">
                see the full progress chart
              </a>
            </div>
          </div>
        </div>
      )}

      {nameOpen && (
        <div className={styles.overlay}>
          <div className={clsx(styles.card, styles.finishCard)}>
            {/* The companion is whatever this world has. On the Hero Trail
                nothing hatches — somebody falls in beside you — and a card
                announcing a dino over a picture of a knight is the first
                thing a new child sees. */}
            <div className={styles.finishBadge}>
              {prefs.world === "hero" ? (
                <TentIcon size={34} color="#5c4500" />
              ) : (
                <EggIcon size={34} color="#5c4500" />
              )}
            </div>
            <div
              className={styles.cardTitle}
              style={{ justifyContent: "center" }}
            >
              {prefs.world === "hero"
                ? "Someone joined your trail!"
                : "Your dino hatched!"}
            </div>
            <div className={styles.finishMsg}>
              {prefs.world === "hero"
                ? "They will walk every step of the trail with you. What will you call them?"
                : "It will run every step of the trail with you. What will you call it?"}
            </div>
            <input
              className={styles.nameInput}
              maxLength={12}
              placeholder={companionName}
              value={draftName}
              autoFocus={true}
              onChange={(ev) => setDraftName(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  finishNaming();
                }
              }}
            />

            {/*
              Asked here, once, and never again — this card is the only moment
              before the session starts when somebody is looking at the screen
              and not yet typing. Tapping a choice is also the gesture browsers
              require before any audio may play at all, so the answer takes
              effect immediately instead of on some later click.
            */}
            {!prefs.soundAsked && (
              <div className={styles.askSound}>
                <span className={styles.askSoundTitle}>
                  Shall {draftName.trim() || companionName} make noises?
                </span>
                <div className={styles.askSoundRow}>
                  <button
                    type="button"
                    className={clsx(
                      styles.askSoundBtn,
                      draftSounds && styles.askSoundOn,
                    )}
                    onClick={() => {
                      setDraftSounds(true);
                      // Let them hear what they just agreed to. This click is
                      // the user gesture that unlocks audio.
                      kidsAudio.init();
                      unlockVoice();
                      kidsAudio.playPoint();
                    }}
                  >
                    <SoundIcon size={20} color="currentColor" />
                    Yes please
                  </button>
                  <button
                    type="button"
                    className={clsx(
                      styles.askSoundBtn,
                      !draftSounds && styles.askSoundOn,
                    )}
                    onClick={() => setDraftSounds(false)}
                  >
                    <SoundIcon size={20} color="currentColor" muted={true} />
                    Keep it quiet
                  </button>
                </div>
                <span className={styles.askSoundNote}>
                  You can change this any time with the speaker button up top.
                </span>
              </div>
            )}

            <button type="button" className={styles.cta} onClick={finishNaming}>
              Say hello!
            </button>
          </div>
        </div>
      )}

      {classic && tourOpen && (
        <ClassicTour
          onClose={() => {
            setTourOpen(false);
            try {
              localStorage.setItem(CLASSIC_TOUR_KEY(), "1");
            } catch {
              // A learner with storage denied simply sees it again; better than
              // refusing to show them the page.
            }
          }}
        />
      )}

      {ceremony != null && classic && (
        <ClassicUnlock
          letter={ceremony.letter}
          finger={
            FINGER_OF[ceremony.letter] != null
              ? FINGER_NAMES[FINGER_OF[ceremony.letter]]
              : null
          }
        />
      )}

      {ceremony != null && !classic && (
        <div className={styles.overlay}>
          <div className={clsx(styles.card, styles.finishCard)}>
            <div className={styles.cerEyebrow}>NEW LETTER!</div>
            <div className={styles.cerLetter}>
              {ceremony.letter.toUpperCase()}
            </div>
            <div className={styles.finishMsg}>
              Your{" "}
              <b style={{ color: "var(--leaf-d)" }}>
                {FINGER_NAMES[FINGER_OF[ceremony.letter]]}
              </b>{" "}
              presses it — tap {ceremony.letter.toUpperCase()} three times to
              wake it up!
            </div>
            <div className={styles.cerDots}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={clsx(
                    styles.cerDot,
                    i < ceremony.presses && styles.cerDotOn,
                  )}
                >
                  <StarIcon
                    size={20}
                    color={i < ceremony.presses ? "#5c4500" : "#c9c9bb"}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/*
        The hatch, here rather than in a settings menu.

        The creature is offered right now, while the child is still looking at
        the moment it arrived in — and taking it swaps the runner in the scene
        behind this card. The old flow printed "(see settings)" and left a
        five-year-old to go and find a gear icon, which is not a reward.
      */}
      {hatched != null && ceremony == null && (
        <div className={styles.overlay}>
          <div className={clsx(styles.card, styles.finishCard)}>
            <div className={clsx(styles.finishBadge, styles.hatchBadge)}>
              <EggIcon size={34} color="#5c4500" />
            </div>
            <div className={styles.cerEyebrow}>AN EGG HATCHED!</div>
            <div className={styles.hatchName}>{hatched.label}</div>
            <div className={styles.finishMsg}>
              {hatched.label} is yours to keep. Run together, or stay with{" "}
              {prefs.name || "your buddy"} — you can swap any time.
            </div>
            <div className={styles.hatchRow}>
              <button
                type="button"
                className={styles.cta}
                onClick={() => {
                  savePrefs(
                    prefs.world === "hero"
                      ? { hero: hatched.id }
                      : { dino: hatched.id },
                  );
                  worldRef.current?.setPlayer(hatched.id).catch(() => {});
                  setHatched(null);
                }}
              >
                Run with {hatched.label}!
              </button>
              <button
                type="button"
                className={styles.pill}
                onClick={() => setHatched(null)}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/*
        Graduation. Three things have to happen here and none of them used to:
        the moment is marked, the trail is given somewhere to go next, and the
        grown-up page is named out loud — a child who has typed the whole
        alphabet has outgrown a game about eggs, and until now nobody told them
        there was anywhere else.
      */}
      {graduated && (
        <div className={styles.overlay}>
          <div className={clsx(styles.card, styles.finishCard)}>
            <div className={styles.gradRibbon}>THE WHOLE ALPHABET</div>
            <div className={styles.gradLetters}>
              {[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((ch, i) => (
                <span
                  key={ch}
                  className={styles.gradLetter}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {ch}
                </span>
              ))}
            </div>
            <div className={styles.finishMsg}>
              Every single letter, {prefs.name || "friend"} — you did that.
              There are bigger keys out there now.
            </div>
            <div className={styles.gradChoices}>
              <button
                type="button"
                className={styles.cta}
                onClick={() => {
                  savePrefs({ grownupKeys: "caps" });
                  setGraduated(false);
                }}
              >
                Add the BIG letters
              </button>
              <a className={styles.gradLink} href="/practice">
                or move up to the grown-up page
              </a>
              <button
                type="button"
                className={styles.pill}
                onClick={() => setGraduated(false)}
              >
                Just letters for now
              </button>
            </div>
          </div>
        </div>
      )}

      {albumOpen && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span className={styles.hIcon}>
                <StarIcon size={20} color="#5c4500" />
              </span>
              Your sticker album
            </div>
            <AlbumGrid album={album} world={prefs.world} />
            <button
              type="button"
              className={styles.cta}
              onClick={() => setAlbumOpen(false)}
            >
              Back to the trail
            </button>
          </div>
        </div>
      )}

      {mapOpen && (
        <div className={styles.overlay}>
          <div className={clsx(styles.card, styles.finishCard)}>
            <div className={styles.finishBadge}>
              <FlagIcon size={30} color="#5c4500" />
            </div>
            <div
              className={styles.cardTitle}
              style={{ justifyContent: "center" }}
            >
              Chapter {chapter} complete!
            </div>
            <div className={styles.finishMsg}>
              {dinoName()} crossed {landName} — the herd walks on toward the
              Green Valley.
            </div>
            <div className={styles.mapRow}>
              {LANDS.map(({ name }, i) => {
                const here = name === landName;
                const next = name === peekNextLandName();
                return (
                  <div key={name} className={styles.mapStopWrap}>
                    {i > 0 && <span className={styles.mapHop} />}
                    <div
                      className={clsx(
                        styles.mapStop,
                        here && styles.mapStopHere,
                        next && styles.mapStopNext,
                      )}
                    >
                      {here ? (
                        <FlagIcon size={18} />
                      ) : (
                        <DinoFill
                          size={20}
                          color={next ? "#3d6b2e" : "#b9b9a9"}
                        />
                      )}
                      <span className={styles.mapStopName}>{name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={styles.finishStats}>
              <div className={styles.fstat}>
                <div className={styles.sd}>Camps</div>
                <div
                  className={styles.fstatVal}
                  style={{ color: "var(--leaf-d)" }}
                >
                  {roundsRef.current}
                </div>
              </div>
              <div className={styles.fstat}>
                <div className={styles.sd}>Words</div>
                <div
                  className={styles.fstatVal}
                  style={{ color: "var(--sunny-d)" }}
                >
                  {words}
                </div>
              </div>
              <div className={styles.fstat}>
                <div className={styles.sd}>Score</div>
                <div
                  className={styles.fstatVal}
                  style={{ color: "var(--coral)" }}
                >
                  {score}
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.cta}
              onClick={crossIntoNextLand}
            >
              Cross into {peekNextLandName()}!
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <SettingsCard
          prefs={prefs}
          included={included}
          savePrefs={savePrefs}
          onRename={() => {
            setSettingsOpen(false);
            setDraftName(prefs.name);
            setNameOpen(true);
          }}
          totalLetters={lesson.letters.length}
          onOpenAlbum={() => {
            setSettingsOpen(false);
            setAlbumOpen(true);
          }}
          onPickDino={(dino) => {
            savePrefs({ dino });
            worldRef.current?.setPlayer(dino).catch(() => {});
          }}
          onPickHero={(hero) => {
            // Playing as somebody sends them home as your friend — you cannot
            // walk beside yourself.
            const companion = prefs.companion === hero ? null : prefs.companion;
            savePrefs({ hero, companion });
            worldRef.current?.setPlayer(hero).catch(() => {});
            if (companion !== prefs.companion) {
              worldRef.current?.setCompanion(companion).catch(() => {});
            }
          }}
          onPickCompanion={(companion) => {
            savePrefs({ companion });
            worldRef.current?.setCompanion(companion).catch(() => {});
          }}
          onPickTimer={(timerMin) => {
            savePrefs({ timerMin });
            setSessionSecs(timerMin * 60);
            setSessionOver(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

// Stable reference so the space key's `def` prop doesn't defeat Key's memo
// with a fresh object literal every render.
const SPACE_KEY_DEF: KeyDef = { char: " ", label: "" };

/**
 * Rainbow's frame keys, as signs rather than as words.
 *
 * The reference board draws them this way and it is not decoration: "back"
 * and "enter" are words a five-year-old cannot yet read, and Rainbow is the
 * board for the band that cannot read them. A sign can be shown once; a word
 * has to be told. Crayon keeps the words — it is the board a learner meets
 * later, by which time reading them is free.
 */
const RAINBOW_SIGN: Readonly<Record<string, string>> = {
  back: "\u2190",
  tab: "\u21e5",
  caps: "\u21ea",
  enter: "\u21b5",
  shift: "\u2191",
};

// A pure, prop-only tile — memoized so a keystroke that changes one or two
// keys' state (old "next" key, new "next" key, pressed key) doesn't force
// React to diff every tile on the board (up to 47 in full-keyboard mode).
const Key = memo(function Key({
  def,
  next,
  pressed,
  space = false,
  stuck = false,
  urgent = false,
  wrong = false,
  colours = true,
  upper,
  active = false,
  rainbow = false,
}: {
  readonly def: KeyDef;
  readonly next: boolean;
  readonly pressed: boolean;
  readonly space?: boolean;
  readonly stuck?: boolean;
  /** Help level 2: the next key insists rather than suggests. */
  readonly urgent?: boolean;
  /** This is the key that was just pressed by mistake. */
  readonly wrong?: boolean;
  /** False when the finger-zone colours are switched off. */
  readonly colours?: boolean;
  /** Full board only: capitals when true, lowercase when false. */
  readonly upper?: boolean;
  /** A modifier key currently held/latched (Caps, Shift, Tab, …). */
  readonly active?: boolean;
  /** The primary-colour board: the cap carries the key's kind as its fill. */
  readonly rainbow?: boolean;
}) {
  // Only the character keys carry a finger colour. Tab, Caps, Shift, Enter,
  // Backspace and the space bar keep the neutral cap: they are the frame the
  // letters sit in, and colouring them competes with the keys a learner is
  // actually being pointed at.
  const zone = def.char != null ? ZONE_OF[def.char] : ZONE_OF_LABEL[def.label];
  // Letter keys follow the Caps/Shift state on the full board; everything else
  // (symbols, modifiers) keeps its fixed legend.
  const isLetter = def.char != null && /^[a-z]$/.test(def.char);
  const face =
    isLetter && upper != null
      ? upper
        ? def.char!.toUpperCase()
        : def.char!
      : def.label;
  /* Rainbow paints the cap by what KIND of key this is — the frame, a
     number or punctuation mark, a consonant, a vowel — and leaves the finger
     colour to the legend. Crayon does the opposite: the cap IS the finger
     colour. Both read `zone` above; only this decides what to do with it. */
  const kind = !rainbow
    ? null
    : space || (def.mod === true && zone == null)
      ? "g"
      : def.char == null
        ? "r"
        : "aeiou".includes(def.char)
          ? "v"
          : "b";
  return (
    <div
      className={clsx(
        styles.key,
        space && styles.keySpace,
        def.mod && styles.keyMod,
        def.shift != null && styles.keyDual,
        def.width === "w15" && styles.keyW15,
        def.width === "w2" && styles.keyW2,
        def.width === "w25" && styles.keyW25,
        next && styles.keyNext,
        next && stuck && styles.keyStuck,
        next && urgent && styles.keyUrgent,
        wrong && styles.keyWrong,
        pressed && styles.keyPressed,
        active && styles.keyModOn,
      )}
      style={{
        // Crayon's cap IS the finger colour, so `--kz` always resolves —
        // its ring is built with it and an unset value would invalidate the
        // whole box-shadow. Rainbow prints its LEGEND in the finger colour,
        // and its frame keys have no finger, so that reads a separate
        // variable which is simply absent on the keys that have no zone.
        ["--kz" as never]:
          colours && zone != null ? `var(--${zone})` : "var(--clay)",
        ...(colours && zone != null
          ? { ["--kl" as never]: `var(--${zone})` }
          : {}),
        ...(kind != null
          ? {
              ["--kc" as never]: `var(--k${kind})`,
              ["--kc-d" as never]: `var(--k${kind}-d)`,
            }
          : {}),
      }}
      // Lets Classic find the home keys and the space bar in the DOM, so the
      // resting hands can be anchored to them rather than eyeballed.
      data-key={space ? " " : (def.char ?? undefined)}
    >
      {def.shift != null ? (
        rainbow ? (
          // The shifted symbol small and to the top right, the way the
          // reference board prints it. Stacked, as Crayon does it, both
          // glyphs end up too small to read on a cap this size.
          <>
            <span className={styles.kMainBig}>{def.label}</span>
            <span className={styles.kShiftUp}>{def.shift}</span>
          </>
        ) : (
          <>
            <span className={styles.kTop}>{def.shift}</span>
            <span className={styles.kBot}>{def.label}</span>
          </>
        )
      ) : rainbow && RAINBOW_SIGN[def.label] != null ? (
        <span className={styles.kSign}>{RAINBOW_SIGN[def.label]}</span>
      ) : (
        face
      )}
      {def.bump && <span className={styles.bump} />}
    </div>
  );
});

/**
 * The album.
 *
 * Unearned stickers are drawn as faded outlines with the words for how to get
 * them, and that is the whole point of showing them: a child who can see three
 * empty slots knows there is more trail ahead, where a child who only sees what
 * they already hold has arrived at the end of the game.
 */
/**
 * The album, in one line, at the end of a session.
 *
 * Two things a child needs to see here: how many they hold, and — the part the
 * page never had — how far the next one is. "Two more keys" is a reason to come
 * back; a score that resets to zero is not.
 */
function AlbumStrip({
  album,
  world,
  included,
  onOpen,
}: {
  readonly album: Album;
  readonly world: "dino" | "hero";
  readonly included: number;
  readonly onOpen: () => void;
}) {
  const all = catalogue(world);
  const got = all.filter(({ id }) => id in album).length;
  const next = nextHatchling(world, included);
  return (
    <button type="button" className={styles.albumStrip} onClick={onOpen}>
      <span className={styles.albumStripIcon}>
        <StarIcon size={20} color="#5c4500" />
      </span>
      <span className={styles.albumStripText}>
        <b>
          {got} of {all.length} stickers
        </b>
        {next != null && (
          <span className={styles.albumStripNext}>
            {next.at - included === 1
              ? `1 more key and ${next.label} hatches`
              : `${next.at - included} more keys and ${next.label} hatches`}
          </span>
        )}
      </span>
    </button>
  );
}

function AlbumGrid({
  album,
  world,
}: {
  readonly album: Album;
  readonly world: "dino" | "hero";
}) {
  const all = catalogue(world);
  const got = all.filter(({ id }) => id in album).length;
  return (
    <>
      <div className={styles.albumCount}>
        {got} of {all.length} collected
      </div>
      <div className={styles.albumGrid}>
        {all.map((sticker) => (
          <StickerTile
            key={sticker.id}
            sticker={sticker}
            on={sticker.id in album}
          />
        ))}
      </div>
    </>
  );
}

function StickerTile({
  sticker,
  on,
}: {
  readonly sticker: Sticker;
  readonly on: boolean;
}) {
  const { label, hint, kind } = sticker;
  const colour = on
    ? {
        companion: "var(--sage)",
        land: "var(--seafoam)",
        milestone: "var(--sand)",
      }[kind]
    : "transparent";
  const ink = on ? "#3d3a2e" : "var(--kink2)";
  return (
    <div
      className={clsx(styles.sticker, !on && styles.stickerOff)}
      style={{ background: colour }}
      title={on ? label : hint}
    >
      <span className={styles.stickerIcon}>
        {kind === "companion" ? (
          <EggIcon size={20} color={ink} />
        ) : kind === "land" ? (
          <FlagIcon size={20} color={ink} />
        ) : (
          <StarIcon size={20} color={ink} />
        )}
      </span>
      <span className={styles.stickerLabel}>{on ? label : hint}</span>
    </div>
  );
}

// The sections, in the order a child meets them: how they practise, the world
// they practise in, what helps while they type, and how long they go for.
/**
 * Whether this learner has asked to practise without a clock.
 *
 * Read from the shared accessibility record rather than the game's own prefs:
 * it is a standing preference somebody set for this learner, not a choice made
 * inside this run, and it applies wherever they type.
 */
function noClock(): boolean {
  return !loadA11y().timers;
}

const SET_TABS = [
  { id: "practise", label: "Practice" },
  { id: "world", label: "World" },
  { id: "help", label: "Help" },
  { id: "session", label: "Session" },
] as const;

type SetTab = (typeof SET_TABS)[number]["id"];

function SettingsCard({
  prefs,
  included,
  totalLetters,
  savePrefs,
  onRename,
  onOpenAlbum,
  onPickDino,
  onPickHero,
  onPickCompanion,
  onPickTimer,
  onClose,
}: {
  readonly prefs: Prefs;
  readonly included: number;
  /** Letters in this layout's alphabet, so "all of them" is not hardcoded. */
  readonly totalLetters: number;
  readonly savePrefs: (patch: Partial<Prefs>) => void;
  readonly onRename: () => void;
  readonly onOpenAlbum: () => void;
  readonly onPickDino: (dino: string) => void;
  readonly onPickHero: (hero: string) => void;
  readonly onPickCompanion: (companion: string | null) => void;
  readonly onPickTimer: (min: number) => void;
  readonly onClose: () => void;
}) {
  const pill = (on: boolean) => clsx(styles.pill, on && styles.pillOn);
  // The two children, minus whoever is being played. Derived rather than
  // listed so it cannot fall out of step with the roster, and so a third
  // character needs nothing here.
  const companionChoices = COMPANIONS.filter(({ id }) => id !== prefs.hero);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tab, setTab] = useState<SetTab>("practise");
  // Classic has no world to dress, no buddy to pick and no hands to show, so
  // the rows that only mean something on the trail leave the sheet entirely
  // rather than sitting there doing nothing. They come back untouched the
  // moment the trail does.
  // The in-world letters are the default for the youngest; 7-8 and 9-10 get a
  // toggle to opt in.
  const band = currentBand();
  const cfg = bandConfig(band);
  const canToggleWords = band === "7-8" || band === "9-10";
  const canClassic = classicOffered(band);
  const trail = !(prefs.classic && canClassic);
  // Which sections this learner actually has. A child with no Classic offer
  // would otherwise open the panel on a heading with nothing under it.
  const shown = SET_TABS.filter(({ id }) =>
    id === "practise" ? canClassic : id === "world" ? trail : true,
  ).map(({ id }) => id);
  if (!shown.includes(tab)) {
    setTab(shown[0]);
  }
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span className={styles.hIcon}>
            <GearIcon />
          </span>
          Your game, your way
        </div>
        {/*
          The rows scroll; the title above and the button below do not. The
          card had grown past a screen, and the way back to the game was
          buried at the bottom of a scroll a five-year-old had to find.
        */}
        <div className={styles.cardScroll}>
          {/* One section at a time. The list had grown long enough that the
              thing somebody opened this panel for was usually below the fold,
              and a child scrolling past four headings to find the timer is a
              child who gives up and asks a grown-up. */}
          <div className={styles.setTabs} role="tablist">
            {SET_TABS.filter(({ id }) => shown.includes(id)).map(
              ({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={clsx(styles.setTab, tab === id && styles.setTabOn)}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          <div className={styles.setPane}>
            {tab === "practise" && (
              <>
                {canClassic && (
                  <>
                    {/*
            The two faces of the same lesson. Which one a learner lands on
            comes from their age to begin with, but it lives here because
            eleven is an average rather than a rule — and because a child who
            wants the trail back should not have to wait to grow out of it.
          */}
                    <div className={styles.srow}>
                      <span
                        className={styles.ri}
                        style={{ background: "var(--sky)" }}
                      >
                        <ClassicIcon />
                      </span>
                      <div>
                        <div className={styles.sl}>Practice style</div>
                        <div className={styles.sd}>
                          {trail
                            ? "run the trail with your buddy"
                            : "just the words, the board and your progress"}
                        </div>
                      </div>
                      <div className={styles.ctl}>
                        <button
                          type="button"
                          className={pill(trail)}
                          onClick={() => savePrefs({ classic: false })}
                        >
                          Trail game
                        </button>
                        <button
                          type="button"
                          className={pill(!trail)}
                          onClick={() => savePrefs({ classic: true })}
                        >
                          Classic
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            {tab === "world" && (
              <>
                {trail && (
                  <div className={styles.srow}>
                    <span
                      className={styles.ri}
                      style={{ background: "var(--seafoam)" }}
                    >
                      <WorldIcon size={24} color="#12664a" />
                    </span>
                    <div>
                      <div className={styles.sl}>Pick your world</div>
                      <div className={styles.sd}>where you run</div>
                    </div>
                    <div className={styles.ctl}>
                      <button
                        type="button"
                        className={pill(prefs.world === "dino")}
                        onClick={() => savePrefs({ world: "dino" })}
                      >
                        Dino Run
                      </button>
                      <button
                        type="button"
                        className={pill(prefs.world === "hero")}
                        onClick={() => savePrefs({ world: "hero" })}
                      >
                        Hero Trail
                      </button>
                    </div>
                  </div>
                )}
                {/*
          Hero Trail only: what the dark means. By age unless a grown-up says
          otherwise — the youngest get a starry quiet night with no Lost
          Travellers, and this is where a parent moves a child up or down.
        */}
                {trail && prefs.world === "hero" && (
                  <div className={styles.srow}>
                    <span
                      className={styles.ri}
                      style={{ background: "var(--sky)" }}
                    >
                      <MoonIcon size={20} color="#2d3f6b" />
                    </span>
                    <div>
                      <div className={styles.sl}>Night on the trail</div>
                      <div className={styles.sd}>who is out after dark</div>
                    </div>
                    <div className={styles.ctl}>
                      {(
                        [
                          ["auto", "By age"],
                          ["quiet", "Quiet"],
                          ["mild", "Spooky"],
                          ["full", "Extra spooky"],
                        ] as const
                      )
                        // No Extra spooky at five, not even for a grown-up — the
                        // resolver refuses the value anyway (see night.ts), so
                        // offering the pill would be offering a button that does
                        // not do what it says.
                        .filter(
                          ([value]) => !(band === "5-6" && value === "full"),
                        )
                        .map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={pill(prefs.nightStyle === value)}
                            onClick={() => savePrefs({ nightStyle: value })}
                          >
                            {label}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
                {/*
          Only offered once the alphabet is done. Before that it would be a
          harder mode dangled in front of a child still learning where D is.
        */}
                {included >= totalLetters && (
                  <div className={styles.srow}>
                    <span
                      className={styles.ri}
                      style={{ background: "var(--coral)" }}
                    >
                      <span className={styles.aaIcon}>A!</span>
                    </span>
                    <div>
                      <div className={styles.sl}>Grown-up keys</div>
                      <div className={styles.sd}>
                        capital letters, then full stops and commas
                      </div>
                    </div>
                    <div className={styles.ctl}>
                      {(
                        [
                          ["off", "Off"],
                          ["caps", "Capitals"],
                          ["punct", "And marks"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={pill(prefs.grownupKeys === value)}
                          onClick={() => savePrefs({ grownupKeys: value })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {trail && (
                  <>
                    <div className={styles.srow}>
                      <span
                        className={styles.ri}
                        style={{ background: "var(--sand)" }}
                      >
                        <StarIcon size={22} color="#7a5c00" />
                      </span>
                      <div>
                        <div className={styles.sl}>Sticker album</div>
                        <div className={styles.sd}>
                          everything you have collected
                        </div>
                      </div>
                      <div className={styles.ctl}>
                        <button
                          type="button"
                          className={styles.pill}
                          onClick={onOpenAlbum}
                        >
                          Open
                        </button>
                      </div>
                    </div>
                    <div className={styles.srow}>
                      <span
                        className={styles.ri}
                        style={{ background: "var(--sage)" }}
                      >
                        <PawIcon size={24} color="#3d6b2e" />
                      </span>
                      <div>
                        <div className={styles.sl}>
                          {prefs.name !== "" ? prefs.name : "Your buddy"}
                        </div>
                        <div className={styles.sd}>who runs with you</div>
                      </div>
                      {/*
            Both worlds work the same way now: a couple of starters, then a
            companion earned every four keys. The hero world used to hand out
            both of its characters for free and have nothing after them, which
            left the default world for the youngest bands with no rewards at
            all.
          */}
                      <div className={styles.ctl}>
                        {(prefs.world === "hero"
                          ? HERO_CHARACTERS
                          : ([{ id: "TRex", label: "Rex" }] as const)
                        ).map(({ id, label }) => (
                          <button
                            key={id}
                            type="button"
                            className={pill(
                              (prefs.world === "hero"
                                ? prefs.hero
                                : prefs.dino) === id,
                            )}
                            onClick={() =>
                              prefs.world === "hero"
                                ? onPickHero(id)
                                : onPickDino(id)
                            }
                          >
                            {label}
                          </button>
                        ))}
                        {/*
              The hero world's cast is fixed: the Knight, the Skeleton, Dave
              and Little Drew. Its earnable characters — Scout, Ranger, Mage,
              Bear, Shadow — are no longer offered here, and neither are the
              locked eggs counting down to them.

              They are NOT deleted from HATCHLINGS. They still hatch, still
              celebrate, and still earn their album sticker, which is what the
              "hero world is not left without rewards" test in album.test.ts
              exists to protect. Only this picker stops listing them.
            */}
                        {(prefs.world === "hero"
                          ? []
                          : HATCHLINGS[prefs.world]
                        ).map(({ id, label, at }) =>
                          included >= at ? (
                            <button
                              key={id}
                              type="button"
                              className={pill(
                                (prefs.world === "hero"
                                  ? prefs.hero
                                  : prefs.dino) === id,
                              )}
                              onClick={() =>
                                prefs.world === "hero"
                                  ? onPickHero(id)
                                  : onPickDino(id)
                              }
                            >
                              {label}
                            </button>
                          ) : (
                            <button
                              key={id}
                              type="button"
                              className={clsx(styles.pill, styles.pillEgg)}
                              disabled={true}
                              title={`This egg hatches at ${at} keys`}
                            >
                              <EggIcon size={14} color="currentColor" /> {at}{" "}
                              keys
                            </button>
                          ),
                        )}
                        <button
                          type="button"
                          className={styles.pill}
                          onClick={onRename}
                        >
                          Rename
                        </button>
                      </div>
                    </div>
                    {/*
            A friend to walk with, offered only in the hero world and only
            when there is somebody left to offer: the list is the two
            Explorers minus whoever you are already playing as, so it can
            never suggest you bring yourself.
          */}
                    {prefs.world === "hero" && companionChoices.length > 0 && (
                      <div className={styles.srow}>
                        <span
                          className={styles.ri}
                          style={{ background: "var(--sky)" }}
                        >
                          <PawIcon size={24} color="#2f5d7a" />
                        </span>
                        <div>
                          <div className={styles.sl}>Who comes with you?</div>
                          <div className={styles.sd}>
                            they copy what you do, a moment later
                          </div>
                        </div>
                        <div className={styles.ctl}>
                          <button
                            type="button"
                            className={pill(prefs.companion == null)}
                            onClick={() => onPickCompanion(null)}
                          >
                            Nobody
                          </button>
                          {companionChoices.map(({ id, label }) => (
                            <button
                              key={id}
                              type="button"
                              className={pill(prefs.companion === id)}
                              onClick={() => onPickCompanion(id)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {tab === "help" && (
              <>
                {/*
            Only while the words are actually in a panel. The in-world letter
            blocks are capitals by their nature, so whenever a child is on
            them — always at 5-6, by choice at 7-10 — a CAPITALS toggle
            changes nothing, and a toggle that changes nothing is worse than
            no toggle.
          */}
                {!(band === "5-6" || (canToggleWords && prefs.wordBlocks)) && (
                  <div className={styles.srow}>
                    <span
                      className={styles.ri}
                      style={{ background: "var(--sky)" }}
                    >
                      <span className={styles.aaIcon}>Aa</span>
                    </span>
                    <div>
                      <div className={styles.sl}>Big letters</div>
                      <div className={styles.sd}>
                        show the words in CAPITALS
                      </div>
                    </div>
                    <div className={styles.ctl}>
                      <button
                        type="button"
                        className={pill(prefs.bigLetters)}
                        onClick={() =>
                          savePrefs({ bigLetters: !prefs.bigLetters })
                        }
                      >
                        {prefs.bigLetters ? "On" : "Off"}
                      </button>
                    </div>
                  </div>
                )}
                {trail && canToggleWords && (
                  <div className={styles.srow}>
                    <span
                      className={styles.ri}
                      style={{ background: "var(--seafoam)" }}
                    >
                      <span className={styles.aaIcon}>Ab</span>
                    </span>
                    <div>
                      <div className={styles.sl}>Letters on the trail</div>
                      <div className={styles.sd}>
                        show the words as blocks in the game, not a panel
                      </div>
                    </div>
                    <div className={styles.ctl}>
                      <button
                        type="button"
                        className={pill(prefs.wordBlocks)}
                        onClick={() =>
                          savePrefs({ wordBlocks: !prefs.wordBlocks })
                        }
                      >
                        {prefs.wordBlocks ? "On" : "Off"}
                      </button>
                    </div>
                  </div>
                )}
                <div className={styles.srow}>
                  <span
                    className={styles.ri}
                    style={{ background: "var(--sand)" }}
                  >
                    <SoundIcon color="#7a5c00" size={20} />
                  </span>
                  <div>
                    <div className={styles.sl}>Sounds</div>
                    <div className={styles.sd}>
                      beeps, jumps and level-up tunes
                    </div>
                  </div>
                  <div className={styles.ctl}>
                    <button
                      type="button"
                      className={pill(prefs.sounds)}
                      onClick={() => savePrefs({ sounds: !prefs.sounds })}
                    >
                      {prefs.sounds ? "On" : "Off"}
                    </button>
                  </div>
                </div>
                {/*
          On by default for the bands who cannot read the coach, and still a
          knob: a classroom of eight children is a very different room from a
          bedroom, and a child who has learned to read wants it gone.
        */}
                <div className={styles.srow}>
                  <span
                    className={styles.ri}
                    style={{ background: "var(--sand)" }}
                  >
                    <SoundIcon color="#7a5c00" size={20} />
                  </span>
                  <div>
                    <div className={styles.sl}>Read it out loud</div>
                    <div className={styles.sd}>
                      {prefs.sounds
                        ? "the coach says the important bits"
                        : "needs sounds switched on"}
                    </div>
                  </div>
                  <div className={styles.ctl}>
                    <button
                      type="button"
                      className={pill(prefs.readAloud && prefs.sounds)}
                      disabled={!prefs.sounds}
                      onClick={() => {
                        const on = !prefs.readAloud;
                        savePrefs({ readAloud: on, readAloudChosen: true });
                        if (on) {
                          unlockVoice();
                          speakLine(
                            "Hello! I will read the important bits.",
                            cfg.speechRate,
                          );
                        } else {
                          stopSpeaking();
                        }
                      }}
                    >
                      {prefs.readAloud && prefs.sounds ? "On" : "Off"}
                    </button>
                  </div>
                </div>
                {/* Offered from 9-10 up only — see playfulOffered. Below that
                    the coach's lines are frequently the only prose the child
                    reads unaided, and understatement is the first register to
                    fail when somebody is still decoding the words. */}
                {playfulOffered(band) && (
                  <div className={styles.srow}>
                    <span
                      className={styles.ri}
                      style={{ background: "var(--sky)" }}
                    >
                      <StarIcon />
                    </span>
                    <div>
                      <div className={styles.sl}>Cheeky coach</div>
                      <div className={styles.sd}>
                        drier, funnier lines from your buddy
                      </div>
                    </div>
                    <div className={styles.ctl}>
                      <button
                        type="button"
                        className={pill(prefs.playful)}
                        onClick={() => savePrefs({ playful: !prefs.playful })}
                      >
                        {prefs.playful ? "On" : "Off"}
                      </button>
                    </div>
                  </div>
                )}
                {trail && (
                  <div className={styles.srow}>
                    <span
                      className={styles.ri}
                      style={{ background: "var(--rose)" }}
                    >
                      <HandIcon />
                    </span>
                    <div>
                      <div className={styles.sl}>Helper hands</div>
                      <div className={styles.sd}>the glowing finger guide</div>
                    </div>
                    <div className={styles.ctl}>
                      <button
                        type="button"
                        className={pill(prefs.hands)}
                        onClick={() => savePrefs({ hands: !prefs.hands })}
                      >
                        {prefs.hands ? "On" : "Off"}
                      </button>
                    </div>
                  </div>
                )}
                <div className={styles.srow}>
                  <span
                    className={styles.ri}
                    style={{ background: "var(--seafoam)" }}
                  >
                    <KeysIcon />
                  </span>
                  <div>
                    <div className={styles.sl}>Keyboard</div>
                    <div className={styles.sd}>
                      {trail
                        ? "simple letters, the full grown-up board, or hidden"
                        : "the full board, or out of the way"}
                    </div>
                  </div>
                  <div className={styles.ctl}>
                    {/* Classic always draws the whole board, so offering "simple"
                  there would be a pill that changes nothing. */}
                    {(trail
                      ? ([
                          ["off", "Hidden"],
                          ["simple", "Simple"],
                          ["full", "Full"],
                        ] as const)
                      : ([
                          ["off", "Hidden"],
                          ["full", "Shown"],
                        ] as const)
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        className={pill(
                          trail
                            ? prefs.kbMode === mode
                            : mode === "off"
                              ? prefs.kbMode === "off"
                              : prefs.kbMode !== "off",
                        )}
                        onClick={() =>
                          // On the trail, choosing the full board makes room by
                          // standing the hands aside (turn them back on anytime).
                          //
                          // On Classic this row is only Hidden/Shown, and "Shown"
                          // must write the band's own board rather than "full":
                          // Classic draws the whole board whatever this says, and
                          // writing "full" here followed the learner back to the
                          // trail and left them with a grown-up board — and no
                          // helper hands — that they never chose.
                          savePrefs(
                            !trail
                              ? { kbMode: mode === "off" ? "off" : cfg.kbMode }
                              : mode === "full"
                                ? { kbMode: mode, hands: false }
                                : { kbMode: mode },
                          )
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.srow}>
                  <span
                    className={styles.ri}
                    style={{ background: "var(--seafoam)" }}
                  >
                    <KeysIcon color="#0b4a37" />
                  </span>
                  <div>
                    <div className={styles.sl}>Key style</div>
                    <div className={styles.sd}>
                      how the keys are painted &mdash; the keys themselves do
                      not move
                    </div>
                  </div>
                  <div className={styles.ctl}>
                    {(
                      [
                        ["crayon", "Crayon"],
                        ["rainbow", "Rainbow"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={pill(prefs.board === id)}
                        onClick={() => savePrefs({ board: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.srow}>
                  <span
                    className={styles.ri}
                    style={{ background: "var(--sand)" }}
                  >
                    <KeysIcon color="#7a5c00" />
                  </span>
                  <div>
                    <div className={styles.sl}>Finger colours</div>
                    <div className={styles.sd}>
                      colour each key by the finger that presses it
                    </div>
                  </div>
                  <div className={styles.ctl}>
                    <button
                      type="button"
                      className={pill(prefs.fingerColours)}
                      onClick={() =>
                        savePrefs({ fingerColours: !prefs.fingerColours })
                      }
                    >
                      {prefs.fingerColours ? "On" : "Off"}
                    </button>
                  </div>
                </div>
              </>
            )}
            {tab === "session" && (
              <>
                <div className={styles.srow}>
                  <span
                    className={styles.ri}
                    style={{ background: "var(--sage)" }}
                  >
                    <ClockIcon />
                  </span>
                  <div>
                    <div className={styles.sl}>Timer</div>
                    <div className={styles.sd}>
                      pick a session — the run ends at the campfire
                    </div>
                  </div>
                  <div className={styles.ctl}>
                    {/* A standing preference beats a per-session control: a
                        parent set "practise without a clock" for this learner,
                        and a child flipping this pill should not undo it. The
                        session still ends at the campfire — what goes is being
                        watched while you type. */}
                    <button
                      type="button"
                      className={pill(!prefs.timerVisible || noClock())}
                      disabled={noClock()}
                      title={
                        noClock()
                          ? "Hidden for this learner in Accessibility settings"
                          : undefined
                      }
                      onClick={() =>
                        savePrefs({ timerVisible: !prefs.timerVisible })
                      }
                    >
                      {prefs.timerVisible && !noClock() ? "Shown" : "Hidden"}
                    </button>
                    {[5, 10, 15, 20, 25, 30].map((min) => (
                      <button
                        key={min}
                        type="button"
                        className={pill(prefs.timerMin === min)}
                        onClick={() => onPickTimer(min)}
                      >
                        {min}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.srow}>
                  <span
                    className={styles.ri}
                    style={{ background: "var(--rose)" }}
                  >
                    <ChatIcon />
                  </span>
                  <div>
                    <div className={styles.sl}>Cheers</div>
                    <div className={styles.sd}>
                      {trail
                        ? "dino messages while you type"
                        : "little messages while you type"}
                    </div>
                  </div>
                  <div className={styles.ctl}>
                    <button
                      type="button"
                      className={pill(prefs.cheers)}
                      onClick={() => savePrefs({ cheers: !prefs.cheers })}
                    >
                      {prefs.cheers ? "On" : "Off"}
                    </button>
                  </div>
                </div>
                {/* Brightness, paleness and movement all dress the world's canvas,
              which Classic does not draw. */}
                {trail && (
                  <button
                    type="button"
                    className={clsx(
                      styles.advToggle,
                      advancedOpen && styles.advOpen,
                    )}
                    onClick={() => setAdvancedOpen((v) => !v)}
                    aria-expanded={advancedOpen}
                  >
                    <span className={styles.advLabel}>Advanced settings</span>
                    <span className={styles.advChevron} aria-hidden="true">
                      ▾
                    </span>
                  </button>
                )}
                {trail && advancedOpen && (
                  <div className={styles.advPanel}>
                    <div className={styles.srow}>
                      <span
                        className={styles.ri}
                        style={{ background: "var(--sky)" }}
                      >
                        <SunIcon size={20} color="#3d6b8a" />
                      </span>
                      <div>
                        <div className={styles.sl}>Brightness</div>
                        <div className={styles.sd}>
                          how bright the world looks
                        </div>
                      </div>
                      <div className={styles.ctl}>
                        <input
                          type="range"
                          className={styles.slider}
                          min={0.75}
                          max={1.25}
                          step={0.01}
                          value={prefs.brightness}
                          aria-label="Brightness"
                          onChange={(e) =>
                            savePrefs({ brightness: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                    <div className={styles.srow}>
                      <span
                        className={styles.ri}
                        style={{ background: "var(--seafoam)" }}
                      >
                        <span className={styles.swatch} />
                      </span>
                      <div>
                        <div className={styles.sl}>Brightness of colour</div>
                        <div className={styles.sd}>
                          soft and pale, or bright and bold
                        </div>
                      </div>
                      <div className={styles.ctl}>
                        <input
                          type="range"
                          className={styles.slider}
                          min={0}
                          max={1}
                          step={0.02}
                          // Slider reads left = pale, right = full colour, so invert.
                          value={1 - prefs.paleness}
                          aria-label="Colour"
                          onChange={(e) =>
                            savePrefs({ paleness: 1 - Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                    <div className={styles.srow}>
                      <span
                        className={styles.ri}
                        style={{ background: "var(--sage)" }}
                      >
                        <PawIcon size={20} color="#4a6b3a" />
                      </span>
                      <div>
                        <div className={styles.sl}>Movement</div>
                        <div className={styles.sd}>
                          how lively the animals and heroes are
                        </div>
                      </div>
                      <div className={styles.ctl}>
                        <input
                          type="range"
                          className={styles.slider}
                          min={0}
                          max={1}
                          step={0.02}
                          value={prefs.motion}
                          aria-label="Movement"
                          onChange={(e) =>
                            savePrefs({ motion: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <button type="button" className={styles.cta} onClick={onClose}>
          {trail ? "Back to the run!" : "Back to typing!"}
        </button>
      </div>
    </div>
  );
}
