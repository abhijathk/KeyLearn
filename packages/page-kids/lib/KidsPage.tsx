import {
  useAssessment,
  useAssessmentPartial,
  useAssessmentReset,
} from "@keylearn/assessment";
import { keyboardProps, KeyboardProvider } from "@keylearn/keyboard";
import { Lesson, lessonProps, LessonType } from "@keylearn/lesson";
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
  type ReactElement,
  type ReactNode,
  useCallback,
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
  LeafBookIcon,
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
import { KidsLessonLoader } from "./kids-lesson-loader.tsx";
import { deviceTier, type NightOverride, resolveNightStyle } from "./night.ts";
import { paceTarget } from "./pace.ts";
import { RoadCard } from "./road-card.tsx";
import { STORY, type StoryPart } from "./story.ts";
import { isSpoken, speakLine, stopSpeaking, unlockVoice } from "./voice.ts";
import {
  createKidsWorld,
  createLoaderScene,
  DINO_THEME,
  HERO_THEME,
  type KidsWorld,
  LANDS,
  pickLand,
  stagedHours,
  VILLAGE_THEME,
  type WorldId,
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

/**
 * Worlds whose cast is the children rather than creatures.
 *
 * Hero Trail and Village Road are both played as Dave, Little Drew or Peeli,
 * both offer a walking companion, both carry the pointer ring and both have a
 * real nightfall. Dino Run does none of that - you ARE the dinosaur there.
 *
 * Written as a predicate because the alternative is thirty-odd
 * `world === "hero"` tests that a third world silently falls out of: every one
 * of them would have sent Village Road down the dino branch, and every one of
 * them would still have compiled.
 */
const childCast = (w: WorldId) => w !== "dino";

type Prefs = {
  world: WorldId;
  dino: string;
  hero: string;
  /** Who the child plays as on Village Road. */
  village: string;
  /**
   * Flags reached since the last village, and the gap this run is waiting for.
   *
   * Villages fall every four to seven flags, and a flag is a round - but the
   * world is rebuilt once per session and has no memory of the rounds before
   * it. The count has to live with the rest of the saved preferences or a
   * child would meet a village every single session, which is the opposite of
   * rare. `villageGap` is redrawn each time one is spent so the rhythm never
   * settles into a pattern a child could learn.
   */
  villageFlags?: number;
  /**
   * WHAT THIS CHILD HAS ALREADY SEEN FOR THE FIRST TIME.
   *
   * A handful of moments are worth saying once and never again — the first
   * buffalo, the first lamp lit, the first milestone. Not "once per band":
   * once, ever. Cleared with the rest of a profile, so a fresh profile gets a
   * fresh village, which is the whole point of clearing one.
   */
  seen?: readonly string[];
  /**
   * Does the local boy walk with them? On by default.
   *
   * Off means every line that mentions him drops out of the pool rather than
   * being reworded — see `villagePool`. No context can empty out that way;
   * that is checked, not hoped for.
   */
  guide?: boolean;
  /**
   * Offer the story at all. On by default.
   *
   * Off means no button and no unread mark — but the parts keep unlocking
   * quietly in the background, so turning it back on months later finds the
   * story where the child actually is rather than back at part one.
   */
  story?: boolean;
  /**
   * How many parts have been opened, so the unread mark knows when to show.
   *
   * A count rather than a list: the parts only ever unlock in order, so the
   * number of them read is all there is to know, and a number survives the
   * story being re-cut far better than a list of titles would.
   */
  storyRead?: number;
  /**
   * Milestones passed on Village Road, across every session ever played.
   *
   * A stone in the ground does not reset because the page reloaded. The
   * number cut into it is the whole reward, so it counts up forever and the
   * world starts numbering from there rather than from one.
   */
  roadStones?: number;
  villageGap?: number;
  /**
   * Who walks the trail beside them, or null for nobody.
   *
   * A companion never types and never scores — it copies what the player
   * does, a beat later. Off by default: a second character on screen is a
   * second thing to look at, and that is a choice, not a gift.
   */
  /** @deprecated The single companion. Read through `companionsOf`. */
  companion: string | null;
  /**
   * Everyone walking with the child, at most two.
   *
   * A list because two people walking with you is two people, and the single
   * `companion` field could only ever answer "who is it" — a question with
   * one answer built into its shape. Kept beside the old field rather than
   * replacing it, so a profile saved before this still knows who its friend
   * was: `companionsOf` reads the list when there is one and falls back to
   * the single name when there is not.
   */
  companions?: readonly string[];
  /**
   * WHO WALKS WITH THE CHILD, KEPT SEPARATELY FOR EACH WORLD.
   *
   * The three worlds are three games. Village Road is a place people live and
   * offers everybody in it; Hero Trail is one hero and a dog; Dino Run has
   * nobody. One shared list could not mean the right thing in all three — a
   * child who walked the village road with Peeli and the robot arrived on the
   * Hero Trail still nominally accompanied by two people that world does not
   * have. Held per world, so each game remembers its own party and switching
   * finds it exactly as it was left.
   *
   * `companions` above stays as the pre-split value and is read as the
   * starting point for whichever world a profile was last in.
   */
  companionsByWorld?: Partial<Record<WorldId, readonly string[]>>;
  /**
   * What the Explorer is wearing.
   *
   * Only the garments a child has actually changed are stored, so an
   * untouched outfit is an empty object and stays whatever the artist
   * painted — including if those colours are ever repainted.
   */
  explorerColours?: ClothingColours;
  /**
   * What this child calls each character, by model id.
   *
   * A NAME BELONGS TO THE CHARACTER, NOT TO THE JOB. Dave renamed while he is
   * the hero is still called that when he turns up as somebody's companion
   * next week, because he is the same person — the child did not name a slot,
   * they named him. Keyed by model id (`Explorer`, `Peeli`, `Puppy`) for the
   * same reason the pickers are: it is what a saved profile already stores,
   * and it survives the label beside it being reworded.
   *
   * Only characters actually renamed appear here. Everyone else keeps the
   * name they shipped with, so a name can also be reset by clearing it.
   */
  names?: Record<string, string>;
  /**
   * The FIRST name a child ever gave, from the card that opens the game.
   *
   * Kept because it is what the coach calls them in a dozen lines of copy and
   * what a returning profile already has stored. `names` is layered over it:
   * whatever that card set is also written into `names` for the character it
   * was naming, so the two agree from then on.
   */
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
  /** @deprecated The shared night setting. Read through `nightStyleOf`. */
  nightStyle: NightOverride;
  /**
   * WHAT THE DARK MEANS, PER WORLD.
   *
   * Village Road's night is oil lamps and a lit temple; the Hero Trail's is
   * Lost Travellers and skeletons. They are not the same question, and one of
   * them does not even offer the spooky answers — so a parent who set "Extra
   * spooky" for the hero world was silently setting it for the village road
   * as well, where it is meaningless and where the pill to undo it is not
   * even on the row.
   */
  nightStyleByWorld?: Partial<Record<WorldId, NightOverride>>;
  /**
   * The drier voice for older learners (see PLAYFUL_SAYS). Off by default and
   * only offered from 9-10 up — the younger bands need the plain lines, which
   * are frequently the only prose on the page they read for themselves.
   */
  playful: boolean;
  /**
   * Whether the space bar hops.
   *
   * On by default, because it is the one key that does something in the world
   * and a child finds it in the first minute. Off for the learners it gets in
   * the way of: space comes once per word, so on a long passage the character
   * is airborne more often than not, and for a child who is watching their
   * own hands rather than the road a runner that will not stay on the ground
   * is one more thing moving. With it off, space is an ordinary keystroke and
   * they simply keep walking.
   */
  spaceJump: boolean;
  /**
   * WHAT HOUR VILLAGE ROAD IS LIT FOR.
   *
   * `"auto"` — the default — reads the child's own clock and folds it onto a
   * twelve-hour face, so the road is a ten o'clock morning when they play at
   * ten and an eight o'clock evening when they play at eight. See
   * `stagedHours` for why day and night each take a different one of the two
   * candidate hours.
   *
   * A number pins it: that hour by day, and its twin twelve hours round by
   * night. For a household that always practises after dark and would like
   * the road to be a morning anyway, and for looking at the thing.
   */
  dayHour: "auto" | number;
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
    // The same child, on the village road. Peeli is the world's own default
    // but a band that opens as Little Drew should stay Little Drew.
    village: band === "5-6" || band === "7-8" ? "Explorer6" : "Peeli",
    villageFlags: 0,
    roadStones: 0,
    villageGap: 4 + Math.floor(Math.random() * 4),
    companion: null,
    companions: [],
    explorerColours: {},
    name: "",
    names: {},
    seen: [],
    guide: true,
    story: true,
    storyRead: 0,
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
    spaceJump: true,
    dayHour: "auto",
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
  milestone: [
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
  stumble: [
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
  joins: [
    "An egg hatched — {friend} joined the herd!",
    "Crack… crack… out popped {friend}!",
    "A wild egg wobbled, and there was {friend}!",
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
  milestone: [
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
  stumble: [
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
  milestone: [
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
  stumble: [
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
  joins: [
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

// Village Road's voice. Warmer and slower than the hero world's, and about
// walking and arriving rather than questing and winning - the road is not a
// challenge to beat, it is a place to go through.
/**
 * THE YEAR THE ROAD IS SET IN, and how long ago that is.
 *
 * One constant, and the distance counted from today — never written down. The
 * first draft of these lines said "about ninety years", which was already
 * wrong when it was typed (it was ninety-six) and would have been wrong again
 * every January.
 */
const VILLAGE_YEAR = 1930;
/**
 * The local boy, by model id.
 *
 * Named once, here. Every line says {guide}, so if the character is ever
 * swapped for a different one this is the only line that changes.
 */
/**
 * The local boy, so he has a shipped name like everybody else.
 *
 * He is on none of the three cast lists — he is not somebody you play as and
 * not somebody you pick as a friend — so without this his "name" was the model
 * id falling through, which reads correctly today only because the file
 * happens to be called Abee. Rename the asset and the settings row would have
 * shown the filename.
 */
const GUIDE_CAST = [{ id: "Abee", label: "Abee" }] as const;

const VILLAGE_GUIDE = GUIDE_CAST[0].id;

/**
 * Everything that can be said.
 *
 * The shared contexts plus the ones only this road has. Village-only keys
 * resolve to nothing in the other two worlds and `speak` returns without
 * saying anything, which is the correct behaviour rather than a fallback: a
 * dinosaur valley has no buffalo to warn anybody about.
 */
type SayKey =
  | keyof typeof SAYS
  | "buffaloNotice"
  | "buffaloWarn"
  | "buffaloCharge"
  | "buffaloSafe"
  | "stared"
  | "nightfall"
  | "village";
const yearsBack = () =>
  String(Math.max(1, new Date().getFullYear() - VILLAGE_YEAR));

/**
 * HOW MUCH OF THE VILLAGE THIS CHILD HAS SEEN, 1 to 3.
 *
 * Driven by milestones walked, ever — not by keys learned, which is what the
 * `Young`/`Old` variants already follow. A child can be fluent at the keyboard
 * and new to the village, or the reverse, and the two axes say different
 * things: one is how well they type, this one is whether the buffalo is still
 * astonishing.
 */
export const bandOf = (stones: number): 1 | 2 | 3 =>
  stones <= 5 ? 1 : stones <= 18 ? 2 : 3;

/**
 * Which lines this context offers, given how far along this child is.
 *
 * Pure, exported and tested, because it is where four rules meet and any one
 * of them going wrong is silent: a child simply hears a slightly wrong line
 * and nobody ever knows. The rules, in order —
 *
 *   1. a once-ever line, if the pool has one and this child has not had it;
 *   2. otherwise the line set for their familiarity band;
 *   3. the guide's lines removed if he is switched off — but never all of
 *      them, because an empty pool means silence at a moment that wanted
 *      something said;
 *   4. and the ORDER preserved, because `pickSay` hands `list[0]` to every
 *      child using the "predictable" accessibility setting, so position one
 *      is not a draft, it is somebody's only line.
 */
export function villagePool(
  table: Readonly<Record<string, readonly string[] | undefined>>,
  key: string,
  band: 1 | 2 | 3,
  seen: readonly string[],
  guideOn: boolean,
): { lines: readonly string[]; firstEver: boolean } {
  const once = table[`${key}First`];
  const isFirst = once != null && once.length > 0 && !seen.includes(key);
  /*
   * A BARE KEY IS A REAL KEY.
   *
   * This used to read `${key}B${band}` and nothing else, which quietly made
   * every context written without bands unsayable: `buffaloWarn` and
   * `buffaloCharge` have one list each and no banded variants, so they
   * resolved to an empty pool on every single call and the two most urgent
   * lines in the game were never once shown to anybody. The comment on the
   * table below had said "a bare key is said at any distance" the whole time;
   * only the resolver disagreed.
   *
   * The fallback is deliberately narrow. It applies only when the key has NO
   * banded variants at all — because `VILLAGE_SAYS` is spread over the shared
   * table, so a banded village context whose own band happened to be missing
   * would otherwise fall through to the shared bare key and say something
   * about a dinosaur on a road in Malabar.
   */
  const banded = table[`${key}B${band}`];
  const anyBand =
    table[`${key}B1`] != null ||
    table[`${key}B2`] != null ||
    table[`${key}B3`] != null;
  const chosen = isFirst
    ? once
    : (banded ?? (anyBand ? [] : (table[key] ?? [])));
  if (guideOn) {
    return { lines: chosen, firstEver: isFirst };
  }
  const without = chosen.filter((l) => !l.includes("{guide}"));
  return {
    lines: without.length > 0 ? without : chosen,
    firstEver: isFirst,
  };
}

/**
 * Village Road's own voice.
 *
 * Generated from the script document rather than typed out, so what ships is
 * exactly what was reviewed. Suffixes: `First` is said once ever, `B1`/`B2`/`B3`
 * are the familiarity bands, and a bare key is said at any distance.
 */
export const VILLAGE_SAYS = {
  ...SAYS,
  startFirst: [
    "You're {years} years from home, and the road only goes one way. Off we go.",
  ],
  startB1: [
    "No cars, no phones, no wires — just a red road. Off we go!",
    "{name} steps onto the road. None of this has been invented yet!",
    "Coconut palms, red earth, and not one screen anywhere. Let's walk!",
  ],
  startB2: [
    "Back on the red road. Every letter is a step.",
    "{guide} is waiting up ahead. Every letter is a step towards him.",
    "The paddy is up again. Let's walk!",
  ],
  startB3: [
    "You know the way by now. Off we go.",
    "{guide} doesn't even wave any more — he just falls in beside you.",
    "Same road, same stones. Let's see how far today.",
  ],
  cheer: [
    "Lovely steady walking!",
    "You kept going — that's the whole trick!",
    "Nice and steady, just like that!",
    "The road is easy when you walk it like that!",
    "{guide} can barely keep up with you!",
  ],
  cheerYoung: [
    "WOW! Look at those fingers go!",
    "You did that all by yourself!",
    "{guide} has never seen anybody move like that!",
    "{name} does a little skip down the red road!",
    "Super typing! The village is getting closer!",
  ],
  cheerCool: [
    "Clean. Keep that rhythm.",
    "Smooth — {guide} is jogging to keep up.",
    "Nice run building.",
    "{name} nods, impressed.",
    "That's the pace. Steady and sharp.",
  ],
  streak: [
    "TEN perfect steps down the red road!",
    "Ten in a row! {guide} is counting on his fingers.",
    "Ten straight — your fingers know {year} by heart!",
    "Ten in a row. Even the buffalo looked up.",
  ],
  miss: [
    "Whoops — {name} stopped. The glowing key shows the way.",
    "Oops! No rush — find the glowing key.",
    "{name} stubbed a toe on a stone. {guide} helps them up!",
    "Not that one — but you're SO close. Look for the glow!",
    "Wrong step! Peek at the glowing key and try again.",
  ],
  stumble: [
    "Oof! Take a breath — then look for the glowing key.",
    "That one got away. Shake your hands out and try the glow.",
    "{guide} waits. Nobody hurries anybody on this road.",
    "Everybody stumbles here. Breathe, then find the glow.",
  ],
  stuck: [
    "Look — the {letter} key! Your {finger} presses it.",
    "The {letter} key is right there, under your {finger}.",
    "Try this: find your {finger}, then press {letter} gently.",
  ],
  stuckSpace: [
    "Look — the space bar! A thumb presses it.",
    "The big long key at the bottom — give it a thumb tap.",
    "The gap between two words is the space bar. Thumb!",
  ],
  wake: [
    "The {letter} key is awake — back to the road!",
    "{letter} is your friend now. Onward!",
    "You woke {letter} up! The road carries on.",
  ],
  wave: [
    "{name} waves. Hello — still there?",
    "{name} stops and waves. Ready when you are!",
    "{guide} waves from further up the road. Shall we?",
    "{name} turns round and gives you a big wave.",
    "{name} waves, just in case you were looking.",
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
    "{name} looks back up the road and waves.",
  ],
  crouch: [
    "{name} crouches down at the roadside. No rush!",
    "{name} is having a little rest. Press a key when you're ready.",
    "{name} kneels in the red earth — they've never seen soil this colour.",
    "A breather by the road. {guide} waits too.",
    "{name} rests on one knee and watches the paddy.",
  ],
  crouchYoung: [
    "{name} is waiting for youuu!",
    "{name} sits on their heels by the road. Ready?",
    "{name} is being very, very patient!",
  ],
  crouchOld: [
    "{name} settles by the roadside. Take your time.",
    "{name} drops to a crouch. In your own time.",
    "No hurry. {name} will hold this spot.",
  ],
  sit: [
    "{name} sits down in the shade. Press any key when you're ready!",
    "Comfy here! One key and we're off again.",
    "{name} is sitting under a palm, watching the fields.",
    "{name} crosses their legs by the road. Come back whenever.",
    "{name} watches the paddy shift in the wind. One key wakes them.",
  ],
  sitYoung: [
    "{name} is sitting down! Press a key and we can go!",
    "{name} is having a sit-down in the shade. Wake them with a key!",
    "Plonk! {name} sits in the red earth. Press a key when you want to walk!",
  ],
  sitOld: [
    "{name} takes a seat. Press a key whenever you want to carry on.",
    "{name} sits down to wait it out. No rush.",
    "{name} settles cross-legged in the shade. Pick it up whenever.",
  ],
  idleFirst: [
    "{name} is staring at a lamp burning on a stone. No switch. No wire.",
  ],
  idleB1: [
    "{name} is staring at an oil lamp. They've only ever seen bulbs.",
    "{guide} is showing {name} something. One key and you're off.",
    "{name} is trying to work out where the wires go. There aren't any.",
  ],
  idleB2: [
    "{name} is waiting — press the glowing key!",
    "{name} looks back at you. Ready to walk on?",
    "A dragonfly lands on {name}'s shoulder. Press a key to shoo it!",
  ],
  idleB3: [
    "{name} knows the next vazhivilakku is round the bend. Press a key.",
    "Still here. {name} could walk this stretch with their eyes shut.",
    "{name} is counting the stones to the market. One key and off you go.",
  ],
  idleYoung: [
    "{name} peeps up at you — press the glowing key!",
    "{name} is poking a stick into the red mud. Press a key!",
    "{name} chews a blade of grass and blinks — one glowing key, please!",
    "{name} plops down in the dust. Press a key to bounce them up!",
    "{name} is counting coconuts. The glowing key stops them!",
  ],
  idleOld: [
    "{name} stands tall, waiting for your next key.",
    "{name} scans the road ahead. One glowing key and you walk on.",
    "{name} watches smoke rise from a cooking fire. Press the glowing key.",
    "{name} gives a slow, steady nod. Ready when you are.",
    "{name} shades their eyes and waits, calm and patient.",
  ],
  milestoneFirst: [
    "Your first milestone! +10. Somebody carved that number by hand.",
    "Your first milestone! +10. {guide} explains: the number is how far you have come.",
  ],
  milestoneB1: [
    "You reached the stone! +10. Older than all of you, that stone.",
    "MILESTONE! +10 — {guide} reads the number out loud.",
    "That number was carved long before you were born. +10!",
  ],
  milestoneB2: [
    "Another milestone behind you. +10!",
    "Stone passed! {name} looks back at how far you've come. +10.",
    "That's another one. +10.",
  ],
  milestoneB3: [
    "Stone {stone}. +10. You know this road now.",
    "{name} touches the stone as they pass, the way {guide} does. +10.",
    "Another one down. +10. The market is two stones ahead.",
  ],
  grow: [
    "A new key joined your trail — the road opens up!",
    "New key! You're a {stage} now.",
    "Another letter is yours. {stage} suits you.",
    "A new key — the road ahead just got longer.",
    "One more letter learned. {guide} is impressed, and says so.",
  ],
  growYoung: [
    "A NEW KEY! That's another letter you know!",
    "Look — a brand new key on your road!",
    "One more letter! You're a {stage} now!",
  ],
  growOld: [
    "Another key. Not many left on this road now.",
    "A new letter — {stage}, and earning it.",
    "One more key. The whole board is nearly yours.",
  ],
  joins: [
    "{friend} has come to walk with you!",
    "Look who's caught up — {friend}!",
    "{friend} falls in beside you. The village has never seen anything like it.",
  ],
  crossed: [
    "A whole new stretch of road, and nobody here has a map.",
    "Chapter {chapter}! New palms, new stones, same brave typist.",
    "You crossed over — welcome to {land}!",
    "New land, new road. The next stone is waiting.",
  ],
  graduate: [
    "That's the WHOLE alphabet — every letter on this road is yours.",
    "You know every single letter! {guide} has never met anyone who could.",
    "Twenty-six letters, learned {years} years before you were born.",
  ],
  timerEnd: [
    "Time to head home — all the way home. Wonderful walking today!",
    "The lamps are being lit. You did wonderfully today.",
    "{guide} waves goodbye from the roadside. Same time tomorrow?",
    "That's the day's walking done. Rest those fingers!",
  ],
  nightfallFirst: [
    "The lamps are being lit, one by one, all down the road. Nobody flicked a switch.",
  ],
  nightfallB1: [
    "It's getting dark. Somebody is going round lighting the lamps.",
    "{name} has never seen a road this dark. Or this full of little fires.",
    "No street lights. Just oil, in stone.",
  ],
  nightfallB2: [
    "Lamps are going on down the road. Keep walking.",
    "Evening. The market is still open, though.",
    "The paddy has gone dark. The road has not.",
  ],
  nightfallB3: [
    "Lamps are lit. You know the way in the dark by now.",
    "Evening on the road. Same as always.",
    "{name} doesn't even slow down when the light goes.",
  ],
  villageFirst: [
    "A village! Houses, a market, a temple behind the big tree. People live here.",
  ],
  villageB1: [
    "A temple, behind the banyan. You only see it through the branches.",
    "There's the market. {guide} says the bright hissing lamp is a petromax.",
    "The stone bench round the tree is called an althara.",
  ],
  villageB2: [
    "The market is up ahead. Mind the cart.",
    "Past the althara, then the temple. You know this bit.",
    "The petromax is lit. Somebody is still trading.",
  ],
  villageB3: [
    "Same cart, same spot, still half unloaded.",
    "The village again. {guide} nods at somebody outside the market.",
    "Through the village and out the other side. You barely look up.",
  ],
  buffaloNoticeFirst: [
    "{name} has stopped dead. They have never been near anything this big.",
  ],
  buffaloNoticeB1: [
    "The buffalo has looked up. {name} has only seen these in books.",
    "A head comes up in the field. {guide} says: don't run.",
    "{name} goes very quiet. It is much bigger up close.",
  ],
  buffaloNoticeB2: [
    "That buffalo is watching you. Steady now.",
    "Head up in the paddy. You know this one.",
    "{guide} has already stopped walking. So should you.",
  ],
  buffaloNoticeB3: [
    "Here we go. It always does this by the third stone.",
    "The buffalo looks up. {name} barely glances at it.",
    "Same buffalo, same field, same look.",
  ],
  buffaloWarn: [
    "Head down — keep typing!",
    "{guide} is shouting something — GO!",
    "Hooves shifting in the mud — go, go, go!",
    "Don't stop now — type!",
    "It's coming. Fingers moving!",
  ],
  buffaloCharge: [
    "It's running! Keep going — don't look back!",
    "The buffalo is charging — type!",
    "Hooves behind you — faster!",
    "Go, {name}, go!",
  ],
  buffaloSafeFirst: [
    "It stopped. It was never going to reach you — but nobody told {name} that.",
    "It stopped. {guide} is laughing — he knew all along it would.",
  ],
  buffaloSafeB1: [
    "The buffalo stops short and snorts. You're fine.",
    "Back to the grass it goes. {guide} says they always do that.",
    "{name} is still shaking. {guide} is not.",
  ],
  buffaloSafeB2: [
    "It pulled up. Just showing off.",
    "All that fuss — and it only wanted the field. Walk on.",
    "Back to the grass. You barely broke step.",
  ],
  buffaloSafeB3: [
    "Told you. Walk on.",
    "It never gets any further than that. Never has.",
    "{name} does not even look round this time.",
  ],
  staredFirst: [
    "Everyone has stopped to look at you. Nobody here dresses like that.",
  ],
  staredB1: [
    "Two women by the well have stopped talking to watch you pass.",
    "A boy is staring at your shoes. He has never seen shoes like that.",
    "They are all looking at the robot. Of course they are.",
  ],
  staredB2: [
    "They know the dog by now. The robot, never.",
    "Somebody at the market points at the robot and says something to {guide}.",
    "Heads turn as you pass. You are getting used to it.",
  ],
  // ── PLAIN KEYS FOR THE BANDED CONTEXTS ────────────────────────────────
  //
  // `VILLAGE_SAYS` spreads `...SAYS`, so any context this table does not name
  // still answers with the dinosaur valley's words. The three banded contexts
  // below had no plain key of their own — and while the resolver always finds
  // a band first, "always" is doing a lot of work there: one missing band, one
  // typo in a suffix, and a child on a Kerala road is told the herd is walking
  // home to the Green Valley. These are the safety net, set to what band 2
  // says, which is the version that reads correctly at any distance.
  start: [
    "Back on the red road. Every letter is a step.",
    "The paddy is up again. Let's walk!",
  ],
  idle: [
    "{name} is waiting — press the glowing key!",
    "{name} looks back at you. Ready to walk on?",
  ],
  milestone: [
    "Another milestone behind you. +10!",
    "Stone passed! {name} looks back at how far you've come. +10.",
  ],
  staredB3: [
    "Nobody looks up any more. You are just the children from the road.",
    "Somebody waves at {name} by name. That's new.",
    "Only the robot still turns heads, and only the small ones.",
  ],
} as const;

/**
 * WHAT A KERALA ROAD SAYS AFTER DARK.
 *
 * Village Road used to borrow the Hero Trail's night lines, because the test
 * that adds them is `world !== "dino"` — so half of what a child heard after
 * dark on this road was about lanterns, a party and mist, and if the night
 * style was not quiet it also pulled in the Lost Travellers, who do not exist
 * here. Its night is a real and specific thing now: eight in the evening, the
 * lamps lit one at a time, the market still trading, and a buffalo somewhere
 * out in the black.
 */
const VILLAGE_NIGHT_SAYS: Partial<Record<string, readonly string[]>> = {
  startB1: [
    "It is dark already, and the lamps are lit. Off we go.",
    "The road is a line of little fires tonight. Every letter is a step.",
  ],
  startB2: [
    "Lamps lit, road open. Let's walk.",
    "Evening on the red road. Off we go!",
  ],
  startB3: ["You know this road in the dark by now. Off we go."],
  idleB1: [
    "{name} is watching a flame in a stone. It has not gone out yet.",
    "It is very dark out past the lamps. Press the glowing key.",
  ],
  idleB2: [
    "The road waits between one lamp and the next. One glowing key.",
    "{name} looks back down the line of lamps. Ready?",
  ],
  idleB3: ["{name} could walk this in the dark. Nearly is. Press a key."],
  wave: [
    "{name} waves in the lamplight. Still there?",
    "A wave out of the dark — {name} is still with you.",
  ],
  crouch: ["{name} crouches down inside a pool of lamplight, and waits."],
  sit: ["{name} sits down under a lamp. Press a key when you're ready."],
  milestoneB2: ["Another stone, found in the dark. +10!"],
  timerEnd: [
    "The lamps will burn a while yet. Wonderful walking today!",
    "Time to stop. The road keeps its lights on.",
  ],
};

/**
 * The dry version, for the Cheeky coach setting — this world's own.
 *
 * `PLAYFUL_SAYS` is one table for all three worlds, so a child who turned this
 * on for Village Road got the dry version of somebody else's jokes. These sit
 * alongside the plain lines rather than replacing them, exactly as the shared
 * ones do, so anything a learner actually needs is still said straight by
 * whichever line comes up next.
 */
const VILLAGE_PLAYFUL_SAYS: Partial<Record<string, readonly string[]>> = {
  cheer: [
    "The road is not going anywhere, but well done anyway.",
    "Efficient. The buffalo is taking notes.",
  ],
  miss: [
    "That key was not the one. The glowing one is a clue.",
    "Bold choice. Wrong, but bold.",
  ],
  stumble: ["Everyone stops here. Everyone. Breathe."],
  idleB2: ["The road is still there. It will wait. It is a road."],
  idleB3: ["{name} has counted the stones twice now."],
  milestoneB2: ["Another rock with a number on it. +10, though."],
  buffaloSafeB2: ["Tremendous running. From a cow, essentially."],
};

/** What the runner is called before a child gives them a name. */
const defaultWhoName = (w: WorldId) =>
  w === "village" ? "Your friend" : w === "hero" ? "Your hero" : "Your dino";

const saysOf = (world: WorldId, classic = false) =>
  classic
    ? (CLASSIC_SAYS as unknown as typeof SAYS)
    : world === "village"
      ? (VILLAGE_SAYS as unknown as typeof SAYS)
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

// Village Road grows as how far along the road you have walked, and how well
// the village knows you. Not ranks earned and not ages reached: this world has
// no quest to rise through and the child is not a creature growing up, they
// are somebody walking a road that people live along.
function villageStage(age: number): string {
  if (age < 0.05) {
    return "Newcomer";
  }
  if (age < 0.3) {
    return "Walker";
  }
  if (age < 0.6) {
    return "Traveller";
  }
  if (age < 0.95) {
    return "Wayfarer";
  }
  return "Pathfinder";
}

/** The growth label for whichever world this is. */
const stageOf = (w: WorldId) =>
  w === "village" ? villageStage : w === "hero" ? heroStage : dinoStage;

/** What that growth label is CALLED, above the value. */
const stageLabel = (w: WorldId) =>
  w === "village" ? "Road level" : w === "hero" ? "Hero level" : "Dino stage";

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
  // KNIGHT AND SKELETON FIRST. This is the world where you are a hero out of
  // a story, and those two are what it is FOR — the two children are here
  // because a child who does not want to be either of them should not be
  // shut out, not because they are what this trail is about. Village Road is
  // where they lead.
  { id: "Knight", label: "Knight" },
  { id: "Skeleton_Warrior", label: "Skeleton" },
  // The ids stay `Explorer` and `Explorer6`: they are the model filenames,
  // and they are what a saved profile has already stored. Renaming those
  // would silently reset every child's choice back to whoever is first.
  { id: "Explorer", label: "Dave" },
  { id: "Explorer6", label: "Little Drew" },
] as const;

/**
 * Village Road's cast: the three children, and nobody else.
 *
 * No Knight, no Skeleton. A paddy field is not a quest, and the whole reason
 * this world exists as a third rather than a re-skin of Hero Trail is that
 * what you meet on it is a place people live in rather than a party of
 * adventurers. The earnable companions are handled by HATCHLINGS, as
 * everywhere else.
 */
const VILLAGE_CHARACTERS = [
  // ONE ORDER FOR THE THREE OF THEM, EVERYWHERE: Dave, Peeli, Little Drew.
  //
  // Oldest to youngest, which is how they are drawn and how the hero world
  // already lists them. This row used to open with Peeli on the grounds that
  // she is the village's default — but a picker that reorders itself by world
  // makes a child hunt for a face that was second a moment ago, and the
  // default is shown by the pill that is lit, not by which one is first.
  { id: "Explorer", label: "Dave" },
  { id: "Peeli", label: "Peeli" },
  { id: "Explorer6", label: "Little Drew" },
] as const;

/**
 * The name a child knows somebody by, from whichever list they are on.
 *
 * The tables are keyed by MODEL FILENAME — `Explorer`, `Explorer6` — because
 * that is what a saved profile stores, and every one of them carries the real
 * name beside it. This is the one place that asks all of them, so the loading
 * card can name the hero before a single byte of the hero has arrived.
 */
/**
 * The longest name a character may be given.
 *
 * Ten. The name is printed on the loading card, in the settings pills and in
 * the coach's lines, and those are laid out for a word rather than a
 * sentence — the pills wrap and the loading row, which never wraps, simply
 * runs out of room. Enforced in the code as well as on the input, because
 * `maxLength` stops typing and does not stop a paste.
 *
 * THE SHIPPED NAMES ARE EXEMPT, and deliberately so: "Little Drew" is eleven
 * characters and has been fitting on that row since the day he was drawn.
 * The limit is on what a child may ADD, which is the thing that has no
 * bound; it is not a rule about how long a name may be, so it is applied
 * where a name is typed rather than where one is read.
 */
const NAME_MAX = 10;

const shippedLabel = (id: string): string =>
  [
    ...HERO_CHARACTERS,
    ...VILLAGE_CHARACTERS,
    ...COMPANIONS,
    ...GUIDE_CAST,
  ].find((c) => c.id === id)?.label ?? id;

/**
 * What to call somebody: the child's own name for them if they gave one,
 * otherwise the name they shipped with.
 *
 * Every label that names a character goes through here — the pickers, the
 * loading card, the coach — so renaming somebody renames them everywhere at
 * once rather than in the places somebody remembered to update.
 */
const castLabel = (id: string, names?: Record<string, string>): string => {
  const own = names?.[id]?.trim();
  return own != null && own !== "" ? own : shippedLabel(id);
};

/** The cast a world offers as the character a child plays AS. */
const charactersOf = (w: WorldId) =>
  w === "village"
    ? VILLAGE_CHARACTERS
    : w === "hero"
      ? HERO_CHARACTERS
      : ([{ id: "TRex", label: "Rex" }] as const);

/**
 * Can this world actually be played AS this character?
 *
 * Dino Run's cast is the T-Rex and whatever has hatched — its hatchlings are
 * characters, where the other worlds' are companions. Hero Trail and Village
 * Road each have a fixed list.
 */
const playableIn = (world: WorldId, id: string): boolean =>
  world === "dino"
    ? id === "TRex" || HATCHLINGS.dino.some((h) => h.id === id)
    : (world === "hero" ? HERO_CHARACTERS : VILLAGE_CHARACTERS).some(
        (c) => c.id === id,
      );

/** What the dark means in this world — see Prefs.nightStyleByWorld. */
const nightStyleOf = (
  p: Pick<Prefs, "nightStyle" | "nightStyleByWorld" | "world">,
): NightOverride => {
  const own = p.nightStyleByWorld?.[p.world] ?? p.nightStyle;
  // The village has no spooky. A value carried in from another world — or
  // from before the split — resolves to its quiet night rather than to
  // nothing at all.
  return p.world === "village" && (own === "mild" || own === "full")
    ? "auto"
    : own;
};

/** Who a world falls back to when the saved choice is not one of its own. */
const DEFAULT_CHAR: Readonly<Record<WorldId, string>> = {
  dino: "TRex",
  hero: "Knight",
  village: "Peeli",
};

/**
 * Who this learner is playing as, in whichever world they are in.
 *
 * CHECKED AGAINST THAT WORLD'S CAST, not just read out of storage. A saved
 * choice can stop being a valid one — Peeli was on the Hero Trail's list
 * until its cast was cut back to the knight, the skeleton and the two
 * children — and a stale id is worse than a wrong one: the world happily
 * loads her, the settings show no pill lit because she is not on the row any
 * more, and the game and the panel disagree about who the child is. Falling
 * back here fixes both at once, because both read this.
 */
const charOf = (p: Pick<Prefs, "world" | "dino" | "hero" | "village">) => {
  const saved =
    p.world === "village" ? p.village : p.world === "hero" ? p.hero : p.dino;
  return playableIn(p.world, saved) ? saved : DEFAULT_CHAR[p.world];
};

/**
 * Who may come along, for now.
 *
 * Only the three siblings — a companion is somebody a child recognises as
 * another child, and a skeleton walking behind them is a different idea
 * entirely. The list is filtered against the current hero at the point of
 * use, so it can never offer you yourself.
 */
const COMPANIONS = [
  // The same order the character rows use — see VILLAGE_CHARACTERS.
  { id: "Explorer", label: "Dave" },
  { id: "Peeli", label: "Peeli" },
  { id: "Explorer6", label: "Little Drew" },
  // Companion only, and deliberately absent from HERO_CHARACTERS above: it
  // is somebody's robot, not somebody a child plays as.
  { id: "Robot", label: "Robot" },
  { id: "Puppy", label: "Puppy" },
] as const;

/**
 * Braille, for the loading card — as DOT PATTERNS, not as characters.
 *
 * A typing app is a machine for turning a hand movement into a letter, and
 * braille is the same idea in the other direction — so the world arrives as
 * cells and resolves into words while the scene is built.
 *
 * Braille rather than morse for one specific reason: a braille cell occupies
 * ONE column, so it can turn into its letter on the spot. Morse runs two to
 * five characters per letter, so a name resolving out of it shoves the rest
 * of the line sideways on every step — the text crawls, and what should read
 * as a word coming into focus reads as a layout bug.
 *
 * The numbers below are the six dots as a bitmask (dot 1 = 1, dot 2 = 2, dot
 * 3 = 4, dot 4 = 8, dot 5 = 16, dot 6 = 32), and the cells are DRAWN from
 * them rather than written as U+28xx characters. That is not fussiness: the
 * monospace stack this row is set in carries no Braille Patterns block, so
 * every single cell came out as the font's missing-glyph box — six dots in a
 * rectangle, identical for every letter, which is the one thing a braille
 * cell must never be. Drawing them means the letters are right on every
 * machine, whatever fonts it happens to have.
 */
const BRAILLE: Readonly<Record<string, number>> = {
  "a": 0b000001,
  "b": 0b000011,
  "c": 0b001001,
  "d": 0b011001,
  "e": 0b010001,
  "f": 0b001011,
  "g": 0b011011,
  "h": 0b010011,
  "i": 0b001010,
  "j": 0b011010,
  "k": 0b000101,
  "l": 0b000111,
  "m": 0b001101,
  "n": 0b011101,
  "o": 0b010101,
  "p": 0b001111,
  "q": 0b011111,
  "r": 0b010111,
  "s": 0b001110,
  "t": 0b011110,
  "u": 0b100101,
  "v": 0b100111,
  "w": 0b111010,
  "x": 0b101101,
  "y": 0b111101,
  "z": 0b110101,
  // Digits are the first ten letters in braille; the number sign that
  // normally precedes them is left off, since this is a decoration
  // resolving into a word rather than a passage anybody reads as braille.
  "1": 0b000001,
  "2": 0b000011,
  "3": 0b001001,
  "4": 0b011001,
  "5": 0b010001,
  "6": 0b001011,
  "7": 0b011011,
  "8": 0b010011,
  "9": 0b001010,
  "0": 0b011010,
};

/**
 * The six dots, in the order they are laid out in the cell.
 *
 * A braille cell reads down the left column and then down the right:
 *
 *     1  4
 *     2  5
 *     3  6
 *
 * The grid fills left-to-right, top-to-bottom, so the bits are listed in the
 * order the boxes appear rather than in numerical order. Getting this pair
 * swapped produces cells that look plausible and spell something else.
 */
const CELL_ORDER = [0, 3, 1, 4, 2, 5] as const;

/**
 * A line that arrives in braille and resolves, once, and then stays put.
 *
 * The loading card's other line is a ticker of many names; this is for a
 * single line that is already known when the card goes up — the chapter and
 * the place — so it resolves left to right and is simply text from then on.
 * It reveals again only when the text itself changes, which is to say when
 * the child crosses into a new chapter.
 */
function Reveal({ text }: { text: string }): ReactElement {
  const [cut, setCut] = useState(0);
  useEffect(() => {
    setCut(0);
  }, [text]);
  useEffect(() => {
    if (cut >= text.length) {
      return;
    }
    const id = setTimeout(() => setCut((c) => c + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [cut, text]);
  return (
    <>
      {text.split("").map((ch, i) => {
        // A RUNNING EDGE OF CELLS, not the whole word and not just one.
        //
        // The whole word in braille resolving left to right shows the shape
        // of the answer before it is sent, and reads as a word fading in
        // rather than as one arriving. A single cell reads as a stutter. What
        // works is a short wave: by the time the first cell has become its
        // letter the third is already forming, so there is always something
        // coming as well as something arriving.
        //
        // Everything past the wave is an empty slot of exactly the same
        // width, so the line never moves while it is being written.
        const mask = BRAILLE[ch.toLowerCase()];
        const ahead = i - cut;
        return (
          <Slot key={i}>
            {ahead < 0 ? (
              ch
            ) : ahead >= CELL_LEAD ? (
              ""
            ) : mask == null ? (
              ch
            ) : (
              <Cell mask={mask} />
            )}
          </Slot>
        );
      })}
    </>
  );
}

/**
 * ONE CHARACTER'S WORTH OF SPACE, holding either the cell or the letter.
 *
 * Both go in the same box, and that is the whole trick. Sitting a drawn cell
 * and a text glyph next to each other in the line and hoping they agree does
 * not work: an inline box aligns by its own baseline rule and a glyph by the
 * font's, so the cell sat low and the letter appeared to rise into place from
 * underneath it. A fixed slot with the content centred in it has no baseline
 * to disagree about — the contents are swapped and nothing moves at all.
 */
function Slot({ children }: { children: ReactNode }): ReactElement {
  return <span className={styles.loadSlot}>{children}</span>;
}

/** One braille cell, drawn. `mask` is the six dots — see BRAILLE. */
function Cell({ mask }: { mask: number }): ReactElement {
  return (
    <span className={styles.loadCell}>
      {CELL_ORDER.map((bit) => (
        <i
          key={bit}
          className={(mask & (1 << bit)) !== 0 ? styles.dotOn : styles.dotOff}
        />
      ))}
    </span>
  );
}

/**
 * How many cells stand ahead of the resolved text.
 *
 * Three, so that the moment the first cell becomes its letter the third is
 * already on screen forming. Two reads as a stutter and four starts to give
 * the whole word away before it has been sent.
 */
const CELL_LEAD = 3;

/** How long each letter waits before it resolves, and how long a name is held. */
const STEP_MS = 28;
const HOLD_MS = 420;

/**
 * The names of the things being built, arriving in braille and resolving.
 *
 * Fed through a REF rather than through state, and that is not a detail: the
 * world reports two or three dozen pieces as it builds, and routing each one
 * through `useState` re-rendered the whole of KidsPage — a component with the
 * lesson, the keyboard, the HUD and the settings inside it — thirty times
 * during the one stretch where the machine is already busy loading models.
 * That was the lag. Nothing above this component needs to know which name is
 * showing, so nothing above it is told: the queue is a box the world drops
 * names into and this component takes them out on its own clock.
 */
function LoadStep({
  queueRef,
  active,
  settling,
  onDone,
}: {
  queueRef: { current: string[] };
  active: boolean;
  /** The world itself has finished; the only thing left is this ticker. */
  settling: boolean;
  /** Called once, when the last name has been shown and read. */
  onDone: () => void;
}): ReactElement {
  // Everything the ticker owns lives in refs and it asks for one render when
  // something actually changed. Driving it through `useState` meant writing
  // `setWord` from inside a `setCut` updater — a side effect in a reducer,
  // which React is free to call twice, and which duly lost names.
  const wordRef = useRef("");
  const cutRef = useRef(0);
  const heldRef = useRef(0);
  /** Every name shown so far, replayed when the queue runs dry. */
  const shownRef = useRef<string[]>([]);
  const seenAtRef = useRef(0);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!active) {
      return;
    }
    const id = setInterval(() => {
      // ── THE WORLD IS READY: GET OFF THE SCREEN ────────────────────────
      //
      // Finish the name that is on screen, at speed, and go. The backlog is
      // dropped on the floor deliberately.
      //
      // Waiting for the queue to play out was the first attempt and it was
      // worse than the bug it fixed: the ticker shows one name at a time with
      // a 420ms hold on each, so a scene with a dozen models still had
      // seconds of names to get through after the last file had landed, and
      // the child sat watching a loading screen for a world that was already
      // built. The queue is a nicety — it tells you what is being added — and
      // a nicety must never hold the door.
      //
      // What is worth keeping is not cutting a name off mid-word: a loader
      // that vanishes halfway through spelling "Peeli" looks broken. So the
      // current name finishes, three cells a tick instead of one, gets a
      // fifth of a second to be read, and that is the whole of the wait.
      if (settling) {
        queueRef.current.length = 0;
        if (wordRef.current === "") {
          onDone();
          return;
        }
        if (cutRef.current < wordRef.current.length) {
          cutRef.current = Math.min(wordRef.current.length, cutRef.current + 3);
          bump();
          return;
        }
        heldRef.current += STEP_MS;
        if (heldRef.current >= 200) {
          onDone();
        }
        return;
      }
      if (wordRef.current === "") {
        const next = queueRef.current.shift();
        if (next == null) {
          return;
        }
        wordRef.current = next;
        cutRef.current = 0;
        heldRef.current = 0;
        // Kept for the replay above, so a dry queue still has something true
        // to show.
        if (!shownRef.current.includes(next)) {
          shownRef.current.push(next);
        }
        bump();
        return;
      }
      if (cutRef.current < wordRef.current.length) {
        cutRef.current += 1;
        bump();
        return;
      }
      // Resolved. Hold it long enough to be read, then take the next — but
      // only when there IS a next. A name left standing reads as the thing
      // being built right now; a row that empties itself between names reads
      // as a loader that has stalled, which is the one impression a loading
      // screen must never give.
      heldRef.current += STEP_MS;
      if (heldRef.current < HOLD_MS) {
        return;
      }
      if (queueRef.current.length > 0) {
        wordRef.current = "";
        bump();
        return;
      }
      // NOTHING QUEUED, AND THE WORLD IS NOT DONE EITHER.
      //
      // This is the stall. The name used to be left standing here — the
      // reasoning being that a row which empties itself reads as a loader
      // that has given up. But the queue runs dry long before the build
      // does: every model is NAMED early and then spends seconds being
      // parsed and placed, so the last name sat frozen for most of the load
      // and read as exactly the thing it was meant to avoid.
      //
      // So it goes round again. The names already shown are replayed, oldest
      // first, which is honest — those are the things in the scene — and the
      // row never stops moving while there is still work going on.
      if (shownRef.current.length > 0) {
        seenAtRef.current = (seenAtRef.current + 1) % shownRef.current.length;
        wordRef.current = shownRef.current[seenAtRef.current]!;
        cutRef.current = 0;
        heldRef.current = 0;
        bump();
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [active, queueRef, settling, onDone]);

  const word = wordRef.current;
  const cut = cutRef.current;

  if (word === "") {
    return <div className={styles.loadStep} aria-hidden="true" />;
  }
  return (
    // aria-hidden: decoration over a load the page already announces, and a
    // screen reader spelling out braille cells is nobody's idea of progress.
    <div className={styles.loadStep} aria-hidden="true">
      {word.split("").map((ch, i) => {
        // A RUNNING EDGE OF CELLS, not the whole word and not just one.
        //
        // The whole word in braille resolving left to right shows the shape
        // of the answer before it is sent, and reads as a word fading in
        // rather than as one arriving. A single cell reads as a stutter. What
        // works is a short wave: by the time the first cell has become its
        // letter the third is already forming, so there is always something
        // coming as well as something arriving.
        //
        // Everything past the wave is an empty slot of exactly the same
        // width, so the line never moves while it is being written.
        const mask = BRAILLE[ch.toLowerCase()];
        const ahead = i - cut;
        return (
          <Slot key={i}>
            {ahead < 0 ? (
              ch
            ) : ahead >= CELL_LEAD ? (
              ""
            ) : mask == null ? (
              ch
            ) : (
              <Cell mask={mask} />
            )}
          </Slot>
        );
      })}
    </div>
  );
}

/**
 * Everyone walking with this child, in the order they line up.
 *
 * Sorted by CAST ORDER rather than by the order the pills were tapped: the
 * line is a fact about the characters, so picking Little Drew and then Peeli
 * has to put them in the same places as picking Peeli and then Little Drew.
 * Anything not in the cast list — a hatched puppy, the buffalo — falls in
 * behind the three children, which is the order they are offered in.
 */
const CAST_ORDER: readonly string[] = COMPANIONS.map(({ id }) => id);

/**
 * May this character walk beside a child in this world?
 *
 * Each world has its own answer and the saved list does not — it is one list
 * for the whole profile, so a child who walks the village road with Peeli and
 * the robot and then switches to Hero Trail was still shown "Robot and Peeli
 * come with you" on a trail that offers neither. The stored choice is kept
 * either way, so switching back finds them where they were left; it is only
 * hidden while standing somewhere they do not belong.
 */
const walksIn = (world: WorldId, id: string): boolean =>
  world === "village" ? true : world === "hero" ? id === "Puppy" : false;

const companionsOf = (
  p: Pick<Prefs, "companions" | "companion" | "companionsByWorld" | "world">,
): string[] => {
  const raw =
    p.companionsByWorld?.[p.world] ??
    p.companions ??
    (p.companion != null ? [p.companion] : []);
  return [...raw]
    .filter((id) => walksIn(p.world, id))
    .filter((id, i, all) => all.indexOf(id) === i)
    .sort((a, b) => {
      const ia = CAST_ORDER.indexOf(a);
      const ib = CAST_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .slice(0, 2);
};

/**
 * THE STORY, as a manuscript the children are carrying.
 *
 * A floating panel over the road rather than a screen of its own: the story is
 * about the place they are standing in, and covering it up makes the two feel
 * unrelated. Aged paper in both app themes, because it is a physical object
 * and a physical object does not repaint itself when the room light changes.
 *
 * Locked parts are shown, not hidden. Knowing there are three more to come is
 * most of why a child walks to the next stone; a hidden part motivates nobody.
 */
function StoryDoc({
  stones,
  graduated,
  fill,
  onRead,
  onClose,
}: {
  readonly stones: number;
  readonly graduated: boolean;
  readonly fill: (t: string) => string;
  readonly onRead: (text: string) => void;
  readonly onClose: () => void;
}): ReactElement {
  const open = (part: StoryPart) =>
    part.graduate === true ? graduated : stones >= part.stone;
  return (
    <div
      className={styles.storyBack}
      role="dialog"
      aria-modal="true"
      aria-label="The story so far"
      onClick={onClose}
    >
      {/* Stops a click inside the paper from closing it. */}
      <div className={styles.storyDoc} onClick={(ev) => ev.stopPropagation()}>
        <h3 className={styles.storyTitle}>The story so far</h3>
        <p className={styles.storySub}>
          How three children from a very long way off ended up on this road.
        </p>
        {STORY.map((part, i) => {
          const unlocked = open(part);
          const body = part.text.map(fill);
          return (
            <div
              key={part.title}
              className={clsx(styles.storyPart, !unlocked && styles.storyShut)}
            >
              <div className={styles.storyHead}>
                <span className={styles.storyNo}>{`Part ${i + 1}`}</span>
                <h4>{unlocked ? part.title : "Not yet"}</h4>
                {unlocked ? (
                  <button
                    type="button"
                    className={styles.storySpeak}
                    aria-label={`Read part ${i + 1} aloud`}
                    onClick={() => onRead(body.join(" "))}
                  >
                    <SoundIcon size={14} color="#6b5227" />
                  </button>
                ) : (
                  <span className={styles.storyWhen}>
                    {part.graduate === true
                      ? "when you know every letter"
                      : `at stone ${part.stone}`}
                  </span>
                )}
              </div>
              {unlocked && body.map((para, k) => <p key={k}>{para}</p>)}
            </div>
          );
        })}
        <button type="button" className={styles.storyClose} onClick={onClose}>
          Back to the road
        </button>
      </div>
    </div>
  );
}

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
// Village Road ends the day arriving somewhere, rather than migrating to a
// valley or marching home from a quest. The road goes on; the village is where
// you stop for the night.
const VILLAGE_FINISH = [
  "The lamps are lit in the village — what a walk that was!",
  "Your fingers carried you a long way down the road today!",
  "The market is closing up. You typed your way right past it!",
  "Every letter was a step along the road. Look how far you came!",
  "Rest by the banyan tree — you earned it. See you tomorrow!",
];
const finishPool = (world: WorldId) =>
  world === "village"
    ? VILLAGE_FINISH
    : world === "hero"
      ? HERO_FINISH
      : DINO_FINISH;

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
        <KidsLessonLoader>
          {(lesson) => <KidsGame lesson={lesson} />}
        </KidsLessonLoader>
      </KidsSettings>
    </KeyboardProvider>
  );
}

/**
 * The tears, as SVG filters.
 *
 * Each one takes a plain rectangle and pushes its edge about with
 * four octaves of fractal noise, which is the only way to get an edge
 * that wanders at every scale at once. A hand-written polygon cannot:
 * its points are evenly spaced, so its teeth are evenly spaced, and
 * the eye picks the period out immediately and reads "zigzag border".
 *
 * `baseFrequency` is deliberately anisotropic — low across, high down
 * — so the noise drifts slowly left-to-right and fidgets top-to-
 * bottom, which is what makes a long ragged rip down the sides rather
 * than the same even fuzz all the way round.
 *
 * The filter region is grown to 160%. Displaced pixels leave the
 * element's box, and the default region would clip them off — putting
 * a dead straight edge back on a deliberately ragged one.
 *
 * The three scales are one tear seen at three depths: the rim is
 * pushed furthest, then the fibre, then the printed face. Same seed
 * for all three, so they are the same rip rather than three rips.
 *
 * Ids are document-global — CSS-module hashing does not reach inside
 * `url(#...)` — hence the `klv` prefix.
 */
/**
 * True for a moment after `value` changes, and false to begin with.
 *
 * Used to light the one figure on the notice that just moved. `prev`
 * starts at the first value, so a fresh page does not flash all four
 * lines at a child who has not done anything yet.
 */
function useFlash(value: unknown, ms = 750): boolean {
  const [on, setOn] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) {
      return;
    }
    prev.current = value;
    setOn(true);
    const id = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return on;
}

/**
 * The scene pane's height when the keyboard helper is hidden and there has
 * never been one to measure. It is what a 270px helper caps the pane at, so a
 * session that starts with the helper off is framed like every other one.
 */
const SCENE_CAP_FALLBACK = 405;
/**
 * The shortest the world pane may be squeezed to, matching `.sceneCard`'s own
 * `min-block-size: 10rem`. Below this the road is a letterbox and there is no
 * point taking more.
 */
const SCENE_MIN_PX = 160;
/**
 * The pane the overlays were drawn against, in CSS pixels. `--kscale` is the
 * pane's size relative to this, so a full-size window is exactly 1 and
 * nothing moves for anyone already comfortable.
 */
const SCENE_REF_W = 1216; // the window's own max, 76rem
const SCENE_REF_H = SCENE_CAP_FALLBACK; // the height the pane settles at
/**
 * How far the whole window may be scaled down before the keyboard is dropped
 * instead. Below about two thirds the key legends stop being readable, and a
 * keyboard nobody can read is worth less than the road it is covering.
 */
const WINDOW_MIN_SCALE = 0.68;
/**
 * A browser this short is not going to fit a road AND a keyboard however hard
 * it is squeezed, so the helper goes and the game keeps the space.
 */
const KB_DROP_HEIGHT = 520;

function TearDefs(): ReactNode {
  const rip = (id: string, freq: string, seed: number, scale: number) => (
    <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence
        type="fractalNoise"
        baseFrequency={freq}
        numOctaves="4"
        seed={seed}
        result="n"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="n"
        scale={scale}
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  );
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute" }}
    >
      <defs>
        {rip("klvTear", "0.014 0.09", 3, 7)}
        {rip("klvTearFibre", "0.014 0.09", 3, 11)}
        {rip("klvTearRim", "0.014 0.09", 3, 14)}
        {rip("klvScrap", "0.05 0.12", 41, 4)}
        {rip("klvScrapFibre", "0.05 0.12", 41, 7)}
        {rip("klvScrapRim", "0.05 0.12", 41, 9)}
      </defs>
    </svg>
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
        .set(lessonProps.punctuators, grownupKeys === "punct" ? 0.1 : 0),
    // How a letter is EARNED is not set from here. It lives in
    // `KidsLesson` — this app's own copy of the unlock rule — so that
    // nothing tuned for a six-year-old can ever reach a grown-up's
    // practice. Two things it settles that a setting used to: keys are
    // judged on current speed rather than best-ever, so one lucky
    // keystroke cannot buy the next letter; and the single weakest key is
    // excused, so a child is not locked out of the whole alphabet by one
    // letter they are having a bad week with.
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
  /**
   * THE ROAD IS HANDED OVER ONCE, AND ONLY WHEN IT IS ACTUALLY READY.
   *
   * `worldReady` is the old `loaded`: the models are parsed and the cast is
   * placed. That is NOT the same thing as the loading screen being finished,
   * and treating it as though it were is what let the game start underneath a
   * loader that was still running. The name ticker shows one name at a time
   * on its own clock, so with a dozen models it is still several seconds
   * behind the load when the last file lands — and the overlay was torn away
   * mid-sentence.
   *
   * `loaded` now waits for both, and then for two animation frames on top:
   * the first puts every rig, texture and shadow on screen for the first
   * time, and handing the road over before it has been drawn shows the child
   * a frame of characters standing in their bind pose.
   */
  const [worldReady, setWorldReady] = useState(false);
  const [stepsDone, setStepsDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  /**
   * The pieces of the world, in the order they should be READ OUT.
   *
   * Deliberately not the order they load in. What a child wants named first
   * is themselves, then whoever is walking with them, then the animal in the
   * field — and the build order has no opinion about any of that: it fetches
   * thirty files in parallel and they land in whatever order the network
   * returns them, which on a warm cache is close to random. So the first few
   * are SEEDED the moment the loading card goes up, from what the page
   * already knows out of the child's own settings, and the world's own
   * reports queue up behind them.
   *
   * A ref, not state — see LoadStep for why routing these through a render
   * was the lag.
   */
  const loadSteps = useRef<string[]>([]);
  /**
   * THE BUFFALO BANNER — the one thing in the game with urgency in it.
   *
   * Its own state and its own place on screen rather than the coach line: the
   * coach line is small and low, and this one has to be read at a glance while
   * something is running at you. `at` is a timestamp rather than a flag so the
   * same event firing twice restarts the display.
   */
  const [alarmLine, setAlarmLine] = useState("");
  /** Buffalo lines waiting their turn — see `pushAlarm`. */
  const alarmQ = useRef<SayKey[]>([]);
  const alarmBusy = useRef(false);
  const alarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The once-ever moments this child has had, live.
   *
   * A ref rather than reading `prefs.seen` directly, so spending one takes
   * effect on the very next frame without waiting for a render — and so the
   * write to storage can be deferred past the moment that triggered it. See
   * where it is spent, in `sayLine`.
   */
  const seenRef = useRef<readonly string[]>(loadPrefs().seen ?? []);
  /** Nobody has typed for a couple of seconds — see the idle interval. */
  const [restful, setRestful] = useState(true);
  const [storyOpen, setStoryOpen] = useState(false);
  const seenSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      // Unmounted with a save still pending — write it now rather than losing
      // a first-ever the child has already been shown.
      if (seenSave.current != null) {
        clearTimeout(seenSave.current);
        savePrefs({ seen: seenRef.current });
      }
    },

    [],
  );
  /** Everything already queued, so nothing is named twice. */
  const loadSeen = useRef<Set<string>>(new Set());
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
  /**
   * WHICH CHARACTER the naming card is naming, by model id.
   *
   * Empty on the card that opens the game, which names whoever the child has
   * just been given and writes the answer to `prefs.name` as it always has.
   * Set from a Rename button, it names that one character and nobody else —
   * which is what makes the two Rename buttons different from each other
   * despite opening the same card.
   */
  const [namingWho, setNamingWho] = useState("");
  // What to call the companion before the child names it. Each world has its
  // own, so the placeholder and the sound question agree with the card above
  // them.
  // Who the companion is called when the child has not named them. Village
  // Road borrows nothing from the other two: a companion on a village road is
  // a friend walking with you, not a sidekick on a quest.
  const companionName =
    prefs.world === "village"
      ? "Kuttan"
      : prefs.world === "hero"
        ? "Robin"
        : "Rexy";
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
  /**
   * The coach line. Empty until the opening one is chosen — see below.
   *
   * It used to be computed right here, in the initialiser, by reaching into
   * the say-table directly. That was the one line in the game that never went
   * through the resolver, so on Village Road it skipped the familiarity band
   * and the once-ever opening entirely and read out whatever the plain key
   * happened to hold. A child's very first sentence in the game was the one
   * sentence the script did not choose.
   *
   * It cannot be done here because `sayLine` is defined further down the
   * component, so it is done in an effect instead. The card covering the
   * scene at that moment means nobody sees the blank.
   */
  const [say, setSay] = useState("");
  const [growNonce, setGrowNonce] = useState(0);
  const [sessionSecs, setSessionSecs] = useState(prefs.timerMin * 60);
  const [sessionOver, setSessionOver] = useState(false);
  const [regenNonce, setRegenNonce] = useState(0);
  const [landNonce, setLandNonce] = useState(0);
  /**
   * A canvas hands out ONE WebGL context in its lifetime, and
   * `dispose()` ends it deliberately: `forceContextLoss()` is what lets
   * Chrome release the canvas and the ~6 MB of renderer state pinned
   * behind it. The cost is that the element is then spent — ask it for a
   * context again and you get the same dead one back, so the next
   * `new WebGLRenderer(canvas)` read `null.precision` out of
   * `getShaderPrecisionFormat` and took the whole scene down with it.
   *
   * The world is rebuilt on exactly these inputs (see the effect's
   * dependency list), so keying the element on them makes React mint a
   * fresh canvas for each new world and drop the spent one. The loading
   * scene never hit this despite disposing the same way — it lives
   * inside `{!loaded && …}`, so React was already replacing its element
   * every time.
   */
  /** This world's own night setting — see Prefs.nightStyleByWorld. */
  const worldNight = nightStyleOf(prefs);
  const worldKey = `${landNonce}:${prefs.world}:${worldNight}:${band}`;
  // Seeded from THIS world, not from the dinosaurs. The message is set again
  // when the session actually ends, so this default is only ever a fallback —
  // but a fallback that says "the herd" on a Kerala cart road is the kind of
  // thing that ships.
  const [finishMsg, setFinishMsg] = useState(
    () => finishPool(loadPrefs().world)[0],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loaderRef = useRef<HTMLCanvasElement>(null);
  const sceneCardRef = useRef<HTMLDivElement>(null);
  /** The last cap measured from the helper — see the capping effect. */
  const sceneCapRef = useRef(0);
  /** Read inside the capping effect, which must not re-run per render. */
  const onVillageRef = useRef(false);
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
  /**
   * When the flag celebration finishes, and the timer holding the
   * new-key ceremony back until it does.
   *
   * The two fire from the same keystroke: reaching the flag calls
   * `celebrate()` and saves the run, the saved run is what lets another
   * key in, and the ceremony effect below opens on that. So the panel
   * used to land over the celebration it was caused by — the child
   * earned the animation and then had it covered up.
   */
  const celebrateUntilRef = useRef(0);
  /**
   * THE CEREMONY THAT IS COMING, once the celebration it belongs to has
   * finished — the letter it is for, and the moment it may open.
   *
   * Input stays blocked meanwhile, which is what the panel itself used to do
   * by covering the screen, since it opened on the same frame the flag was
   * reached. Without the block the delay would be a regression rather than a
   * fix: the new key also regenerates the passage, so the child would start
   * typing a fresh line and have the panel land on them mid-word.
   *
   * THIS IS THE ONE BLOCKED STATE WITH NOTHING ON SCREEN, which is why it
   * owns its timer through an effect rather than through a ref.
   *
   * It used to be a boolean set beside a `setTimeout` held in a ref, and the
   * only thing that ever set it back to false was the body of that one timer.
   * Clearing the timer without running it — which the unlock effect did on
   * any superseding unlock — left the flag true with nothing left alive to
   * lower it. Every keystroke was then swallowed for the rest of the session,
   * with no card, no cue and no way out but reloading the page. The three
   * presses of the ceremony still counted and the panel still closed on them,
   * so it looked like the ceremony had worked and the keyboard had died a
   * moment later.
   *
   * As state with an effect, the pairing cannot come apart: React runs the
   * cleanup for the old value and the body for the new one, so there is no
   * arrangement in which this is set and no timer is counting down to clear
   * it. Superseding is the same mechanism rather than a second one.
   */
  const [ceremonyWaiting, setCeremonyWaiting] = useState<{
    readonly letter: string;
    readonly until: number;
  } | null>(null);
  const ceremonyPending = ceremonyWaiting != null;
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
    // RENAMING ONE CHARACTER, not setting "the name".
    //
    // A blank box clears the name rather than setting an empty one, so a
    // child who changes their mind gets Dave back instead of a nameless
    // person — which is why this does not fall back to a default the way the
    // opening card does.
    if (namingWho !== "") {
      const chosen = draftName.trim().slice(0, NAME_MAX);
      const names = { ...(prefs.names ?? {}) };
      if (chosen === "") {
        delete names[namingWho];
      } else {
        names[namingWho] = chosen;
      }
      savePrefs({ names });
      setNamingWho("");
      setNameOpen(false);
      // BACK WHERE THEY CAME FROM. Renaming is reached from the toy box and
      // is almost never the only thing somebody opened it to do — dropping
      // them out onto the trail afterwards means reopening settings and
      // finding their place again for every single change.
      setSettingsOpen(true);
      return;
    }
    const name = draftName.trim().slice(0, NAME_MAX) || companionName;
    // The opening card names somebody in particular too — whoever the child
    // has just been handed — so its answer goes into `names` as well. Without
    // this, the first name a child ever gives is the one name the pickers and
    // the loading card do not know about.
    const first = childCast(prefs.world)
      ? (companionsOf(prefs)[0] ?? charOf(prefs))
      : charOf(prefs);
    const names = { ...(prefs.names ?? {}), [first]: name };
    savePrefs(
      prefs.soundAsked
        ? { name, names }
        : { name, names, sounds: draftSounds, soundAsked: true },
    );
    setNameOpen(false);
    // This click is a user gesture, which is the only kind of moment a browser
    // will start audio in — and the greeting is the one line worth saying
    // before any typing has happened.
    if (draftSounds && cfg.readAloud) {
      unlockVoice();
      // Through the resolver, like everything else — and `speak` both shows
      // it and queues the voice, which is what this moment wants.
      speak("start", { name });
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
  /** False until the opening `data-kids` has been painted. See the effect. */
  const kidsCrossReady = useRef(false);
  useEffect(() => {
    document.body.dataset.kids = prefs.night ? "night" : "day";
    // THE HEADER CROSSES BETWEEN DAY AND NIGHT, BUT NOT ON THE WAY IN.
    //
    // The header eases between the two palettes so the moon button changes
    // one thing rather than two (see Header.module.less). This attribute is
    // what tells it the crossing is allowed, and it is withheld for one frame
    // on the way in: the FIRST `data-kids` is not a change of hour, it is the
    // page saying what hour it already is. Without the gap a child who left
    // the world at night watched the header fade down out of daylight every
    // time they opened the page.
    //
    // The flag is carried on a ref rather than read back off the body,
    // because this effect re-runs on every toggle and its cleanup clears both
    // attributes each time — so "is the attribute missing?" is true on every
    // run, and the crossing would be suppressed on exactly the presses it
    // exists for.
    let raf = 0;
    if (kidsCrossReady.current) {
      document.body.dataset.kidsCross = "on";
    } else {
      raf = window.requestAnimationFrame(() => {
        kidsCrossReady.current = true;
        document.body.dataset.kidsCross = "on";
      });
    }
    return () => {
      window.cancelAnimationFrame(raf);
      delete document.body.dataset.kids;
      delete document.body.dataset.kidsCross;
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

  /**
   * How many parts are open, and how many of those have not been read.
   *
   * Counted here rather than inside the panel, because the BUTTON needs the
   * unread number and the button exists whether or not the panel does.
   */
  /**
   * WHICH ONE CARD IS ON SCREEN.
   *
   * Every interrupt used to render itself the moment its own flag went up, so
   * finishing a run, unlocking a key and crossing into a new chapter — which
   * can all land on a single keystroke — raced each other. The map was on a
   * 900ms timer, the ceremony had its own pending flag and the finish card
   * rendered at once, so a child got whichever order they happened to fire in
   * and dismissed them one at a time with the mouse.
   *
   * They are ordered here instead, and exactly one is shown. The order is
   * what matters rather than the mechanism: health first, then the things
   * that end a session, then the things that reward one, and the ordinary
   * end-of-run card last — it is the one that will still be true in a
   * moment, so it is the one that can wait.
   *
   * Nothing about the individual cards changes; each still owns its own flag
   * and its own dismissal. They simply queue.
   */
  type CardKind = "rest" | "graduated" | "key" | "chapter" | "finished";
  // NOTE there is no "session over" card, and there never was one — the
  // window inventory lists it as its own entry, but running the timer out
  // opens the FINISHED card with an end-of-session message in it. Giving
  // `sessionOver` a rank of its own here suppressed every lower card and
  // rendered nothing in their place, so the timer ending left a child
  // looking at a road with no way back into the game.
  const cardShown: CardKind | null = restOpen
    ? "rest"
    : graduated
      ? "graduated"
      : ceremony != null
        ? "key"
        : mapOpen
          ? "chapter"
          : finishOpen
            ? "finished"
            : null;

  /**
   * THE CARDS LEAVE BY KEY, NOT BY MOUSE.
   *
   * A child's hands are on home row; reaching for a mouse to dismiss a card
   * breaks the one posture this whole game exists to teach. Every card can be
   * answered with the two keys already under their thumbs.
   *
   * SPACE IS ARMED LATE, and that is the whole subtlety. Space is a real
   * letter in the passage, so a keystroke already on its way down when a card
   * appears would dismiss a card the child never saw — and take their space
   * with it. Cards ignore every key for 400ms. Enter is live at once, because
   * nobody presses Enter in the middle of a word.
   *
   * The rest card is the exception: it takes Enter only. A nudge to stop for
   * the day should cost a deliberate key, not a thumb already resting on the
   * bar.
   *
   * The NEW KEY card is deliberately absent from this. It is dismissed by
   * pressing the letter just earned, three times — a drill rather than an
   * acknowledgement, and a better thing than any dismissal key.
   */
  const [cardArmed, setCardArmed] = useState(false);
  const cardActionRef = useRef<{
    space: (() => void) | null;
    enter: (() => void) | null;
  }>({ space: null, enter: null });

  /** Village Road parts company with the other two worlds all over. */
  const onVillage = prefs.world === "village";
  /**
   * THE HOUR THE ROAD IS AT, for the corner of the notice board.
   *
   * Read from the same function the lighting is staged by, and given the
   * same setting, so the board and the sky can never disagree — a clock that
   * says half past four over a midday sun is worse than no clock.
   *
   * Re-read once a minute rather than every render: it is a clock, and the
   * cheapest correct thing is to let it tick.
   */
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClockTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    // Pushed rather than rebuilt: restaging moves the sun and repaints the
    // sky in place, which is a frame's work against a world build's several
    // seconds. `loaded` is in the deps so the hour lands on a world that has
    // only just arrived, not only on a later change.
    worldRef.current?.setHour(prefs.dayHour === "auto" ? null : prefs.dayHour);
  }, [prefs.dayHour, loaded, regenNonce]);
  // A rebuilt world is a fresh one and has to be lit again before it shows.
  useEffect(() => {
    setHourStaged(false);
  }, [regenNonce, landNonce]);

  /**
   * THE GUIDE, KEPT IN STEP WITH HIS OWN SWITCH.
   *
   * He was handed to the world once, inside the build, and never again — so
   * turning him off moved his lines out of the script immediately and left
   * him walking down the road until the page was reloaded. Half the setting
   * worked and half of it did not, which is the most confusing way for a
   * switch to be broken.
   *
   * An effect rather than another callback on the settings row: the pref is
   * written from more than one place, and this covers all of them by watching
   * the value instead of the click. `setGuide` early-returns when the name
   * has not changed, so the redundant call on every load costs nothing.
   */
  useEffect(() => {
    if (!loaded) {
      return;
    }
    const wanted =
      prefs.world === "village" && !prefs.classic && (prefs.guide ?? true)
        ? VILLAGE_GUIDE
        : null;
    worldRef.current?.setGuide(wanted).catch(() => {
      // A guide who cannot be swapped is not worth taking the road down for.
    });
  }, [prefs.guide, prefs.world, prefs.classic, loaded, regenNonce]);
  const roadClock = useMemo(() => {
    void clockTick;
    const pinned = prefs.dayHour === "auto" ? null : prefs.dayHour;
    const at =
      typeof pinned === "number"
        ? { day: pinned, night: (pinned + 12) % 24 }
        : stagedHours();
    const h24 = prefs.night ? at.night : at.day;
    const hour = Math.floor(h24);
    const mins = Math.round((h24 - hour) * 60);
    // 12-hour, because that is the clock a child reads and the one the whole
    // staging is folded onto. Midnight and noon are 12, not 0.
    const face = hour % 12 === 0 ? 12 : hour % 12;
    const half = hour < 12 ? "am" : "pm";
    return `${face}:${String(Math.min(59, mins)).padStart(2, "0")} ${half}`;
  }, [clockTick, prefs.dayHour, prefs.night]);
  onVillageRef.current = onVillage;
  // Which line on the notice just moved. See `useFlash`.
  const flashScore = useFlash(score);
  const flashCombo = useFlash(combo);
  const flashStage = useFlash(
    stageOf(prefs.world)(dinoAgeOf(included, lesson.letters.length)),
  );
  const flashBest = useFlash(best);
  const storyOpenCount = STORY.filter((part) =>
    part.graduate === true
      ? included >= lesson.letters.length
      : (prefs.roadStones ?? 0) >= part.stone,
  ).length;
  const storyUnread = Math.max(0, storyOpenCount - (prefs.storyRead ?? 0));
  // Each world has its own voice: the dino arcade blips, the hero storybook
  // chimes (and its bored idle babble).
  useEffect(() => {
    // Village Road borrows Hero Trail's softer chimes rather than Dino Run's
    // 8-bit blips: it is the gentler of the two moods, and a village road is
    // not an arcade. A voice of its own can come later - the palette is the
    // one thing here that is genuinely shared rather than merely defaulted.
    kidsAudio.setTheme(childCast(prefs.world) ? "hero" : "dino");
  }, [prefs.world]);
  // The night, heard: a far-off cricket now and then, only on the hero
  // world's real night and only with sound on. Quiet enough to be the night
  // being there rather than a soundtrack.
  useEffect(() => {
    if (childCast(prefs.world) && prefs.night && prefs.sounds) {
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
          // Wait out the flag celebration first. Usually there IS one —
          // this key was let in by the run that just reached the flag —
          // but not always: a child can arrive with results earned on
          // the grown-up page, and then the wait is zero and nothing is
          // delayed.
          if (celebrateUntilRef.current <= performance.now()) {
            setCeremonyWaiting(null);
            setCeremony({ letter, presses: 0 });
          } else {
            setCeremonyWaiting({
              letter,
              until: celebrateUntilRef.current,
            });
          }
        }
      }
      // Did the trail reach an egg? The creature arrives here, in the scene
      // the child is looking at — the old line told them to go and find it in
      // a settings menu, which is not a reward, it is an errand.
      const world = prefsRef.current.world;
      for (const hatchling of HATCHLINGS[world]) {
        const { id, label, at } = hatchling;
        if (prevIncluded.current < at && included >= at) {
          speak("joins", { friend: label });
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

  /**
   * Open the waiting ceremony once its celebration is over.
   *
   * The timer belongs to the state, so the two cannot come apart — see
   * `ceremonyWaiting`. Unmount, supersession and opening are all the same
   * path: the cleanup clears whatever was counting down, and anything that
   * leaves `ceremonyWaiting` set arms a fresh one in the same commit.
   *
   * CAPPED, because this is a block with nothing on screen behind it. The
   * wait is a celebration's own length, reported by the world — about a
   * second and a half — and the cap is well clear of that, so it only ever
   * bites if that number comes back wrong. A child should never lose their
   * keyboard for longer than it takes to notice, whatever else breaks.
   */
  useEffect(() => {
    if (ceremonyWaiting == null) {
      return;
    }
    const wait = Math.min(
      3000,
      Math.max(0, ceremonyWaiting.until - performance.now()),
    );
    const id = setTimeout(() => {
      setCeremony({ letter: ceremonyWaiting.letter, presses: 0 });
      setCeremonyWaiting(null);
    }, wait);
    return () => clearTimeout(id);
  }, [ceremonyWaiting]);

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
    prefsRef.current.name || defaultWhoName(prefsRef.current.world);
  /**
   * WHO {name} IS: the character the child plays as.
   *
   * Not the companion. It used to be `prefs.name` — the answer to the card
   * that opens the game, which names whoever the child was just handed — while
   * the lines that use it plainly mean the person the child IS. The same
   * reading works in all three worlds: the dino you play as, the hero you play
   * as, the child you play as.
   *
   * The old value is not lost: that opening card writes its answer into the
   * per-character names too, so whatever a child typed on their first ever run
   * still comes back out of whichever of these two that character turned out
   * to be.
   */
  const villagerName = () => {
    const p = prefsRef.current;
    return p.world === "village" || p.world === "hero"
      ? castLabel(charOf(p), p.names)
      : dinoName();
  };
  /** {mate}: the first companion walking with them, if there is one. */
  const companionLabel = () => {
    const p = prefsRef.current;
    const first = companionsOf(p)[0];
    return first == null ? "your friend" : castLabel(first, p.names);
  };
  /**
   * {guide}: the local boy.
   *
   * By model id, so renaming him renames him here — and so the story does not
   * hard-code a name that a child is free to change.
   */
  const guideLabel = () => castLabel(VILLAGE_GUIDE, prefsRef.current.names);
  // The runner's current growth (0 → 1), kept fresh for the say-lines.
  const dinoAgeRef = useRef(0);
  dinoAgeRef.current = dinoAgeOf(included, lesson.letters.length);

  /**
   * EVERY TOKEN A SCRIPT LINE MAY USE, IN ONE PLACE.
   *
   * It has to be one place. The cheer lines were filled in on their own with
   * `{ name }` and nothing else, so every cheer that names the local boy —
   * "{guide} can barely keep up with you!" — reached the child with the
   * braces still in it. A child who cannot yet read reliably was being shown
   * punctuation soup, and a child who can was being shown a bug.
   *
   * Anything that picks from these pools fills them in through here, so a
   * token added to the script can never be live in one voice and raw in
   * another.
   */
  /**
   * DROP THE LINES THAT NAME THE LOCAL BOY, WHEN HE IS NOT ON THE ROAD.
   *
   * Switching the guide off removes him from the world, so a line that says
   * "Abee is counting on his fingers" is not merely chatty, it is a sentence
   * about somebody who is not there — and for a child who is having the page
   * read to them it is the most confusing kind of wrong, because there is no
   * picture to contradict it.
   *
   * `villagePool` already does this for the banded context lines, and it is
   * covered by a test that every context keeps a guide-free line. The CHEERS
   * were never filtered at all: they are picked from their own pool, on their
   * own path, and four of them name him. They also fire more often than
   * anything else on the page. So the filter lives here now and every caller
   * goes through it.
   *
   * Falls back to the unfiltered pool rather than falling silent — but that
   * is a guard against a script edit, not a case that happens: see the test.
   */
  const withoutGuide = (pool: readonly string[]): readonly string[] => {
    const p = prefsRef.current;
    if (p.world !== "village" || p.classic || p.guide !== false) {
      return pool;
    }
    const without = pool.filter((l) => !l.includes("{guide}"));
    return without.length > 0 ? without : pool;
  };

  const sayVars = (extra: Record<string, string> = {}) => {
    const p = prefsRef.current;
    return {
      name: villagerName(),
      mate: companionLabel(),
      guide: guideLabel(),
      years: yearsBack(),
      year: String(VILLAGE_YEAR),
      stone: String(p.roadStones ?? 0),
      stage: stageOf(p.world)(dinoAgeRef.current),
      ...extra,
    };
  };

  /**
   * CHOOSE A LINE, WITHOUT SAYING IT.
   *
   * Split out of `speak` so the buffalo banner can use exactly the same pools,
   * the same bands, the same first-ever rule and the same tokens, and then put
   * the result somewhere that is not the coach line and does not queue the
   * voice. Two things that pick from the same script must not have two copies
   * of the picking.
   *
   * Returns "" when this world has nothing to say for the key, which is the
   * right answer rather than a fallback: a dinosaur valley has no buffalo.
   */
  const sayLine = (key: SayKey, vars: Record<string, string> = {}): string => {
    const age = dinoAgeRef.current;
    const p = prefsRef.current;
    const world = p.world;
    const village = world === "village" && !p.classic;
    // ── WHICH VARIANT OF THIS CONTEXT ────────────────────────────────────
    //
    // Village Road resolves in its own order: a once-ever line if this child
    // has never seen the thing, then the familiarity band, then the existing
    // age variants, then the plain key. Everywhere else is untouched.
    const stones = p.roadStones ?? 0;
    const bandNo = bandOf(stones);
    const table = saysOf(world, p.classic) as unknown as Record<
      string,
      readonly string[] | undefined
    >;
    let firstEver = "";
    let pool: readonly string[] = [];
    if (village) {
      const got = villagePool(
        table,
        key,
        bandNo,
        seenRef.current,
        p.guide !== false,
      );
      pool = got.lines;
      if (got.firstEver) {
        firstEver = key;
      }
    }
    if (pool.length === 0 && key in SAYS) {
      // The age variants only exist for the shared contexts; the village-only
      // keys are banded instead and have already been resolved above.
      pool = agedPool(saysOf(world, p.classic), key as keyof typeof SAYS, age);
    }
    // The banded pools were already filtered inside `villagePool`; this
    // catches the shared ones that fell through to it — the age variants and
    // the plain keys, some of which also name him.
    if (village && p.guide === false) {
      const without = pool.filter((l) => !l.includes("{guide}"));
      if (without.length > 0) {
        pool = without;
      }
    }
    // The after-dark lines. Village Road has its own; the Hero Trail's are
    // about lanterns, a party and mist, and were being handed to a Kerala
    // cart road because the test for them is only "not the dino world".
    if (!p.classic && childCast(world) && p.night) {
      const nightKeys = village ? [`${key}B${bandNo}`, key] : [key];
      const extra = village
        ? nightKeys.flatMap((k) => VILLAGE_NIGHT_SAYS[k] ?? [])
        : [
            ...(HERO_NIGHT_SAYS[key] ?? []),
            ...(resolveNightStyle(band, nightStyleOf(p)) !== "quiet"
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
    if (p.playful && playfulOffered(band)) {
      const extra = village
        ? [
            ...(VILLAGE_PLAYFUL_SAYS[`${key}B${bandNo}`] ?? []),
            ...(VILLAGE_PLAYFUL_SAYS[key] ?? []),
          ]
        : (PLAYFUL_SAYS[key] ?? []);
      if (extra.length > 0) {
        pool = [...pool, ...extra];
      }
    }
    if (pool.length === 0) {
      return ""; // a context this world has nothing to say about
    }
    // ── SPENDING A FIRST-EVER, WITHOUT COSTING A FRAME ───────────────────
    //
    // Marked in a ref straight away, so it cannot be offered twice even if the
    // same moment fires again in the next second. The SAVE is deferred,
    // because `savePrefs` re-renders the whole of this component — the lesson,
    // the keyboard, the HUD — and the moments this fires on are the worst
    // possible ones to do that: a buffalo mid-charge, the first milestone
    // landing. Seven writes in the lifetime of a profile can wait a second and
    // a half for the road to go quiet.
    if (firstEver !== "") {
      seenRef.current = [...seenRef.current, firstEver];
      if (seenSave.current != null) {
        clearTimeout(seenSave.current);
      }
      seenSave.current = setTimeout(() => {
        seenSave.current = null;
        savePrefs({ seen: seenRef.current });
      }, 1500);
    }
    // Filtered HERE, at the end. The earlier pass ran before the night and
    // the playful lines were merged in, so anything either of those added
    // slipped past it — neither names him today, and neither has to keep not
    // naming him for this to stay correct.
    return fillSay(pickSay(withoutGuide(pool)), sayVars(vars));
  };

  /**
   * The buffalo has the floor.
   *
   * While it is coming, nothing else talks. Every other line on this page is
   * a nicety -- a streak, a new key, a chapter -- and the buffalo's are the
   * only ones that are an instruction to act this second. Two voices at once
   * is bad enough; a cheerful one over a warning is worse, and `setSay` would
   * also have overwritten the warning ON SCREEN with a milestone.
   *
   * Time-stamped as well as flagged, so a `buffaloSafe` that never arrives
   * cannot leave the page permanently mute.
   */
  const alarmUntilRef = useRef(0);
  const alarmLive = () => performance.now() < alarmUntilRef.current;

  const speak = (key: SayKey, vars: Record<string, string> = {}) => {
    if (alarmLive()) {
      return;
    }
    const line = sayLine(key, vars);
    if (line === "") {
      return;
    }
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
    // The passage decides how far the trail carries them, so that a
    // keystroke moves the same distance for a five-year-old typing eight
    // short words as for a twelve-year-old typing thirty.
    worldRef.current?.startRun(flat.length);
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
    const theme =
      prefsRef.current.world === "village"
        ? VILLAGE_THEME
        : prefsRef.current.world === "hero"
          ? HERO_THEME
          : DINO_THEME;
    const chosen = charOf(prefsRef.current);
    // Before the world, deliberately. Both want the same character file, and
    // three de-duplicates requests already in flight — but the world queues
    // a dozen models of its own, and whichever is asked for first is the one
    // the browser fetches first. Created after it, the loading screen stood
    // empty until every tree and companion had been fetched, which is most of
    // the wait it exists to fill.
    // The loading screen is always one of the three children.
    //
    // It is the first thing a child sees every session, and it is the only
    // picture of "who this is for" the page gets to make before the world
    // arrives. A skeleton jogging on the spot is a fine thing to PLAY as and
    // a poor thing to be greeted by. So the loader shows Dave, Little Drew
    // or Peeli — the child's own pick when it is one of them, and otherwise
    // the sibling their age band opens with.
    //
    // Only the hero world has anything else to offer; Dino Run's cast is
    // dinosaurs, and a child running there is a dinosaur on purpose.
    const SIBLINGS = ["Explorer", "Explorer6", "Peeli"];
    const loaderWho =
      !childCast(prefsRef.current.world) || SIBLINGS.includes(chosen)
        ? chosen
        : band === "5-6" || band === "7-8"
          ? "Explorer6"
          : "Explorer";
    const loader =
      loaderRef.current != null
        ? createLoaderScene(loaderRef.current, theme, loaderWho)
        : null;
    const nav = navigator as Navigator & { deviceMemory?: number };
    // `?buffalo` or `?puppy` - one showcase, either animal.
    // `?puppy` shows the puppy alone. `?buffalo` shows BOTH: the buffalo held
    // on its idle as a scale reference, with the puppy cycling its clips in
    // front of it - the puppy is the one being reviewed, and a still animal
    // beside it is what makes its size legible.
    const qs =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search);
    const showcaseModel =
      qs?.has("puppy") || qs?.has("buffalo") ? "Puppy" : undefined;
    const showcaseIdleModel = qs?.has("buffalo") ? "Buffalo" : undefined;
    // Is a village due on this trail?
    //
    // Decided here rather than in the world, because it depends on how many
    // flags the child has reached across ALL their sessions and the world is
    // rebuilt from nothing every time. Reading it here and spending it here
    // keeps the whole rhythm in one place: the count lives with the saved
    // preferences, the gap is redrawn whenever a village is spent so the
    // spacing never settles into something a child could predict, and a world
    // that is not Village Road never touches either.
    // `?village` forces one, the way `?buffalo` forces the showcase. Without
    // it a village is unreviewable: looking at one SPENDS it, so every reload
    // while working on the layout put the counter back to zero and showed an
    // empty road.
    const villageForced = qs?.has("village") === true;
    const villageDue: boolean | "near" =
      prefsRef.current.world !== "village"
        ? false
        : villageForced
          ? "near"
          : (prefsRef.current.villageFlags ?? 0) >=
            (prefsRef.current.villageGap ?? 4);
    if (villageDue === true) {
      savePrefs({
        villageFlags: 0,
        villageGap: 4 + Math.floor(Math.random() * 4),
      });
    }
    // THE FIRST FEW NAMES, SET BEFORE ANYTHING IS FETCHED.
    //
    // The card goes up now, so the reading starts now — it does not wait for
    // a model to come back, which on a cold cache is seconds of a bar moving
    // under a blank line. Three names the page already knows from the child's
    // own settings, in the order a child cares about them: who they are, who
    // is coming with them, and then the animal that is going to be standing
    // in the field. Everything the world reports queues up behind these, and
    // the dedupe in `onLoadStep` keeps them from being said twice when their
    // files actually land.
    // THE CARD GOES BACK UP FOR EVERY REBUILD, not just the first one.
    //
    // This effect runs again whenever the world, the night style, the band or
    // the land changes — and `loaded` was left true through all of it, so
    // switching from Village Road to Hero Trail tore the old scene down and
    // built the new one in full view: an empty green plane, then a road, then
    // trees and people arriving one at a time over several seconds. Every
    // one of those rebuilds is the same wait the opening one is, and it is
    // shown the same way.
    setLoaded(false);
    setWorldReady(false);
    setStepsDone(false);
    loadSteps.current = [];
    loadSeen.current = new Set();
    {
      const say = (label: string) => {
        if (label !== "" && !loadSeen.current.has(label)) {
          loadSeen.current.add(label);
          loadSteps.current.push(label);
        }
      };
      say(castLabel(charOf(prefsRef.current), prefsRef.current.names));
      if (childCast(prefsRef.current.world)) {
        for (const mate of companionsOf(prefsRef.current)) {
          say(castLabel(mate, prefsRef.current.names));
        }
      }
      // The buffalo is the village's own, and the one thing in the field a
      // child asks about. Named third, before the trees and the houses.
      if (prefsRef.current.world === "village") {
        say("a buffalo");
      }
    }
    const world = createKidsWorld(canvas, pickLand(theme.lands), theme, {
      nightStyle: resolveNightStyle(band, nightStyleOf(prefsRef.current)),
      villageDue,
      // `?wild` — the buffalo's charge, brought within reach of a reviewer.
      wildReview: qs?.has("wild") === true,
      // Carry on from the last stone this child walked past, and stand the
      // most recent few behind them so the road reads as already travelled.
      stonesPassed: prefsRef.current.roadStones ?? 0,
      chapter,
      // How long this child's chapter is. Ten lessons of a five-year-old's
      // passages is 270 units of road; of an eleven-year-old's, 640.
      ageBand: band,
      // Dev review aid: `?buffalo` / `?puppy` spawns that animal beside the
      // player and cycles every clip, naming each in the caption line.
      showcaseModel,
      showcaseIdleModel,
      onShowcaseClip: (name) => setSay(`🐶 ${name.replace(/_/g, " ")}`),
      // What the world is building, named — see LoadStep. Only while the
      // card is up: once the road is open these keep arriving for the props
      // planted along it, and nobody wants a ticker over their game.
      // ── THINGS THAT HAPPEN ON THE ROAD ─────────────────────────────
      //
      // The buffalo's four go to their own banner; everything else is an
      // ordinary coach line. Nothing here touches the typing — see the banner
      // itself, which is drawn over the scene and never over the keyboard or
      // the letters.
      onEvent: (what) => {
        if (what.startsWith("buffalo")) {
          if (what === "buffaloSafe") {
            alarmUntilRef.current = 0;
          } else {
            // Cut whatever is mid-sentence rather than letting it finish over
            // the top, and bin anything queued behind it -- by the time the
            // animal has gone the line has missed its moment anyway.
            if (!alarmLive()) {
              stopSpeaking();
              pendingSpeechRef.current = null;
            }
            // Long enough to cover notice -> warn -> charge -> safe, short
            // enough that a sequence which never resolves un-mutes itself.
            alarmUntilRef.current = performance.now() + 30000;
          }
          pushAlarm(what as SayKey);
          return;
        }
        speak(what as SayKey);
      },
      onLoadStep: (label: string) => {
        // Dropped in a box for the loader to read at its own pace. No state,
        // so the page does not re-render once per model loaded. Skipped if
        // it is already in the list: the hero and the companion were named
        // before the world started, and the scatter loads the same file for
        // forty plants.
        if (!loadSeen.current.has(label)) {
          loadSeen.current.add(label);
          loadSteps.current.push(label);
        }
      },
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
    // The world is built before the first passage exists; the effect above
    // starts the properly-sized run as soon as there is one.
    world.startRun(passageRef.current.length || undefined);
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
        const friends = childCast(prefsRef.current.world)
          ? companionsOf(prefsRef.current)
          : [];
        // THE GUIDE, on the road rather than only in the text.
        //
        // He is a village-only character and he is switchable — the settings
        // row is "{guide} shows you round", and when it is off his lines are
        // filtered out of every context. It would be strange to strip him from
        // the script and leave him walking about, so the same flag decides
        // both.
        const guide =
          prefsRef.current.world === "village" &&
          (prefsRef.current.guide ?? true)
            ? VILLAGE_GUIDE
            : null;
        world.setGuideBand(prefsRef.current.roadStones ?? 0);
        if (chosen !== theme.defaultPlayer) {
          return world
            .setPlayer(chosen)
            .then(() => world.setCompanions(friends))
            .then(() => world.setGuide(guide));
        }
        return world.setCompanions(friends).then(() => world.setGuide(guide));
      })
      .finally(() => {
        // NOT `loader.dispose()` HERE.
        //
        // Disposing it calls `forceContextLoss`, which permanently spends the
        // canvas element — and the loading screen is still on screen at this
        // point, because the reveal waits for the name ticker to finish and
        // for two frames after that. Killing the context under a canvas the
        // child is still looking at leaves a dead image box in the middle of
        // the loader for the last moments of the load. It is handed to the
        // effect below instead, which lets it go when the loader actually
        // comes off the screen.
        loaderSceneRef.current = loader;
        if (!cancelled) {
          setWorldReady(true);
        }
      });
    const observer = new ResizeObserver(() => world.resize());
    observer.observe(canvas);
    return () => {
      cancelled = true;
      observer.disconnect();
      // Torn down before the loading screen ever came off — the effect that
      // normally releases this never ran, so it is released here. Clearing
      // the ref keeps that effect from disposing it a second time.
      loader?.dispose();
      loaderSceneRef.current = null;
      world.dispose();
      worldRef.current = null;
    };
    // The style override rebuilds the world: the plan decides what was
    // planted, which is not a thing that can be re-lit in place.
    // `classic` matters here even though the world does not use it: while
    // Classic is on there is no canvas to draw into, so this effect bails out
    // early. Coming back to the trail must rebuild the world, or the learner
    // lands on an empty scene that never loads.
  }, [landNonce, prefs.world, worldNight, band, prefs.classic]);

  /**
   * The world pane never grows more than 50% taller than the helper card.
   *
   * `useLayoutEffect`, and that is the whole of the loader's "opens tall then
   * settles smaller". A `<canvas>` carries its width and height attributes as
   * its intrinsic size, so before anything measured the keyboard the pane was
   * as tall as the drawing buffer — 608px — and the cap that brought it to
   * 405 landed a frame later, in front of the child. Running before the
   * browser paints means the only height ever shown is the capped one.
   */
  useLayoutEffect(() => {
    const scene = sceneCardRef.current;
    const kb = kbCardRef.current;
    if (scene == null) {
      return;
    }
    const cap = () => {
      const kb = kbCardRef.current;
      const kbOn = kb != null && prefsRef.current.kbMode !== "off";
      let want: number;
      if (kbOn && kb != null) {
        want = Math.round(kb.offsetHeight * 1.5);
        sceneCapRef.current = want;
      } else {
        // THE HELPER GOING AWAY MUST NOT RESIZE THE WORLD.
        //
        // Clearing the cap here let the pane grow into the space the keyboard
        // had been using — and the canvas is sized to this pane and the
        // camera framed from it, so turning the helper off pulled the whole
        // view backwards. Whatever height it had with the helper up, it keeps.
        //
        // The fallback covers the case where the helper was already off when
        // the page loaded, so there is nothing to measure: it is the height
        // the pane settles at with the keyboard shown, which is the framing
        // every other session gets.
        want = sceneCapRef.current || SCENE_CAP_FALLBACK;
      }
      // NO VIEWPORT CLAMP HERE ANY MORE.
      //
      // There used to be one, and it was the thing that shrank the game: the
      // pane is the only part of the window with a flexible height, so every
      // pixel the window was too tall came off the ROAD and nothing else.
      // Fitting the browser is the stylesheet's job now -- it bounds the
      // window's width by the height available, so the keyboard and the pane
      // come down together and keep their proportions. The pane's height is
      // once again only ever what it always was: one and a half keyboards.
      //
      // If a page ever carries more chrome than the stylesheet's model
      // allows for, it scrolls a little. That is a far better failure than
      // silently squeezing the one part the child is looking at.
      scene.style.maxHeight = `${Math.max(SCENE_MIN_PX, want)}px`;
      // WHAT SITS OVER THE ROAD SCALES WITH THE ROAD.
      //
      // The notice board and the story page were fixed in `rem`, so on a
      // small window they stayed the same physical size over a much smaller
      // scene and swallowed it. A container query would only track width; the
      // pane changes in BOTH directions and it is the smaller of the two that
      // decides whether a panel still fits, so the factor is worked out here,
      // where both are already measured, and handed to the stylesheet.
      //
      // Set on the root as well as the pane: the story page is a
      // viewport-fixed backdrop, so it cannot rely on inheriting through the
      // scene card.
      const kscale = Math.min(
        1.15,
        Math.max(
          0.7,
          Math.min(
            scene.clientWidth / SCENE_REF_W,
            scene.clientHeight / SCENE_REF_H,
          ),
        ),
      );
      const v = kscale.toFixed(3);
      scene.style.setProperty("--kscale", v);
      document.documentElement.style.setProperty("--kscale", v);
    };
    cap();
    const observer = new ResizeObserver(cap);
    observer.observe(document.documentElement);
    if (kb != null) {
      observer.observe(kb);
    }
    // AND ON THE WINDOW ITSELF.
    //
    // The observer above watches the document element, whose border box is
    // not always what changed -- browser zoom, a toolbar appearing, a mobile
    // address bar sliding away all alter how much room the window really has
    // without resizing it. A plain resize listener catches those, and unlike
    // observing the window box it cannot feed itself: `cap` writes the pane's
    // height, which would resize that box, which would call `cap` again.
    window.addEventListener("resize", cap);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", cap);
    };
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
    // The story panel covers the road. A key pressed while it is open is a
    // key aimed at nothing the child can see.
    storyOpen ||
    graduated ||
    restOpen ||
    tourOpen ||
    hatched != null ||
    ceremony != null ||
    ceremonyPending ||
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
          // `classicRef`, not `prefs.classic`: Classic is only OFFERED to the
          // oldest band, so a younger child carrying the preference — set
          // when they were older, or inherited from a shared device — was
          // shown a card counting three presses by a handler that closed it
          // after one. The render decides what the card says; this has to
          // read the same answer.
          if (cer.presses + 1 >= (classicRef.current ? 1 : 3)) {
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
      // And the story invitation goes with it, on the FIRST key rather than
      // whenever the second-by-second timer next comes round: a button that
      // lingers for most of a second into a word is exactly the distraction
      // it exists to avoid. React bails out when the value is unchanged, so
      // this costs one render at the start of a burst and nothing after.
      setRestful(false);
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
        // Right or wrong — a hop is not a reward for accuracy, it is what the
        // space bar does. Unless it has been switched off, in which case
        // space is an ordinary key and the walk carries on uninterrupted.
        if (prefsRef.current.spaceJump !== false) {
          worldRef.current?.jump();
        }
        // The jump is the trail's own sound effect. On Classic the space bar
        // is just another key and should sound like one — the real key click
        // is played below with every other press. And a child who has turned
        // the hop off should not still hear one.
        if (
          sounds &&
          !prefsRef.current.classic &&
          prefsRef.current.spaceJump !== false
        ) {
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
                withoutGuide(
                  cheerPool(
                    saysOf(prefsRef.current.world, prefsRef.current.classic),
                    band,
                  ),
                ),
              ),
              sayVars(),
            ),
          );
        }
        if (textInput.completed) {
          // Reaching the camp flag is the one moment the run is won; the world
          // decides what that looks like for a dino and for a hero. It
          // reports how long that takes so the new-key ceremony can wait
          // for it rather than land on top of it.
          const celebrationMs = worldRef.current?.celebrate() ?? 0;
          celebrateUntilRef.current = performance.now() + celebrationMs;
          setScore((s) => saveBest(s + 10));
          setWords((w) => w + 1);
          speak("milestone");
          // Reaching a flag is what counts as having practised, not running
          // the timer to zero — most children close the tab long before it
          // gets there, and none of them should lose the day for it.
          collect("first-run");
          // And it is what a village is measured in. Counted on every world,
          // not just Village Road: a child who spends a week on Hero Trail and
          // comes back should find a village waiting rather than have to earn
          // four more flags for one.
          savePrefs({
            villageFlags: (prefsRef.current.villageFlags ?? 0) + 1,
            // The milestone just reached. Only Village Road plants stones, so
            // only Village Road counts them — unlike the village itself,
            // which accrues on every world because a village rewards
            // practising rather than walking this particular road.
            ...(prefsRef.current.world === "village"
              ? { roadStones: (prefsRef.current.roadStones ?? 0) + 1 }
              : {}),
          });
          // And the stone standing at the end of it is earned. Until this is
          // said, the road treats it as the marker for the lesson still being
          // walked and will move it rather than plant another — see
          // `pendingStone` in world.ts.
          if (prefsRef.current.world === "village") {
            worldRef.current?.passStone();
          }
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
            speak("stumble");
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
      // ── IS THE ROAD QUIET? ───────────────────────────────────────────
      //
      // Drives whether the story button is on screen at all. Piggy-backed on
      // the beckon timer that is already running rather than starting a
      // second one: this is a once-a-second question and one interval can
      // answer both.
      //
      // `restful` is deliberately not "has stopped for a moment" — it is
      // "has stopped for long enough that offering something else to look at
      // is not a distraction". Two and a half seconds is longer than any gap
      // inside a word and shorter than a child's patience.
      setRestful(performance.now() - (lastKeyAtRef.current || 0) > 2500);
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

  /**
   * Two frames after both halves are done, hand over the road.
   *
   * Two, not one: the first frame is where three.js finally draws every rig,
   * uploads the textures it has been holding and fills the shadow map, and
   * that frame is the expensive one. Revealing on it shows the child the
   * stutter; revealing on the one after shows them the road.
   */
  /**
   * Whether the road has been lit for the right hour yet.
   *
   * The hour is pushed to the world by an effect of its own, which runs
   * AFTER the one that reveals — so on a fresh load the first frame a child
   * saw was the theme's fallback eight o'clock, and the real hour arrived a
   * beat later as a visible change of light. It is the first thing they look
   * at, so it has to be right before they look.
   */
  const [hourStaged, setHourStaged] = useState(false);
  useEffect(() => {
    if (!worldReady || !stepsDone || loaded) {
      return;
    }
    if (!hourStaged) {
      // Stage it now and let this effect run again — see `hourStaged` in the
      // deps. One frame's delay, behind a loading screen that has been up for
      // seconds, against a lighting pop in the opening shot.
      worldRef.current?.setHour(
        prefs.dayHour === "auto" ? null : prefs.dayHour,
      );
      setHourStaged(true);
      return;
    }
    // rAF, BUT NEVER ONLY rAF.
    //
    // A hidden or throttled tab does not run animation frames — Chrome stops
    // them outright when the page is not visible — so a reveal that waits on
    // two of them waits for as long as the child is looking at another tab,
    // and comes back to a loading screen for a world that finished minutes
    // ago. The timer is the floor: whichever arrives first wins, and both
    // paths go through `done` so it only ever fires once.
    let raf = 0;
    let fired = false;
    const done = () => {
      if (!fired) {
        fired = true;
        setLoaded(true);
      }
    };
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(done);
    });
    const fallback = setTimeout(done, 200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [worldReady, stepsDone, loaded, hourStaged, prefs.dayHour]);

  /**
   * The loading screen's own little scene, released when it is no longer
   * being looked at — see the `.finally` above for why not sooner.
   */
  const loaderSceneRef = useRef<{ dispose(): void } | null>(null);
  useEffect(() => {
    if (loaded && loaderSceneRef.current != null) {
      loaderSceneRef.current.dispose();
      loaderSceneRef.current = null;
    }
  }, [loaded]);
  useEffect(
    () => () => {
      loaderSceneRef.current?.dispose();
      loaderSceneRef.current = null;
    },
    [],
  );

  /** Told once, by the name ticker, when it has shown the last name. */
  const onStepsDone = useCallback(() => setStepsDone(true), []);

  /**
   * The loading screen, built once and placed in one of two spots.
   *
   * On Village Road it is a child of the window and covers all of it — the
   * road, the coach's line and the keyboard together — so the load is one
   * surface rather than a panel in the top third with an empty card beneath
   * it. The other two worlds are still three separate cards, where an overlay
   * spanning them would have nothing to span, so there it stays inside the
   * scene card exactly as before.
   */
  const loaderPane = loaded ? null : (
    <div className={styles.loading}>
      <div className={styles.loadStack}>
        {/*
          `setSize(canvas.width, canvas.height, false)` treats these numbers
          as the render size in CSS pixels and multiplies by the device
          ratio, so 360 across is 720 device pixels at 2x — comfortably more
          than the 13rem this is ever drawn at. It was briefly raised to 480
          for a much larger picture; the picture came back down and so has
          this, because the extra was GPU work paid during the load for
          resolution nothing could see.
        */}
        <canvas
          ref={loaderRef}
          className={styles.loadArt}
          width={360}
          height={240}
        />
        {/* The ground he walks on IS the progress bar — see `.loadGround`. */}
        <div className={styles.loadGround}>
          <i />
        </div>
        <div className={styles.loadLabel}>
          <Reveal
            text={(onVillage
              ? "Chapter 1 · The Village"
              : landName !== ""
                ? `Chapter ${chapter} · ${landName}`
                : "Running to the valley"
            ).toUpperCase()}
          />
        </div>
        <LoadStep
          queueRef={loadSteps}
          active={!loaded}
          settling={worldReady}
          onDone={onStepsDone}
        />
      </div>
    </div>
  );

  /**
   * The world is frozen from the moment it is built and released here.
   *
   * See `setHeld` in world.ts. Without it the cast waves, the buffalo wanders
   * and the light moves behind the loading screen, and what the child is
   * handed when it lifts is a scene that has plainly been running without
   * them.
   */
  useEffect(() => {
    if (loaded) {
      worldRef.current?.setHeld(false);
    }
  }, [loaded]);

  /**
   * THE BUFFALO LINES, ONE AFTER ANOTHER, EACH LONG ENOUGH TO READ.
   *
   * A QUEUE, not a variable, and that is the whole point of it.
   *
   * The animal's own sequence is far quicker than a sentence. Measured on the
   * road: the windup clip runs 0.9s, and the charge itself covers the two
   * units between where it starts and where it always stops — about a fifth
   * of a second. Each event simply overwrote the last, so `buffaloWarn` got
   * 0.9s, `buffaloCharge` got long enough to blink, and what a child actually
   * saw was the relief line for an event they never knew had happened. The
   * lines were firing correctly the entire time; they were being erased.
   *
   * So each one now holds the floor for a minimum before the next is allowed
   * on. That puts the relief beat a second or so behind the animal, which is
   * the right way round to be wrong: a warning nobody can read is worthless,
   * and a relief line a beat late still lands.
   *
   * Deliberately not through `speak`: that would set the coach line and queue
   * the voice, and per the script these are shown and never spoken. It
   * borrows the same pools and the same band and first-ever rules, and then
   * puts the result somewhere else.
   */
  const runAlarm = useCallback(() => {
    const next = alarmQ.current.shift();
    if (next == null) {
      alarmBusy.current = false;
      setAlarmLine("");
      return;
    }
    alarmBusy.current = true;
    setAlarmLine(sayLine(next));
    // The relief beat is the one anybody has time to read properly, and the
    // only one that is not telling them to do something this second.
    const hold = next === "buffaloSafe" ? 2600 : 1600;
    alarmTimer.current = setTimeout(runAlarm, hold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushAlarm = useCallback(
    (key: SayKey) => {
      alarmQ.current.push(key);
      if (!alarmBusy.current) {
        runAlarm();
      }
    },
    [runAlarm],
  );

  useEffect(
    () => () => {
      if (alarmTimer.current != null) {
        clearTimeout(alarmTimer.current);
      }
    },
    [],
  );

  /**
   * The opening line, once, as soon as the resolver exists.
   *
   * Guarded on `say` being empty rather than on a mount flag: crossing into a
   * new land clears it and this fires again, which is right — a new stretch of
   * road opens the same way the first one did.
   */
  useEffect(() => {
    // NOT WHILE THE LOADING SCREEN IS UP.
    //
    // This used to fire the moment the resolver existed, which is several
    // seconds before the road appears — so the coach greeted the child, out
    // loud, over a loading screen, about a world they could not yet see. The
    // line is an invitation to start walking and it has to arrive when there
    // is somewhere to walk.
    if (say === "" && loaded) {
      speak("start");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [say, loaded]);

  const crossIntoNextLand = () => {
    setMapOpen(false);
    const land = peekNextLandName();
    speak("crossed", { chapter: String(chapter + 1), land });
    collect(`land:${land}`);
    // THE VILLAGE ROAD HAS ONE CHAPTER, and it is Chapter 1.
    //
    // This counter came from the old model, where a chapter was however much
    // road happened to be generated before the land changed — so crossing
    // into new scenery called it a new chapter, and a child could be on
    // "Chapter 4" of a world with no authored chapters in it at all. Chapter
    // 1 is now The Village: ten lessons, M0 to M10, and it is over when the
    // tenth stone is passed rather than when the trees change.
    //
    // The other two worlds keep the old behaviour; they are procedural by
    // design and have no authored chapters to contradict.
    if (!onVillage) {
      setChapter((c) => c + 1);
    }
    setLoaded(false);
    setWorldReady(false);
    setStepsDone(false);
    loadSteps.current = [];
    setLandNonce((n) => n + 1);
  };

  /**
   * CLOSE THE CARD WITHOUT LEAVING THE GAME LOCKED.
   *
   * `sessionOver` blocks every keystroke — that is what makes the end of a
   * session an end — and it is cleared in exactly one place. So a card whose
   * second key only hid itself put the child on a live road with a dead
   * keyboard and nothing on screen to press: no way back but a reload. That
   * is what "stop here" did.
   *
   * It has to put the clock back as well as clear the flag. The timer fires
   * again the moment it ticks a session that is already at zero, so leaving
   * the seconds where they were would have re-ended the session on the next
   * tick and reopened the same card a second and a half later.
   *
   * What it does NOT do is reset the score. That is the whole difference
   * between the two keys: Space starts a fresh run from nothing, Enter stops
   * this one and leaves what they earned on the board. The clock waits for
   * their next keystroke either way.
   */
  const stopHere = () => {
    setFinishOpen(false);
    setSessionOver(false);
    setSessionSecs(prefs.timerMin * 60);
    lastKeyAtRef.current = 0;
    setTimerIdle(true);
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

  // What each card answers to. Rebuilt per render so the closures are never
  // stale; the ref is only so the key handler can read it without re-binding.
  cardActionRef.current =
    cardShown === "rest"
      ? { space: null, enter: () => setRestOpen(false) }
      : cardShown === "finished"
        ? { space: playAgain, enter: stopHere }
        : cardShown === "chapter"
          ? { space: crossIntoNextLand, enter: crossIntoNextLand }
          : cardShown === "graduated"
            ? { space: null, enter: () => setGraduated(false) }
            : { space: null, enter: null };

  useEffect(() => {
    if (cardShown == null) {
      setCardArmed(false);
      return;
    }
    setCardArmed(false);
    const id = setTimeout(() => setCardArmed(true), 400);
    return () => clearTimeout(id);
  }, [cardShown]);

  useEffect(() => {
    if (cardShown == null || !cardArmed) {
      return;
    }
    const onKey = (ev: KeyboardEvent) => {
      const { space, enter } = cardActionRef.current;
      const act =
        ev.key === "Enter" ? enter : ev.key === " " ? (space ?? enter) : null;
      if (act == null) {
        return;
      }
      // Or the same press also lands on the run behind the card.
      ev.preventDefault();
      ev.stopPropagation();
      act();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [cardShown, cardArmed]);

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
  // `kbCramped` is the layout's veto: the browser is too short to hold a road
  // and a keyboard at once, so the keyboard steps aside. It does not touch
  // `prefs.kbMode`, so the child's own choice comes back with the space.
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
        <div className={clsx(styles.oneWindow, onVillage && styles.joined)}>
          {onVillage && loaderPane}
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
              key={worldKey}
              className={styles.canvas}
              ref={canvasRef}
              role="img"
              aria-label={sceneDescription}
            />
            {/*
              THE STORY BUTTON. Village Road only, and only while nothing is
              being typed — see `restful`. Absent rather than dimmed: a story
              invitation in the corner of a typing exercise is a thing to look
              at instead of the keyboard.
            */}
            {prefs.world === "village" &&
              prefs.story !== false &&
              loaded &&
              restful && (
                <button
                  type="button"
                  className={clsx(styles.storyBtn, styles.storyScrap)}
                  aria-label="The story so far"
                  title="The story so far"
                  onClick={() => setStoryOpen(true)}
                >
                  <span className={styles.scrapPaper}>
                    <span className={styles.scrapRim} />
                    <span className={styles.scrapFibre} />
                    <span className={styles.scrapFace} />
                  </span>
                  <LeafBookIcon size={20} />
                  {storyUnread > 0 && <span className={styles.storyNew} />}
                </button>
              )}
            {!onVillage && (
              <span className={styles.keysChip}>
                <b>{included}</b> keys on your trail
              </span>
            )}
            {!onVillage && loaderPane}
            {onVillage ? (
              /*
                VILLAGE ROAD'S HUD: one torn sheet of newsprint with every
                figure printed on it, and no icons anywhere. See `.notice`
                in kids.module.less for how the tear and the paper are
                made. The other two worlds keep the chip stack below —
                the three games share no furniture.
              */
              <div className={styles.notice}>
                <TearDefs />
                <div className={styles.sheet}>
                  <div className={styles.rim} />
                  <div className={styles.fibre} />
                  <div className={styles.face} />
                </div>
                <div className={styles.notePrint}>
                  <span className={styles.noteHead}>
                    <span>
                      <b>{included}</b> keys
                    </span>
                    {/* The hour the ROAD is at, which after the clock
                        staging is the hour the child is at — see
                        `stagedHours`. On the same rule as the light: day
                        mode shows the daylight hour nearest their clock,
                        night mode the night hour. */}
                    <span className={styles.noteClock}>{roadClock}</span>
                  </span>
                  {prefs.timerVisible && !noClock() && (
                    <div className={styles.noteRow}>
                      <span className={styles.noteLab}>
                        {timerIdle && !sessionOver ? "Waiting" : "Timer"}
                      </span>
                      <span
                        className={clsx(
                          styles.noteVal,
                          sessionSecs <= 60 &&
                            !sessionOver &&
                            styles.timerLowNote,
                        )}
                      >
                        {Math.floor(sessionSecs / 60)}:
                        {String(sessionSecs % 60).padStart(2, "0")}
                      </span>
                    </div>
                  )}
                  <div
                    className={clsx(
                      styles.noteRow,
                      flashScore && styles.noteFlash,
                    )}
                  >
                    <span className={styles.noteLab}>Score</span>
                    <span className={styles.noteVal}>{score}</span>
                  </div>
                  <div
                    className={clsx(
                      styles.noteRow,
                      flashCombo && styles.noteFlash,
                    )}
                  >
                    <span className={styles.noteLab}>Combo</span>
                    <span className={styles.noteVal}>×{combo}</span>
                  </div>
                  <div
                    className={clsx(
                      styles.noteRow,
                      flashStage && styles.noteFlash,
                    )}
                  >
                    <span className={styles.noteLab}>
                      {stageLabel(prefs.world)}
                    </span>
                    <span className={styles.noteVal}>
                      {stageOf(prefs.world)(
                        dinoAgeOf(included, lesson.letters.length),
                      )}
                    </span>
                  </div>
                  <div
                    className={clsx(
                      styles.noteRow,
                      flashBest && styles.noteFlash,
                    )}
                  >
                    <span className={styles.noteLab}>Best</span>
                    <span className={styles.noteVal}>{best}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.hudStack}>
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
                      {stageLabel(prefs.world)}
                    </div>
                    <div className={styles.chipVal}>
                      {stageOf(prefs.world)(
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
            )}
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
                // Village Road prints it on paper — see `.growBannerRoad`.
                prefs.world === "village" && styles.growBannerRoad,
                growNonce > 0 && styles.growBannerShow,
              )}
            >
              {/* Each world says this in its own voice. It used to read
                  "your dino grew" everywhere, so a child walking the village
                  road was told about a dinosaur. Note what the village does
                  NOT say: a milestone here is distance walked, not a letter
                  earned, and borrowing the word would make the two mean the
                  same thing. */}
              {prefs.world === "village" ? (
                <>
                  <KeysIcon color="#fff" /> NEW KEY UNLOCKED — a new letter for
                  the road!
                </>
              ) : prefs.world === "hero" ? (
                <>
                  <FlagIcon size={22} color="#fff" /> NEW KEY UNLOCKED — the
                  party walks on!
                </>
              ) : (
                <>
                  <BranchIcon /> NEW KEY UNLOCKED — your dino grew!
                </>
              )}
            </div>
          </div>

          {/* The coach's line is the only thing on this page that tells a
              learner what to do next, and it changes without anything else
              changing — which for somebody listening rather than looking is a
              page that says nothing at all. Polite, so it lands after
              whatever they were reading. */}
          {/*
            The buffalo shouts from HERE rather than from a banner of its
            own across the scene, which is where it used to be — and which
            put the one message a child has to act on straight away
            somewhere they were not looking. Same line, capitals, and
            assertive so a screen reader interrupts for it, which is the
            whole point of the warning.
          */}
          <div
            className={styles.say}
            role="status"
            aria-live={alarmLine !== "" ? "assertive" : "polite"}
          >
            {alarmLine !== "" ? (
              <span className={clsx(styles.sayText, styles.sayAlarm)}>
                {alarmLine}
              </span>
            ) : (
              say !== "" && <span className={styles.sayText}>{say}</span>
            )}
          </div>

          {helperVisible && (
            <div
              ref={kbCardRef}
              className={clsx(
                styles.kbWrap,
                prefs.kbMode === "full" && styles.kbWrapFull,
                wide && styles.kbWrapWide,
                // Nothing beside it any more, so it takes the middle.
                !showHands && styles.kbWrapAlone,
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
        </div>
      )}

      {/*
        Past the day's healthy ceiling. Deliberately a card that has to be
        answered rather than a line that fades: a child who is enjoying
        themselves will type straight through a notice, and the whole point
        is to interrupt. It says the honest reason — the practice keeps
        working while they are away from it — rather than telling them off.
      */}
      {cardShown === "rest" && onVillage && (
        <RoadCard
          kind="rest"
          eyebrow="Enough for today"
          title="Rest your hands"
          keys={[{ cap: "enter", what: "to stop here", zone: "rose" }]}
        >
          <p>
            You have walked for {restMinutes} minutes today — a long way. Your
            fingers keep learning while you rest, so the road will be better
            tomorrow than it would be if you carried on now.
          </p>
        </RoadCard>
      )}

      {cardShown === "rest" && !onVillage && (
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

      {cardShown === "finished" && onVillage && (
        <RoadCard
          kind="finished"
          eyebrow="Enough walking for now"
          title="Nicely walked"
          keys={[
            { cap: "space", what: "walk on", zone: "sky", wide: true },
            { cap: "enter", what: "stop here", zone: "rose" },
          ]}
        >
          <p>{finishMsg}</p>
          <div className={styles.roadStats}>
            <div>
              <span className={styles.roadStatVal}>{score}</span>
              <span className={styles.roadStatLab}>Score</span>
            </div>
            <div>
              <span className={styles.roadStatVal}>{words}</span>
              <span className={styles.roadStatLab}>Words</span>
            </div>
            <div>
              <span className={styles.roadStatVal}>&times;{maxCombo}</span>
              <span className={styles.roadStatLab}>Best run</span>
            </div>
            <div>
              <span className={styles.roadStatVal}>{included}</span>
              <span className={styles.roadStatLab}>Keys</span>
            </div>
          </div>
          <p className={styles.roadBest}>
            {score >= best && score > 0
              ? "A NEW BEST — WELL WALKED!"
              : `your best so far: ${best}`}
          </p>
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
        </RoadCard>
      )}

      {cardShown === "finished" && !onVillage && (
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
                <div className={styles.sd}>{stageLabel(prefs.world)}</div>
                <div
                  className={styles.fstatVal}
                  style={{ color: "var(--leaf-d)" }}
                >
                  {stageOf(prefs.world)(
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
              {childCast(prefs.world) ? (
                <TentIcon size={34} color="#5c4500" />
              ) : (
                <EggIcon size={34} color="#5c4500" />
              )}
            </div>
            <div
              className={styles.cardTitle}
              style={{ justifyContent: "center" }}
            >
              {namingWho !== ""
                ? `What shall we call ${castLabel(namingWho, prefs.names)}?`
                : childCast(prefs.world)
                  ? prefs.world === "village"
                    ? "Someone joined you on the road!"
                    : "Someone joined your trail!"
                  : "Your dino hatched!"}
            </div>
            <div className={styles.finishMsg}>
              {namingWho !== ""
                ? "Pick any name you like. Leave it empty to give them their own name back."
                : childCast(prefs.world)
                  ? prefs.world === "village"
                    ? "They will walk every step of the road with you. What will you call them?"
                    : "They will walk every step of the trail with you. What will you call them?"
                  : "It will run every step of the trail with you. What will you call it?"}
            </div>
            <input
              className={styles.nameInput}
              maxLength={NAME_MAX}
              placeholder={
                namingWho !== "" ? shippedLabel(namingWho) : companionName
              }
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
            {!prefs.soundAsked && namingWho === "" && (
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

      {cardShown === "key" && ceremony != null && classic && (
        <ClassicUnlock
          letter={ceremony.letter}
          finger={
            FINGER_OF[ceremony.letter] != null
              ? FINGER_NAMES[FINGER_OF[ceremony.letter]]
              : null
          }
        />
      )}

      {/*
        THE NEW KEY, EARNED AND THEN USED.
        The document has this card leave by Space, like the others. It leaves
        by pressing the new letter three times instead, and that is a
        deliberate departure: every other card is an interruption to be waved
        away, and this one is the first three strokes of the thing just
        earned. A cap that has to be pressed teaches more than a cap that is
        only looked at.
      */}
      {cardShown === "key" && ceremony != null && !classic && onVillage && (
        <RoadCard
          kind="key"
          eyebrow="A new letter"
          letter={ceremony.letter}
          finger={
            FINGER_OF[ceremony.letter] != null
              ? FINGER_NAMES[FINGER_OF[ceremony.letter]]
              : null
          }
          keys={[
            {
              cap: ceremony.letter.toUpperCase(),
              what: `${3 - ceremony.presses} more to wake it`,
              zone: ZONE_OF[ceremony.letter] ?? "clay",
            },
          ]}
        >
          <p>
            Cut fresh into the stone at the roadside. Press it three times and
            it is yours.
          </p>
          <div className={styles.roadTally} aria-hidden={true}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={clsx(
                  styles.roadTick,
                  i < ceremony.presses && styles.roadTickOn,
                )}
              />
            ))}
          </div>
        </RoadCard>
      )}

      {cardShown === "key" && ceremony != null && !classic && !onVillage && (
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
      {/*
        THE CHARACTER REVEAL, and not on Village Road.
        It is a hatching-egg idea from Dino Run — a badge announcing that
        somebody has joined. On this road the cast are time-travellers who
        catch you up, and the story panel is where that is told. A card
        popping up to say "Puppy joined!" contradicts it.
      */}
      {!onVillage && hatched != null && cardShown == null && (
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
      {cardShown === "graduated" && onVillage && (
        <RoadCard
          kind="graduated"
          eyebrow="The whole alphabet"
          title="Every letter, walked"
          keys={[{ cap: "enter", what: "to carry on", zone: "rose" }]}
        >
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
          <p>
            Every single letter, {prefs.name || "friend"} — you did that. There
            are bigger keys out there now.
          </p>
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
          </div>
        </RoadCard>
      )}

      {cardShown === "graduated" && !onVillage && (
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

      {/*
        THE MAP AND THE CROSSING WERE TWO WINDOWS FOR ONE EVENT. The trail
        map opened on a 900ms timer and the land card rendered at once, so
        crossing a chapter put two overlays on screen in the wrong order.
        One card now, with the road drawn inside it.
      */}
      {cardShown === "chapter" && onVillage && (
        <RoadCard
          kind="chapter"
          eyebrow={`Chapter ${chapter}`}
          title={peekNextLandName()}
          keys={[{ cap: "enter", what: "to walk on", zone: "rose" }]}
        >
          <p>
            {landName} is behind you. {dinoName()} walks on, and the road bends
            toward {peekNextLandName()}.
          </p>
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
                    <FlagIcon
                      size={here ? 18 : 16}
                      color={here ? undefined : next ? "#7a6c4f" : "#b9b9a9"}
                    />
                    <span className={styles.mapStopName}>{name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </RoadCard>
      )}

      {cardShown === "chapter" && !onVillage && (
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

      {storyOpen && (
        <StoryDoc
          stones={prefs.roadStones ?? 0}
          graduated={included >= lesson.letters.length}
          fill={(t) =>
            fillSay(t, {
              name: villagerName(),
              mate: companionLabel(),
              guide: guideLabel(),
              years: yearsBack(),
              year: String(VILLAGE_YEAR),
            })
          }
          onRead={(text) => {
            // The same voice the coach uses, and the same rule: typing stops
            // it. `speakLine` already replaces whatever is playing, so a
            // second tap on another part swaps rather than overlaps.
            unlockVoice();
            speakLine(text, cfg.speechRate);
          }}
          onClose={() => {
            stopSpeaking();
            setStoryOpen(false);
            // Everything open has now been read, so the mark goes.
            if (storyUnread > 0) {
              savePrefs({ storyRead: storyOpenCount });
            }
          }}
        />
      )}
      {settingsOpen && (
        <SettingsCard
          prefs={prefs}
          included={included}
          savePrefs={savePrefs}
          onRename={(who) => {
            // Hidden rather than closed: the naming card is an overlay and
            // two stacked overlays read as a mistake. `finishNaming` puts it
            // back up.
            setSettingsOpen(false);
            setNamingWho(who);
            // Pre-filled with whatever they are called now, so Rename opens on
            // the current name rather than on an empty box a child has to work
            // out the purpose of.
            setDraftName(castLabel(who, prefs.names));
            setNameOpen(true);
          }}
          totalLetters={lesson.letters.length}
          onPickCharacter={(who, forWorld) => {
            // One handler for all three worlds, writing to whichever pref
            // that world keeps its choice in. `forWorld` is the world the
            // PANEL is showing, which is not always the one running: the
            // change waits for the way out, so a choice made while browsing
            // Hero Trail has to land in the Hero Trail's slot.
            const key =
              forWorld === "village"
                ? "village"
                : forWorld === "hero"
                  ? "hero"
                  : "dino";
            // Playing as somebody sends them home as your friend — you
            // cannot walk beside yourself. Dino Run has no companions, so
            // this only ever bites in the two worlds that do.
            const was = companionsOf({ ...prefs, world: forWorld });
            const now = childCast(forWorld)
              ? was.filter((id) => id !== who)
              : was;
            savePrefs({
              [key]: who,
              companionsByWorld: {
                ...prefs.companionsByWorld,
                [forWorld]: now,
              },
              companions: now,
              companion: now[0] ?? null,
            } as Partial<Prefs>);
            // The running world is only told when the choice is ITS choice.
            if (forWorld !== prefs.world) {
              return;
            }
            worldRef.current?.setPlayer(who).catch(() => {});
            if (now.length !== was.length) {
              worldRef.current?.setCompanions(now).catch(() => {});
            }
          }}
          onPickWorld={(world) => {
            savePrefs({ world });
          }}
          onPickCompanion={(who, forWorld) => {
            // TAPPING SOMEBODY TOGGLES THEM, and `null` is "nobody at all".
            //
            // Two is the ceiling, and a third tap takes the one who has been
            // in the line longest rather than refusing: a pill that does
            // nothing when pressed is a pill a child presses again harder.
            const now = companionsOf({ ...prefsRef.current, world: forWorld });
            const next =
              who == null
                ? []
                : now.includes(who)
                  ? now.filter((id) => id !== who)
                  : [...now, who].slice(-2);
            const ordered = companionsOf({
              companions: next,
              companion: null,
              world: forWorld,
            });
            savePrefs({
              companionsByWorld: {
                ...prefsRef.current.companionsByWorld,
                [forWorld]: ordered,
              },
              // The pre-split fields are kept in step so a profile written
              // here still reads correctly anywhere not yet moved over.
              companions: ordered,
              companion: ordered[0] ?? null,
            });
            // Only if this is the running world's own party — see above.
            if (forWorld === prefsRef.current.world) {
              worldRef.current?.setCompanions(ordered).catch(() => {});
            }
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
  readonly world: WorldId;
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
  readonly world: WorldId;
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
  onPickCharacter,
  onPickCompanion,
  onPickWorld,
  onPickTimer,
  onClose,
}: {
  readonly prefs: Prefs;
  readonly included: number;
  /** Letters in this layout's alphabet, so "all of them" is not hardcoded. */
  readonly totalLetters: number;
  readonly savePrefs: (patch: Partial<Prefs>) => void;
  /** Rename one character, by model id — see Prefs.names. */
  readonly onRename: (who: string) => void;
  readonly onPickCharacter: (who: string, world: WorldId) => void;
  /** Toggle one companion in or out of the line, or `null` for nobody. */
  readonly onPickCompanion: (companion: string | null, world: WorldId) => void;
  /** Change worlds. Called once, on the way out — see worldDraft. */
  readonly onPickWorld: (world: WorldId) => void;
  readonly onPickTimer: (min: number) => void;
  readonly onClose: () => void;
}) {
  const pill = (on: boolean) => clsx(styles.pill, on && styles.pillOn);
  // The two children, minus whoever is being played. Derived rather than
  // listed so it cannot fall out of step with the roster, and so a third
  // character needs nothing here.
  /**
   * WHO MAY WALK WITH YOU — everyone but yourself.
   *
   * Filtered against whoever the child is actually playing AS, which is not
   * the same thing as `prefs.hero`: that is the Hero Trail's pick and it
   * holds a value in every world. Village Road stores its choice in
   * `prefs.village`, so filtering on `prefs.hero` struck Dave off the
   * companion list on the village road whenever he happened to be somebody's
   * hero-world character — which, since he is that world's default, was
   * almost everybody — while cheerfully offering to bring you along with
   * yourself the moment you played as him here.
   *
   * Village Road's earned hatchlings join this list rather than the character
   * one. They are companions by design — see HATCHLINGS in album.ts, which
   * says so — and the buffalo at twenty keys is the clearest case: it is a
   * wild animal a child is finally allowed to WALK WITH, not one they are
   * asked to be.
   */
  /**
   * THE WORLD IS CHOSEN HERE AND CHANGED ON THE WAY OUT.
   *
   * Tapping a world used to save it there and then, which tore the running
   * scene down and rebuilt it while the settings card was still open — a
   * child browsing the three of them set three worlds building behind a panel
   * they were still reading, and whichever they looked at last was the one
   * they got, several seconds after they had stopped caring. Now the pill
   * records a choice and "Back to the run!" acts on it, which is also what
   * makes that button mean something.
   */
  const [worldDraft, setWorldDraft] = useState<WorldId>(prefs.world);
  const leaveSettings = () => {
    if (worldDraft !== prefs.world) {
      onPickWorld(worldDraft);
    }
    onClose();
  };

  /**
   * THE PANEL DESCRIBES THE WORLD BEING CHOSEN, not the one still running.
   *
   * The world change waits for "Back to the run!", which is right — but it
   * left every row below the picker talking about the old game: tap Hero
   * Trail and the cast row still offered the village's three children and the
   * friend row still said Robot and Peeli were coming along. A settings panel
   * that shows one world's options under another world's name is worse than
   * one that switches immediately.
   *
   * So the rows read from a view of the preferences with the DRAFTED world in
   * it, and the pick handlers are told which world they are writing for. What
   * is saved is still whichever world's own slot the choice belongs to.
   */
  const view: Prefs = { ...prefs, world: worldDraft };
  const playingAs = charOf(view);
  /**
   * WHO MAY WALK WITH YOU, WHICH IS NOT THE SAME LIST IN BOTH WORLDS.
   *
   * Hero Trail offers the puppy and nobody else. Its cast is a knight, a
   * skeleton and two children out of another world's story, and a party of
   * them walking the same trail turns a hero's road into a school outing —
   * the one companion that belongs beside a lone hero is a dog.
   *
   * Village Road is the opposite case and offers everybody, because it is a
   * place people live: the three children, the robot, the puppy, and whatever
   * has been earned along the road — the buffalo at twenty keys included.
   */
  const companionChoices = [
    ...COMPANIONS,
    ...HATCHLINGS.village.filter(
      ({ id, at }) => included >= at && !COMPANIONS.some((c) => c.id === id),
    ),
  ].filter(({ id }) => id !== playingAs && walksIn(worldDraft, id));
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
  /** The hour setting is Village Road's alone — see the row below. */
  const onRoad = trail && prefs.world === "village";
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
                      {/*
                        VILLAGE ROAD FIRST. It is the one this app is built
                        around and the one most children will stay in, and a
                        row of choices says which is the main one by where it
                        puts it — the other two were in front of it only
                        because they were written first.

                        Named "Road" rather than "Trail" on purpose: two of
                        the three would otherwise end in the same word, and a
                        child picking by shape — or a parent scanning the row
                        — would have to read carefully to tell them apart.
                      */}
                      <button
                        type="button"
                        className={pill(worldDraft === "village")}
                        onClick={() => setWorldDraft("village")}
                      >
                        Village Road
                      </button>
                      <button
                        type="button"
                        className={pill(worldDraft === "dino")}
                        onClick={() => setWorldDraft("dino")}
                      >
                        Dino Run
                      </button>
                      <button
                        type="button"
                        className={pill(worldDraft === "hero")}
                        onClick={() => setWorldDraft("hero")}
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
                {trail && childCast(worldDraft) && (
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
                        // AND NOTHING SPOOKY ON VILLAGE ROAD AT ALL.
                        //
                        // A Kerala cart road after dark is oil lamps, a lit
                        // temple and a buffalo in the field — it is somewhere
                        // people live, which is the whole reason this world
                        // exists as a third rather than a re-skin of Hero
                        // Trail. Spookiness is that other world's idea, and
                        // the two pills that offer it were offering to turn
                        // this one into it.
                        .filter(
                          ([value]) =>
                            worldDraft !== "village" ||
                            (value !== "mild" && value !== "full"),
                        )
                        .map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={pill(nightStyleOf(view) === value)}
                            onClick={() =>
                              savePrefs({
                                nightStyleByWorld: {
                                  ...prefs.nightStyleByWorld,
                                  [worldDraft]: value,
                                },
                                nightStyle: value,
                              })
                            }
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
                    {/*
                      The local boy. Village Road only — the other two worlds
                      have nobody to guide anybody.
                    */}
                    {worldDraft === "village" && (
                      <div className={styles.srow}>
                        <span
                          className={styles.ri}
                          style={{ background: "var(--sand)" }}
                        >
                          <PawIcon size={24} color="#7a5c00" />
                        </span>
                        <div>
                          <div className={styles.sl}>
                            {castLabel(VILLAGE_GUIDE, prefs.names)} shows you
                            round
                          </div>
                          <div className={styles.sd}>
                            the boy from the village who knows the road
                          </div>
                        </div>
                        <div className={styles.ctl}>
                          <button
                            type="button"
                            className={pill(prefs.guide !== false)}
                            onClick={() => savePrefs({ guide: true })}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            className={pill(prefs.guide === false)}
                            onClick={() => savePrefs({ guide: false })}
                          >
                            No
                          </button>
                          {/*
                            He is renameable like anybody else — which is the
                            whole reason every line says {guide} rather than
                            his name. Offered only while he is coming along:
                            naming somebody who is switched off is a button
                            with nothing behind it.
                          */}
                          {prefs.guide !== false && (
                            <button
                              type="button"
                              className={styles.pill}
                              onClick={() => onRename(VILLAGE_GUIDE)}
                            >
                              Rename
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {worldDraft === "village" && (
                      <div className={styles.srow}>
                        <span
                          className={styles.ri}
                          style={{ background: "var(--sand)" }}
                        >
                          <LeafBookIcon size={22} color="#7a5c00" />
                        </span>
                        <div>
                          <div className={styles.sl}>The story</div>
                          <div className={styles.sd}>
                            where they came from, a bit at a time
                          </div>
                        </div>
                        <div className={styles.ctl}>
                          <button
                            type="button"
                            className={pill(prefs.story !== false)}
                            onClick={() => savePrefs({ story: true })}
                          >
                            On
                          </button>
                          <button
                            type="button"
                            className={pill(prefs.story === false)}
                            onClick={() => savePrefs({ story: false })}
                          >
                            Off
                          </button>
                        </div>
                      </div>
                    )}
                    {/*
                      NO STICKER ALBUM ROW. The album is still collected —
                      hatchlings, lands and streaks all still file their
                      stickers, and album.test.ts still holds that to account —
                      it simply is not offered from here any more.
                    */}
                    <div className={styles.srow}>
                      <span
                        className={styles.ri}
                        style={{ background: "var(--sage)" }}
                      >
                        <PawIcon size={24} color="#3d6b2e" />
                      </span>
                      <div>
                        <div className={styles.sl}>
                          {castLabel(charOf(view), prefs.names)}
                        </div>
                        <div className={styles.sd}>who you play as</div>
                      </div>
                      {/*
            Both worlds work the same way now: a couple of starters, then a
            companion earned every four keys. The hero world used to hand out
            both of its characters for free and have nothing after them, which
            left the default world for the youngest bands with no rewards at
            all.
          */}
                      <div className={styles.ctl}>
                        {charactersOf(worldDraft).map(({ id }) => (
                          <button
                            key={id}
                            type="button"
                            className={pill(charOf(view) === id)}
                            onClick={() => onPickCharacter(id, worldDraft)}
                          >
                            {castLabel(id, prefs.names)}
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
                        {/*
              THE DINO WORLD'S HATCHLINGS, AND ONLY ONCE THEY HAVE HATCHED.
              
              Dino is the one world whose hatchlings are characters a child
              PLAYS AS — Vela, Steggy, Tops are its whole cast past the first
              one. Village Road's are companions, which is what album.ts says
              they are, so Puppy and Robot were being offered here as people
              to be rather than to walk with; they have moved to the friend
              row below, the buffalo with them. Hero's were already gone.

              The locked eggs are gone too. They were greyed pills reading
              "12 keys", "16 keys", "20 keys" — a row of buttons that could
              not be pressed, in the one place a child comes to press buttons,
              mostly saying how much of the toy box is shut. A hatchling is a
              surprise, and announcing the date of a surprise spends it early.

              Nothing stops hatching: they still celebrate and still earn
              their album sticker — see the album test that protects it.
            */}
                        {(worldDraft === "dino" ? HATCHLINGS.dino : [])
                          .filter(({ at }) => included >= at)
                          .map(({ id }) => (
                            <button
                              key={id}
                              type="button"
                              className={pill(charOf(view) === id)}
                              onClick={() => onPickCharacter(id, worldDraft)}
                            >
                              {castLabel(id, prefs.names)}
                            </button>
                          ))}
                        <button
                          type="button"
                          className={styles.pill}
                          onClick={() => onRename(charOf(view))}
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
                    {childCast(worldDraft) && companionChoices.length > 0 && (
                      <div className={styles.srow}>
                        <span
                          className={styles.ri}
                          style={{ background: "var(--sky)" }}
                        >
                          <PawIcon size={24} color="#2f5d7a" />
                        </span>
                        <div>
                          <div className={styles.sl}>
                            {companionsOf(view).length === 0
                              ? "Who comes with you?"
                              : `${companionsOf(view)
                                  .map((id) => castLabel(id, prefs.names))
                                  .join(" and ")} ${
                                  companionsOf(view).length > 1
                                    ? "come"
                                    : "comes"
                                } with you`}
                          </div>
                          {/*
                            Says what they ARE, not what they do. The old line
                            promised "they copy what you do, a moment later",
                            which is only true of where they walk — they do
                            not copy the resting, the celebrating or any of
                            the rest of it, so a child who read that line and
                            then watched them was being told something the
                            game does not do.
                          */}
                          <div className={styles.sd}>
                            walks the road with you
                          </div>
                        </div>
                        <div className={styles.ctl}>
                          <button
                            type="button"
                            className={pill(companionsOf(view).length === 0)}
                            onClick={() => onPickCompanion(null, worldDraft)}
                          >
                            Nobody
                          </button>
                          {companionChoices.map(({ id }) => (
                            <button
                              key={id}
                              type="button"
                              className={pill(companionsOf(view).includes(id))}
                              onClick={() => onPickCompanion(id, worldDraft)}
                            >
                              {castLabel(id, prefs.names)}
                            </button>
                          ))}
                          {/*
                            NO RENAME BUTTON HERE. A name belongs to the
                            character, not to the job — renaming Dave in the
                            row above renames him here too, because he is the
                            same person. A second button that did the same
                            thing to the same people would only raise the
                            question of why there are two.
                          */}
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
                {/*
                  VILLAGE ROAD ONLY. The other two worlds are staged at
                  midday on purpose and have no hour to set — offering the
                  control there would be offering a switch that does nothing.
                */}
                {onRoad && (
                  <div className={styles.srow}>
                    <span
                      className={styles.ri}
                      style={{ background: "var(--sand)" }}
                    >
                      <ClockIcon color="#7a5c00" />
                    </span>
                    <div>
                      <div className={styles.sl}>Time of day</div>
                      <div className={styles.sd}>
                        {prefs.dayHour === "auto"
                          ? "follows your own clock — the road is lit for the hour you are playing"
                          : "the road stays at the time you picked"}
                      </div>
                      <div className={styles.pillRow}>
                        {(
                          [
                            ["auto", "Auto"],
                            [7, "Early"],
                            [9, "Morning"],
                            [12, "Midday"],
                            [15, "Afternoon"],
                            [17, "Evening"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={label}
                            type="button"
                            className={pill(prefs.dayHour === value)}
                            onClick={() => savePrefs({ dayHour: value })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {trail && (
                  <div className={styles.srow}>
                    <span
                      className={styles.ri}
                      style={{ background: "var(--sky)" }}
                    >
                      <KeysIcon color="#1f4f7a" />
                    </span>
                    <div>
                      <div className={styles.sl}>Space bar hop</div>
                      <div className={styles.sd}>
                        off, and the space bar is just a key
                      </div>
                    </div>
                    <div className={styles.ctl}>
                      <button
                        type="button"
                        className={pill(prefs.spaceJump !== false)}
                        onClick={() =>
                          savePrefs({ spaceJump: prefs.spaceJump === false })
                        }
                      >
                        {prefs.spaceJump !== false ? "On" : "Off"}
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
        <div className={styles.ctaRow}>
          {/*
            Only offered when there is something to cancel. A button that
            does the same thing as the one beside it is a button a child has
            to think about, and there is nothing to undo until a different
            world has been picked — everything else on this card takes effect
            as it is tapped and is undone by tapping it back.
          */}
          {worldDraft !== prefs.world && (
            <button
              type="button"
              className={clsx(styles.cta, styles.ctaQuiet)}
              onClick={() => {
                setWorldDraft(prefs.world);
                onClose();
              }}
            >
              Cancel
            </button>
          )}
          <button type="button" className={styles.cta} onClick={leaveSettings}>
            {trail ? "Back to the run!" : "Back to typing!"}
          </button>
        </div>
      </div>
    </div>
  );
}
