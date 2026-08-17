import { findAccent } from "./accents.ts";
import { COLORS, FONTS } from "./themes.ts";

export class ThemePrefs {
  static colorAttrName = "data-color";
  static fontAttrName = "data-font";
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

  static dataAttributes({ color, font, accent }: ThemePrefs) {
    return {
      [ThemePrefs.colorAttrName]: COLORS.find(color).id,
      [ThemePrefs.fontAttrName]: FONTS.find(font).id,
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
  readonly accent: string;

  constructor(o: unknown) {
    const { color, font, accent } = Object(o);
    this.color = COLORS.find(String(color)).id;
    this.font = FONTS.find(String(font)).id;
    // Cookies written before accents shipped simply have no `accent`, and
    // findAccent falls back to the signature mint — which is what those
    // visitors were already seeing.
    this.accent = findAccent(String(accent)).id;
  }
}
