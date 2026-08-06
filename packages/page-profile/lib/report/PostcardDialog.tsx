import { artFamilies, artKindOf, newArtSeed } from "@keylearn/identicon";
import {
  activeProfileArt,
  downloadBlob,
  exportFilename,
} from "@keylearn/pages-shared";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as dialog from "./dialog.module.less";
import {
  POSTCARD_SIZE,
  type PostcardDesign,
  renderPostcard,
} from "./postcard.ts";
import * as styles from "./share.module.less";
import { type ShareFacts } from "./ShareDialog.tsx";

export const POSTCARD_OPEN_EVENT = "keylearn:postcard-open";

export function openPostcard(): void {
  window.dispatchEvent(new CustomEvent(POSTCARD_OPEN_EVENT));
}

/**
 * The postcard: something to keep, not something to file.
 *
 * Unlike the share card there is no preview drawn in HTML — the postcard is
 * dense enough that a second implementation of its layout would drift from the
 * canvas within a week. It is rendered once, to the real thing, and shown.
 * What is on screen is the file, because it *is* the file.
 */
export function PostcardDialog({
  facts,
  formatDate,
}: {
  readonly facts: ShareFacts;
  readonly formatDate: (at: number) => string;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [design, setDesign] = useState<PostcardDesign>("ticket");
  const [art, setArt] = useState<{
    readonly family: string;
    readonly seed: number;
  } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = () => {
      const own = activeProfileArt();
      const kind = facts.kid ? "kid" : "adult";
      setArt(
        own != null && artKindOf(own.family) === kind
          ? own
          : { family: artFamilies(kind)[1].id, seed: 20260806 },
      );
      // A child is shown their card first; a grown-up the record.
      setDesign(facts.kid ? "card" : "ticket");
      setNote(null);
      setOpen(true);
    };
    window.addEventListener(POSTCARD_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(POSTCARD_OPEN_EVENT, onOpen);
  }, [facts.kid]);

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

  const model = useMemo(
    () => ({
      design,
      facts,
      art,
      fontFamily:
        typeof document === "undefined"
          ? "sans-serif"
          : getComputedStyle(document.body).fontFamily || "sans-serif",
      monoFamily:
        'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      formatDate,
    }),
    [design, facts, art, formatDate],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    let stale = false;
    let made: string | null = null;
    void (async () => {
      try {
        const out = await renderPostcard(model);
        if (stale || out == null) {
          setNote(out == null ? "This browser would not draw the card." : null);
          return;
        }
        made = URL.createObjectURL(out);
        setBlob(out);
        setUrl(made);
      } catch {
        setNote("The card could not be drawn.");
      }
    })();
    return () => {
      stale = true;
      // Revoked on replacement rather than on unmount alone: a shuffle can
      // produce several of these in a second, and each one holds its bitmap.
      if (made != null) {
        URL.revokeObjectURL(made);
      }
    };
  }, [open, model]);

  if (!open) {
    return null;
  }

  const [W, H] = POSTCARD_SIZE;

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
            <FormattedMessage
              id="postcard.title"
              defaultMessage="Save a postcard"
            />
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
          <div className={styles.stage}>
            {url != null ? (
              <img
                className={styles.postcard}
                src={url}
                width={W}
                height={H}
                alt="The postcard, as it will be saved"
              />
            ) : (
              <p className={dialog.empty}>
                <FormattedMessage
                  id="postcard.drawing"
                  defaultMessage="Drawing…"
                />
              </p>
            )}
          </div>

          <div className={dialog.label}>
            <FormattedMessage id="postcard.design" defaultMessage="Design" />
          </div>
          <div className={dialog.chips}>
            {(
              [
                ["ticket", "The record"],
                ["card", "The card"],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                className={clsx(dialog.chip, design === id && dialog.on)}
                onClick={() => setDesign(id)}
              >
                {text}
              </button>
            ))}
            <button
              type="button"
              className={dialog.chip}
              disabled={design !== "card"}
              onClick={() => {
                const kind = facts.kid ? "kid" : "adult";
                const list = artFamilies(kind);
                const seed = newArtSeed();
                setArt({ family: list[seed % list.length].id, seed });
              }}
            >
              <FormattedMessage
                id="postcard.shuffle"
                defaultMessage="⤫ Shuffle the artwork"
              />
            </button>
          </div>
          <p className={dialog.hint}>
            <FormattedMessage
              id="postcard.hint"
              defaultMessage="The record is monospace and plain — the one to keep beside a report. The card carries this learner’s own painting. Both save at {w}×{h}, which prints as an ordinary 6×4 postcard."
              values={{ w: W, h: H }}
            />
          </p>
        </div>

        <div className={dialog.foot}>
          {note != null && <span className={dialog.privacy}>{note}</span>}
          <span className={dialog.spacer} />
          <button
            type="button"
            className={dialog.btn}
            onClick={() => setOpen(false)}
          >
            <FormattedMessage id="postcard.cancel" defaultMessage="Cancel" />
          </button>
          <button
            type="button"
            className={clsx(dialog.btn, dialog.go)}
            disabled={blob == null}
            onClick={() => {
              if (blob != null) {
                downloadBlob(
                  blob,
                  exportFilename(
                    "postcard",
                    facts.name,
                    "png",
                    new Date().toISOString().slice(0, 10),
                  ),
                );
              }
            }}
          >
            <FormattedMessage
              id="postcard.save"
              defaultMessage="↓ Save postcard"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
