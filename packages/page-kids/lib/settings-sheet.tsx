import { clsx } from "clsx";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  type AgeBand,
  bandConfig,
  classicOffered,
  currentBand,
} from "./age.ts";
import { HATCHLINGS } from "./album.ts";
import { ASSETS, versioned } from "./asset-url.ts";
import { kidsAudio } from "./audio.ts";
import type { Prefs } from "./KidsPage.tsx";
import type { NightOverride } from "./night.ts";
import * as styles from "./settings-sheet.module.less";
import { speakLine, stopSpeaking, unlockVoice } from "./voice.ts";
import type { WorldId } from "./world.ts";

/**
 * ── YOUR GAME, YOUR WAY ─────────────────────────────────────────────────
 *
 * The trail game's settings sheet: a rail of five sections down the side and
 * the chosen one beside it, each section a stack of small grouped cards.
 *
 * It replaced a four-tab card whose rows were all the same shape — an icon, a
 * label and a row of pills — so an on/off switch, a choice of three and a
 * slider all looked alike, and the world picker was three words. Here every
 * on/off is a switch, every choice is a segmented control, and the things a
 * child picks by looking (the world, who they are, who comes along, the key
 * style) are pictures.
 *
 * WHAT IS SAVED IS UNCHANGED. Every row writes the same `Prefs` field with the
 * same side effects as the card it replaced; only the world waits for "Back
 * to the run!", as it always did — see `worldDraft`.
 */

/**
 * The game's own cast helpers, handed over once.
 *
 * They live in KidsPage.tsx next to the roster they read, and importing them
 * from there would make this file and that one import each other. Handed
 * over the same way the picker is handed its two — see `configurePicker`.
 */
export type SheetModel = {
  readonly castLabel: (id: string, names?: Record<string, string>) => string;
  readonly charOf: (p: Prefs) => string;
  readonly charactersOf: (
    w: WorldId,
  ) => readonly { readonly id: string; readonly label: string }[];
  readonly companions: readonly { readonly id: string }[];
  readonly walksIn: (w: WorldId, id: string) => boolean;
  readonly childCast: (w: WorldId) => boolean;
  readonly companionsOf: (p: Prefs) => string[];
  readonly nightStyleOf: (p: Prefs) => NightOverride;
  /** The village boy's model id — see VILLAGE_GUIDE. */
  readonly guide: string;
  readonly playfulOffered: (band: AgeBand) => boolean;
  readonly choosePracticeStyle: (classic: boolean) => void;
  /** Whether this learner practises without a clock — see noClock. */
  readonly noClock: () => boolean;
};

let model: SheetModel | null = null;

export function configureSettingsSheet(m: SheetModel): void {
  model = m;
}

const faceUrl = (id: string) => versioned(`${ASSETS}/faces/${id}.webp`);
const worldUrl = (id: WorldId) => versioned(`${ASSETS}/cards/world-${id}.webp`);

/**
 * VILLAGE FIRST, and "Time Keepers" rather than "Village Road" — see the
 * world row this replaced: it is the world the app is built around, and a
 * row of choices says which is the main one by where it puts it.
 */
const WORLDS: readonly (readonly [WorldId, string])[] = [
  ["village", "Time Keepers"],
  ["dino", "Dino Run"],
  ["hero", "Hero Trail"],
];

const worldName = (w: WorldId) =>
  WORLDS.find(([id]) => id === w)?.[1] ?? "Time Keepers";

/** The wash behind each portrait, so a face reads as that character's. */
const FACE_TINT: Readonly<Record<string, string>> = {
  Explorer: "#5b8def",
  Peeli: "#e9739a",
  Explorer6: "#4fb58a",
  Robot: "#8a8fa8",
  Puppy: "#c89b6d",
  TRex: "#6aa84f",
  Velociraptor: "#c9a24a",
  Stegosaurus: "#5aa3a0",
  Triceratops: "#b07a4a",
  Parasaurolophus: "#d08a5a",
  Apatosaurus: "#7a9a6a",
  Knight: "#9fb0c8",
  Skeleton_Warrior: "#c8b89f",
};

type Section = "play" | "scene" | "typing" | "sound" | "session";

const SECTIONS: readonly {
  readonly id: Section;
  readonly label: string;
  readonly icon: IconName;
  readonly tint: string;
}[] = [
  { id: "play", label: "Play", icon: "globe", tint: "#3aa0ff" },
  { id: "scene", label: "World look", icon: "sun", tint: "#f2a93b" },
  { id: "typing", label: "Typing", icon: "keys", tint: "#5fc9a7" },
  { id: "sound", label: "Sound & coach", icon: "sound", tint: "#f5a8b8" },
  { id: "session", label: "Session", icon: "clock", tint: "#9b7fe0" },
];

/**
 * Which section was open last, for as long as the page lives.
 *
 * The sheet is a fresh mount every time it opens — Rename closes it to show
 * the naming card and reopens it after — so without this every reopening
 * started back at the top rather than where the child left off.
 */
let lastSection: Section = "play";

export function SettingsSheet({
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
  if (model == null) {
    throw new Error("configureSettingsSheet() was never called");
  }
  const m = model;
  const uid = useId();
  const titleId = `${uid}-title`;
  const paneId = `${uid}-pane`;
  const tabId = (s: Section) => `${uid}-tab-${s}`;
  const cardRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  /**
   * THE WORLD IS CHOSEN HERE AND CHANGED ON THE WAY OUT.
   *
   * Tapping a world used to save it there and then, which tore the running
   * scene down and rebuilt it while the sheet was still open — a child
   * browsing the three set three worlds building behind a panel they were
   * still reading. The picture records a choice; "Back to the run!" acts on
   * it, which is also what makes that button mean something.
   */
  const [worldDraft, setWorldDraft] = useState<WorldId>(prefs.world);
  const [section, setSectionState] = useState<Section>(lastSection);
  const setSection = (s: Section) => {
    lastSection = s;
    setSectionState(s);
  };
  const leaveSettings = () => {
    if (worldDraft !== prefs.world) {
      onPickWorld(worldDraft);
    }
    onClose();
  };
  const cancel = () => {
    setWorldDraft(prefs.world);
    onClose();
  };

  // Keyboard users land on the section they are in, not on the page behind.
  useEffect(() => {
    railRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.focus({ preventScroll: true });
  }, []);

  /**
   * THE PANEL DESCRIBES THE WORLD BEING CHOSEN, not the one still running:
   * every row reads a view of the preferences with the DRAFTED world in it,
   * and the pick handlers are told which world they are writing for.
   */
  const view: Prefs = { ...prefs, world: worldDraft };
  const playingAs = m.charOf(view);
  const walking = m.companionsOf(view);
  /**
   * What to call somebody. `castLabel` knows the people but not the dinosaurs
   * — their names live on the Dino Run cast and hatchling lists — so an
   * unnamed T-Rex read "TRex", the model id, where the world calls it Rex.
   */
  const shipped = new Map<string, string>(
    [...m.charactersOf("dino"), ...HATCHLINGS.dino].map(
      (c) => [c.id, c.label] as const,
    ),
  );
  const label = (id: string) => {
    const own = m.castLabel(id, prefs.names);
    return own === id ? (shipped.get(id) ?? id) : own;
  };
  /**
   * Who may walk with you — everyone the drafted world allows, minus
   * yourself. See `walksIn` for why the lists differ by world and why the
   * buffalo is on none of them.
   */
  const companionChoices = m.companions.filter(
    ({ id }) => id !== playingAs && m.walksIn(worldDraft, id),
  );
  const band = currentBand();
  const cfg = bandConfig(band);
  const canToggleWords = band === "7-8" || band === "9-10";
  const canClassic = classicOffered(band);
  const village = worldDraft === "village";
  const hasCast = m.childCast(worldDraft);
  const noClock = m.noClock();

  const summaries: Record<Section, string> = {
    play:
      worldDraft === "dino"
        ? "world & dino"
        : worldDraft === "hero"
          ? "world, you & friend"
          : "world, you & friends",
    scene: worldDraft === "dino" ? "colours" : "light & colours",
    typing: "keyboard & words",
    sound: "sounds & coach",
    session: canClassic ? "timer & style" : "timer & length",
  };

  // ── the dialog's own keys ──────────────────────────────────────────────
  const onCardKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      // Escape is "put it back": it keeps no world change, like Cancel.
      e.stopPropagation();
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key === "Tab" && cardRef.current != null) {
      // Focus stays inside the sheet — the page behind is covered.
      const all = [
        ...cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
        ),
      ].filter((el) => el.tabIndex >= 0);
      const first = all[0];
      const last = all[all.length - 1];
      if (first == null || last == null) {
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const onRailKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = SECTIONS.findIndex(({ id }) => id === section);
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? (i + 1) % SECTIONS.length
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? (i - 1 + SECTIONS.length) % SECTIONS.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? SECTIONS.length - 1
              : -1;
    if (next < 0) {
      return;
    }
    e.preventDefault();
    const id = SECTIONS[next].id;
    setSection(id);
    document.getElementById(tabId(id))?.focus();
  };

  const current = SECTIONS.find(({ id }) => id === section) ?? SECTIONS[0];

  return (
    <div className={styles.overlay}>
      <div
        ref={cardRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onCardKey}
      >
        <header className={styles.head}>
          <span className={styles.gear} aria-hidden="true">
            <Icon name="gear" size={22} />
          </span>
          <h2 id={titleId} className={styles.title}>
            Your game, your way
          </h2>
          <span className={styles.playing}>
            <img
              className={styles.playingImg}
              src={worldUrl(prefs.world)}
              alt=""
            />
            <span className={styles.playingText}>
              <span className={styles.playingWord}>Playing: </span>
              {worldName(prefs.world)}
            </span>
          </span>
        </header>
        <div className={styles.body}>
          <div
            ref={railRef}
            className={styles.rail}
            role="tablist"
            aria-orientation="vertical"
            aria-label="Settings sections"
            onKeyDown={onRailKey}
          >
            {SECTIONS.map(({ id, label: name, icon, tint }) => {
              const on = id === section;
              return (
                <button
                  key={id}
                  id={tabId(id)}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={paneId}
                  tabIndex={on ? 0 : -1}
                  title={name}
                  className={clsx(styles.tab, on && styles.tabOn)}
                  style={{ "--tint": tint } as CSSProperties}
                  onClick={() => setSection(id)}
                >
                  <span className={styles.tabIcon} aria-hidden="true">
                    <Icon name={icon} size={20} strokeWidth={2.4} />
                  </span>
                  <span className={styles.tabText}>
                    <span className={styles.tabLabel}>{name}</span>
                    <span className={styles.tabSummary}>{summaries[id]}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div
            id={paneId}
            className={styles.pane}
            role="tabpanel"
            aria-labelledby={tabId(section)}
            // The pane scrolls, so it has to be reachable to scroll with keys.
            tabIndex={0}
          >
            <h3 className={styles.paneTitle}>{current.label}</h3>

            {section === "play" && (
              <>
                <Group title="World">
                  <div className={styles.worlds}>
                    {WORLDS.map(([id, name]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={worldDraft === id}
                        className={styles.world}
                        onClick={() => setWorldDraft(id)}
                      >
                        <span className={styles.worldShot}>
                          <img src={worldUrl(id)} alt="" />
                          {worldDraft === id && <Check corner={true} />}
                        </span>
                        <span className={styles.worldName}>{name}</span>
                      </button>
                    ))}
                  </div>
                </Group>
                <div className={styles.pair}>
                  <Group
                    title="You play as"
                    note={
                      worldDraft === "dino"
                        ? "new dinos hatch as you unlock keys"
                        : undefined
                    }
                  >
                    <div className={styles.faces}>
                      {[
                        ...m.charactersOf(worldDraft).map(({ id }) => id),
                        // Dino Run's hatchlings are characters you play AS,
                        // once they have hatched; the other worlds' are
                        // companions (see HATCHLINGS in album.ts).
                        ...(worldDraft === "dino" ? HATCHLINGS.dino : [])
                          .filter(({ at }) => included >= at)
                          .map(({ id }) => id),
                      ].map((id) => (
                        <Face
                          key={id}
                          id={id}
                          name={label(id)}
                          on={playingAs === id}
                          big={true}
                          onPick={() => onPickCharacter(id, worldDraft)}
                          onRename={
                            playingAs === id
                              ? () => onRename(playingAs)
                              : undefined
                          }
                        />
                      ))}
                      {(worldDraft === "dino" ? HATCHLINGS.dino : [])
                        .filter(({ at }) => included < at)
                        .map(({ id, label: name, at }) => (
                          <div key={id} className={styles.locked}>
                            <span>{name}</span>
                            <span>at {at} keys</span>
                          </div>
                        ))}
                    </div>
                  </Group>
                  {hasCast && companionChoices.length > 0 && (
                    <Group
                      title="Walking with you"
                      note={
                        companionChoices.length > 2
                          ? "pick up to two"
                          : undefined
                      }
                    >
                      <div className={styles.faces}>
                        <button
                          type="button"
                          aria-pressed={walking.length === 0}
                          className={styles.face}
                          onClick={() => onPickCompanion(null, worldDraft)}
                        >
                          <span
                            className={clsx(styles.faceRing, styles.nobody)}
                          >
                            <span aria-hidden="true">–</span>
                            {walking.length === 0 && <Check />}
                          </span>
                          <span className={styles.faceName}>Nobody</span>
                        </button>
                        {companionChoices.map(({ id }) => (
                          <Face
                            key={id}
                            id={id}
                            name={label(id)}
                            on={walking.includes(id)}
                            onPick={() => onPickCompanion(id, worldDraft)}
                          />
                        ))}
                      </div>
                    </Group>
                  )}
                </div>
                {village && (
                  <Group
                    title="On the road"
                    tags={<Tag kind="gold">Time Keepers</Tag>}
                  >
                    <Row
                      lead={
                        <img
                          className={styles.rowFace}
                          src={faceUrl(m.guide)}
                          alt=""
                        />
                      }
                      label={`${label(m.guide)} shows you round`}
                      desc="the village boy who knows the road"
                    >
                      {(ids) => (
                        <span className={styles.ctlPair}>
                          {/* Only while he is coming along: naming somebody
                              who is switched off is a button with nothing
                              behind it. */}
                          {prefs.guide !== false && (
                            <button
                              type="button"
                              className={styles.chip}
                              onClick={() => onRename(m.guide)}
                            >
                              <Icon name="pencil" size={12} strokeWidth={2.4} />
                              Rename
                            </button>
                          )}
                          <Switch
                            {...ids}
                            on={prefs.guide !== false}
                            onToggle={(on) => savePrefs({ guide: on })}
                          />
                        </span>
                      )}
                    </Row>
                    <Row
                      label="The story"
                      desc="where they came from, a bit at a time"
                    >
                      {(ids) => (
                        <Switch
                          {...ids}
                          on={prefs.story !== false}
                          onToggle={(on) => savePrefs({ story: on })}
                        />
                      )}
                    </Row>
                  </Group>
                )}
              </>
            )}

            {section === "scene" && (
              <>
                {/* Time Keepers only: the other two worlds are staged at
                    midday on purpose and have no hour to set. Asks the
                    DRAFTED world — the old card asked the running one, and so
                    offered the hour on Dino Run while switching to the
                    village and hid it the other way round. */}
                {village && (
                  <Group
                    title="Time of day"
                    tags={<Tag kind="gold">Time Keepers</Tag>}
                  >
                    <Row
                      label="Time of day"
                      desc={
                        prefs.dayHour === "auto"
                          ? "Auto follows your own clock"
                          : "the road stays at the time you picked"
                      }
                      wide={true}
                    >
                      {(ids) => (
                        <Segmented
                          {...ids}
                          value={prefs.dayHour}
                          options={
                            [
                              ["auto", "Auto"],
                              [7, "Early"],
                              [9, "Morning"],
                              [12, "Midday"],
                              [15, "Afternoon"],
                              [17, "Evening"],
                            ] as const
                          }
                          onPick={(dayHour) => savePrefs({ dayHour })}
                        />
                      )}
                    </Row>
                  </Group>
                )}
                {hasCast && (
                  <Group
                    title="After dark"
                    tags={<Tag kind="gold">Time Keepers · Hero Trail</Tag>}
                  >
                    <Row
                      label="Who’s out at night"
                      desc="how spooky the night gets"
                      wide={true}
                    >
                      {(ids) => (
                        <Segmented
                          {...ids}
                          value={m.nightStyleOf(view)}
                          options={(
                            [
                              ["auto", "By age"],
                              ["quiet", "Quiet"],
                              ["mild", "Spooky"],
                              ["full", "Extra spooky"],
                            ] as const
                          )
                            // No Extra spooky at five, not even for a
                            // grown-up — night.ts refuses the value anyway.
                            .filter(
                              ([value]) =>
                                !(band === "5-6" && value === "full"),
                            )
                            // And nothing spooky on the village road at all:
                            // it is somewhere people live.
                            .filter(
                              ([value]) =>
                                worldDraft !== "village" ||
                                (value !== "mild" && value !== "full"),
                            )}
                          onPick={(value) =>
                            savePrefs({
                              nightStyleByWorld: {
                                ...prefs.nightStyleByWorld,
                                [worldDraft]: value,
                              },
                              nightStyle: value,
                            })
                          }
                        />
                      )}
                    </Row>
                  </Group>
                )}
                <Group title="How it looks">
                  <Row
                    label="Brightness"
                    desc="how bright the world is"
                    wide={true}
                  >
                    {(ids) => (
                      <Slider
                        {...ids}
                        low="Dim"
                        high="Bright"
                        min={0.75}
                        max={1.25}
                        step={0.01}
                        value={prefs.brightness}
                        onChange={(brightness) => savePrefs({ brightness })}
                      />
                    )}
                  </Row>
                  <Row
                    label="Colour"
                    desc="soft and pale, or bright and bold"
                    wide={true}
                  >
                    {(ids) => (
                      // Reads left = pale, right = full colour, so inverted.
                      <Slider
                        {...ids}
                        low="Soft"
                        high="Bold"
                        min={0}
                        max={1}
                        step={0.02}
                        value={1 - prefs.paleness}
                        onChange={(v) => savePrefs({ paleness: 1 - v })}
                      />
                    )}
                  </Row>
                  <Row
                    label="Movement"
                    desc="how lively the animals and people are"
                    wide={true}
                  >
                    {(ids) => (
                      <Slider
                        {...ids}
                        low="Calm"
                        high="Lively"
                        min={0}
                        max={1}
                        step={0.02}
                        value={prefs.motion}
                        onChange={(motion) => savePrefs({ motion })}
                      />
                    )}
                  </Row>
                </Group>
              </>
            )}

            {section === "typing" && (
              <>
                <Group title="Keyboard">
                  <Row
                    label="Keyboard on screen"
                    desc="simple letters, the full board, or hidden"
                  >
                    {(ids) => (
                      <Segmented
                        {...ids}
                        value={prefs.kbMode}
                        options={
                          [
                            ["off", "Hidden"],
                            ["simple", "Simple"],
                            ["full", "Full"],
                          ] as const
                        }
                        onPick={(mode) =>
                          // The full board makes room by standing the hands
                          // aside (turn them back on anytime).
                          savePrefs(
                            mode === "full"
                              ? { kbMode: mode, hands: false }
                              : { kbMode: mode },
                          )
                        }
                      />
                    )}
                  </Row>
                  <Row label="Key style" desc="how the keys are painted">
                    {(ids) => (
                      <span
                        className={styles.boards}
                        role="group"
                        aria-labelledby={ids.labelledBy}
                      >
                        {(
                          [
                            ["crayon", "Crayon"],
                            ["rainbow", "Rainbow"],
                          ] as const
                        ).map(([id, name]) => (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={prefs.board === id}
                            className={styles.board}
                            onClick={() => savePrefs({ board: id })}
                          >
                            <BoardPicture rainbow={id === "rainbow"} />
                            <span>{name}</span>
                          </button>
                        ))}
                      </span>
                    )}
                  </Row>
                  <Row
                    label="Finger colours"
                    desc="colour each key by the finger that presses it"
                  >
                    {(ids) => (
                      <Switch
                        {...ids}
                        on={prefs.fingerColours}
                        onToggle={(fingerColours) =>
                          savePrefs({ fingerColours })
                        }
                      />
                    )}
                  </Row>
                  <Row label="Helper hands" desc="the glowing finger guide">
                    {(ids) => (
                      <Switch
                        {...ids}
                        on={prefs.hands}
                        onToggle={(hands) => savePrefs({ hands })}
                      />
                    )}
                  </Row>
                </Group>
                <Group title="Words">
                  {/* Only while the words are in a panel. The in-world
                      letter blocks are capitals by their nature, so a
                      CAPITALS switch there changes nothing. */}
                  {!(
                    band === "5-6" ||
                    (canToggleWords && prefs.wordBlocks)
                  ) && (
                    <Row label="Big letters" desc="show the words in CAPITALS">
                      {(ids) => (
                        <Switch
                          {...ids}
                          on={prefs.bigLetters}
                          onToggle={(bigLetters) => savePrefs({ bigLetters })}
                        />
                      )}
                    </Row>
                  )}
                  {canToggleWords && (
                    <Row
                      label="Letters on the trail"
                      desc="show the words as blocks in the game"
                      tags={<Tag kind="blue">Ages 7–10</Tag>}
                    >
                      {(ids) => (
                        <Switch
                          {...ids}
                          on={prefs.wordBlocks}
                          onToggle={(wordBlocks) => savePrefs({ wordBlocks })}
                        />
                      )}
                    </Row>
                  )}
                  {/* Only once the alphabet is done — before that it is a
                      harder mode dangled in front of a child still learning
                      where D is. */}
                  {included >= totalLetters && (
                    <Row
                      label="Grown-up keys"
                      desc="capitals, then full stops and commas"
                      tags={<Tag kind="green">All letters unlocked</Tag>}
                    >
                      {(ids) => (
                        <Segmented
                          {...ids}
                          value={prefs.grownupKeys}
                          options={
                            [
                              ["off", "Off"],
                              ["caps", "Capitals"],
                              ["punct", "And marks"],
                            ] as const
                          }
                          onPick={(grownupKeys) => savePrefs({ grownupKeys })}
                        />
                      )}
                    </Row>
                  )}
                  <Row
                    label="Space bar hop"
                    desc="the space bar makes you jump"
                  >
                    {(ids) => (
                      <Switch
                        {...ids}
                        on={prefs.spaceJump !== false}
                        onToggle={(spaceJump) => savePrefs({ spaceJump })}
                      />
                    )}
                  </Row>
                </Group>
              </>
            )}

            {section === "sound" && (
              <>
                <Group title="Sounds">
                  <Row
                    label="Sounds"
                    desc="turns every sound on or off — same as the speaker at the top"
                  >
                    {(ids) => (
                      <Switch
                        {...ids}
                        on={prefs.sounds}
                        onToggle={(on) => {
                          // Played BEFORE the save when switching off, so the
                          // child hears the switch they just pressed.
                          kidsAudio.init();
                          kidsAudio.playToggle(on);
                          savePrefs({ sounds: on });
                        }}
                      />
                    )}
                  </Row>
                  {/* The two halves — see `clickSounds` on Prefs — and the
                      voice, all under the master and grey with it. */}
                  <Row
                    label="Key clicks"
                    desc={
                      prefs.sounds
                        ? "a small click for every key and button"
                        : "needs sounds switched on"
                    }
                    indent={true}
                    dim={!prefs.sounds}
                  >
                    {(ids) => (
                      <Switch
                        {...ids}
                        on={prefs.clickSounds && prefs.sounds}
                        disabled={!prefs.sounds}
                        onToggle={() => {
                          const on = !prefs.clickSounds;
                          kidsAudio.init();
                          savePrefs({ clickSounds: on });
                          if (on) {
                            kidsAudio.playToggle(true);
                          }
                        }}
                      />
                    )}
                  </Row>
                  <Row
                    label="Game and background"
                    desc={
                      prefs.sounds
                        ? "jumps, chimes and the sound of the road"
                        : "needs sounds switched on"
                    }
                    indent={true}
                    dim={!prefs.sounds}
                  >
                    {(ids) => (
                      <Switch
                        {...ids}
                        on={prefs.worldSounds && prefs.sounds}
                        disabled={!prefs.sounds}
                        onToggle={() => {
                          const on = !prefs.worldSounds;
                          kidsAudio.init();
                          savePrefs({ worldSounds: on });
                          if (on) {
                            kidsAudio.playPoint();
                          }
                        }}
                      />
                    )}
                  </Row>
                  <Row
                    label="Read it out loud"
                    desc={
                      prefs.sounds
                        ? "the coach says the important bits"
                        : "needs sounds switched on"
                    }
                    indent={true}
                    dim={!prefs.sounds}
                  >
                    {(ids) => (
                      <Switch
                        {...ids}
                        on={prefs.readAloud && prefs.sounds}
                        disabled={!prefs.sounds}
                        onToggle={() => {
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
                      />
                    )}
                  </Row>
                </Group>
                <Group title="Coach">
                  <Row
                    label="Cheers"
                    desc="messages from your buddy while you type"
                  >
                    {(ids) => (
                      <Switch
                        {...ids}
                        on={prefs.cheers}
                        onToggle={(cheers) => savePrefs({ cheers })}
                      />
                    )}
                  </Row>
                  {/* From 9-10 up only — see playfulOffered. */}
                  {m.playfulOffered(band) && (
                    <Row
                      label="Cheeky coach"
                      desc="drier, funnier lines"
                      tags={<Tag kind="violet">Ages 9+</Tag>}
                    >
                      {(ids) => (
                        <Switch
                          {...ids}
                          on={prefs.playful}
                          onToggle={(playful) => savePrefs({ playful })}
                        />
                      )}
                    </Row>
                  )}
                </Group>
              </>
            )}

            {section === "session" && (
              <>
                <Group title="Timer">
                  <Row
                    label="Show the timer"
                    desc={
                      noClock
                        ? "hidden for this learner in Accessibility settings"
                        : "the run ends at the campfire"
                    }
                  >
                    {(ids) => (
                      // A standing preference beats a per-session control:
                      // a parent set "practise without a clock", and a child
                      // flipping this should not undo it.
                      <Switch
                        {...ids}
                        on={prefs.timerVisible && !noClock}
                        disabled={noClock}
                        title={
                          noClock
                            ? "Hidden for this learner in Accessibility settings"
                            : undefined
                        }
                        onToggle={() =>
                          savePrefs({ timerVisible: !prefs.timerVisible })
                        }
                      />
                    )}
                  </Row>
                  <Row
                    label="Session length"
                    desc="how long each run lasts"
                    wide={true}
                  >
                    {(ids) => (
                      <Segmented
                        {...ids}
                        value={prefs.timerMin}
                        options={[5, 10, 15, 20, 25, 30].map(
                          (min) =>
                            [
                              min,
                              min === 30 ? "30 min" : String(min),
                              `${min} minutes`,
                            ] as const,
                        )}
                        onPick={onPickTimer}
                      />
                    )}
                  </Row>
                </Group>
                {/* Classic is the grown-up practice page, which the route
                    mounts in place of this one — so choosing it saves the
                    preference and reloads rather than switching in place. */}
                {canClassic && (
                  <Group
                    title="Practice style"
                    tags={<Tag kind="violet">Ages 9+</Tag>}
                  >
                    <div className={styles.classic}>
                      <span className={styles.classicIcon} aria-hidden="true">
                        <Icon name="keys" size={28} color="#ffffff" />
                      </span>
                      <span className={styles.classicText}>
                        <span className={styles.classicTitle}>
                          Try Classic mode
                        </span>
                        <span className={styles.desc}>
                          just the words, the keyboard and your progress — no
                          trail
                        </span>
                      </span>
                      <button
                        type="button"
                        className={styles.classicGo}
                        onClick={() => m.choosePracticeStyle(true)}
                      >
                        Switch to Classic
                      </button>
                    </div>
                  </Group>
                )}
              </>
            )}
          </div>
        </div>
        <footer className={styles.foot}>
          {/* Only when there is something to cancel: everything else on this
              sheet takes effect as it is tapped and is undone by tapping it
              back — only a world waits. */}
          {worldDraft !== prefs.world && (
            <button
              type="button"
              className={clsx(styles.cta, styles.ctaQuiet)}
              onClick={cancel}
            >
              Cancel
            </button>
          )}
          <button type="button" className={styles.cta} onClick={leaveSettings}>
            Back to the run!
          </button>
        </footer>
      </div>
    </div>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────

type RowIds = {
  readonly labelledBy: string;
  readonly describedBy: string;
};

function Group({
  title,
  note,
  tags,
  children,
}: {
  readonly title: string;
  readonly note?: string;
  readonly tags?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className={styles.group}>
      <h4 className={styles.groupTitle}>
        <span>{title}</span>
        {note != null && <span className={styles.groupNote}>· {note}</span>}
        {tags}
      </h4>
      <div className={styles.groupCard}>{children}</div>
    </section>
  );
}

function Row({
  label,
  desc,
  tags,
  indent = false,
  dim = false,
  wide = false,
  lead,
  children,
}: {
  /** A portrait before the label, for a row that is about somebody. */
  readonly lead?: ReactNode;
  readonly label: string;
  readonly desc: string;
  readonly tags?: ReactNode;
  readonly indent?: boolean;
  readonly dim?: boolean;
  /** A control that needs the room — it drops under the label sooner. */
  readonly wide?: boolean;
  readonly children: (ids: RowIds) => ReactNode;
}) {
  const id = useId();
  const ids = { labelledBy: `${id}-l`, describedBy: `${id}-d` };
  return (
    <div
      className={clsx(
        styles.row,
        indent && styles.rowIndent,
        dim && styles.rowDim,
        wide && styles.rowWide,
      )}
    >
      {lead}
      <div className={styles.rowText}>
        <span className={styles.label}>
          <span id={ids.labelledBy}>{label}</span>
          {tags}
        </span>
        <span id={ids.describedBy} className={styles.desc}>
          {desc}
        </span>
      </div>
      <div className={styles.ctl}>{children(ids)}</div>
    </div>
  );
}

const TAG_CLASS = {
  gold: styles.tagGold,
  blue: styles.tagBlue,
  green: styles.tagGreen,
  violet: styles.tagViolet,
} as const;

function Tag({
  kind,
  children,
}: {
  readonly kind: "gold" | "blue" | "green" | "violet";
  readonly children: ReactNode;
}) {
  return <span className={clsx(styles.tag, TAG_CLASS[kind])}>{children}</span>;
}

function Switch({
  on,
  onToggle,
  labelledBy,
  describedBy,
  disabled = false,
  title,
}: RowIds & {
  readonly on: boolean;
  readonly onToggle: (on: boolean) => void;
  readonly disabled?: boolean;
  readonly title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      title={title}
      className={styles.switch}
      onClick={() => onToggle(!on)}
    >
      <span className={styles.knob} />
    </button>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onPick,
  labelledBy,
  describedBy,
}: RowIds & {
  readonly value: T;
  /** `[value, visible label, spoken label?]` */
  readonly options: readonly (
    | readonly [T, string]
    | readonly [T, string, string]
  )[];
  readonly onPick: (value: T) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const at = options.findIndex(([v]) => v === value);
  const onKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) {
      return;
    }
    e.preventDefault();
    // Right is "next" in a left-to-right row; flipped for right-to-left.
    const rtl =
      ref.current != null && getComputedStyle(ref.current).direction === "rtl";
    const across = e.key === "ArrowLeft" || e.key === "ArrowRight";
    const dir = across && rtl ? -step : step;
    const next = (Math.max(at, 0) + dir + options.length) % options.length;
    onPick(options[next][0]);
    const radios = ref.current?.querySelectorAll<HTMLElement>('[role="radio"]');
    radios?.[next]?.focus();
  };
  return (
    <span
      ref={ref}
      className={styles.seg}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onKeyDown={onKey}
    >
      {options.map(([v, text, spoken], i) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={v === value}
          aria-label={spoken}
          tabIndex={i === Math.max(at, 0) ? 0 : -1}
          className={styles.segItem}
          onClick={() => onPick(v)}
        >
          {text}
        </button>
      ))}
    </span>
  );
}

function Slider({
  low,
  high,
  min,
  max,
  step,
  value,
  onChange,
  labelledBy,
  describedBy,
}: RowIds & {
  readonly low: string;
  readonly high: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <span className={styles.slider}>
      <span className={styles.sliderEnd} aria-hidden="true">
        {low}
      </span>
      <input
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        style={{ "--fill": `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className={styles.sliderEnd} aria-hidden="true">
        {high}
      </span>
    </span>
  );
}

function Face({
  id,
  name,
  on,
  big = false,
  onPick,
  onRename,
}: {
  readonly id: string;
  readonly name: string;
  readonly on: boolean;
  readonly big?: boolean;
  readonly onPick: () => void;
  /** Only on the one being played — renaming lives where the name is. */
  readonly onRename?: () => void;
}) {
  return (
    <span className={clsx(styles.faceWrap, big && styles.faceBig)}>
      <button
        type="button"
        aria-pressed={on}
        className={styles.face}
        onClick={onPick}
      >
        <span
          className={styles.faceRing}
          style={{ "--face": FACE_TINT[id] ?? "#9fb0c8" } as CSSProperties}
        >
          <span className={styles.faceClip}>
            <img src={faceUrl(id)} alt="" />
          </span>
          {on && <Check />}
        </span>
        <span
          className={clsx(styles.faceName, onRename && styles.faceNameRoom)}
        >
          {name}
        </span>
      </button>
      {onRename != null && (
        <button
          type="button"
          className={styles.pencil}
          aria-label={`Rename ${name}`}
          title={`Rename ${name}`}
          onClick={onRename}
        >
          <Icon name="pencil" size={12} strokeWidth={2.4} />
        </button>
      )}
    </span>
  );
}

function Check({ corner = false }: { readonly corner?: boolean }) {
  return (
    <span
      className={clsx(styles.check, corner && styles.checkCorner)}
      aria-hidden="true"
    >
      <Icon name="check" size={13} strokeWidth={3} color="#ffffff" />
    </span>
  );
}

/** A small board: plain keys with finger-zone rims, or painted rainbow keys. */
function BoardPicture({ rainbow }: { readonly rainbow: boolean }) {
  const fills = ["#e35d51", "#4a5fb8", "#6fb8e4", "#4ab86a"];
  const rims = ["#f5a8b8", "#8fce7e", "#f2c94c", "#5fc9a7"];
  return (
    <svg
      className={styles.boardSvg}
      viewBox="0 0 88 32"
      width="88"
      height="32"
      aria-hidden="true"
    >
      {Array.from({ length: 10 }, (_, i) => (
        <rect
          key={i}
          x={1 + (i % 5) * 17.5}
          y={i < 5 ? 1 : 17}
          width={15}
          height={13}
          rx={3}
          fill={rainbow ? fills[i % 4] : "#ffffff"}
          stroke={rainbow ? "none" : rims[i % 4]}
          strokeWidth={1.6}
        />
      ))}
    </svg>
  );
}

type IconName =
  | "globe"
  | "sun"
  | "keys"
  | "sound"
  | "clock"
  | "gear"
  | "pencil"
  | "check";

const ICON_PATHS: Readonly<Record<IconName, ReactNode>> = {
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  keys: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="3" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </>
  ),
  sound: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  check: <path d="M5 12l5 5L20 7" />,
};

function Icon({
  name,
  size = 18,
  color = "currentColor",
  strokeWidth = 2.2,
}: {
  readonly name: IconName;
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
