export type Theme = {
  readonly id: string;
  readonly name: string;
};

export class ThemeList implements Iterable<Theme> {
  readonly #themes: readonly Theme[];

  constructor(themes: readonly Theme[]) {
    this.#themes = [...themes];
  }

  [Symbol.iterator](): IterableIterator<Theme> {
    return this.#themes[Symbol.iterator]();
  }

  get default(): Theme {
    return this.#themes[0];
  }

  find(id: string): Theme {
    return this.#themes.find((item) => item.id === id) ?? this.#themes[0];
  }
}

export const COLORS = new ThemeList([
  {
    // First = the default for a fresh visit: follow the device's light/dark
    // setting (see theme-14-auto.less).
    id: "auto",
    name: "Auto",
  },
  {
    id: "keylearn",
    name: "Night",
  },
  {
    id: "keylearn-day",
    name: "Day",
  },
]);

export const FONTS = new ThemeList([
  {
    // First = the default for a fresh visit.
    id: "roboto",
    name: "Roboto",
  },
  {
    id: "open-sans",
    name: "Open Sans",
  },
  {
    id: "rubik",
    name: "Rubik",
  },
  {
    id: "shantell-sans",
    name: "Shantell Sans",
  },
  {
    id: "spectral",
    name: "Spectral",
  },
  {
    id: "nunito",
    name: "Nunito",
  },
  {
    id: "ubuntu",
    name: "Ubuntu",
  },
  {
    id: "cormorant",
    name: "Cormorant",
  },
  {
    id: "inter",
    name: "Inter",
  },
  {
    id: "manrope",
    name: "Manrope",
  },
  {
    id: "lexend",
    name: "Lexend",
  },
  {
    id: "questrial",
    name: "Questrial",
  },
  {
    id: "sora",
    name: "Sora",
  },
  {
    id: "sans-serif",
    name: "sans-serif",
  },
  {
    id: "serif",
    name: "serif",
  },
  {
    id: "monospace",
    name: "monospace",
  },
  {
    id: "cursive",
    name: "cursive",
  },
]);

/**
 * How large the interface is set — the companion to FONTS above.
 *
 * The same scope as the font: every page of the app, and not the passage the
 * learner types, which has its own size control in the practice settings and
 * would otherwise be scaled twice (see TextLines.module.less, which divides
 * this back out).
 *
 * Medium is first, which is what makes it the default for a fresh visit.
 */
export const TEXT_SIZES = new ThemeList([
  {
    id: "medium",
    name: "Medium",
  },
  {
    id: "small",
    name: "Small",
  },
  {
    id: "large",
    name: "Large",
  },
]);
