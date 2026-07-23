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

export const ADULT_AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: "a-punch", bg: "#e9cece", fg: "#6f3e3e" },
  { id: "a-peach", bg: "#e9d6ce", fg: "#6f4d3e" },
  { id: "a-tangerine", bg: "#e9dece", fg: "#6f5c3e" },
  { id: "a-amber", bg: "#e9e6ce", fg: "#6f6a3e" },
  { id: "a-lemon", bg: "#e3e9ce", fg: "#656f3e" },
  { id: "a-lime", bg: "#dbe9ce", fg: "#576f3e" },
  { id: "a-meadow", bg: "#d3e9ce", fg: "#486f3e" },
  { id: "a-mint", bg: "#cee9d0", fg: "#3e6f43" },
  { id: "a-seafoam", bg: "#cee9d9", fg: "#3e6f52" },
  { id: "a-lagoon", bg: "#cee9e1", fg: "#3e6f60" },
  { id: "a-sky", bg: "#cee9e9", fg: "#3e6f6f" },
  { id: "a-cornflower", bg: "#cee1e9", fg: "#3e606f" },
  { id: "a-blueberry", bg: "#ced9e9", fg: "#3e526f" },
  { id: "a-periwinkle", bg: "#ced0e9", fg: "#3e436f" },
  { id: "a-iris", bg: "#d3cee9", fg: "#483e6f" },
  { id: "a-lavender", bg: "#dbcee9", fg: "#573e6f" },
  { id: "a-orchid", bg: "#e3cee9", fg: "#653e6f" },
  { id: "a-bubblegum", bg: "#e9cee6", fg: "#6f3e6a" },
  { id: "a-flamingo", bg: "#e9cede", fg: "#6f3e5c" },
  { id: "a-blush", bg: "#e9ced6", fg: "#6f3e4d" },
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
