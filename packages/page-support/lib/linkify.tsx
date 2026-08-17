import { type ReactNode } from "react";

const URL_RE = /https?:\/\/[^\s]+/gi;

/**
 * The bare host a URL resolves to, or the raw text if it doesn't parse as
 * one — a sender can type anything after "https://", and a message that
 * fails to parse is shown as-is rather than dropped.
 */
function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname;
  } catch {
    return raw;
  }
}

/**
 * Renders a message body as plain text with any `https?://` URL replaced by
 * an inert span showing just its host — never a clickable `<a href>`.
 *
 * This is the one place a support message body is allowed to become
 * anything other than a text node: per the mock's §14 rule ("links are
 * shown, never followed"), a URL a stranger typed must never become
 * something a tired staff member can click without a deliberate copy-paste.
 * Every other rendering in this screen must go through this helper — never
 * `dangerouslySetInnerHTML` a message body.
 */
export function linkify(body: string, className?: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of body.matchAll(URL_RE)) {
    const start = match.index;
    const raw = match[0];
    if (start > lastIndex) {
      parts.push(body.slice(lastIndex, start));
    }
    parts.push(
      <span
        key={`link-${key++}`}
        className={className}
        title="Not a link — host shown in full"
      >
        {hostOf(raw)}
      </span>,
    );
    lastIndex = start + raw.length;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }
  return parts;
}
