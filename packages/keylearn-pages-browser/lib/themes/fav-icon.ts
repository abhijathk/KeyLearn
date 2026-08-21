/**
 * Dresses the browser tab in the learner's own accent.
 *
 * The colour is read back from `--accent` on the document rather than looked up
 * from the accent id, so this follows whatever is actually on screen: the
 * built-in accents, their day and night faces, and a custom theme somebody
 * mixed themselves. One source of truth, and no second table to keep in step.
 *
 * The static `/assets/favicon.svg` link is rewritten rather than a second one
 * added. Two `rel="icon"` links leave the browser to choose, and which one it
 * picks is not something to rely on.
 */

// The accent is written into CSS by the theme code, but a custom theme is
// user-supplied, and this value is interpolated into markup. Only shapes that
// are unambiguously colours get through — anything else leaves the tab on the
// static icon rather than putting unknown text inside an SVG.
const COLOR =
  /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9a-z%.,\s/+-]{1,64}\)|[a-z]{3,20})$/i;

function iconSvg(color: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<g fill="none" stroke="${color}" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round">` +
    `<rect x="2" y="5" width="20" height="14" rx="3"/>` +
    `<path d="M7 10h0M12 10h0M17 10h0M7.5 14.5h9"/>` +
    `</g></svg>`
  );
}

export function applyFavIcon(): void {
  if (typeof document === "undefined") {
    return;
  }
  // The desk's favicon is its own fixed headset mark in its own fixed
  // amber, not the learner's chosen accent — leave the static SVG
  // `favicon-desk.svg` (already the right colour) alone.
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel~="icon"][type="image/svg+xml"]',
  );
  if (link == null) {
    return; // A browser without the SVG icon keeps the PNG fallback.
  }
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent")
    .trim();
  if (color === "" || !COLOR.test(color)) {
    return;
  }
  const href = `data:image/svg+xml,${encodeURIComponent(iconSvg(color))}`;
  // Assigning an identical href would make some browsers re-fetch and flicker.
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href);
  }
}
