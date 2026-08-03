/**
 * Saving a file to the browser's download folder, with a name worth keeping.
 *
 * Every export used to arrive as the same fixed name — `typing-data.json` for
 * whichever learner happened to be selected, `keylearn-data.json` for whichever
 * day. Downloading twice gave `typing-data (1).json`, and a folder of those is
 * unreadable: nothing says whose history it is or when it was taken, which is
 * exactly what an export is for.
 */

/**
 * `keylearn-typing-data-ada-02-08-2026-1432.json`
 *
 * The parts in order of how they are searched for: what it is, whose it is,
 * and when it was taken.
 *
 * The stamp comes from the caller rather than being built here, because it has
 * to agree with every other date in the app: same account time zone, same
 * locale order — `02-08-2026` for a reader in Australia and `08-02-2026` for
 * one in the United States. `useIntlDates().formatStamp` produces it.
 *
 * One consequence worth knowing: a locale-ordered name does not sort
 * chronologically in a file listing, where the old ISO form did. That is the
 * trade for a date that reads the way the rest of the app writes it.
 */
export function exportFilename(
  what: string,
  who: string | null | undefined,
  extension: string,
  stamp: string,
): string {
  const parts = ["keylearn", what, slug(who), stamp].filter(
    (part) => part !== "",
  );
  return `${parts.join("-")}.${extension}`;
}

/**
 * A name reduced to what a filename can safely hold.
 *
 * Letters and numbers in any script are kept, so a name written in Chinese or
 * Arabic survives instead of being erased down to nothing. Everything else
 * becomes a dash, and a name that leaves nothing behind is dropped rather than
 * contributing an empty run of them.
 */
function slug(who: string | null | undefined): string {
  if (who == null) {
    return "";
  }
  return (
    who
      .normalize("NFC")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .slice(0, 40)
      // Trimmed after the cut as well as before it: a name whose fortieth
      // character lands on a separator would otherwise leave a dash hanging,
      // and the join below turns that into a double dash.
      .replace(/^-+|-+$/g, "")
  );
}

/** Hand a blob to the browser to save, and let go of the object URL after. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers, so this
  // waits a turn — the URL is still released, just not in the same tick.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
