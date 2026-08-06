import {
  artFamilies,
  artKindOf,
  ArtMotif,
  artPaletteOf,
  newArtSeed,
} from "@keylearn/identicon";
import { activeProfileArt } from "@keylearn/pages-shared";
import { StrokeIcon } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as dialog from "./dialog.module.less";
import { type Point, smooth } from "./report-data.ts";
import * as styles from "./share.module.less";

export const SHARE_OPEN_EVENT = "keylearn:share-open";

export function openShare(): void {
  window.dispatchEvent(new CustomEvent(SHARE_OPEN_EVENT));
}

/**
 * Everything a card is allowed to say, already reduced to figures.
 *
 * Deliberately not the learner's results: a braille learner's progress has a
 * different shape entirely, and passing facts rather than a results context is
 * what lets both kinds of profile share the same card. It is also the reason
 * nothing about how somebody types can reach the card — there is no field here
 * to carry it, so no future edit can leak it by accident.
 */
export type ShareFacts = {
  readonly name: string | null;
  readonly kid: boolean;
  /** Characters this learner has unlocked, and how many there are in total. */
  readonly letters: number;
  readonly alphabet: number;
  readonly daysPractised: number;
  readonly weeks: number;
  readonly lessons: number;
  /** Null where the mode has no comparable speed or accuracy figure. */
  readonly wpm: number | null;
  readonly accuracy: number | null;
  readonly best: number | null;
  readonly points: readonly Point[];
};

type CardShape = "wide" | "square" | "story";
type Look = "night" | "day" | "bold" | "paper";

const LOOKS: Readonly<
  Record<
    Look,
    { readonly bg: string; readonly fg: string; readonly dim: string }
  >
> = {
  night: {
    bg: "linear-gradient(150deg,#1a1f30,#141620 60%)",
    fg: "#e6e8ee",
    dim: "#9aa0b4",
  },
  day: {
    bg: "linear-gradient(150deg,#ffffff,#eef1f7 60%)",
    fg: "#1f2433",
    dim: "#5d6377",
  },
  bold: {
    bg: "linear-gradient(140deg,#0f2f24,#06120e 70%)",
    fg: "#ffffff",
    dim: "#7fc9a8",
  },
  paper: {
    bg: "linear-gradient(150deg,#f6f1e6,#ece3d2 70%)",
    fg: "#3a3327",
    dim: "#8a7f6b",
  },
};

/** Relative luminance, good enough to sort three colours by lightness. */
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    (0.2126 * ((n >> 16) & 255) +
      0.7152 * ((n >> 8) & 255) +
      0.0722 * (n & 255)) /
    255
  );
}

/**
 * Share a milestone, not a metric.
 *
 * Everything is drawn on the device and previewed exactly as it will appear;
 * nothing leaves until a person has seen what leaves. There is no platform SDK
 * anywhere near this — an embedded share button would contact that platform,
 * set cookies and leak the page before anybody clicked.
 *
 * A child's card is a different document, not the same one with a flag: no
 * name and no age by default, no age offered at all, and two explicit
 * statements from the adult before it can go anywhere. See {@link KidShare}.
 */
export function ShareDialog({
  facts,
}: {
  readonly facts: ShareFacts;
}): ReactNode {
  const profileName = facts.name;
  const kidProfile = facts.kid;
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState<CardShape>("wide");
  const [look, setLook] = useState<Look>("night");
  const [head, setHead] = useState(0);
  const [ownWords, setOwnWords] = useState("");
  const [caption, setCaption] = useState("");
  const [captionEdited, setCaptionEdited] = useState(false);
  const [opts, setOpts] = useState({
    name: false,
    speed: true,
    streak: true,
    keys: true,
    line: false,
    dates: false,
  });

  // A child's card carries nothing that points at a particular child unless an
  // adult turns it on, one field at a time.
  const [showName, setShowName] = useState(false);
  const [nameMode, setNameMode] = useState<"nickname" | "first">("nickname");
  const [nickname, setNickname] = useState("");
  const [isGuardian, setIsGuardian] = useState(false);
  const [understands, setUnderstands] = useState(false);

  // Starts as the learner's own painting and rerolls from there. Shuffling
  // here never touches the avatar — the card is a poster, not a profile.
  const [art, setArt] = useState<{
    readonly family: string;
    readonly seed: number;
  } | null>(null);

  const rollArt = () => {
    const kind = kidProfile ? "kid" : "adult";
    const list = artFamilies(kind);
    const seed = newArtSeed();
    setArt({ family: list[seed % list.length].id, seed });
  };

  useEffect(() => {
    const onOpen = () => {
      // Read on open rather than on mount: the learner at the keyboard can
      // change while this component is alive.
      const own = activeProfileArt();
      const kind = kidProfile ? "kid" : "adult";
      setArt(
        own != null && artKindOf(own.family) === kind
          ? own
          : { family: artFamilies(kind)[1].id, seed: 20260806 },
      );
      setShowName(false);
      setIsGuardian(false);
      setUnderstands(false);
      setCaptionEdited(false);
      setOpen(true);
    };
    window.addEventListener(SHARE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(SHARE_OPEN_EVENT, onOpen);
  }, [kidProfile]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) {
    return null;
  }

  // Every figure on the card is the learner’s own. Nothing here is a round
  // number chosen because it looked good in a layout: a card that overstates
  // a child’s progress is worse than no card, because somebody will read it.
  const { letters, alphabet, weeks, points } = facts;
  const days = facts.daysPractised;
  const wpm = facts.wpm;
  const accuracy = facts.accuracy;
  const plural = (n: number, one: string, many: string) =>
    n === 1 ? one : many;

  const shownName = kidProfile
    ? showName
      ? nameMode === "nickname"
        ? nickname.trim() || "…"
        : (profileName ?? "")
      : null
    : opts.name
      ? (profileName ?? null)
      : null;

  const heads: readonly (readonly [string, string, string])[] = kidProfile
    ? [
        [
          "There’s a new typist in the family",
          "There’s a new typist",
          "in the family",
        ],
        letters >= alphabet && alphabet > 0
          ? ["Every letter, learned", "Every letter,", "learned"]
          : [
              `${letters} ${plural(letters, "letter", "letters")} so far`,
              `${letters} ${plural(letters, "letter", "letters")}`,
              "learned so far",
            ],
        shownName != null
          ? [
              `We are proud of ${shownName}`,
              `We are very proud`,
              `of ${shownName} today`,
            ]
          : [
              "Someone here is very proud today",
              "Someone here is",
              "very proud today",
            ],
      ]
    : [
        [
          `${days} days, every one`,
          `${days} days of practice,`,
          "every one of them",
        ],
        letters >= alphabet && alphabet > 0
          ? [
              "Finished the alphabet",
              "The whole alphabet,",
              "one key at a time",
            ]
          : [
              `${letters} of ${alphabet} keys`,
              `${letters} of ${alphabet} keys,`,
              "and counting",
            ],
        facts.best != null
          ? [
              "A new personal best",
              "A new personal best:",
              `${Math.round(facts.best)} wpm`,
            ]
          : ["Still going", "Still at it,", "one lesson at a time"],
      ];
  const own = head === heads.length;
  const line1 = own ? ownWords : heads[head][1];
  const line2 = own ? "" : heads[head][2];

  const L = LOOKS[look];
  // The card takes its colour from the artwork rather than from a picker.
  // There is no combination to get wrong that way, and the headline is
  // guaranteed to belong to the same painting as the corner.
  const palette = artPaletteOf(art?.family ?? "flow", art?.seed ?? 1);
  const pale = look === "day" || look === "paper";
  const washes = [...palette.wash].sort((a, b) => lum(a) - lum(b));
  const A = pale ? palette.ink : washes[washes.length - 1];

  const autoCaption = kidProfile
    ? `${line1} ${line2}`.trim()
    : `${days} ${plural(days, "day", "days")} of typing practice.${wpm != null ? ` ${wpm} wpm and climbing.` : ""} #KeyLearn`;
  const captionText = captionEdited ? caption : autoCaption;

  const canShare = !kidProfile || (isGuardian && understands);

  const doShare = () => {
    void navigator
      .share?.({
        title: "KeyLearn",
        text: captionText,
        url: "https://keylearn.com",
      })
      .catch(() => {
        // A dismissed share sheet is a normal outcome, not a fault.
      });
  };

  const card = (
    <div className={styles.stage}>
      <div
        className={clsx(styles.card, styles[shape])}
        style={{ background: L.bg, color: L.fg }}
      >
        {art != null && (
          <ArtMotif
            className={styles.motif}
            family={art.family}
            seed={art.seed}
            kind={kidProfile ? "kid" : "adult"}
            opacity={pale ? 0.9 : 0.72}
          />
        )}
        {/* The app's own mark, not a coloured square. The icon takes the
            card's colour so the header belongs to the artwork; the wordmark
            keeps its two weights, which is what makes it recognisable. */}
        <div className={styles.top} style={{ color: L.dim }}>
          <span className={styles.glyph} style={{ color: A }}>
            <StrokeIcon name="keyboard" title="KeyLearn" />
          </span>
          <span className={styles.mark} style={{ color: L.fg }}>
            Key<em style={{ color: L.dim }}>Learn</em>
          </span>
          {shownName != null && <span className={styles.who}>{shownName}</span>}
        </div>
        <div className={styles.big}>
          {line1}
          {line2 !== "" && (
            <>
              <br />
              <em style={{ color: A }}>{line2}</em>
            </>
          )}
        </div>
        <div>
          <div className={styles.row} style={{ color: L.dim }}>
            {kidProfile ? (
              <>
                <span>
                  <b>{letters}</b>
                  {plural(letters, "letter", "letters")}
                </span>
                <span>
                  <b>{weeks}</b>
                  {plural(weeks, "week", "weeks")}
                </span>
              </>
            ) : (
              <>
                {opts.speed && wpm != null && (
                  <span>
                    <b>{wpm}</b>wpm
                  </span>
                )}
                {opts.speed && accuracy != null && (
                  <span>
                    <b>{(accuracy * 100).toFixed(1)}%</b>accurate
                  </span>
                )}
                {opts.streak && (
                  <span>
                    <b>{days}</b>
                    {plural(days, "day", "days")} practised
                  </span>
                )}
                {opts.keys && (
                  <span>
                    <b>{letters}</b>of {alphabet} learned
                  </span>
                )}
                {opts.dates && (
                  <span>
                    <b>{weeks}</b>
                    {plural(weeks, "week", "weeks")}
                  </span>
                )}
              </>
            )}
          </div>
          {opts.line && points.length > 2 && (
            <Spark points={points} colour={A} />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={dialog.overlay}
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        className={clsx(dialog.win, dialog.wide)}
        role="dialog"
        aria-modal={true}
      >
        <div className={dialog.head}>
          <span>
            {kidProfile ? (
              <FormattedMessage
                id="share.titleKid"
                defaultMessage="Share {name}’s progress"
                values={{ name: profileName ?? "" }}
              />
            ) : (
              <FormattedMessage
                id="share.title"
                defaultMessage="Share progress"
              />
            )}
          </span>
          <span className={dialog.spacer} />
          <button
            type="button"
            className={dialog.close}
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>

        <div className={dialog.body}>
          {card}

          {kidProfile ? (
            <>
              <Says
                heads={heads}
                head={head}
                setHead={setHead}
                ownWords={ownWords}
                setOwnWords={setOwnWords}
              />

              <div className={dialog.label}>
                <FormattedMessage id="share.artwork" defaultMessage="Artwork" />
              </div>
              <div className={dialog.chips}>
                <button type="button" className={dialog.chip} onClick={rollArt}>
                  <FormattedMessage
                    id="share.shuffleArt"
                    defaultMessage="⤫ Shuffle"
                  />
                </button>
              </div>
              <p className={dialog.hint}>
                <FormattedMessage
                  id="share.artwork.hint"
                  defaultMessage="It starts as the painting from this learner’s avatar, and the card takes its colour from it. Shuffling changes the card only — the avatar stays as it is."
                />
              </p>

              <div className={dialog.label}>
                <FormattedMessage
                  id="share.noName"
                  defaultMessage="This card carries no name and no age"
                />
              </div>
              <p className={dialog.hint}>
                <FormattedMessage
                  id="share.noName.body"
                  defaultMessage="Nothing on it points at a particular child. That is the default, and for most people it is all they wanted — the achievement is the thing worth showing."
                />
              </p>

              <label className={clsx(dialog.check, styles.strong)}>
                <input
                  type="checkbox"
                  checked={showName}
                  onChange={(ev) => setShowName(ev.target.checked)}
                />
                <span>
                  <FormattedMessage
                    id="share.showName"
                    defaultMessage="Show a name on the card"
                  />
                  <small>
                    <FormattedMessage
                      id="share.showName.hint"
                      defaultMessage="off by default"
                    />
                  </small>
                </span>
              </label>
              {showName && (
                <>
                  <div className={dialog.chips}>
                    <button
                      type="button"
                      className={clsx(
                        dialog.chip,
                        nameMode === "nickname" && dialog.on,
                      )}
                      onClick={() => setNameMode("nickname")}
                    >
                      <FormattedMessage
                        id="share.nickname"
                        defaultMessage="A nickname you choose"
                      />
                    </button>
                    <button
                      type="button"
                      className={clsx(
                        dialog.chip,
                        nameMode === "first" && dialog.on,
                      )}
                      onClick={() => setNameMode("first")}
                    >
                      <FormattedMessage
                        id="share.firstName"
                        defaultMessage="{name}’s first name"
                        values={{ name: profileName ?? "" }}
                      />
                    </button>
                  </div>
                  {nameMode === "nickname" && (
                    <input
                      className={styles.field}
                      value={nickname}
                      placeholder="“our small dinosaur”"
                      onChange={(ev) => setNickname(ev.target.value)}
                    />
                  )}
                </>
              )}

              <div className={styles.consent}>
                <div className={styles.consentHead}>
                  <FormattedMessage
                    id="share.consent"
                    defaultMessage="Before this can be shared"
                  />
                </div>
                <label className={dialog.check}>
                  <input
                    type="checkbox"
                    checked={isGuardian}
                    onChange={(ev) => setIsGuardian(ev.target.checked)}
                  />
                  <span>
                    <FormattedMessage
                      id="share.consent.guardian"
                      defaultMessage="I am {name}’s parent or guardian, and I am choosing to publish this."
                      values={{ name: profileName ?? "" }}
                    />
                  </span>
                </label>
                <label className={dialog.check}>
                  <input
                    type="checkbox"
                    checked={understands}
                    onChange={(ev) => setUnderstands(ev.target.checked)}
                  />
                  <span>
                    <FormattedMessage
                      id="share.consent.permanent"
                      defaultMessage="I understand this cannot be taken back once it is posted."
                    />
                  </span>
                </label>
              </div>
            </>
          ) : (
            <div className={dialog.cols}>
              <div>
                <div className={dialog.label}>
                  <FormattedMessage id="share.shape" defaultMessage="Shape" />
                </div>
                <div className={dialog.chips}>
                  {(
                    [
                      ["wide", "Link card 1200×630"],
                      ["square", "Square 1080"],
                      ["story", "Story 9:16"],
                    ] as const
                  ).map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      className={clsx(dialog.chip, shape === id && dialog.on)}
                      onClick={() => setShape(id)}
                    >
                      {text}
                    </button>
                  ))}
                </div>

                <Says
                  heads={heads}
                  head={head}
                  setHead={setHead}
                  ownWords={ownWords}
                  setOwnWords={setOwnWords}
                />

                <div className={dialog.label}>
                  <FormattedMessage id="share.look" defaultMessage="Look" />
                </div>
                <div className={dialog.chips}>
                  {(
                    [
                      ["night", "Night"],
                      ["day", "Day"],
                      ["bold", "Bold"],
                      ["paper", "Paper"],
                    ] as const
                  ).map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      className={clsx(dialog.chip, look === id && dialog.on)}
                      onClick={() => setLook(id)}
                    >
                      {text}
                    </button>
                  ))}
                </div>

                <div className={dialog.label}>
                  <FormattedMessage
                    id="share.artwork"
                    defaultMessage="Artwork"
                  />
                </div>
                <div className={dialog.chips}>
                  <button
                    type="button"
                    className={dialog.chip}
                    onClick={rollArt}
                  >
                    <FormattedMessage
                      id="share.shuffleArt"
                      defaultMessage="⤫ Shuffle"
                    />
                  </button>
                </div>
                <p className={dialog.hint}>
                  <FormattedMessage
                    id="share.artwork.hint"
                    defaultMessage="It starts as the painting from this learner’s avatar, and the card takes its colour from it. Shuffling changes the card only — the avatar stays as it is."
                  />
                </p>
              </div>

              <div>
                <div className={dialog.label}>
                  <FormattedMessage
                    id="share.onCard"
                    defaultMessage="On the card"
                  />
                </div>
                {(
                  [
                    [
                      "name",
                      "My name",
                      "off by default — it says what you did, not who you are",
                    ],
                    ["speed", "Speed and accuracy", ""],
                    ["streak", "Streak", ""],
                    ["keys", "Keys learned", ""],
                    ["line", "A small progress line", ""],
                    ["dates", "The date range", ""],
                  ] as const
                ).map(([key, text, hint]) => (
                  <label key={key} className={dialog.check}>
                    <input
                      type="checkbox"
                      checked={opts[key]}
                      onChange={(ev) =>
                        setOpts((prev) => ({
                          ...prev,
                          [key]: ev.target.checked,
                        }))
                      }
                    />
                    <span>
                      {text}
                      {hint !== "" && <small>{hint}</small>}
                    </span>
                  </label>
                ))}

                <div className={dialog.label}>
                  <FormattedMessage
                    id="share.caption"
                    defaultMessage="Caption to post with it"
                  />
                </div>
                <textarea
                  className={styles.area}
                  rows={3}
                  value={captionText}
                  onChange={(ev) => {
                    setCaptionEdited(true);
                    setCaption(ev.target.value);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className={dialog.foot}>
          <button
            type="button"
            className={dialog.btn}
            onClick={() => window.print()}
          >
            <FormattedMessage
              id="share.saveImage"
              defaultMessage="↓ Save image"
            />
          </button>
          {!kidProfile && (
            <button
              type="button"
              className={dialog.btn}
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(`${captionText}\nhttps://keylearn.com`)
                  .catch(() => {
                    // Clipboard access can be refused; nothing is lost.
                  });
              }}
            >
              <FormattedMessage
                id="share.copyLink"
                defaultMessage="⧉ Copy link"
              />
            </button>
          )}
          <span className={dialog.spacer} />
          {kidProfile && (
            <button
              type="button"
              className={dialog.btn}
              onClick={() => setOpen(false)}
            >
              <FormattedMessage id="share.cancel" defaultMessage="Cancel" />
            </button>
          )}
          <button
            type="button"
            className={clsx(dialog.btn, dialog.go)}
            disabled={!canShare}
            onClick={doShare}
          >
            <FormattedMessage id="share.share" defaultMessage="↗ Share…" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The shape of the learner's progress, and nothing else — no axis, no figures.
 * A card is read in a second, and a chart that needs a legend has already lost
 * that second.
 */
function Spark({
  points,
  colour,
}: {
  readonly points: readonly Point[];
  readonly colour: string;
}): ReactNode {
  const avg = smooth(points, 7);
  const lo = Math.min(...avg);
  const hi = Math.max(...avg);
  const W = 160;
  const H = 26;
  const x = (i: number) => (i / (avg.length - 1)) * W;
  const y = (v: number) => H - 2 - ((v - lo) / Math.max(1, hi - lo)) * (H - 4);
  const d = avg.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${y(v)}`).join(" ");
  return (
    <svg className={styles.spark} viewBox={`0 0 ${W} ${H}`} aria-hidden={true}>
      <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={colour} opacity={0.16} />
      <path
        d={d}
        fill="none"
        stroke={colour}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Says({
  heads,
  head,
  setHead,
  ownWords,
  setOwnWords,
}: {
  readonly heads: readonly (readonly [string, string, string])[];
  readonly head: number;
  readonly setHead: (n: number) => void;
  readonly ownWords: string;
  readonly setOwnWords: (s: string) => void;
}): ReactNode {
  return (
    <>
      <div className={dialog.label}>
        <FormattedMessage id="share.says" defaultMessage="What it says" />
      </div>
      <div className={dialog.chips}>
        {heads.map((h, i) => (
          <button
            key={i}
            type="button"
            className={clsx(dialog.chip, head === i && dialog.on)}
            onClick={() => setHead(i)}
          >
            {h[0]}
          </button>
        ))}
        <button
          type="button"
          className={clsx(dialog.chip, head === heads.length && dialog.on)}
          onClick={() => setHead(heads.length)}
        >
          <FormattedMessage
            id="share.ownWords"
            defaultMessage="Write your own…"
          />
        </button>
      </div>
      {head === heads.length && (
        <input
          className={styles.field}
          value={ownWords}
          placeholder="In your own words"
          onChange={(ev) => setOwnWords(ev.target.value)}
        />
      )}
    </>
  );
}
