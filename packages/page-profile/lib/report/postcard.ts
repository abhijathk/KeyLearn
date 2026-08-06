// The postcard: a keepsake rather than a document.
//
// Two designs, because they are for two different people. The Ticket reads as
// evidence and is the natural companion to the printed report; the Trading
// Card is the one a child asks for by name. Both draw at 1800×1200, which
// prints as an ordinary 6×4 postcard and survives whatever a platform does to
// it on the way through.

import { motifMarkup } from "@keylearn/identicon";
import { GLYPH, loadSvg } from "./card-image.ts";
import { type ShareFacts } from "./ShareDialog.tsx";

export type PostcardDesign = "ticket" | "card";

export const POSTCARD_SIZE = [1800, 1200] as const;

export type PostcardModel = {
  readonly design: PostcardDesign;
  readonly facts: ShareFacts;
  readonly art: { readonly family: string; readonly seed: number } | null;
  readonly fontFamily: string;
  readonly monoFamily: string;
  readonly formatDate: (at: number) => string;
};

export async function renderPostcard(
  model: PostcardModel,
): Promise<Blob | null> {
  const [W, H] = POSTCARD_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx == null) {
    return null;
  }
  if (model.design === "ticket") {
    await drawTicket(ctx, model, W, H);
  } else {
    await drawTradingCard(ctx, model, W, H);
  }
  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

const hhmm = (minutes: number) =>
  `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;

/**
 * The Ticket.
 *
 * Monospace and a tear-off stub. Nothing here is decorative: the whole point
 * is that it reads as issued rather than designed, which is what makes it
 * usable beside the PDF when a tutor asks what has actually been done.
 */
async function drawTicket(
  ctx: CanvasRenderingContext2D,
  model: PostcardModel,
  W: number,
  H: number,
): Promise<void> {
  const { facts, monoFamily: M, formatDate } = model;
  const stubX = Math.round(W * 0.7);

  ctx.fillStyle = "#f4f1e8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ece8dc";
  ctx.fillRect(stubX, 0, W - stubX, H);

  // The perforation.
  ctx.strokeStyle = "#b9b3a4";
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 16]);
  ctx.beginPath();
  ctx.moveTo(stubX, 0);
  ctx.lineTo(stubX, H);
  ctx.stroke();
  ctx.setLineDash([]);

  const pad = Math.round(W * 0.047);
  const ink = "#1d2127";
  const dim = "#7a7566";

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = dim;
  ctx.font = `500 ${Math.round(W * 0.0155)}px ${M}`;
  ctx.fillText("KEYLEARN · PROGRESS RECORD", pad, pad + W * 0.016);

  ctx.fillStyle = ink;
  ctx.font = `500 ${Math.round(W * 0.052)}px ${M}`;
  ctx.fillText(facts.name ?? "Typing", pad, pad + W * 0.078);

  // Six figures on a three-column grid.
  const cells: readonly (readonly [string, string])[] = [
    [facts.wpm == null ? "—" : `${facts.wpm}`, "WPM TYPICAL"],
    [facts.best == null ? "—" : `${Math.round(facts.best)}`, "WPM BEST"],
    [
      facts.accuracy == null ? "—" : `${(facts.accuracy * 100).toFixed(1)}%`,
      "ACCURACY",
    ],
    [`${facts.letters}/${facts.alphabet}`, "KEYS"],
    [`${facts.lessons}`, "LESSONS"],
    [hhmm(facts.minutes), "AT THE KEYBOARD"],
  ];
  const colW = (stubX - pad * 2) / 3;
  cells.forEach(([value, label], i) => {
    const x = pad + (i % 3) * colW;
    const y = H * 0.42 + Math.floor(i / 3) * H * 0.19;
    ctx.fillStyle = ink;
    ctx.font = `700 ${Math.round(W * 0.044)}px ${M}`;
    ctx.fillText(value, x, y);
    ctx.fillStyle = dim;
    ctx.font = `500 ${Math.round(W * 0.0145)}px ${M}`;
    ctx.fillText(label, x, y + W * 0.024);
  });

  // A barcode drawn from the figures themselves, so two learners do not get
  // the same one — decorative, but not arbitrary.
  const bars = 26;
  const seedish = facts.lessons * 31 + facts.letters * 7 + facts.daysPractised;
  ctx.fillStyle = ink;
  for (let i = 0; i < bars; i++) {
    const h = 18 + ((seedish * (i + 3)) % 47) * 1.6;
    ctx.fillRect(pad + i * (W * 0.0125), H - pad - h, W * 0.0058, h);
  }

  // The stub.
  const sx = stubX + Math.round(W * 0.03);
  ctx.fillStyle = dim;
  ctx.font = `500 ${Math.round(W * 0.0145)}px ${M}`;
  ctx.fillText("DAYS", sx, pad + W * 0.016);
  ctx.fillStyle = ink;
  ctx.font = `700 ${Math.round(W * 0.058)}px ${M}`;
  ctx.fillText(`${facts.daysPractised}`, sx, pad + W * 0.075);

  ctx.fillStyle = dim;
  ctx.font = `500 ${Math.round(W * 0.0145)}px ${M}`;
  ctx.fillText("PERIOD", sx, H * 0.46);
  ctx.fillStyle = ink;
  ctx.font = `500 ${Math.round(W * 0.018)}px ${M}`;
  if (facts.to > 0) {
    ctx.fillText(formatDate(facts.from), sx, H * 0.52);
    ctx.fillText(formatDate(facts.to), sx, H * 0.57);
  }

  ctx.fillStyle = dim;
  ctx.font = `500 ${Math.round(W * 0.0125)}px ${M}`;
  ctx.fillText("NO DATA LEFT", sx, H - pad - W * 0.018);
  ctx.fillText("THIS DEVICE", sx, H - pad);
}

/**
 * The Trading Card.
 *
 * The learner's own painting as the artwork and their figures as card stats.
 * Bright frame, rounded inner panel, and nothing on it a child has to read
 * twice.
 */
async function drawTradingCard(
  ctx: CanvasRenderingContext2D,
  model: PostcardModel,
  W: number,
  H: number,
): Promise<void> {
  const { facts, fontFamily: F } = model;

  const frame = ctx.createLinearGradient(0, 0, W, H);
  frame.addColorStop(0, "#ffb43f");
  frame.addColorStop(0.55, "#ff6f61");
  frame.addColorStop(1, "#b1509f");
  ctx.fillStyle = frame;
  ctx.fillRect(0, 0, W, H);

  const m = Math.round(W * 0.026);
  const r = Math.round(W * 0.018);
  roundRect(ctx, m, m, W - m * 2, H - m * 2, r);
  ctx.fillStyle = "#fffaf0";
  ctx.fill();

  const pad = m + Math.round(W * 0.032);
  const ink = "#35241c";

  // Name plate and rank.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ink;
  ctx.font = `900 ${Math.round(W * 0.062)}px ${F}`;
  ctx.fillText(facts.name ?? "A new typist", pad, pad + W * 0.05);

  const rank =
    facts.letters >= facts.alphabet && facts.alphabet > 0
      ? "★ ALPHABET"
      : `★ ${facts.letters} LETTERS`;
  ctx.font = `900 ${Math.round(W * 0.019)}px ${F}`;
  const rw = ctx.measureText(rank).width + W * 0.045;
  roundRect(ctx, W - pad - rw, pad + W * 0.012, rw, W * 0.042, W * 0.021);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.fillStyle = "#ffd166";
  ctx.fillText(rank, W - pad - rw + W * 0.022, pad + W * 0.041);

  // Artwork panel — the learner's own painting, clipped to the rounded box.
  const ax = pad;
  const ay = pad + Math.round(W * 0.072);
  const aw = W - pad * 2;
  const ah = H - ay - Math.round(W * 0.115) - m;
  ctx.save();
  roundRect(ctx, ax, ay, aw, ah, W * 0.013);
  ctx.clip();
  const bg = ctx.createLinearGradient(ax, ay, ax + aw, ay + ah);
  bg.addColorStop(0, "#9be8c0");
  bg.addColorStop(0.6, "#63c4e8");
  bg.addColorStop(1, "#b28ef0");
  ctx.fillStyle = bg;
  ctx.fillRect(ax, ay, aw, ah);
  if (model.art != null) {
    try {
      const img = await loadSvg(
        motifMarkup({
          family: model.art.family,
          seed: model.art.seed,
          kind: facts.kid ? "kid" : "adult",
          size: 1024,
          vivid: facts.kid ? 0 : 0.45,
        }),
      );
      const side = Math.max(aw, ah);
      ctx.drawImage(
        img,
        ax + (aw - side) / 2,
        ay + (ah - side) / 2,
        side,
        side,
      );
    } catch {
      // The gradient behind is a complete picture on its own.
    }
  }
  ctx.restore();

  // Stats along the foot.
  const stats: readonly (readonly [string, string])[] = facts.kid
    ? [
        [`${facts.letters}`, "LETTERS"],
        [`${facts.daysPractised}`, "DAYS"],
        [`${facts.weeks}`, "WEEKS"],
      ]
    : [
        [facts.wpm == null ? "—" : `${facts.wpm}`, "WPM"],
        [`${facts.letters}`, "KEYS"],
        [`${facts.daysPractised}`, "DAYS"],
      ];
  const sw = (W - pad * 2 - W * 0.028) / 3;
  const sy = H - m - Math.round(W * 0.098);
  stats.forEach(([value, label], i) => {
    const x = pad + i * (sw + W * 0.014);
    roundRect(ctx, x, sy, sw, W * 0.072, W * 0.012);
    ctx.fillStyle = "#fff0d2";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = "#d1502a";
    ctx.font = `900 ${Math.round(W * 0.038)}px ${F}`;
    ctx.fillText(value, x + sw / 2, sy + W * 0.042);
    ctx.fillStyle = "#9a7f63";
    ctx.font = `800 ${Math.round(W * 0.0145)}px ${F}`;
    ctx.fillText(label, x + sw / 2, sy + W * 0.062);
    ctx.textAlign = "start";
  });

  // The mark, small, bottom right of the artwork.
  try {
    const glyph = await loadSvg(GLYPH.replace("COLOUR", "#fffaf0"));
    ctx.globalAlpha = 0.85;
    ctx.drawImage(
      glyph,
      ax + aw - W * 0.075,
      ay + ah - W * 0.045,
      W * 0.05,
      W * 0.033,
    );
    ctx.globalAlpha = 1;
  } catch {
    // Without the mark the card is still the learner's card.
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
