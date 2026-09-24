import { usePageData } from "@keylearn/pages-shared";
import { type CSSProperties } from "react";

/**
 * The reply accent (control centre, Settings → Replies): the colour a
 * customer's reply chrome — route chips, keycaps, the step numbers — is
 * drawn in. Ten fixed ids, each already checked at ≥4.5:1 contrast in both
 * of the app's own themes (owner, 24 Sep 2026); the warning amber and the
 * emergency red never follow it.
 *
 * This file is the whole of the client-side interface: `useReplyAccent()`
 * for the id in force, `REPLY_ACCENTS` for its colours. ReplyBody itself is
 * a separate agent's file to rewrite, so nothing here reaches into it.
 */
export const REPLY_ACCENT_IDS = [
  "mint",
  "blue",
  "ember",
  "violet",
  "pink",
  "teal",
  "indigo",
  "lime",
  "sky",
  "graphite",
] as const;

export type ReplyAccentId = (typeof REPLY_ACCENT_IDS)[number];

const DEFAULT_REPLY_ACCENT: ReplyAccentId = "mint";

/**
 * Each id's colour in the two themes. Not derived — hand-picked by the
 * owner for contrast, so the pair is a literal table rather than a
 * generated one.
 */
export const REPLY_ACCENTS: Readonly<
  Record<ReplyAccentId, { readonly dark: string; readonly light: string }>
> = {
  mint: { dark: "#4fd1a1", light: "#0b7a55" },
  blue: { dark: "#6ea8fe", light: "#2158d6" },
  ember: { dark: "#ff8a57", light: "#b8420f" },
  violet: { dark: "#a78bfa", light: "#6d3fd8" },
  pink: { dark: "#f472b6", light: "#b8266f" },
  teal: { dark: "#2dd4d4", light: "#0b7285" },
  indigo: { dark: "#8b93ff", light: "#4048c9" },
  lime: { dark: "#a3d94a", light: "#4d7a0c" },
  sky: { dark: "#5ec8f2", light: "#0a6b94" },
  graphite: { dark: "#c3c9d6", light: "#4a5263" },
};

export function isReplyAccentId(value: unknown): value is ReplyAccentId {
  return (
    typeof value === "string" &&
    (REPLY_ACCENT_IDS as readonly string[]).includes(value)
  );
}

/**
 * The control centre's reply accent, from page data (`PageData.replyAccent`,
 * set from the `support.replyAccent` site setting). Falls back to the
 * shipped default for an older page render or an unrecognised id, so a
 * reply is never left with no accent at all.
 */
export function useReplyAccent(): ReplyAccentId {
  const value = usePageData().replyAccent;
  return isReplyAccentId(value) ? value : DEFAULT_REPLY_ACCENT;
}

/**
 * `--reply-accent-dark` / `--reply-accent-light` for an id, as inline
 * style props — for whichever element ends up being the accent's root.
 * Convenience only: the same two values are in `REPLY_ACCENTS[id]`.
 */
export function replyAccentStyle(id: ReplyAccentId): CSSProperties {
  const { dark, light } = REPLY_ACCENTS[id];
  return {
    "--reply-accent-dark": dark,
    "--reply-accent-light": light,
  } as CSSProperties;
}
