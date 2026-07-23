// A small set of friendly avatar presets (an emoji-free colour + glyph),
// plus the photo-upload helper. No external assets.

export type AvatarPreset = {
  readonly id: string;
  readonly bg: string;
  readonly fg: string;
};

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: "leaf", bg: "#58b947", fg: "#ffffff" },
  { id: "sky", bg: "#3aa0ff", fg: "#ffffff" },
  { id: "sun", bg: "#ffcf3f", fg: "#5c4500" },
  { id: "coral", bg: "#ff7d68", fg: "#ffffff" },
  { id: "grape", bg: "#a06cff", fg: "#ffffff" },
  { id: "teal", bg: "#3ac9a7", fg: "#053b30" },
  { id: "rose", bg: "#f5a8b8", fg: "#5c1526" },
  { id: "slate", bg: "#7c8aa5", fg: "#ffffff" },
];

export function presetById(id: string): AvatarPreset {
  return AVATAR_PRESETS.find((p) => p.id === id) ?? AVATAR_PRESETS[0];
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
