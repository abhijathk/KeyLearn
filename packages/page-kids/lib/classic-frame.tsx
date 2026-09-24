import { keyboardProps, KeyboardStyle } from "@keylearn/keyboard";
import { lessonProps, LessonType } from "@keylearn/lesson";
import { profileStorageKey, useLearnerOverride } from "@keylearn/pages-shared";
import { uiProps } from "@keylearn/result";
import { SettingsContext, useSettings } from "@keylearn/settings";
import { Font, textDisplayProps } from "@keylearn/textinput";
import { PlaySounds, soundProps } from "@keylearn/textinput-sounds";
import { NUNITO_B } from "@keylearn/themes";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import * as styles from "./classic-frame.module.less";
import { ClassicIcon, FlagIcon, GearIcon, KeysIcon } from "./icons.tsx";
import { choosePracticeStyle, type KidsBoard } from "./KidsPage.tsx";

/**
 * Classic: the grown-up guided practice, in the kids world's colours.
 *
 * Classic used to be its own screen — a copy of the grown-up page rebuilt
 * inside the kids page, with its own passage length, its own Enter gate, its
 * own unlock rule and its own hands. Every one of those drifted from the page
 * it was copying. So Classic is now the grown-up page itself: the same
 * engine, the same unlock rule, the same statistics, settings, keyboard and
 * resting hands. The route mounts it inside this frame, and the only thing
 * the frame changes is how it looks.
 *
 * Two settings are pinned here rather than read from the learner's menu. The
 * lesson type is Guided, because that is what Classic is. And the practice
 * text is set in Nunito until the learner picks a font of their own, because
 * the grown-up default is a monospace code font.
 */
export function KidsClassicFrame({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const { settings, updateSettings } = useSettings();
  const [board, setBoard] = useState<KidsBoard>(() =>
    readPrefs().board === "rainbow" ? "rainbow" : "crayon",
  );
  const kids = useMemo(() => {
    // Guided, always; and the grown-up page's walkthrough never opens on its
    // own here — it explains that page's settings, which Classic does not
    // offer.
    let s = settings
      .set(lessonProps.type, LessonType.GUIDED)
      .set(uiProps.tourSeen, true)
      // The kids boards, full size, on the grown-up keyboard — so the grown-up
      // hands still lie across them. Chosen in the kids sheet.
      .set(
        keyboardProps.style,
        board === "rainbow"
          ? KeyboardStyle.KIDS_RAINBOW
          : KeyboardStyle.KIDS_CRAYON,
      );
    const nunito = Font.ALL.find(({ name }) => name === NUNITO_B.name);
    if (
      nunito != null &&
      settings.get(textDisplayProps.font) === Font.default
    ) {
      s = s.set(textDisplayProps.font, nunito);
    }
    return s;
  }, [settings, board]);
  const [night, setNight] = useState(() => readPrefs().night === true);
  const [streak, setStreak] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  // When the site sets the goal speed for everyone, it is not offered here.
  const managedGoal = useLearnerOverride("lesson.targetSpeed") !== "default";
  const sounds = settings.get(soundProps.playSounds) !== PlaySounds.None;

  // The header paints itself from the kids palette while this is on screen,
  // and the page ground underneath it follows (see the stylesheet).
  useEffect(() => {
    document.body.dataset.kids = night ? "night" : "day";
    document.body.dataset.kidsClassic = night ? "night" : "day";
    return () => {
      delete document.body.dataset.kids;
      delete document.body.dataset.kidsClassic;
    };
  }, [night]);

  // The kids header's three buttons still work here. It asks for them by
  // event, and the kids page that used to answer is not mounted on Classic.
  useEffect(() => {
    window.dispatchEvent(
      new window.CustomEvent("keylearn:kids-state", {
        detail: { sounds, night, keys: 0, streak },
      }),
    );
  }, [sounds, night, streak]);
  useEffect(() => {
    const onStreak = (ev: Event) => {
      setStreak((ev as CustomEvent<number>).detail ?? 0);
    };
    const onToggle = (ev: Event) => {
      const what = (ev as CustomEvent<string>).detail;
      if (what === "sound") {
        updateSettings(
          settings.set(
            soundProps.playSounds,
            sounds ? PlaySounds.None : PlaySounds.All,
          ),
        );
      } else if (what === "night") {
        writePrefs({ night: !night });
        setNight(!night);
      } else if (what === "settings") {
        // The kids sheet, not the grown-up one: Classic is always guided
        // practice, and what a child can change here is how it looks.
        setSheetOpen(true);
      }
    };
    window.addEventListener("keylearn:streak", onStreak);
    window.addEventListener("keylearn:kids-toggle", onToggle);
    return () => {
      window.removeEventListener("keylearn:streak", onStreak);
      window.removeEventListener("keylearn:kids-toggle", onToggle);
    };
  }, [settings, updateSettings, sounds, night]);

  return (
    <SettingsContext.Provider value={{ settings: kids, updateSettings }}>
      <div className={styles.frame}>
        {children}
        {sheetOpen && (
          <ClassicSheet
            goal={managedGoal ? null : settings.get(lessonProps.targetSpeed)}
            onGoal={(next) => {
              // The learner's own settings, not the Classic-dressed copy
              // above: that one carries overrides that must never be saved.
              updateSettings(settings.set(lessonProps.targetSpeed, next));
            }}
            board={board}
            onBoard={(next) => {
              writePrefs({ board: next });
              setBoard(next);
            }}
            onClose={() => setSheetOpen(false)}
          />
        )}
      </div>
    </SettingsContext.Provider>
  );
}

type StoredPrefs = { night?: boolean; board?: KidsBoard };

// The kids page owns these prefs and reads them back on its next mount; only
// the night and board fields are touched here, and the board is the same
// choice the trail's keyboard reads.
function readPrefs(): StoredPrefs {
  try {
    return JSON.parse(
      localStorage.getItem(profileStorageKey("kids.prefs")) ?? "{}",
    ) as StoredPrefs;
  } catch {
    return {};
  }
}

function writePrefs(patch: StoredPrefs): void {
  try {
    localStorage.setItem(
      profileStorageKey("kids.prefs"),
      JSON.stringify({ ...readPrefs(), ...patch }),
    );
  } catch {
    // Storage blocked: the switch simply does not stick.
  }
}

/** 25 characters a minute: five words a minute, one press. */
const GOAL_STEP = 25;

/**
 * The kids sheet, as Classic has it.
 *
 * The trail's own sheet belongs to the trail and is not mounted here, so the
 * header's gear opens this instead: the two choices that mean something on
 * this screen, in that sheet's clothes. Everything about the lesson itself is
 * guided practice's own and is not offered.
 */
function ClassicSheet({
  goal,
  onGoal,
  board,
  onBoard,
  onClose,
}: {
  /** The goal speed in characters a minute, or null when it is not ours. */
  readonly goal: number | null;
  readonly onGoal: (next: number) => void;
  readonly board: KidsBoard;
  readonly onBoard: (board: KidsBoard) => void;
  readonly onClose: () => void;
}): ReactNode {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const pill = (on: boolean) =>
    on ? `${styles.pill} ${styles.pillOn}` : styles.pill;
  return (
    <div
      className={styles.overlay}
      onPointerDown={(ev) => {
        if (ev.target === ev.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.card}
        role="dialog"
        aria-label="Your game, your way"
      >
        <div className={styles.cardTitle}>
          <span className={styles.hIcon}>
            <GearIcon />
          </span>
          Your game, your way
        </div>
        <div className={styles.srow}>
          <span className={styles.ri} style={{ background: "#3aa0ff" }}>
            <ClassicIcon />
          </span>
          <div>
            <div className={styles.sl}>Practice style</div>
            <div className={styles.sd}>
              just the words, the board and your progress
            </div>
          </div>
          <div className={styles.ctl}>
            <button
              type="button"
              className={pill(false)}
              onClick={() => choosePracticeStyle(false)}
            >
              Trail game
            </button>
            <button type="button" className={pill(true)}>
              Classic
            </button>
          </div>
        </div>
        {goal != null && (
          <div className={styles.srow}>
            <span className={styles.ri} style={{ background: "#f2c94c" }}>
              <FlagIcon size={20} color="#7a5a00" />
            </span>
            <div>
              <div className={styles.sl}>Goal speed</div>
              <div className={styles.sd}>the speed a key must reach</div>
            </div>
            <div className={styles.ctl}>
              {/* Five words a minute a press, snapped to a round figure —
                  the same steps the grown-up page's goal tuner takes. */}
              <button
                type="button"
                className={styles.step}
                aria-label="Slower goal"
                disabled={goal <= lessonProps.targetSpeed.min}
                onClick={() =>
                  onGoal(
                    Math.max(
                      lessonProps.targetSpeed.min,
                      Math.ceil(goal / GOAL_STEP) * GOAL_STEP - GOAL_STEP,
                    ),
                  )
                }
              >
                −
              </button>
              <span className={styles.stepValue}>
                {Math.round(goal / 5)} <small>wpm</small>
              </span>
              <button
                type="button"
                className={styles.step}
                aria-label="Faster goal"
                disabled={goal >= lessonProps.targetSpeed.max}
                onClick={() =>
                  onGoal(
                    Math.min(
                      lessonProps.targetSpeed.max,
                      Math.floor(goal / GOAL_STEP) * GOAL_STEP + GOAL_STEP,
                    ),
                  )
                }
              >
                +
              </button>
            </div>
          </div>
        )}
        <div className={styles.srow}>
          <span className={styles.ri} style={{ background: "#5fc9a7" }}>
            <KeysIcon />
          </span>
          <div>
            <div className={styles.sl}>Keyboard</div>
            <div className={styles.sd}>how the keys are coloured</div>
          </div>
          <div className={styles.ctl}>
            <button
              type="button"
              className={pill(board === "crayon")}
              onClick={() => onBoard("crayon")}
            >
              Crayon
            </button>
            <button
              type="button"
              className={pill(board === "rainbow")}
              onClick={() => onBoard("rainbow")}
            >
              Rainbow
            </button>
          </div>
        </div>
        <button type="button" className={styles.done} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
