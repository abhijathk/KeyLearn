/**
 * Dates that follow the reader.
 *
 * A date inserted into a reply is written as a marker carrying the
 * instant — `{{t:2026-08-21T00:39:00Z}}` for a moment, `{{d:2026-08-21}}`
 * for a day — and resolved wherever it is displayed. Plain words could
 * not do that: they would say one time forever, and the one time they
 * said would be whatever the staff member's clock read.
 *
 * The cost is that every surface has to resolve them, and a surface that
 * forgets shows a customer a line of punctuation. There are three: the
 * desk's thread, this chat, and email — and email has no renderer at all,
 * so the server substitutes before sending.
 *
 * Duplicated from the desk's own copy rather than shared, for the same
 * reason the support emoji art is: this repository is AGPL and that one
 * is not, so the two cannot import from each other. Kept deliberately
 * small so the duplication stays cheap to keep in step.
 */

/**
 * `t` carries a time, `d` a whole day. Deliberately narrow: only the two
 * shapes {@link dateMarker} writes, so a stray "{{" in somebody's message
 * is left exactly as they typed it.
 */
export const DATE_MARK =
  /\{\{(t|d):(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}Z)?)\}\}/g;

export type DateMarkOptions = {
  /**
   * The reader's zone. Undefined follows the device, which is right for a
   * browser; the server passes one explicitly, or UTC when the account
   * has none set.
   */
  readonly timeZone?: string;
  readonly locale?: string;
};

/** One marker's worth of text, in the reader's own terms. */
export function formatDateMark(
  kind: "t" | "d",
  value: string,
  { timeZone, locale }: DateMarkOptions = {},
): string {
  const at = new Date(kind === "d" ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(at.getTime())) {
    // Unparseable is not this function's problem to hide: give back the
    // marker so somebody can see what went wrong, rather than a silent
    // "Invalid Date" in front of a customer.
    return `{{${kind}:${value}}}`;
  }
  if (kind === "d") {
    // A whole day is read in UTC whatever the reader's zone: shifting it
    // could name a different date, and "the 21st" was the point.
    return at.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return at.toLocaleString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });
}

/** Every marker in `text`, resolved. For email and anywhere plain. */
export function resolveDateMarks(
  text: string,
  options: DateMarkOptions = {},
): string {
  DATE_MARK.lastIndex = 0;
  return text.replace(DATE_MARK, (_all, kind: "t" | "d", value: string) =>
    formatDateMark(kind, value, options),
  );
}

/** Whether there is anything here to resolve. */
export function hasDateMark(text: string): boolean {
  DATE_MARK.lastIndex = 0;
  const found = DATE_MARK.test(text);
  DATE_MARK.lastIndex = 0;
  return found;
}

/**
 * The text split into plain parts and resolved dates, for a renderer that
 * wants to mark them up rather than flatten them to a string.
 */
export function splitDateMarks(
  text: string,
  options: DateMarkOptions = {},
): Array<{
  readonly text: string;
  readonly isDate: boolean;
  /** The marker this part was built from — what has to be sent back. */
  readonly marker?: string;
}> {
  DATE_MARK.lastIndex = 0;
  const out: Array<{ text: string; isDate: boolean; marker?: string }> = [];
  let last = 0;
  for (const match of text.matchAll(DATE_MARK)) {
    const at = match.index;
    if (at > last) {
      out.push({ text: text.slice(last, at), isDate: false });
    }
    out.push({
      text: formatDateMark(match[1] as "t" | "d", match[2]!, options),
      isDate: true,
      marker: match[0],
    });
    last = at + match[0].length;
  }
  if (last < text.length) {
    out.push({ text: text.slice(last), isDate: false });
  }
  return out;
}
