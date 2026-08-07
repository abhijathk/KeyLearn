// Taking a certificate off the screen.
//
// Both files are drawn from `SHEETS`, the same table the on-screen sheet uses,
// rather than from a screenshot of it. A downloaded certificate that is a
// photograph of a browser window carries whatever that window was doing — a
// scrollbar, a hairline of the page behind it, the wrong device pixel ratio —
// and cannot be produced at print resolution at all.

import { brailleCells } from "@keylearn/certificate";
import {
  CELL,
  cellInk,
  type Face,
  type Field,
  type SheetName,
  SHEETS,
} from "@keylearn/certificate";
import { type PrintedCertificate } from "@keylearn/certificate";
import sheetAdult from "./assets/sheet-adult.jpg";
import sheetChild from "./assets/sheet-child.jpg";
import sheetYoung from "./assets/sheet-young.jpg";

const ART: Readonly<Record<SheetName, string>> = {
  adult: sheetAdult,
  young: sheetYoung,
  child: sheetChild,
};

const FACE: Readonly<Record<Face, string>> = {
  serif: `"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`,
  round: `"SF Pro Rounded",Nunito,system-ui,-apple-system,"Segoe UI",sans-serif`,
  mono: `ui-monospace,"SF Mono",Menlo,Consolas,monospace`,
};

/** The line-height the sheet sets on every field. */
const LINE_HEIGHT = 1.05;

/**
 * Draw the certificate onto a canvas.
 *
 * `scale` multiplies the artwork's own pixel size — 1 is native, which is
 * around 130dpi at A4 and is what the templates hold. Anything above about 2
 * is enlarging a JPEG and only makes the file bigger.
 */
export async function drawCertificate(
  printed: PrintedCertificate,
  scale = 1,
): Promise<HTMLCanvasElement> {
  const layout = SHEETS[printed.sheet];
  const art = await loadImage(ART[printed.sheet]);
  // Measurements below are only correct once the faces they name are actually
  // resolved; before that the canvas measures a fallback.
  await document.fonts.ready;

  const w = Math.round(layout.art.width * scale);
  const h = Math.round(layout.art.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(art, 0, 0, w, h);

  const braille = printed.kind === "braille";
  const name = braille ? layout.braille.name : layout.name;
  const language = braille ? layout.braille.language : layout.language;

  text(ctx, w, h, name, printed.name);
  if (braille) {
    dots(ctx, w, h, printed.name, layout.braille.cells, cellInk(printed.sheet));
  }
  text(ctx, w, h, language, printed.languageLine);
  layout.fields.forEach((field, i) => {
    text(ctx, w, h, field, printed.values[i] ?? "");
  });
  return canvas;
}

export async function certificatePng(
  printed: PrintedCertificate,
  scale = 2,
): Promise<Blob> {
  const canvas = await drawCertificate(printed, scale);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("no blob"))),
      "image/png",
    );
  });
}

/** A4 portrait, in PostScript points. */
const A4 = { width: 595.28, height: 841.89 } as const;
const MARGIN = 18;

/**
 * A single-page PDF holding the certificate, centred on A4.
 *
 * Written out by hand rather than with a PDF library: the whole document is
 * one image on one page, and that is a few hundred bytes of structure against
 * a dependency the rest of the app has no use for. The image goes in as JPEG
 * and is passed through untouched — `DCTDecode` is a filter PDF readers
 * already have, so nothing is decoded and re-encoded on the way.
 */
export async function certificatePdf(
  printed: PrintedCertificate,
  scale = 2,
): Promise<Blob> {
  const canvas = await drawCertificate(printed, scale);
  const jpeg = new Uint8Array(
    await (
      await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("no blob"))),
          "image/jpeg",
          0.94,
        );
      })
    ).arrayBuffer(),
  );

  // Fit inside the page rather than filling it. The three sheets are all
  // narrower than A4, and stretching one to the paper's proportions would
  // distort artwork somebody is about to frame.
  const box = {
    width: A4.width - MARGIN * 2,
    height: A4.height - MARGIN * 2,
  };
  const fit = Math.min(box.width / canvas.width, box.height / canvas.height);
  const dw = canvas.width * fit;
  const dh = canvas.height * fit;
  const dx = (A4.width - dw) / 2;
  const dy = (A4.height - dh) / 2;

  const content = `q ${f(dw)} 0 0 ${f(dh)} ${f(dx)} ${f(dy)} cm /Im0 Do Q\n`;
  const objects: (string | Uint8Array)[][] = [
    ["<</Type/Catalog/Pages 2 0 R>>"],
    ["<</Type/Pages/Kids[3 0 R]/Count 1>>"],
    [
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${f(A4.width)} ${f(A4.height)}]` +
        `/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`,
    ],
    [
      `<</Type/XObject/Subtype/Image/Width ${canvas.width}` +
        `/Height ${canvas.height}/ColorSpace/DeviceRGB/BitsPerComponent 8` +
        `/Filter/DCTDecode/Length ${jpeg.length}>>\nstream\n`,
      jpeg,
      "\nendstream",
    ],
    [`<</Length ${content.length}>>\nstream\n${content}endstream`],
  ];

  const parts: Uint8Array[] = [];
  let offset = 0;
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? latin1(chunk) : chunk;
    parts.push(bytes);
    offset += bytes.length;
  };

  push("%PDF-1.4\n");
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    push(`${i + 1} 0 obj\n`);
    body.forEach(push);
    push("\nendobj\n");
  });

  const xref = offset;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) {
    table += `${String(at).padStart(10, "0")} 00000 n \n`;
  }
  push(table);
  push(
    `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\n` +
      `startxref\n${xref}\n%%EOF\n`,
  );

  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

/** A filename somebody can find again in their downloads folder. */
export function certificateFileName(
  printed: PrintedCertificate,
  extension: "png" | "pdf",
): string {
  const who = printed.name
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
  return `keylearn-certificate-${who || "learner"}.${extension}`;
}

// ── drawing ────────────────────────────────────────────────────────────────

/**
 * Draw one field exactly where the DOM would have put it.
 *
 * The vertical placement is the CSS inline box, worked out rather than
 * approximated: a line box of `line-height` is centred on the font's own
 * ascent-plus-descent, and the baseline sits an ascent below the top of that.
 * Using the canvas' own `textBaseline: "top"` instead is off by the half
 * leading, which at these sizes is enough to lift a date off its ruled line.
 */
function text(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  field: Field,
  value: string,
): void {
  if (value === "") {
    return;
  }
  const body = field.upper ? value.toUpperCase() : value;
  // Type is sized against the sheet's width in both axes — see `Field.size`.
  const size = (field.size / 100) * w;
  const weight = field.face === "round" ? 800 : 400;
  ctx.font = `${weight} ${size}px ${FACE[field.face]}`;
  ctx.fillStyle = field.colour;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const tracking = field.tracking * size;
  const metrics = ctx.measureText(body);
  const baseline =
    (field.top / 100) * h +
    (LINE_HEIGHT * size -
      (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent)) /
      2 +
    metrics.fontBoundingBoxAscent;

  const width = measure(ctx, body, tracking);
  const x =
    field.width > 0
      ? (field.left / 100) * w + ((field.width / 100) * w - width) / 2
      : (field.left / 100) * w;

  if (tracking === 0) {
    // One call, so the face's own kerning survives. This is the name and the
    // dates — the fields where letter pairs actually matter.
    ctx.fillText(body, x, baseline);
    return;
  }
  // Tracked fields are monospaced or set in caps, where there is no kerning to
  // lose, and drawing them character by character reproduces CSS exactly:
  // the space goes *after* each character, the last one included.
  let at = x;
  for (const ch of body) {
    ctx.fillText(ch, at, baseline);
    at += ctx.measureText(ch).width + tracking;
  }
}

function measure(
  ctx: CanvasRenderingContext2D,
  value: string,
  tracking: number,
): number {
  if (tracking === 0) {
    return ctx.measureText(value).width;
  }
  let width = 0;
  for (const ch of value) {
    width += ctx.measureText(ch).width + tracking;
  }
  return width;
}

/** The name in grade 1, centred in the same box the on-screen sheet uses. */
function dots(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  name: string,
  at: { readonly top: number; readonly left: number },
  ink: string,
): void {
  const cells = brailleCells(name);
  const dot = (CELL.dot / 100) * w;
  const gap = (CELL.gap / 100) * w;
  const advance = (CELL.advance / 100) * w;
  // A cell is two dots wide with one gap between them, then the space to the
  // next cell. The last cell's trailing space counts, exactly as the flex row
  // on screen counts its final margin.
  const cellWidth = dot * 2 + gap + advance;
  const total = cells.length * cellWidth;
  const box = w - 2 * (at.left / 100) * w;
  let x = (at.left / 100) * w + (box - total) / 2;
  const top = (at.top / 100) * h;

  ctx.fillStyle = ink;
  for (const raised of cells) {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      if (!raised.includes(n)) {
        continue;
      }
      // Dots 1-3 run down the left column, 4-6 down the right.
      const col = n <= 3 ? 0 : 1;
      const row = (n - 1) % 3;
      const cx = x + col * (dot + gap) + dot / 2;
      const cy = top + row * (dot + gap) + dot / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, dot / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    x += cellWidth;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error(`cannot load ${src}`));
    };
    image.src = src;
  });
}

/** Two decimal places, without an exponent — PDF numbers have neither. */
function f(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function latin1(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return bytes;
}
