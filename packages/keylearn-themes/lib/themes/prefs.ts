import { findAccent } from "./accents.ts";
import { COLORS, FONTS, TEXT_SIZES } from "./themes.ts";

export class ThemePrefs {
  static colorAttrName = "data-color";
  static fontAttrName = "data-font";
  static textSizeAttrName = "data-text-size";
  static accentAttrName = "data-accent";
  static cookieKey = "prefs";
  /** The desk's own theme cookie — see {@link cookieKeyFor}. */
  static deskCookieKey = "desk_prefs";

  /**
   * The desk and the learner-facing app are treated as two separate
   * apps that happen to share a domain — switching Day/Night on one
   * must not repaint the other. A distinct cookie per side (rather than
   * relying on the cookie's Path attribute, whose browser-default value
   * depends on exactly which URL it was set from) makes that true
   * regardless of which desk page the switch was clicked from.
   */
  static cookieKeyFor(pathname: string): string {
    return pathname.startsWith("/desk")
      ? ThemePrefs.deskCookieKey
      : ThemePrefs.cookieKey;
  }

  static dataAttributes({ color, font, textSize, accent }: ThemePrefs) {
    return {
      [ThemePrefs.colorAttrName]: COLORS.find(color).id,
      [ThemePrefs.fontAttrName]: FONTS.find(font).id,
      // Server-rendered like the rest, so the first paint is already at the
      // chosen size. Without it every page would lay out at medium and then
      // jump the moment the client took over.
      [ThemePrefs.textSizeAttrName]: TEXT_SIZES.find(textSize).id,
      // Mirrored into the server-rendered markup so the first paint already
      // carries the right accent — otherwise every page load flashes mint.
      [ThemePrefs.accentAttrName]: findAccent(accent).id,
    };
  }

  static serialize(prefs: ThemePrefs): string {
    return JSON.stringify(prefs);
  }

  static deserialize(value: unknown): ThemePrefs {
    let o = null;
    if (typeof value === "string") {
      try {
        o = JSON.parse(value);
      } catch {
        // Ignore.
      }
    }
    return new ThemePrefs(o);
  }

  readonly color: string;
  readonly font: string;
  readonly textSize: string;
  readonly accent: string;

  constructor(o: unknown) {
    const { color, font, textSize, accent } = Object(o);
    this.color = COLORS.find(String(color)).id;
    this.font = FONTS.find(String(font)).id;
    // A cookie written before this shipped has no `textSize`, and find()
    // falls back to the list's first entry — medium, which is the size those
    // visitors are already reading.
    this.textSize = TEXT_SIZES.find(String(textSize)).id;
    // Cookies written before accents shipped simply have no `accent`, and
    // findAccent falls back to the signature mint — which is what those
    // visitors were already seeing.
    this.accent = findAccent(String(accent)).id;
  }
}
