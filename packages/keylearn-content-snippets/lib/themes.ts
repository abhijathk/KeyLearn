/**
 * Editor colour schemes for code practice.
 *
 * Each scheme is a pair, because almost every well-known theme ships one: a
 * palette is defined relative to its background, so Dracula's near-white
 * foreground is legible on Dracula's charcoal and invisible on paper. Carrying
 * both halves means a scheme stays readable whichever mode the app is in.
 *
 * Which half is used depends on whether the editor background is switched on.
 * With it on, the scheme brings its own ground and is shown as its authors drew
 * it. With it off — the default, because a coloured panel is a big change to a
 * page — the code sits on the app's own background and the half matching the
 * app's light or dark mode is chosen automatically.
 *
 * That choice is made in CSS rather than here. The app's mode lives in
 * `html[data-color]` and, for "auto", in a `prefers-color-scheme` query; there
 * is no JavaScript signal for it, and rebuilding that logic in TypeScript would
 * drift from the stylesheet the day either changed. So both halves are emitted
 * as custom properties and the stylesheet picks.
 */
export type Palette = {
  readonly background: string;
  readonly foreground: string;
  readonly keyword: string;
  readonly string: string;
  readonly number: string;
  readonly comment: string;
};

export type CodeTheme = {
  readonly id: string;
  readonly name: string;
  readonly dark: Palette;
  readonly light: Palette;
};

const p = (
  background: string,
  foreground: string,
  keyword: string,
  string_: string,
  number_: string,
  comment: string,
): Palette => ({
  background,
  foreground,
  keyword,
  string: string_,
  number: number_,
  comment,
});

export const CODE_THEMES: readonly CodeTheme[] = [
  /*
   * KeyLearn's own, built on Dark+'s arrangement — blue keywords, warm
   * strings, green comments — because that is what most people already read
   * code in, and a scheme that reassigns those meanings fights the reader.
   *
   * Bright is the default, and the reason is particular to this app. In an
   * editor comments recede, because you skim them. Here you type every
   * character of them, so they are held at full contrast like the rest: what
   * is being read letter by letter cannot also be faded out.
   */
  {
    id: "keylearn-bright",
    name: "KeyLearn Bright",
    dark: p("#1f2433", "#e6eaf1", "#7cc4ff", "#ffb27a", "#a5e8c4", "#9aa6ae"),
    light: p("#f5f6fa", "#161a24", "#0b5fa4", "#9a4416", "#1c7a52", "#5b666e"),
  },
  {
    id: "keylearn-verdant",
    name: "KeyLearn Verdant",
    dark: p("#1f2433", "#d9dee6", "#3fbf8e", "#e0b07a", "#9db8ff", "#6f7d84"),
    light: p("#f5f6fa", "#1f2433", "#1e7355", "#96552b", "#3a5bb8", "#6b777d"),
  },
  {
    id: "vscode",
    name: "VS Code",
    dark: p("#1e1e1e", "#d4d4d4", "#569cd6", "#ce9178", "#b5cea8", "#6a9955"),
    light: p("#ffffff", "#000000", "#0000ff", "#a31515", "#098658", "#008000"),
  },
  {
    id: "one",
    name: "One",
    dark: p("#282c34", "#abb2bf", "#c678dd", "#98c379", "#d19a66", "#5c6370"),
    light: p("#fafafa", "#383a42", "#a626a4", "#50a14f", "#986801", "#a0a1a7"),
  },
  {
    id: "dracula",
    name: "Dracula",
    dark: p("#282a36", "#f8f8f2", "#ff79c6", "#f1fa8c", "#bd93f9", "#6272a4"),
    light: p("#fffbeb", "#1f1f1f", "#a3144d", "#846e15", "#644ac9", "#6c664b"),
  },
  {
    id: "monokai",
    name: "Monokai",
    dark: p("#272822", "#f8f8f2", "#f92672", "#e6db74", "#ae81ff", "#75715e"),
    light: p("#fafafa", "#2c2c2c", "#d4133f", "#8a6a0a", "#7c4dff", "#9e9e9e"),
  },
  {
    id: "nord",
    name: "Nord",
    dark: p("#2e3440", "#d8dee9", "#81a1c1", "#a3be8c", "#b48ead", "#616e88"),
    light: p("#eceff4", "#2e3440", "#5e81ac", "#4c7a4c", "#9d5d90", "#7b88a1"),
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    dark: p("#1a1b26", "#a9b1d6", "#bb9af7", "#9ece6a", "#ff9e64", "#565f89"),
    light: p("#e1e2e7", "#3760bf", "#9854f1", "#587539", "#b15c00", "#848cb5"),
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    dark: p("#1e1e2e", "#cdd6f4", "#cba6f7", "#a6e3a1", "#fab387", "#6c7086"),
    light: p("#eff1f5", "#4c4f69", "#8839ef", "#40a02b", "#fe640b", "#9ca0b0"),
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    dark: p("#282828", "#ebdbb2", "#fb4934", "#b8bb26", "#d3869b", "#928374"),
    light: p("#fbf1c7", "#3c3836", "#9d0006", "#79740e", "#8f3f71", "#928374"),
  },
  {
    id: "solarized",
    name: "Solarized",
    dark: p("#002b36", "#93a1a1", "#859900", "#2aa198", "#d33682", "#586e75"),
    light: p("#fdf6e3", "#657b83", "#859900", "#2aa198", "#d33682", "#93a1a1"),
  },
  {
    id: "night-owl",
    name: "Night Owl",
    dark: p("#011627", "#d6deeb", "#c792ea", "#ecc48d", "#f78c6c", "#637777"),
    light: p("#fbfbfb", "#403f53", "#994cc3", "#c96765", "#aa0982", "#989fb1"),
  },
  {
    id: "github",
    name: "GitHub",
    dark: p("#0d1117", "#c9d1d9", "#ff7b72", "#a5d6ff", "#79c0ff", "#8b949e"),
    light: p("#ffffff", "#24292f", "#cf222e", "#0a3069", "#0550ae", "#6e7781"),
  },
  {
    id: "material",
    name: "Material",
    dark: p("#292d3e", "#a6accd", "#c792ea", "#c3e88d", "#f78c6c", "#676e95"),
    light: p("#fafafa", "#546e7a", "#7c4dff", "#91b859", "#f76d47", "#b0bec5"),
  },
  {
    id: "ayu",
    name: "Ayu",
    dark: p("#0b0e14", "#bfbdb6", "#ff8f40", "#aad94c", "#d2a6ff", "#acb6bf"),
    light: p("#fafafa", "#5c6166", "#fa8d3e", "#86b300", "#a37acc", "#abb0b6"),
  },
];

/**
 * Null for an id we no longer ship — an old setting naming a removed scheme,
 * for instance. The caller then sets no colours and the app's own are used,
 * which is a working lesson rather than an error.
 */
export function codeThemeFor(id: string): CodeTheme | null {
  return CODE_THEMES.find((theme) => theme.id === id) ?? null;
}

/**
 * Both halves of a scheme as custom properties.
 *
 * Emitting both and letting the stylesheet choose is what keeps the automatic
 * light/dark switch honest: the app's mode is a CSS fact, so the decision is
 * made where that fact lives.
 */
export function codeThemeVars(theme: CodeTheme): Record<string, string> {
  return {
    "--code-dark-background": theme.dark.background,
    "--code-dark-foreground": theme.dark.foreground,
    "--code-dark-keyword": theme.dark.keyword,
    "--code-dark-string": theme.dark.string,
    "--code-dark-number": theme.dark.number,
    "--code-dark-comment": theme.dark.comment,
    "--code-light-background": theme.light.background,
    "--code-light-foreground": theme.light.foreground,
    "--code-light-keyword": theme.light.keyword,
    "--code-light-string": theme.light.string,
    "--code-light-number": theme.light.number,
    "--code-light-comment": theme.light.comment,
  };
}
