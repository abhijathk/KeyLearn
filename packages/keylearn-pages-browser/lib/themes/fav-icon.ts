/**
 * Dresses the browser tab in the learner's own accent.
 *
 * The colours are read back from the document rather than looked up from the
 * accent id, so this follows whatever is actually on screen: the built-in
 * accents, their day and night faces, and a custom theme somebody mixed
 * themselves. One source of truth, and no second table to keep in step.
 *
 * The static `/assets/favicon.svg` link is rewritten rather than a second one
 * added. Two `rel="icon"` links leave the browser to choose, and which one it
 * picks is not something to rely on.
 *
 * Worth knowing if you ever change the icon artwork: replacing the file in
 * `assets/` is NOT enough on its own. The static file is what the tab shows
 * for the first moment, and then this replaces it — so a changed file appears
 * for a second and reverts, which reads exactly like a caching problem and is
 * not one. The drawing below is the one that wins.
 */

// The accent is written into CSS by the theme code, but a custom theme is
// user-supplied, and these values are interpolated into markup. Only shapes
// that are unambiguously colours get through — anything else leaves the tab on
// the static icon rather than putting unknown text inside an SVG.
const COLOR =
  /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9a-z%.,\s/+-]{1,64}\)|[a-z]{3,20})$/i;

/**
 * One keycap from the wordmark, at 24px.
 *
 * The same two-rectangle construction the logo uses: the lower rectangle is
 * the cap's front wall, the upper one its top face, and the lip between them
 * is the whole three-dimensional effect. No gradients and no shadow, because
 * this is drawn at sixteen pixels more often than at any other size.
 *
 * Three colours rather than one. The cap needs a darker tone for its wall or
 * it flattens into a tile, and the letter has to be legible against whatever
 * accent it lands on — which is what `--accent-ink` is for: the themes compute
 * it against a 21% contrast target, so a pale accent gets dark letters and a
 * dark accent gets light ones without this file deciding anything.
 */
function iconSvg(face: string, wall: string, ink: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect x="1.6" y="4.94" width="20.8" height="18.72" rx="3.95" fill="${wall}"/>` +
    `<rect x="1.6" y="2.86" width="20.8" height="17.47" rx="3.56" fill="${face}"/>` +
    `<g fill="${ink}" transform="translate(7.36 16.38)">` +
    `<g transform="scale(0.01348 -0.01348)">` +
    `<path d="M74 0V710H226V400L484 710H661L400 397L677 0H504L300 295L226 209V0Z"/>` +
    `</g></g></svg>`
  );
}

/** A custom property, or null when it is missing or not a colour. */
function readColor(name: string): string | null {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value !== "" && COLOR.test(value) ? value : null;
}

export function applyFavIcon(): void {
  if (typeof document === "undefined") {
    return;
  }
  // The desk's favicon is its own fixed mark in its own fixed amber, not the
  // learner's chosen accent — leave the static `favicon-desk.svg` alone.
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel~="icon"][type="image/svg+xml"]',
  );
  if (link == null) {
    return; // A browser without the SVG icon keeps the PNG fallback.
  }

  const face = readColor("--accent");
  if (face == null) {
    return;
  }
  // The wall and the ink fall back to the accent itself rather than to fixed
  // colours. A theme that somehow defines only `--accent` then gets a flat but
  // correct cap, where a hardcoded green would be a green key in a violet app.
  const wall = readColor("--accent-d2") ?? face;
  const ink = readColor("--accent-ink") ?? face;

  const href = `data:image/svg+xml,${encodeURIComponent(iconSvg(face, wall, ink))}`;
  // Assigning an identical href would make some browsers re-fetch and flicker.
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href);
  }
}
