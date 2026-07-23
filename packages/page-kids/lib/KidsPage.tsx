import { keyboardProps, KeyboardProvider } from "@keybr/keyboard";
import { Lesson, lessonProps, LessonType } from "@keybr/lesson";
import { LessonLoader } from "@keybr/lesson-loader";
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
import { kidsAudio } from "./audio.ts";
import {
  BranchIcon,
  ChatIcon,
  ClockIcon,
  DinoFill,
  FlameIcon,
  GearIcon,
  HandIcon,
  KeysIcon,
  MoonIcon,
  SoundIcon,
  SproutIcon,
  StarIcon,
  SunIcon,
  TentIcon,
  TrophyIcon,
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
  type KidsWorld,
  pickLand,
} from "./world.ts";

const BEST_KEY = "kids.best";
const PREFS_KEY = "kids.prefs";

type KbMode = "off" | "simple" | "full";

type Prefs = {
  dino: string;
  sounds: boolean;
  hands: boolean;
  kbMode: KbMode;
  timerVisible: boolean;
  timerMin: number;
  cheers: boolean;
  night: boolean;
};

// Kids defaults: light mode, quiet sounds, a silent 10-minute session,
// the simple keyboard with helper hands.
const DEFAULT_PREFS: Prefs = {
  dino: "TRex",
  sounds: false,
  hands: true,
  kbMode: "simple",
  timerVisible: false,
  timerMin: 10,
  cheers: true,
  night: false,
};

function loadPrefs(): Prefs {
  try {
    return {
      ...DEFAULT_PREFS,
      ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}"),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

const CHEERS = [
  "Leap!",
  "The herd is cheering!",
  "Combo rising!",
  "So fast!!",
  "Camp flag ahead!",
];

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
        .set(lessonProps.guided.kidsWords, true),
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

  const [prefs, setPrefs] = useState(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(loadBest);
  const [combo, setCombo] = useState(1);
  const [maxCombo, setMaxCombo] = useState(1);
  const [words, setWords] = useState(0);
  const [say, setSay] = useState(
    "Every letter is a step — unlock a new key and your dino grows!",
  );
  const [growNonce, setGrowNonce] = useState(0);
  const [sessionSecs, setSessionSecs] = useState(prefs.timerMin * 60);
  const [sessionOver, setSessionOver] = useState(false);
  const [regenNonce, setRegenNonce] = useState(0);
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
  const growScaleRef = useRef(1);
  const [pressed, setPressed] = useState<string | null>(null);
  const pressedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const savePrefs = (patch: Partial<Prefs>) => {
    setPrefs((old) => {
      const next = { ...old, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
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

  // A new key joining the practice set is THE growth moment.
  const prevIncluded = useRef(-1);
  useEffect(() => {
    if (prevIncluded.current !== -1 && included > prevIncluded.current) {
      growScaleRef.current = Math.min(growScaleRef.current * 1.22, 2.4);
      worldRef.current?.grow(growScaleRef.current);
      setGrowNonce((n) => n + 1);
      setScore((s) => saveBest(s + 50));
      if (prefsRef.current.sounds) {
        kidsAudio.playWin();
      }
      setSay("A brand new key joined your trail — your dino grew!");
    }
    prevIncluded.current = included;
  }, [included]);

  // A fresh passage whenever the lesson or the stats move on. Kids runs are
  // short — 6 words to start, one more for every few unlocked keys, capped at
  // 10. Only a kid with the whole alphabet on their trail gets the full
  // grown-up passage.
  useEffect(() => {
    let flat = flattenStyledText(lesson.generate(lessonKeys, Lesson.rng));
    if (included < lesson.letters.length) {
      const wordCount = Math.min(
        10,
        6 + Math.floor(Math.max(0, included - 6) / 5),
      );
      flat = flat.split(" ").slice(0, wordCount).join(" ");
    }
    passageRef.current = flat;
    textInputRef.current = new TextInput(flat, toTextInputSettings(settings));
    lastStampRef.current = 0;
    missStreakRef.current = 0;
    worldRef.current?.setProgress(0);
    forceTick();
  }, [lesson, lessonKeys, included, settings, regenNonce]);

  const saveBest = (s: number) => {
    setBest((b) => {
      if (s > b) {
        try {
          localStorage.setItem(BEST_KEY, String(s));
        } catch {
          // Storage may be unavailable.
        }
        return s;
      }
      return b;
    });
    return s;
  };

  // ── the 3D world ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }
    const world = createKidsWorld(canvas, pickLand());
    worldRef.current = world;
    const loader =
      loaderRef.current != null ? createLoaderScene(loaderRef.current) : null;
    world.ready
      .then(() => {
        if (prefsRef.current.night) {
          world.setNight(true);
        }
        if (prefsRef.current.dino !== "TRex") {
          return world.setPlayer(prefsRef.current.dino);
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
  }, []);

  // The world pane never grows more than 35% taller than the helper card.
  useEffect(() => {
    const scene = sceneCardRef.current;
    const kb = kbCardRef.current;
    if (scene == null) {
      return;
    }
    const cap = () => {
      if (kb != null && prefsRef.current.kbMode !== "off") {
        scene.style.maxHeight = `${Math.round(kb.offsetHeight * 1.35)}px`;
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
  blockedRef.current = settingsOpen || finishOpen || sessionOver;

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key.length !== 1 || ev.ctrlKey || ev.metaKey || ev.altKey) {
        return;
      }
      if (blockedRef.current) {
        return;
      }
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
        worldRef.current?.setProgress(pos / Math.max(1, passage.length));
        worldRef.current?.burstAtPlayer([0xd9c9a3, 0xcbb98f], 4, 0.1);
        comboRunRef.current += 1;
        if (comboRunRef.current >= 5) {
          comboRunRef.current = 0;
          setCombo((c) => {
            const next = Math.min(c + 1, 9);
            setMaxCombo((m) => Math.max(m, next));
            return next;
          });
        }
        setScore((s) => saveBest(s + 10));
        if (sounds && key !== " ") {
          kidsAudio.playMove();
        }
        if (pos > 0 && passage[pos - 1] === " ") {
          setScore((s) => saveBest(s + 50));
          setWords((w) => w + 1);
          if (sounds) {
            kidsAudio.playPoint();
          }
        }
        if (cheers && Math.random() < 0.2) {
          setSay(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
        }
        if (textInput.completed) {
          setScore((s) => saveBest(s + 50));
          setWords((w) => w + 1);
          setSay("CAMP! +50 bonus — the whole herd cheers!!");
          if (sounds) {
            kidsAudio.playPoint();
          }
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
        }
      } else {
        missStreakRef.current += 1;
        comboRunRef.current = 0;
        setCombo(1);
        worldRef.current?.stumble();
        if (missStreakRef.current >= 3) {
          missStreakRef.current = 0;
          worldRef.current?.roar();
          if (sounds) {
            kidsAudio.playRoar();
          }
          if (cheers) {
            setSay("RAWWRR!! Take a breath — look for the glowing key!");
          }
        } else {
          if (sounds) {
            kidsAudio.playDrop();
          }
          if (cheers) {
            setSay("Whoops — the dino stopped! The glowing key shows the way.");
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
          setSay("The herd makes camp. Wonderful typing today!");
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
  // A sliding window keeps the current letter in view — real lessons are far
  // longer than the pane is wide.
  const winStart = Math.max(0, pos - 12);
  const winChars = [...passage].slice(winStart, winStart + 42);
  const sessionTotal = prefs.timerMin * 60;
  const kbVisible = prefs.kbMode !== "off";
  const helperVisible = kbVisible || prefs.hands;
  const wide = kbVisible && (prefs.kbMode === "full" || prefs.hands);

  return (
    <div className={clsx(styles.root, prefs.night && styles.rootDark)}>
      <div className={styles.top}>
        <span className={styles.banner}>
          <DinoFill size={16} color="#2d8cff" /> <b>Key</b>Learn Kids ·{" "}
          {included} keys on your trail
        </span>
        <button
          type="button"
          className={styles.chipBtn}
          style={{
            background: "color-mix(in srgb, var(--sand) 32%, var(--card))",
          }}
          title="Sounds on or off"
          onClick={() => savePrefs({ sounds: !prefs.sounds })}
        >
          <SoundIcon muted={!prefs.sounds} />
        </button>
        <button
          type="button"
          className={styles.chipBtn}
          style={{
            background: "color-mix(in srgb, var(--seafoam) 32%, var(--card))",
          }}
          title="Day or night"
          onClick={() => {
            const night = !prefs.night;
            savePrefs({ night });
            worldRef.current?.setNight(night);
          }}
        >
          {prefs.night ? <SunIcon /> : <MoonIcon />}
        </button>
        <button
          type="button"
          className={styles.chipBtn}
          style={{
            background: "color-mix(in srgb, var(--sky) 26%, var(--card))",
          }}
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <GearIcon />
        </button>
      </div>

      <div className={styles.sceneCard} ref={sceneCardRef}>
        <canvas className={styles.canvas} ref={canvasRef} />
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
              <div className={styles.loadLabel}>Running to the valley…</div>
            </div>
          </div>
        )}
        <div className={styles.hudRight}>
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
              <div className={styles.chipLab}>Dino size</div>
              <div className={styles.chipVal}>Lv {included}</div>
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
                {ch === " " ? " " : ch}
              </span>
            );
          })}
        </div>
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
                <div className={styles.sd}>Dino size</div>
                <div
                  className={styles.fstatVal}
                  style={{ color: "var(--leaf-d)" }}
                >
                  Lv {included}
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
          </div>
        </div>
      )}

      {settingsOpen && (
        <SettingsCard
          prefs={prefs}
          savePrefs={savePrefs}
          onPickDino={(dino) => {
            savePrefs({ dino });
            worldRef.current?.setPlayer(dino).catch(() => {});
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
}: {
  readonly def: KeyDef;
  readonly next: boolean;
  readonly pressed: boolean;
  readonly space?: boolean;
}) {
  const zone = def.char != null ? ZONE_OF[def.char] : undefined;
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
        pressed && styles.keyPressed,
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
        def.label
      )}
      {def.bump && <span className={styles.bump} />}
    </div>
  );
}

function SettingsCard({
  prefs,
  savePrefs,
  onPickDino,
  onPickTimer,
  onClose,
}: {
  readonly prefs: Prefs;
  readonly savePrefs: (patch: Partial<Prefs>) => void;
  readonly onPickDino: (dino: string) => void;
  readonly onPickTimer: (min: number) => void;
  readonly onClose: () => void;
}) {
  const pill = (on: boolean) => clsx(styles.pill, on && styles.pillOn);
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
          <span className={styles.ri} style={{ background: "var(--sage)" }}>
            <DinoFill size={30} />
          </span>
          <div>
            <div className={styles.sl}>Dino friend</div>
            <div className={styles.sd}>who runs with you</div>
          </div>
          <div className={styles.ctl}>
            {[
              ["Velociraptor", "Vela"],
              ["TRex", "Rex"],
              ["Triceratops", "Tops"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={pill(prefs.dino === id)}
                onClick={() => onPickDino(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
        <button type="button" className={styles.cta} onClick={onClose}>
          Back to the run!
        </button>
      </div>
    </div>
  );
}
