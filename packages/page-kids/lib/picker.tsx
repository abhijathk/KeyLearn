import { type ReactElement, useEffect, useRef, useState } from "react";
import * as styles from "./kids.module.less";
import { ASSETS } from "./world.ts";

/**
 * ── WHO WALKS TODAY ──────────────────────────────────────────────────────
 *
 * The screen between the loading card and the road: who the child plays as,
 * and who comes with them.
 *
 * IT IS NOT A SETTINGS PANEL THAT HAPPENS TO OPEN FIRST. The same two choices
 * already exist in the toy-box, and the reason this exists anyway is that
 * nobody opens a settings sheet on their way into a game — the cast was
 * something a child discovered by accident weeks in, or never. Asking once,
 * every session, in a screen they cannot miss, is the difference between a
 * game with four characters in it and a game with one.
 *
 * It is also the cover the streaming build needs. It opens as soon as the
 * character standing on the turntable has arrived — about a megabyte — and
 * the rest of the road builds behind it while the child is choosing.
 *
 * WHAT IS LIVE AND WHAT IS NOT. One 3-D model, the character only. Every
 * other face on the screen is a 6 KB portrait rendered offline from the same
 * GLB by `scripts/glb-face.mjs`; all five together are 30 KB against 4.8 MB
 * of models. That is what makes this affordable at all, and it is why the
 * companion row shows faces rather than figures.
 */

/** Where the offline-rendered portraits live. See `scripts/glb-face.mjs`. */
const faceUrl = (id: string) => `${ASSETS}/faces/${id}.webp`;

export type Pick = {
  readonly id: string;
  readonly label: string;
};

export function Picker({
  open,
  chapter,
  sign,
  lesson,
  characters,
  companions,
  playingAs,
  walkingWith,
  ready,
  onPickCharacter,
  onToggleCompanion,
  onRename,
  onConfirm,
  onRunning,
  canvasRef,
}: {
  /**
   * Whether this screen is the one being looked at.
   *
   * It is mounted before it is shown — its canvas has to exist for the model
   * to load into, and that load is what the loading card waits for — so for a
   * few seconds it is a full, working screen sitting under an opaque one.
   * It also has to stay deaf while it is under there. The loading card now
   * opens this screen by itself rather than on a key, but the space bar is
   * still what confirms it — and a screen that listens before it is looked
   * at is how a stray keystroke once sent the choice in the same frame that
   * revealed it.
   */
  readonly open: boolean;
  readonly chapter: string;
  /** The world's title sign, drawn small at the head of the screen. */
  readonly sign?: string;
  readonly lesson: string;
  readonly characters: readonly Pick[];
  readonly companions: readonly Pick[];
  readonly playingAs: string;
  readonly walkingWith: readonly string[];
  /** Whether the road behind this screen has finished arriving. */
  readonly ready: boolean;
  onPickCharacter(id: string): void;
  onToggleCompanion(id: string): void;
  /** `null` puts the shipped name back. */
  onRename(id: string, name: string | null): void;
  onConfirm(): void;
  /**
   * Turns the turntable into the loading card's runner.
   *
   * Once the child has confirmed, this screen is a waiting room and the
   * character on it is on his way somewhere — so he squares up side-on and
   * runs, at the size the card draws him. Standing still and turning slowly
   * would say the opposite of what the screen now means.
   */
  onRunning(on: boolean): void;
  readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
}): ReactElement {
  /**
   * Confirmed, but the road has not caught up.
   *
   * Kept as its own state rather than derived from `ready`, because what it
   * means is "this child has finished choosing" — which stays true while the
   * world lands, and is what turns this screen into the waiting room rather
   * than leaving it interactive behind a veil.
   */
  const [sent, setSent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const chosen = characters.find((c) => c.id === playingAs) ?? characters[0];
  const full = walkingWith.length >= 2;

  // The moment the road is ready, a child who has already confirmed goes.
  // They are not asked twice: the second press they would need is a press
  // for a question they have answered.
  useEffect(() => {
    onRunning(sent);
  }, [sent, onRunning]);

  useEffect(() => {
    if (sent && ready) {
      onConfirm();
    }
  }, [sent, ready, onConfirm]);

  /**
   * SPACE AND ENTER CONFIRM, as they did on the loading card — except while
   * a name is being typed, where every key belongs to the name.
   */
  useEffect(() => {
    if (!open || sent || editing) {
      return;
    }
    const go = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setSent(true);
      }
    };
    window.addEventListener("keydown", go);
    return () => window.removeEventListener("keydown", go);
  }, [open, sent, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      // SELECTED, NOT PLACED AT THE END. A child renaming somebody wants a
      // different name rather than an edit to this one, so the first key
      // they press should already be the new name's first letter.
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    // Emptied means "put the shipped name back", which is also the only way
    // out for a child who cannot spell the name they have just replaced.
    onRename(chosen.id, next === "" ? null : next);
  };

  return (
    <div
      className={[
        styles.picker,
        open ? styles.pickerIn : "",
        sent ? styles.pickSent : "",
      ].join(" ")}
      inert={!open || undefined}
      aria-hidden={!open}
    >
      <div className={styles.pickSky} />
      <div
        className={[
          styles.pickTop,
          sign != null ? styles.pickTopSigned : "",
        ].join(" ")}
      >
        {/* The same sign the loading card opened on, small and first in the
            row, so the name of the place stays on screen while the child
            chooses. */}
        {sign != null && (
          <img
            className={styles.pickSign}
            src={sign}
            alt=""
            aria-hidden="true"
          />
        )}
        <div>
          <div className={styles.pickWhere}>{chapter}</div>
          <div className={styles.pickAsk}>Who is walking today?</div>
        </div>
        <button
          type="button"
          className={styles.pickGo}
          onClick={() => setSent(true)}
        >
          Walk on <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className={styles.pickStage}>
        {/*
          360 across at the device ratio is 720 device pixels at 2x, which is
          more than this is ever drawn at — the same sizing the loading card
          uses, and for the same reason.
        */}
        <canvas
          ref={canvasRef}
          className={styles.pickArt}
          width={360}
          height={420}
        />
        {/* No progress bar on this screen: the road is the loader's and stays
            there. This is the other half of what it was doing — a figure with
            no shadow floats. */}
        <div className={styles.pickShade} />
      </div>

      <div className={styles.pickIdent}>
        {sent ? (
          /*
            CONFIRMED, AND THE ROAD IS STILL ARRIVING.

            The name plate's own row carries the message, which is why there
            is no separate panel: the child has just read a name in this
            spot, and the sentence replacing it is about that name.
          */
          <div className={styles.pickWaitLab}>
            {sentence(
              chosen.label,
              walkingWith.map((id) => labelOf(companions, id)),
            )}
          </div>
        ) : editing ? (
          <>
            <span className={`${styles.pickPlate} ${styles.pickPlateOn}`}>
              <input
                ref={inputRef}
                className={styles.pickInput}
                value={draft}
                maxLength={NAME_MAX}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Stopped from reaching the window handler above, which
                  // would otherwise confirm the screen on the space bar in
                  // the middle of a two-word name.
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    commit();
                  }
                  if (e.key === "Escape") {
                    setEditing(false);
                  }
                }}
                onBlur={commit}
                aria-label="What to call them"
              />
              <span className={styles.pickCount}>
                {draft.length}/{NAME_MAX}
              </span>
            </span>
            <span className={styles.pickKeys}>
              <b>Enter</b> keep it <b>Esc</b> leave it alone
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.pickPlate}
              onClick={() => {
                setDraft(chosen.label);
                setEditing(true);
              }}
            >
              <b>{chosen.label}</b>
              <span className={styles.pickPenBox} aria-hidden="true">
                <svg className={styles.pickPen} viewBox="0 0 24 24">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </span>
            </button>
            {chosen.label !== shipped(chosen.id) && (
              <button
                type="button"
                className={styles.pickUndo}
                onClick={() => onRename(chosen.id, null)}
              >
                was {shipped(chosen.id)} — <u>put it back</u>
              </button>
            )}
          </>
        )}
      </div>

      <div className={styles.pickRows}>
        <div className={styles.pickRule} />
        <div className={`${styles.pickGrp} ${styles.pickWho}`}>
          <div className={styles.pickLab}>
            <b>Walking as</b>
          </div>
          <Row
            people={characters}
            lit={(id) => id === playingAs}
            onTap={onPickCharacter}
          />
        </div>
        <div
          className={[
            styles.pickGrp,
            styles.pickWith,
            full ? styles.pickFull : "",
          ].join(" ")}
        >
          <div className={styles.pickLab}>
            <b>Walking with</b>
            <i>
              {"· "}
              {walkingWith.length === 0
                ? "up to two"
                : full
                  ? "both chosen · tap one to drop it"
                  : "room for one more"}
            </i>
          </div>
          <Row
            people={companions}
            lit={(id) => walkingWith.includes(id)}
            onTap={onToggleCompanion}
          />
        </div>
      </div>

      {sent && (
        /*
          THE VEIL, AND NOTHING ON IT.

          The picker goes soft rather than leaving, so the child keeps seeing
          the choice they just made while it is being made ready — but the
          character they chose stays sharp in front of it, still turning, and
          the message sits in the name plate's own row.

          This was a flat PNG of the character over a blurred screen, and it
          was wrong the way a still of a rigged model is always wrong: the
          image comes out of the GLB's BIND POSE, so Dave stood there with
          his arms straight out like a scarecrow. Keeping the scene that is
          already running costs nothing, needs no extra file, and shows him
          in a pose somebody actually animated.
        */
        <div className={styles.pickWait} />
      )}
    </div>
  );
}

/** One row of faces. Both rows are the same object — see `.pickAv`. */
function Row({
  people,
  lit,
  onTap,
}: {
  readonly people: readonly Pick[];
  lit(id: string): boolean;
  onTap(id: string): void;
}): ReactElement {
  return (
    <div className={styles.pickStrip}>
      {people.map((p) => {
        const on = lit(p.id);
        return (
          <button
            key={p.id}
            type="button"
            className={styles.pickOne}
            aria-pressed={on}
            onClick={() => onTap(p.id)}
          >
            {/* A ring (lit when chosen), the portrait inside it, and a check
                badge on the chosen one — the tick says "chosen" to a child
                who cannot tell a gradient ring from a hover. */}
            <span
              className={[styles.pickAv, on ? styles.pickOn : ""].join(" ")}
            >
              <span
                className={styles.pickFace}
                style={{ backgroundImage: faceLayers(p.id) }}
              />
              {on && (
                <span className={styles.pickCheck} aria-hidden="true">
                  <svg className={styles.pickTick} viewBox="0 0 24 24">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </span>
              )}
            </span>
            <span className={styles.pickName}>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The colour each portrait sits on — the glow behind the face in the offline
 * render's circle, keyed by cast id. Anybody new gets a neutral grey.
 */
const FACE_TINT: Readonly<Record<string, string>> = {
  Explorer: "#5b8def",
  Peeli: "#e9739a",
  Explorer6: "#4fb58a",
  Robot: "#8a8fa8",
  Puppy: "#c89b6d",
};

/** The portrait over a soft light in that character's colour. */
const faceLayers = (id: string) =>
  `url(${faceUrl(id)}), radial-gradient(circle at 50% 35%, #fff, ${
    FACE_TINT[id] ?? "#8a8fa8"
  })`;

const labelOf = (people: readonly Pick[], id: string) =>
  people.find((p) => p.id === id)?.label ?? "";

/**
 * "Dave is on his way", "Dave and Peeli are", "Dave, Peeli and Robot are".
 *
 * Built rather than templated because the party is nought, one or two and
 * each needs a different sentence — and a line reading "Dave,  are on their
 * way" is exactly the kind of thing a child notices first.
 */
const sentence = (who: string, party: readonly string[]): string => {
  const all = [who, ...party.filter((s) => s !== "")];
  const names =
    all.length === 1
      ? all[0]
      : `${all.slice(0, -1).join(", ")} and ${all[all.length - 1]}`;
  return `${names} ${all.length === 1 ? "is" : "are"} on their way`;
};

/**
 * Set by the page, which owns both tables. Kept as module state rather than
 * threaded through every prop because it is a constant of the build that
 * happens to live in another file — and a picker that had to be handed the
 * whole cast twice would be a picker two callers could disagree about.
 */
let shippedLabelOf: (id: string) => string = (id) => id;
/** Replaced by `configurePicker` at module load; the page owns the number. */
let NAME_MAX = 12;
export function configurePicker(
  shippedLabel: (id: string) => string,
  nameMax: number,
): void {
  shippedLabelOf = shippedLabel;
  NAME_MAX = nameMax;
}
const shipped = (id: string) => shippedLabelOf(id);
