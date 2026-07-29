import { keyboardProps, KeyboardProvider } from "@keybr/keyboard";
import { Lesson, lessonProps, LessonType } from "@keybr/lesson";
import { LessonLoader } from "@keybr/lesson-loader";
import {
  loadNgramStats,
  profileStorageKey,
  saveNgramStats,
} from "@keybr/pages-shared";
import { MutableKeyStatsMap, Result, useResults } from "@keybr/result";
import { SettingsContext, useSettings } from "@keybr/settings";
import {
  Feedback,
  flattenStyledText,
  makeStats,
  TextInput,
  toTextInputSettings,
} from "@keybr/textinput";
import { clsx } from "clsx";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { type AgeBand, bandConfig, currentAge, currentBand } from "./age.ts";
import { kidsAudio } from "./audio.ts";
import {
  BranchIcon,
  ChatIcon,
  ClockIcon,
  DinoFill,
  EggIcon,
  FlagIcon,
  FlameIcon,
  GearIcon,
  HandIcon,
  KeysIcon,
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
} from "./keyboard-data.ts";
import * as styles from "./kids.module.less";
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
const BEST_KEY = () => profileStorageKey("kids.best");
const PREFS_KEY = () => profileStorageKey("kids.prefs");

type KbMode = "off" | "simple" | "full";

type Prefs = {
  world: "dino" | "hero";
  dino: string;
  hero: string;
  name: string;
  bigLetters: boolean;
  sounds: boolean;
  hands: boolean;
  kbMode: KbMode;
  timerVisible: boolean;
  timerMin: number;
  cheers: boolean;
  night: boolean;
  /** Scene look: brightness (~0.7–1.3) and paleness (0 = full colour, 1 = pale). */
  brightness: number;
  paleness: number;
  /** Ambient character motion: 1 = full liveliness, 0 = characters hold still. */
  motion: number;
  /** Show the practice word as 3-D letter blocks in the world (older bands opt
   * in; the youngest always get it). */
  wordBlocks: boolean;
};

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
    hero: "Knight",
    name: "",
    bigLetters: cfg.bigLetters,
    sounds: false,
    hands: cfg.hands,
    kbMode: cfg.kbMode,
    timerVisible: false,
    timerMin: cfg.timerMin,
    cheers: true,
    night: false,
    brightness: 1,
    paleness: 0,
    motion: 0.7,
    wordBlocks: false,
  };
}

function loadPrefs(): Prefs {
  try {
    return {
      ...defaultPrefs(),
      ...JSON.parse(localStorage.getItem(PREFS_KEY()) ?? "{}"),
    };
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
    "An egg hatched — {dino} joined the herd! (see settings)",
    "Crack… crack… {dino} hatched! Say hi in settings!",
    "A wild egg wobbled and out popped {dino}! (find them in settings)",
  ],
  streak: [
    "{name} is SO proud — 10 in a row!",
    "TEN in a row! {name} does a happy hop!",
    "Ten perfect steps — the herd can't believe it!",
    "10 straight! Your fingers know the trail by heart!",
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

const saysOf = (world: "dino" | "hero") =>
  world === "hero"
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

const pickSay = (list: readonly string[]) =>
  list[Math.floor(Math.random() * list.length)];

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

/** Dinos hatch from eggs as the trail grows — they are earned, not picked. */
const HATCHLINGS = [
  { id: "Velociraptor", label: "Vela", at: 8 },
  { id: "Triceratops", label: "Tops", at: 10 },
] as const;

// The Hero Trail heroes you can BE — reserved for the main character so the
// trail companions never look like you.
const HERO_CHARACTERS = [
  { id: "Knight", label: "Knight" },
  { id: "Skeleton_Warrior", label: "Skeleton" },
] as const;

function peekNextLandName(): string {
  try {
    const n = Number(localStorage.getItem(profileStorageKey("kids.land")) ?? 0);
    return LANDS[n % LANDS.length].name;
  } catch {
    return LANDS[0].name;
  }
}

const FINISH_MSGS = [
  "Your fingers are getting SO fast — the herd can barely keep up!",
  "Your dino grew because of YOU. Amazing typing today!",
  "Every letter you typed was a step home. Brilliant run!",
  "The whole herd is cheering around the campfire. You did that!",
  "Super steady fingers today — see you on the trail tomorrow!",
];

export function KidsPage() {
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
  const kids = useMemo(
    () =>
      settings
        .set(lessonProps.type, LessonType.GUIDED)
        .set(lessonProps.guided.kidsWords, true)
        // New letters unlock at an age-appropriate speed, so a six-year-old
        // sees the trail grow at the same emotional pace as a ten-year-old.
        .set(lessonProps.targetSpeed, bandConfig(currentBand()).targetCpm),
    [settings],
  );
  return (
    <SettingsContext.Provider value={{ settings: kids, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

function KidsGame({ lesson }: { readonly lesson: Lesson }) {
  const { settings } = useSettings();
  const { results, appendResults } = useResults();
  const [, forceTick] = useReducer((n: number) => n + 1, 0);
  // The age band is fixed for the visit; the page remounts on profile switch.
  const band = useMemo(currentBand, []);
  const cfg = bandConfig(band);

  const [prefs, setPrefs] = useState(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
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
  // On-screen full-board modifier state — mirrors the real keyboard so Caps and
  // Shift flip the letters to capitals (lowercase by default) and Tab/Enter/
  // Backspace light up when pressed, just like the grown-up board.
  const [capsOn, setCapsOn] = useState(false);
  const [shiftOn, setShiftOn] = useState(false);
  const [specialKey, setSpecialKey] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(() => loadPrefs().name);

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(loadBest);
  const [combo, setCombo] = useState(1);
  const [maxCombo, setMaxCombo] = useState(1);
  const [words, setWords] = useState(0);
  const [say, setSay] = useState(() =>
    fillSay(pickSay(saysOf(loadPrefs().world).start), {
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
  const [finishMsg, setFinishMsg] = useState(FINISH_MSGS[0]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loaderRef = useRef<HTMLCanvasElement>(null);
  const sceneCardRef = useRef<HTMLDivElement>(null);
  const kbCardRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<KidsWorld | null>(null);
  const textInputRef = useRef<TextInput | null>(null);
  const passageRef = useRef("");
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

  const savePrefs = (patch: Partial<Prefs>) => {
    setPrefs((old) => {
      const next = { ...old, ...patch };
      try {
        localStorage.setItem(PREFS_KEY(), JSON.stringify(next));
      } catch {
        // Storage may be unavailable.
      }
      return next;
    });
  };

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
        },
      }),
    );
  }, [prefs.sounds, prefs.night, included]);
  // Each world has its own voice: the dino arcade blips, the hero storybook
  // chimes (and its bored idle babble).
  useEffect(() => {
    kidsAudio.setTheme(prefs.world === "hero" ? "hero" : "dino");
  }, [prefs.world]);
  // Live brightness/paleness/motion sliders — apply to the running scene now.
  useEffect(() => {
    worldRef.current?.setLook(prefs.brightness, prefs.paleness);
  }, [prefs.brightness, prefs.paleness]);
  useEffect(() => {
    worldRef.current?.setMotion(prefs.motion);
  }, [prefs.motion]);
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
      // Did the trail reach an egg?
      for (const { id, label, at } of HATCHLINGS) {
        if (prevIncluded.current < at && included >= at) {
          speak("hatch", { dino: label });
          if (prefsRef.current.sounds) {
            kidsAudio.playSuccess();
          }
        }
      }
    }
    prevIncluded.current = included;
    prevLettersRef.current = letters;
  }, [included, lessonKeys]);

  const dinoName = () =>
    prefsRef.current.name ||
    (prefsRef.current.world === "hero" ? "Your hero" : "Your dino");
  // The runner's current growth (0 → 1), kept fresh for the say-lines.
  const dinoAgeRef = useRef(0);
  dinoAgeRef.current = dinoAgeOf(included, lesson.letters.length);

  const speak = (key: keyof typeof SAYS, vars: Record<string, string> = {}) => {
    const age = dinoAgeRef.current;
    const world = prefsRef.current.world;
    setSay(
      fillSay(pickSay(agedPool(saysOf(world), key, age)), {
        name: dinoName(),
        stage: (world === "hero" ? heroStage : dinoStage)(age),
        ...vars,
      }),
    );
  };

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
    if (included < lesson.letters.length && included < cfg.fullPassageAt) {
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
  }, [lesson, lessonKeys, included, settings, regenNonce]);

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
    const world = createKidsWorld(canvas, pickLand(theme.lands), theme);
    worldRef.current = world;
    setLandName(world.land.name);
    world.startRun();
    const loader =
      loaderRef.current != null
        ? createLoaderScene(loaderRef.current, theme)
        : null;
    world.ready
      .then(() => {
        if (prefsRef.current.night) {
          world.setNight(true);
        }
        world.setLook(prefsRef.current.brightness, prefsRef.current.paleness);
        world.setMotion(prefsRef.current.motion);
        // Push the passage straight away so the 3-D letters appear on a fresh
        // world (e.g. after switching games) without needing a refresh.
        if (currentBand() === "5-6") {
          world.setWord(passageRef.current, textInputRef.current?.pos ?? 0);
        }
        // The runner carries its age (baby → adult, size and all) across
        // rebuilds and character swaps.
        world.setAge(dinoAgeOf(included, lesson.letters.length));
        if (chosen !== theme.defaultPlayer) {
          return world.setPlayer(chosen);
        }
        return;
      })
      .finally(() => {
        loader?.dispose();
        setLoaded(true);
      });
    const observer = new ResizeObserver(() => world.resize());
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      loader?.dispose();
      world.dispose();
      worldRef.current = null;
    };
  }, [landNonce, prefs.world]);

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
  }, [prefs.kbMode, prefs.hands]);

  // Refs mirror the bits of state the one-time key listener needs.
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const blockedRef = useRef(false);
  blockedRef.current =
    settingsOpen ||
    finishOpen ||
    sessionOver ||
    nameOpen ||
    mapOpen ||
    ceremony != null;

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key.length !== 1 || ev.ctrlKey || ev.metaKey || ev.altKey) {
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
          if (cer.presses + 1 >= 3) {
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
      kidsAudio.init(); // browsers unlock audio on first input
      const now = performance.now();
      if (now - lastKeyAtRef.current < 25) {
        return; // synthetic double-dispatch guard
      }
      lastKeyAtRef.current = now;
      ev.preventDefault();
      const key = ev.key.toLowerCase();
      setPressed(key);
      clearTimeout(pressedTimer.current);
      pressedTimer.current = setTimeout(() => setPressed(null), 110);

      const { sounds, cheers } = prefsRef.current;
      if (key === " ") {
        worldRef.current?.jump(); // space always jumps, right or wrong
        if (sounds) {
          kidsAudio.playJump();
        }
      }
      const timeStamp = ev.timeStamp;
      const timeToType =
        lastStampRef.current > 0 ? timeStamp - lastStampRef.current : 0;
      lastStampRef.current = timeStamp;
      const feedback = textInput.appendChar(
        timeStamp,
        key.codePointAt(0)!,
        timeToType,
      );
      const passage = passageRef.current;
      const pos = textInput.pos;
      if (feedback === Feedback.Succeeded || feedback === Feedback.Recovered) {
        missStreakRef.current = 0;
        stuckRef.current = { pos: -1, misses: 0 };
        setStuckHelp(false);
        worldRef.current?.setProgress(pos / Math.max(1, passage.length));
        worldRef.current?.burstAtPlayer([0xd9c9a3, 0xcbb98f], 4, 0.1);
        streakRef.current += 1;
        if (streakRef.current % cfg.hopEvery === 0) {
          worldRef.current?.hop();
          speak("streak");
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
        setScore((s) => saveBest(s + 1));
        if (sounds && key !== " ") {
          kidsAudio.playMove();
        }
        if (pos > 0 && passage[pos - 1] === " ") {
          setScore((s) => saveBest(s + 5));
          setWords((w) => w + 1);
          if (sounds) {
            kidsAudio.playPoint();
          }
        }
        if (cheers && Math.random() < cfg.cheerChance) {
          setSay(
            fillSay(pickSay(cheerPool(saysOf(prefsRef.current.world), band)), {
              name: dinoName(),
            }),
          );
        }
        if (textInput.completed) {
          setScore((s) => saveBest(s + 10));
          setWords((w) => w + 1);
          speak("camp");
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
            // The same record the grown-up mode saves — the algorithm learns
            // from every kids run too.
            appendResults([result]);
          } else {
            setRegenNonce((n) => n + 1);
          }
          // Every third camp, the trail map opens and the herd crosses into
          // a brand-new land.
          roundsRef.current += 1;
          if (roundsRef.current % 3 === 0) {
            setTimeout(() => setMapOpen(true), 900);
          }
        }
      } else {
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
          if (sounds) {
            kidsAudio.playRoar();
          }
          if (cheers && stuckRef.current.misses < cfg.rescueMisses) {
            speak("roar");
          }
        } else {
          if (sounds) {
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

  // ── the session timer (runs even when hidden) ──────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (blockedRef.current) {
        return;
      }
      setSessionSecs((secs) => {
        if (secs <= 1) {
          setSessionOver(true);
          setFinishMsg(
            FINISH_MSGS[Math.floor(Math.random() * FINISH_MSGS.length)],
          );
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
      const last = lastKeyAtRef.current;
      if (performance.now() - (last || 0) > 10000) {
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
    speak("crossed", {
      chapter: String(chapter + 1),
      land: peekNextLandName(),
    });
    setChapter((c) => c + 1);
    setLoaded(false);
    setLandNonce((n) => n + 1);
  };

  const playAgain = () => {
    setFinishOpen(false);
    setSessionOver(false);
    setSessionSecs(prefs.timerMin * 60);
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
    band === "5-6" ||
    ((band === "7-8" || band === "9-10") && prefs.wordBlocks);
  useEffect(() => {
    // Feed the whole passage; the world lays it out as one gliding ribbon so
    // there is no jumpy per-word rebuild.
    worldRef.current?.setWord(use3dWord ? passage : "", pos);
  }, [use3dWord, passage, pos, loaded, landNonce]);
  // A sliding window keeps the current letter in view — real lessons are far
  // longer than the pane is wide.
  const winStart = Math.max(0, pos - 12);
  const winChars = [...passage].slice(winStart, winStart + 42);
  const sessionTotal = prefs.timerMin * 60;
  const kbVisible = prefs.kbMode !== "off";
  const helperVisible = kbVisible || prefs.hands;
  const wide = kbVisible && (prefs.kbMode === "full" || prefs.hands);

  return (
    <div
      className={clsx(styles.root, prefs.night && styles.rootDark)}
      style={{ fontFamily: cfg.font }}
    >
      <div className={styles.sceneCard} ref={sceneCardRef}>
        <canvas className={styles.canvas} ref={canvasRef} />
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
        <div className={clsx(styles.hudRight, use3dWord && styles.hudBottom)}>
          {prefs.timerVisible && (
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
                <div className={styles.chipLab}>Timer</div>
                <div
                  className={clsx(
                    styles.chipVal,
                    sessionSecs <= 60 && !sessionOver && styles.timerLow,
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
              <div className={styles.chipLab}>{prefs.world === "hero" ? "Hero level" : "Dino stage"}</div>
              <div className={styles.chipVal}>
                {(prefs.world === "hero" ? heroStage : dinoStage)(dinoAgeOf(included, lesson.letters.length))}
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
          <div className={styles.words}>
          {winChars.map((ch, i) => {
            const at = winStart + i;
            return (
              <span
                key={at}
                className={
                  at < pos ? styles.hit : at === pos ? styles.cur : undefined
                }
              >
                {ch === " " ? " " : prefs.bigLetters ? ch.toUpperCase() : ch}
              </span>
            );
          })}
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

      <div className={styles.say}>{say}</div>

      {helperVisible && (
        <div
          ref={kbCardRef}
          className={clsx(
            styles.kbWrap,
            prefs.kbMode === "full" && styles.kbWrapFull,
            wide && styles.kbWrapWide,
          )}
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
          {prefs.hands && (
            <div className={styles.hands}>
              <div className={styles.handsArt}>
                <img src="/kids-assets/hands.png" alt="" />
                {FINGER_DOTS.map(({ id, left, top }) => (
                  <span
                    key={id}
                    className={clsx(
                      styles.fingerDot,
                      id === nextFinger && styles.fingerDotOn,
                      id === nextFinger && stuckHelp && styles.fingerDotStrong,
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
          {kbVisible && (
            <div className={styles.kb}>
              {(prefs.kbMode === "full" ? FULL_ROWS : SIMPLE_ROWS).map(
                (row, r) => (
                  <div key={r} className={styles.krow}>
                    {row.map((def, i) => (
                      <Key
                        key={i}
                        def={def}
                        next={def.char != null && def.char === nextChar}
                        pressed={def.char != null && def.char === pressed}
                        stuck={stuckHelp}
                        // The full board mirrors the real keyboard: lowercase by
                        // default, capitals while Caps/Shift are on.
                        upper={
                          prefs.kbMode === "full"
                            ? capsOn !== shiftOn
                            : undefined
                        }
                        active={
                          prefs.kbMode === "full" &&
                          def.mod === true &&
                          ((def.label === "caps" && capsOn) ||
                            (def.label === "shift" && shiftOn) ||
                            def.label === specialKey)
                        }
                      />
                    ))}
                  </div>
                ),
              )}
              <div className={styles.krow}>
                <Key
                  def={{ char: " ", label: "" }}
                  space={true}
                  next={nextChar === " "}
                  pressed={pressed === " "}
                  stuck={stuckHelp}
                />
              </div>
              <div className={styles.kbHint}>
                the glowing key is next — the dots mark where your pointers rest
              </div>
            </div>
          )}
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
                <div className={styles.sd}>{prefs.world === "hero" ? "Hero level" : "Dino stage"}</div>
                <div
                  className={styles.fstatVal}
                  style={{ color: "var(--leaf-d)" }}
                >
                  {(prefs.world === "hero" ? heroStage : dinoStage)(dinoAgeOf(included, lesson.letters.length))}
                </div>
              </div>
            </div>
            <div className={styles.finishBest}>
              {score >= best && score > 0
                ? "NEW BEST SCORE — WOW!!"
                : `your best ever: ${best}`}
            </div>
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
            <div className={styles.finishBadge}>
              <EggIcon size={34} color="#5c4500" />
            </div>
            <div
              className={styles.cardTitle}
              style={{ justifyContent: "center" }}
            >
              Your dino hatched!
            </div>
            <div className={styles.finishMsg}>
              It will run every step of the trail with you. What will you call
              it?
            </div>
            <input
              className={styles.nameInput}
              maxLength={12}
              placeholder="Rexy"
              value={draftName}
              autoFocus={true}
              onChange={(ev) => setDraftName(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  savePrefs({ name: draftName.trim() || "Rexy" });
                  setNameOpen(false);
                }
              }}
            />
            <button
              type="button"
              className={styles.cta}
              onClick={() => {
                savePrefs({ name: draftName.trim() || "Rexy" });
                setNameOpen(false);
              }}
            >
              Say hello!
            </button>
          </div>
        </div>
      )}

      {ceremony != null && (
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
          onPickDino={(dino) => {
            savePrefs({ dino });
            worldRef.current?.setPlayer(dino).catch(() => {});
          }}
          onPickHero={(hero) => {
            savePrefs({ hero });
            worldRef.current?.setPlayer(hero).catch(() => {});
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

function Key({
  def,
  next,
  pressed,
  space = false,
  stuck = false,
  upper,
  active = false,
}: {
  readonly def: KeyDef;
  readonly next: boolean;
  readonly pressed: boolean;
  readonly space?: boolean;
  readonly stuck?: boolean;
  /** Full board only: capitals when true, lowercase when false. */
  readonly upper?: boolean;
  /** A modifier key currently held/latched (Caps, Shift, Tab, …). */
  readonly active?: boolean;
}) {
  const zone = def.char != null ? ZONE_OF[def.char] : undefined;
  // Letter keys follow the Caps/Shift state on the full board; everything else
  // (symbols, modifiers) keeps its fixed legend.
  const isLetter = def.char != null && /^[a-z]$/.test(def.char);
  const face =
    isLetter && upper != null
      ? upper
        ? def.char!.toUpperCase()
        : def.char!
      : def.label;
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
        pressed && styles.keyPressed,
        active && styles.keyModOn,
      )}
      style={{
        ["--kz" as never]: zone != null ? `var(--${zone})` : "var(--clay)",
      }}
    >
      {def.shift != null ? (
        <>
          <span className={styles.kTop}>{def.shift}</span>
          <span className={styles.kBot}>{def.label}</span>
        </>
      ) : (
        face
      )}
      {def.bump && <span className={styles.bump} />}
    </div>
  );
}

function SettingsCard({
  prefs,
  included,
  savePrefs,
  onRename,
  onPickDino,
  onPickHero,
  onPickTimer,
  onClose,
}: {
  readonly prefs: Prefs;
  readonly included: number;
  readonly savePrefs: (patch: Partial<Prefs>) => void;
  readonly onRename: () => void;
  readonly onPickDino: (dino: string) => void;
  readonly onPickHero: (hero: string) => void;
  readonly onPickTimer: (min: number) => void;
  readonly onClose: () => void;
}) {
  const pill = (on: boolean) => clsx(styles.pill, on && styles.pillOn);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // The in-world letters are the default for the youngest; 7-8 and 9-10 get a
  // toggle to opt in.
  const band = currentBand();
  const canToggleWords = band === "7-8" || band === "9-10";
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span className={styles.hIcon}>
            <GearIcon />
          </span>
          Your game, your way
        </div>
        <div className={styles.srow}>
          <span className={styles.ri} style={{ background: "var(--seafoam)" }}>
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
        <div className={styles.srow}>
          <span className={styles.ri} style={{ background: "var(--sage)" }}>
            <PawIcon size={24} color="#3d6b2e" />
          </span>
          <div>
            <div className={styles.sl}>
              {prefs.name !== "" ? prefs.name : "Your buddy"}
            </div>
            <div className={styles.sd}>who runs with you</div>
          </div>
          <div className={styles.ctl}>
            {prefs.world === "hero" ? (
              <>
                {HERO_CHARACTERS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={pill(prefs.hero === id)}
                    onClick={() => onPickHero(id)}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.pill}
                  onClick={onRename}
                >
                  Rename
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={pill(prefs.dino === "TRex")}
                  onClick={() => onPickDino("TRex")}
                >
                  Rex
                </button>
                {HATCHLINGS.map(({ id, label, at }) =>
                  included >= at ? (
                    <button
                      key={id}
                      type="button"
                      className={pill(prefs.dino === id)}
                      onClick={() => onPickDino(id)}
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
                      <EggIcon size={14} color="currentColor" /> {at} keys
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
              </>
            )}
          </div>
        </div>
        <div className={styles.srow}>
          <span className={styles.ri} style={{ background: "var(--sky)" }}>
            <span className={styles.aaIcon}>Aa</span>
          </span>
          <div>
            <div className={styles.sl}>Big letters</div>
            <div className={styles.sd}>show the words in CAPITALS</div>
          </div>
          <div className={styles.ctl}>
            <button
              type="button"
              className={pill(prefs.bigLetters)}
              onClick={() => savePrefs({ bigLetters: !prefs.bigLetters })}
            >
              {prefs.bigLetters ? "On" : "Off"}
            </button>
          </div>
        </div>
        {canToggleWords && (
          <div className={styles.srow}>
            <span className={styles.ri} style={{ background: "var(--seafoam)" }}>
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
                onClick={() => savePrefs({ wordBlocks: !prefs.wordBlocks })}
              >
                {prefs.wordBlocks ? "On" : "Off"}
              </button>
            </div>
          </div>
        )}
        <div className={styles.srow}>
          <span className={styles.ri} style={{ background: "var(--sand)" }}>
            <SoundIcon color="#7a5c00" size={20} />
          </span>
          <div>
            <div className={styles.sl}>Sounds</div>
            <div className={styles.sd}>beeps, jumps and level-up tunes</div>
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
        <div className={styles.srow}>
          <span className={styles.ri} style={{ background: "var(--rose)" }}>
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
        <div className={styles.srow}>
          <span className={styles.ri} style={{ background: "var(--seafoam)" }}>
            <KeysIcon />
          </span>
          <div>
            <div className={styles.sl}>Keyboard</div>
            <div className={styles.sd}>
              simple letters, the full grown-up board, or hidden
            </div>
          </div>
          <div className={styles.ctl}>
            {(
              [
                ["off", "Hidden"],
                ["simple", "Simple"],
                ["full", "Full"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={pill(prefs.kbMode === mode)}
                onClick={() =>
                  // The full board needs the room — hands step aside
                  // (turn them back on anytime).
                  savePrefs(
                    mode === "full"
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
          <span className={styles.ri} style={{ background: "var(--sage)" }}>
            <ClockIcon />
          </span>
          <div>
            <div className={styles.sl}>Timer</div>
            <div className={styles.sd}>
              pick a session — the run ends at the campfire
            </div>
          </div>
          <div className={styles.ctl}>
            <button
              type="button"
              className={pill(!prefs.timerVisible)}
              onClick={() => savePrefs({ timerVisible: !prefs.timerVisible })}
            >
              {prefs.timerVisible ? "Shown" : "Hidden"}
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
          <span className={styles.ri} style={{ background: "var(--rose)" }}>
            <ChatIcon />
          </span>
          <div>
            <div className={styles.sl}>Cheers</div>
            <div className={styles.sd}>dino messages while you type</div>
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
        <button
          type="button"
          className={clsx(styles.advToggle, advancedOpen && styles.advOpen)}
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
        >
          <span className={styles.advLabel}>Advanced settings</span>
          <span className={styles.advChevron} aria-hidden="true">
            ▾
          </span>
        </button>
        {advancedOpen && (
          <div className={styles.advPanel}>
            <div className={styles.srow}>
              <span className={styles.ri} style={{ background: "var(--sky)" }}>
                <SunIcon size={20} color="#3d6b8a" />
              </span>
              <div>
                <div className={styles.sl}>Brightness</div>
                <div className={styles.sd}>how bright the world looks</div>
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
                <div className={styles.sl}>Colour</div>
                <div className={styles.sd}>soft and pale, or bright and bold</div>
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
              <span className={styles.ri} style={{ background: "var(--sage)" }}>
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
        <button type="button" className={styles.cta} onClick={onClose}>
          Back to the run!
        </button>
      </div>
    </div>
  );
}
