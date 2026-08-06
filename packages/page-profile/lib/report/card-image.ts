// Drawing the share card at its real size.
//
// The card on screen is HTML, and HTML cannot be handed to a canvas — so this
// draws the same card again with the 2D API. Both are fed from one
// `CardModel`, which is what stops the preview and the file drifting apart:
// neither of them holds any content of its own.
//
// Text is drawn with canvas rather than inside the SVG on purpose. An SVG
// loaded through an <img> gets no access to the document's web fonts, so its
// text silently falls back to a system face — the export would not be in the
// app's typeface at all.

import { motifMarkup } from "@keylearn/identicon";

export type CardShape = "wide" | "square" | "story";

export type CardLook = {
  /** Background gradient, as data rather than a CSS string, so the canvas and
   * the stylesheet cannot disagree about it. */
  readonly angle: number;
  readonly from: string;
  readonly to: string;
  readonly fg: string;
  readonly dim: string;
};

export type CardModel = {
  readonly shape: CardShape;
  readonly look: CardLook;
  /** The colour taken from the artwork's palette. */
  readonly accent: string;
  readonly line1: string;
  readonly line2: string;
  readonly who: string | null;
  readonly stats: readonly { readonly value: string; readonly label: string }[];
  readonly art: { readonly family: string; readonly seed: number } | null;
  readonly artKind: "adult" | "kid";
  /** Palette lift, matching what the preview drew. */
  readonly artVivid: number;
  readonly artOpacity: number;
  /** Smoothed speeds for the optional progress line, or null. */
  readonly spark: readonly number[] | null;
  /** Resolved from the live card, so the file uses the app's own typeface. */
  readonly fontFamily: string;
};

export const CARD_SIZES: Readonly<
  Record<CardShape, readonly [number, number]>
> = {
  wide: [1200, 630],
  square: [1080, 1080],
  story: [1080, 1920],
};

/** The keyboard glyph from the wordmark, at a 24×16 viewBox. */
export const GLYPH =
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"` +
  ` viewBox="0 0 24 16" fill="none" stroke="COLOUR" stroke-width="1.6"` +
  ` stroke-linecap="round">` +
  `<rect x="1" y="1" width="22" height="14" rx="3"/>` +
  `<path d="M6 6h0M10.5 6h0M15 6h0M19 6h0M7.5 10.5h9"/>` +
  `</svg>`;

export function loadSvg(markup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(
      new Blob([markup], { type: "image/svg+xml" }),
    );
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("motif did not rasterise"));
    };
    img.src = url;
  });
}

/**
 * The card as a PNG at its published size.
 *
 * Returns null when the browser will not give us a canvas or a blob, so the
 * caller can say so rather than handing back an empty file.
 */
export async function renderCard(model: CardModel): Promise<Blob | null> {
  const [W, H] = CARD_SIZES[model.shape];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx == null) {
    return null;
  }

  // Ground.
  const rad = ((model.look.angle - 90) * Math.PI) / 180;
  const len = Math.abs(W * Math.cos(rad)) + Math.abs(H * Math.sin(rad));
  const g = ctx.createLinearGradient(
    W / 2 - (Math.cos(rad) * len) / 2,
    H / 2 - (Math.sin(rad) * len) / 2,
    W / 2 + (Math.cos(rad) * len) / 2,
    H / 2 + (Math.sin(rad) * len) / 2,
  );
  g.addColorStop(0, model.look.from);
  g.addColorStop(0.62, model.look.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (model.art != null) {
    await drawMotif(ctx, model, W, H);
  }

  const tall = model.shape !== "wide";
  const pad = Math.round(W * (tall ? 0.075 : 0.047));
  const column = tall ? W - pad * 2 : W * 0.58;
  const F = model.fontFamily;

  // Wordmark.
  const glyphH = Math.round(W * (tall ? 0.028 : 0.0225));
  const glyph = await loadSvg(GLYPH.replace("COLOUR", model.accent));
  ctx.drawImage(glyph, pad, pad, glyphH * 1.5, glyphH);
  const markSize = Math.round(W * (tall ? 0.032 : 0.0245));
  let x = pad + glyphH * 1.5 + markSize * 0.42;
  ctx.textBaseline = "middle";
  ctx.font = `700 ${markSize}px ${F}`;
  ctx.fillStyle = model.look.fg;
  ctx.fillText("Key", x, pad + glyphH / 2);
  x += ctx.measureText("Key").width;
  ctx.font = `200 ${markSize}px ${F}`;
  ctx.fillStyle = model.look.dim;
  ctx.fillText("Learn", x, pad + glyphH / 2);
  if (model.who != null) {
    x += ctx.measureText("Learn").width + markSize * 0.5;
    ctx.font = `400 ${markSize * 0.92}px ${F}`;
    ctx.fillText(`· ${model.who}`, x, pad + glyphH / 2);
  }

  // Headline, wrapped inside the text column.
  const big = Math.round(W * (tall ? 0.075 : 0.0667));
  ctx.font = `760 ${big}px ${F}`;
  ctx.textBaseline = "alphabetic";
  const lines: { text: string; colour: string }[] = [
    ...wrap(ctx, model.line1, column).map((text) => ({
      text,
      colour: model.look.fg,
    })),
    ...(model.line2 === ""
      ? []
      : wrap(ctx, model.line2, column).map((text) => ({
          text,
          colour: model.accent,
        }))),
  ];
  const lead = big * 1.14;
  let y = tall ? H * 0.42 : pad + glyphH + big * 1.5 + lead;
  for (const line of lines) {
    ctx.fillStyle = line.colour;
    ctx.fillText(line.text, pad, y);
    y += lead;
  }

  // Figures, along the foot.
  const num = Math.round(W * (tall ? 0.038 : 0.0308));
  const lab = Math.round(num * 0.72);
  let fx = pad;
  const fy = H - pad - (model.spark != null ? num * 2.2 : num * 0.3);
  for (const stat of model.stats) {
    ctx.font = `740 ${num}px ${F}`;
    ctx.fillStyle = model.look.fg;
    ctx.fillText(stat.value, fx, fy);
    fx += ctx.measureText(stat.value).width + num * 0.22;
    ctx.font = `400 ${lab}px ${F}`;
    ctx.fillStyle = model.look.dim;
    ctx.fillText(stat.label, fx, fy);
    fx += ctx.measureText(stat.label).width + num * 0.9;
  }

  if (model.spark != null && model.spark.length > 2) {
    drawSpark(
      ctx,
      model.spark,
      model.accent,
      pad,
      H - pad - num * 1.3,
      W * 0.3,
      num * 1.1,
    );
  }

  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function drawMotif(
  ctx: CanvasRenderingContext2D,
  model: CardModel,
  W: number,
  H: number,
): Promise<void> {
  const art = model.art!;
  const tall = model.shape !== "wide";
  // The same rectangle and the same fade the stylesheet uses, in the same
  // proportions — see .motif in share.module.less.
  const box = tall
    ? { x: -0.04 * W, y: H - 0.74 * H + 0.18 * H, w: 1.08 * W, h: 0.74 * H }
    : { x: 0.26 * W, y: -0.14 * H, w: 1.04 * W, h: 1.28 * H };
  const img = await loadSvg(
    motifMarkup({
      family: art.family,
      seed: art.seed,
      kind: model.artKind,
      size: 1024,
      vivid: model.artVivid,
    }),
  );

  const off = document.createElement("canvas");
  off.width = Math.ceil(box.w);
  off.height = Math.ceil(box.h);
  const octx = off.getContext("2d");
  if (octx == null) {
    return;
  }
  // preserveAspectRatio="slice": cover the box, centred.
  const scale = Math.max(off.width, off.height);
  octx.drawImage(
    img,
    (off.width - scale) / 2,
    (off.height - scale) / 2,
    scale,
    scale,
  );

  // The long feather, as a mask on the drawn pixels.
  const fade = tall
    ? octx.createLinearGradient(0, 0, 0, off.height)
    : octx.createLinearGradient(0, 0, off.width, 0);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.18, "rgba(0,0,0,0.06)");
  fade.addColorStop(0.32, "rgba(0,0,0,0.22)");
  fade.addColorStop(0.46, "rgba(0,0,0,0.55)");
  fade.addColorStop(0.6, "rgba(0,0,0,0.85)");
  fade.addColorStop(0.74, "rgba(0,0,0,1)");
  octx.globalCompositeOperation = "destination-in";
  octx.fillStyle = fade;
  octx.fillRect(0, 0, off.width, off.height);

  ctx.save();
  ctx.globalAlpha = model.artOpacity;
  ctx.drawImage(off, box.x, box.y);
  ctx.restore();
}

function drawSpark(
  ctx: CanvasRenderingContext2D,
  values: readonly number[],
  colour: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const px = (i: number) => x + (i / (values.length - 1)) * w;
  const py = (v: number) => y + h - ((v - lo) / Math.max(1, hi - lo)) * h;
  ctx.beginPath();
  values.forEach((v, i) => {
    if (i === 0) {
      ctx.moveTo(px(i), py(v));
    } else {
      ctx.lineTo(px(i), py(v));
    }
  });
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(2, h * 0.09);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

/** Greedy wrap. The headlines are short; anything cleverer would be unused. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const next = `${line} ${word}`;
    if (ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines;
}
