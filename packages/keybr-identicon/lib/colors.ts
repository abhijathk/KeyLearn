// Pastel palettes for the generated account avatars, loosely sampled from
// well-known paintings. Each palette is a soft ground, three wash colours
// for the translucent shapes, and a dark ink for the initials.

export type Palette = {
  readonly ground: string;
  readonly wash: readonly [string, string, string];
  readonly ink: string;
};

export const palettes: readonly Palette[] = [
  // Monet — Water Lilies
  {
    ground: "#dce9e2",
    wash: ["#a9c7b6", "#b7c9e2", "#d9c2d8"],
    ink: "#44605c",
  },
  // Van Gogh — Almond Blossom
  {
    ground: "#d9e7e4",
    wash: ["#a5cec6", "#f0c9d4", "#f6e7d3"],
    ink: "#3f6059",
  },
  // Van Gogh — The Starry Night
  {
    ground: "#d3dcec",
    wash: ["#a3b4d6", "#f2dfae", "#b8c9e6"],
    ink: "#3d4c6e",
  },
  // Van Gogh — Sunflowers
  {
    ground: "#f1e6c8",
    wash: ["#e7cf8f", "#dcc489", "#c9d0a7"],
    ink: "#6d5a2c",
  },
  // Hokusai — The Great Wave
  {
    ground: "#dfe8ee",
    wash: ["#a9c3d9", "#8fadc9", "#ede3cd"],
    ink: "#33506a",
  },
  // Vermeer — Girl with a Pearl Earring
  {
    ground: "#e8e0d2",
    wash: ["#d6c39a", "#a9bccd", "#c8ae91"],
    ink: "#4f4433",
  },
  // Rothko — rose colour fields
  {
    ground: "#f0dcd5",
    wash: ["#e3b8ad", "#edcdb4", "#d9a8a4"],
    ink: "#6e4038",
  },
  // Degas — ballet rehearsal
  {
    ground: "#efe2e8",
    wash: ["#e3c3d3", "#cdb8d9", "#f0d8c9"],
    ink: "#5d4356",
  },
  // Turner — sunset over water
  {
    ground: "#f0e6d8",
    wash: ["#ecd2ac", "#d9b9a4", "#c3c3cd"],
    ink: "#5f4b3a",
  },
  // Matisse — garden greens
  {
    ground: "#dde5da",
    wash: ["#b3cdb8", "#e9d3a9", "#a9bcd3"],
    ink: "#3e5747",
  },
];
