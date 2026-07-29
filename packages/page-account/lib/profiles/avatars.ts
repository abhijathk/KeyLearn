// Pastel avatar presets (an emoji-free colour + glyph) plus the photo-upload
// helper. Kids pick from punchier pastels, grown-ups from paler ones; the
// letter ink is a darker shade of the same hue. No external assets.

export type AvatarPreset = {
  readonly id: string;
  readonly bg: string;
  readonly fg: string;
};

export const KID_AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: "k-punch", bg: "#e48b8b", fg: "#6a2f2f" },
  { id: "k-peach", bg: "#e4a68b", fg: "#6a412f" },
  { id: "k-tangerine", bg: "#e4c08b", fg: "#6a522f" },
  { id: "k-amber", bg: "#e4db8b", fg: "#6a642f" },
  { id: "k-lemon", bg: "#d2e48b", fg: "#5e6a2f" },
  { id: "k-lime", bg: "#b8e48b", fg: "#4d6a2f" },
  { id: "k-meadow", bg: "#9de48b", fg: "#3b6a2f" },
  { id: "k-mint", bg: "#8be494", fg: "#2f6a35" },
  { id: "k-seafoam", bg: "#8be4af", fg: "#2f6a47" },
  { id: "k-lagoon", bg: "#8be4c9", fg: "#2f6a58" },
  { id: "k-sky", bg: "#8be4e4", fg: "#2f6a6a" },
  { id: "k-cornflower", bg: "#8bc9e4", fg: "#2f586a" },
  { id: "k-blueberry", bg: "#8bafe4", fg: "#2f476a" },
  { id: "k-periwinkle", bg: "#8b94e4", fg: "#2f356a" },
  { id: "k-iris", bg: "#9d8be4", fg: "#3b2f6a" },
  { id: "k-lavender", bg: "#b88be4", fg: "#4c2f6a" },
  { id: "k-orchid", bg: "#d28be4", fg: "#5e2f6a" },
  { id: "k-bubblegum", bg: "#e48bdb", fg: "#6a2f64" },
  { id: "k-flamingo", bg: "#e48bc0", fg: "#6a2f52" },
  { id: "k-blush", bg: "#e48ba6", fg: "#6a2f41" },
];

// Earthy, pastel-light grown-up palette — warmer than the old washed-out set.
export const ADULT_AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: "a-punch", bg: "#e0a48f", fg: "#7a4433" },
  { id: "a-peach", bg: "#d9b391", fg: "#74513a" },
  { id: "a-tangerine", bg: "#e2d1a8", fg: "#6f5f38" },
  { id: "a-amber", bg: "#d9cf9e", fg: "#6a613a" },
  { id: "a-lemon", bg: "#c3c893", fg: "#5c6136" },
  { id: "a-lime", bg: "#b6c49e", fg: "#4f5e3c" },
  { id: "a-meadow", bg: "#a7bd9a", fg: "#43573b" },
  { id: "a-mint", bg: "#9fc0a8", fg: "#3d5942" },
  { id: "a-seafoam", bg: "#a3c3b6", fg: "#3d5e51" },
  { id: "a-lagoon", bg: "#a2c0c0", fg: "#3b5c5c" },
  { id: "a-sky", bg: "#a6bcd0", fg: "#3d5468" },
  { id: "a-cornflower", bg: "#adb8d0", fg: "#444f68" },
  { id: "a-blueberry", bg: "#b7b3d4", fg: "#4a4568" },
  { id: "a-periwinkle", bg: "#c6b0d0", fg: "#573f66" },
  { id: "a-iris", bg: "#d6aec0", fg: "#663f52" },
  { id: "a-lavender", bg: "#d3a5a5", fg: "#663a3a" },
  { id: "a-orchid", bg: "#cdbcaa", fg: "#5f5040" },
  { id: "a-bubblegum", bg: "#c3bcb3", fg: "#55504a" },
  { id: "a-flamingo", bg: "#dcc79a", fg: "#6f5f38" },
  { id: "a-blush", bg: "#cbb59e", fg: "#5e4b3a" },
];

export function presetsFor(kind: "kid" | "adult"): readonly AvatarPreset[] {
  return kind === "kid" ? KID_AVATAR_PRESETS : ADULT_AVATAR_PRESETS;
}

// Profiles saved before the pastel palettes used these ids.
const LEGACY_IDS: Readonly<Record<string, string>> = {
  leaf: "k-meadow",
  sky: "k-cornflower",
  sun: "k-amber",
  coral: "k-peach",
  grape: "k-lavender",
  teal: "k-lagoon",
  rose: "k-blush",
  slate: "a-blueberry",
};

export function presetById(id: string): AvatarPreset {
  const mapped = LEGACY_IDS[id] ?? id;
  return (
    KID_AVATAR_PRESETS.find((p) => p.id === mapped) ??
    ADULT_AVATAR_PRESETS.find((p) => p.id === mapped) ??
    KID_AVATAR_PRESETS[0]
  );
}

/**
 * Reads an image File, crops it to a centered square, resizes to 128px and
 * returns a JPEG data URL — small, self-contained, and never uploaded.
 */
export function photoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (ctx == null) {
        reject(new Error("Canvas not available"));
        return;
      }
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}
