import { Enum, type EnumItem } from "@keylearn/lang";
import {
  booleanProp,
  enumProp,
  itemProp,
  numberProp,
  type Settings,
  xitemProp,
} from "@keylearn/settings";
import { Geometry, ZoneMod } from "./geometry.ts";
import { Language } from "./language.ts";
import { Layout } from "./layout.ts";
import { nullMod } from "./mod.ts";

export enum Emulation {
  /**
   * No emulation.
   */
  None = 0,
  /**
   * Assumes that the physical key locations are correct,
   * fixes the character codes.
   */
  Forward = 1,
  /**
   * Assumes that the character codes are correct,
   * fixes the physical key locations.
   * It reverses the effect of layout emulation in hardware.
   */
  Reverse = 2,
}

/**
 * How the on-screen keyboard is drawn. Key positions, sizes and labels are
 * identical across all of them — only the finish changes.
 *
 * Silver and Midnight Grey used to be one "Flat" entry whose face was chosen
 * from the active theme, on the reasoning that nobody would want a white board
 * on a night page. They are two entries now, because that reasoning decided
 * something that was not ours to decide: a learner who wants the dark board on
 * a light page, or the pale one at night, could not have it.
 */
export class KeyboardStyle implements EnumItem {
  /** The board KeyLearn has always drawn. Stays the default. */
  static readonly KEYLEARN = new KeyboardStyle("keylearn", "KeyLearn");
  /** Low-profile caps, almost no wall, a plain warm backlight — pale. */
  static readonly FLAT_SILVER = new KeyboardStyle("flatsilver", "Flat Silver");
  /**
   * The same board in midnight grey. It keeps the bare id `flat`: it was the
   * only flat board until Silver was split out of it, that id is in every
   * stored setting, and midnight is the face those learners were looking at
   * on the dark themes this app ships as its default.
   */
  static readonly FLAT_MIDNIGHT = new KeyboardStyle("flat", "Flat Midnight");
  /** Tall sculpted caps, two-tone keyset, per-key RGB. */
  static readonly MECHANICAL = new KeyboardStyle("mechanical", "Mechanical");
  /** Round caps on the page, six colourways, one warm light. */
  static readonly ROUND = new KeyboardStyle("round", "Round");

  static readonly ALL = new Enum<KeyboardStyle>(
    KeyboardStyle.KEYLEARN,
    KeyboardStyle.FLAT_SILVER,
    KeyboardStyle.FLAT_MIDNIGHT,
    KeyboardStyle.MECHANICAL,
    KeyboardStyle.ROUND,
  );

  private constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  /** Whether this style has a backlight to configure at all. */
  get lightable(): boolean {
    return this !== KeyboardStyle.KEYLEARN;
  }

  /** Whether this style is sold in more than one colour. */
  get colourable(): boolean {
    return this === KeyboardStyle.ROUND;
  }

  /**
   * Whether this is one of the two low-profile boards. Both wear the same
   * geometry and the same plain warm backlight, so every caller that asked
   * "is this the flat board?" asks it here rather than comparing against two
   * constants and eventually forgetting one.
   */
  get lowProfile(): boolean {
    return (
      this === KeyboardStyle.FLAT_SILVER || this === KeyboardStyle.FLAT_MIDNIGHT
    );
  }

  toString(): string {
    return this.id;
  }

  toJSON(): string {
    return this.id;
  }
}

/**
 * The colourways the round board is sold in (mock 11b).
 *
 * Each is ONE face, worn on both themes. The theme changes the light, not the
 * plastic: a keyboard on a desk does not repaint itself when the lamp goes
 * off, and the pale day faces an earlier pass gave these turned Rose into
 * brown and Sand into mud. Only Graphite survived having two faces, so none
 * of them has two now.
 */
export class KeyboardColour implements EnumItem {
  static readonly GRAPHITE = new KeyboardColour("graphite", "Graphite");
  static readonly OFF_WHITE = new KeyboardColour("offwhite", "Off-White");
  static readonly ROSE = new KeyboardColour("rose", "Rose");
  static readonly SAND = new KeyboardColour("sand", "Sand");
  static readonly LAVENDER = new KeyboardColour("lavender", "Lavender");
  static readonly BLUEBERRY = new KeyboardColour("blueberry", "Blueberry");
  /**
   * Graphite caps, with the learner's own accent on the two keys the round
   * board accents (owner, 4 Sep 2026).
   *
   * The other five are a keyset's colours, fixed the way a real one is. This
   * one takes its accent from the theme, so the board matches whatever the
   * learner has chosen everywhere else — the only colourway that changes when
   * they change something.
   */
  static readonly THEME = new KeyboardColour(
    "theme",
    "Graphite + theme colour",
  );

  static readonly ALL = new Enum<KeyboardColour>(
    KeyboardColour.GRAPHITE,
    KeyboardColour.OFF_WHITE,
    KeyboardColour.ROSE,
    KeyboardColour.SAND,
    KeyboardColour.LAVENDER,
    KeyboardColour.BLUEBERRY,
    KeyboardColour.THEME,
  );

  private constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  toString(): string {
    return this.id;
  }

  toJSON(): string {
    return this.id;
  }
}

/**
 * Whether the backlight is on.
 *
 * `Auto` is the default and means "follow the theme" — lit at night, dark by
 * day. It is a distinct value rather than a boolean plus a hidden "has the
 * user touched this" flag, so the stored setting says what it means and a
 * learner who has never opened this screen still gets sensible behaviour when
 * they switch themes.
 */
export enum Backlight {
  Auto = 1,
  On = 2,
  Off = 3,
}

export const keyboardProps = {
  language: itemProp("keyboard.language", Language.ALL, Language.EN),
  style: itemProp("keyboard.style", KeyboardStyle.ALL, KeyboardStyle.KEYLEARN),
  /** Which colourway the round board wears. Ignored by the other styles. */
  colour: itemProp(
    "keyboard.colour",
    KeyboardColour.ALL,
    KeyboardColour.GRAPHITE,
  ),
  backlight: enumProp("keyboard.backlight", Backlight, Backlight.Auto),
  /** Percent. Drives every layer of the glow together. */
  backlightIntensity: numberProp("keyboard.backlightIntensity", 45, {
    min: 0,
    max: 100,
  }),
  layout: xitemProp("keyboard.layout", Layout.ALL, Layout.EN_US),
  geometry: itemProp("keyboard.geometry", Geometry.ALL, Geometry.ANSI_101),
  zones: itemProp("keyboard.zones", ZoneMod.ALL, ZoneMod.STANDARD),
  emulation: enumProp("keyboard.emulation", Emulation, Emulation.Forward),
  colors: booleanProp("keyboard.colors", true),
  pointers: booleanProp("keyboard.pointers", true),
} as const;

export class KeyboardOptions {
  static default(): KeyboardOptions {
    return new KeyboardOptions(
      Language.EN,
      Layout.EN_US,
      Geometry.ANSI_101,
      ZoneMod.STANDARD,
    );
  }

  static from(settings: Settings): KeyboardOptions {
    const language = settings.get(keyboardProps.language);
    const layout = settings.get(keyboardProps.layout);
    const geometry = settings.get(keyboardProps.geometry);
    const zones = settings.get(keyboardProps.zones);
    return KeyboardOptions.default()
      .withLanguage(language)
      .withLayout(layout)
      .withGeometry(geometry)
      .withZones(zones);
  }

  readonly #language: Language;
  readonly #layout: Layout;
  readonly #geometry: Geometry;
  readonly #zones: ZoneMod;

  private constructor(
    language: Language,
    layout: Layout,
    geometry: Geometry,
    zones: ZoneMod,
  ) {
    this.#language = language;
    this.#layout = layout;
    this.#geometry = geometry;
    this.#zones = zones;
  }

  get language(): Language {
    return this.#language;
  }

  get layout(): Layout {
    return this.#layout;
  }

  get geometry(): Geometry {
    return this.#geometry;
  }

  get zones(): ZoneMod {
    return this.#zones;
  }

  selectableLanguages(): Language[] {
    return [...Language.ALL];
  }

  selectableLayouts(): Layout[] {
    return Layout.selectableLayouts(this.#language);
  }

  selectableGeometries(): Geometry[] {
    return [...this.#layout.geometries];
  }

  selectableZones(): ZoneMod[] {
    if (this.#layout.mod !== nullMod) {
      return [];
    }
    return [...this.#geometry.zones];
  }

  withLanguage(language: Language): KeyboardOptions {
    const layout = Layout.selectLayout(language);
    const geometry = Geometry.first(layout.geometries);
    const zones = ZoneMod.first(geometry.zones);
    return new KeyboardOptions(
      language, //
      layout,
      geometry,
      zones,
    );
  }

  withLayout(layout: Layout): KeyboardOptions {
    if (this.#language.script === layout.language.script) {
      const geometry = Geometry.first(layout.geometries);
      const zones = ZoneMod.first(geometry.zones);
      return new KeyboardOptions(
        this.#language, //
        layout,
        geometry,
        zones,
      );
    } else {
      return this;
    }
  }

  withGeometry(geometry: Geometry): KeyboardOptions {
    if (this.#layout.geometries.has(geometry)) {
      const zones = ZoneMod.first(geometry.zones);
      return new KeyboardOptions(
        this.#language, //
        this.#layout,
        geometry,
        zones,
      );
    } else {
      return this;
    }
  }

  withZones(zones: ZoneMod): KeyboardOptions {
    if (this.#layout.mod !== nullMod) {
      return this;
    }
    if (this.#geometry.zones.has(zones)) {
      return new KeyboardOptions(
        this.#language,
        this.#layout,
        this.#geometry,
        zones,
      );
    } else {
      return this;
    }
  }

  save(settings: Settings): Settings {
    return settings
      .set(keyboardProps.language, this.#language)
      .set(keyboardProps.layout, this.#layout)
      .set(keyboardProps.geometry, this.#geometry)
      .set(keyboardProps.zones, this.#zones);
  }
}
