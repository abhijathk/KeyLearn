import { ALLOWED_LOGO_TYPES } from "./controller.ts";

/** 48 KB before base64. A brand mark that needs more than this is a photograph. */
export const LOGO_MAX_BYTES = 48 * 1024;

/**
 * Everything an SVG can carry that is not a drawing.
 *
 * An SVG is a document, not an image, and a hostile one can run script,
 * fetch a tracking pixel or embed another document. We accept SVG because
 * a brand mark should stay sharp at any size, so the file is rewritten
 * before it is stored rather than trusted: these elements are removed
 * whole, every `on*` handler and every external reference goes with them,
 * and the result is served under `default-src 'none'` as a third line.
 */
const FORBIDDEN_ELEMENTS = [
  "script",
  "foreignObject",
  "iframe",
  "embed",
  "object",
  "audio",
  "video",
  "animate",
  "set",
  "handler",
  "use",
  "image",
];

/**
 * Strips an SVG down to a drawing.
 *
 * Deliberately conservative: anything it cannot confidently make safe it
 * removes, even where that loses a legitimate flourish. An advertiser whose
 * logo needs an embedded raster can send a PNG instead.
 */
export function sanitiseSvg(source: string): string {
  let out = source;
  // Doctype and processing instructions can pull in an external entity.
  out = out.replace(/<!DOCTYPE[\s\S]*?>/gi, "");
  out = out.replace(/<\?[\s\S]*?\?>/g, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  for (const name of FORBIDDEN_ELEMENTS) {
    out = out.replace(
      new RegExp(`<${name}\\b[\\s\\S]*?<\\/${name}\\s*>`, "gi"),
      "",
    );
    out = out.replace(new RegExp(`<${name}\\b[^>]*/?>`, "gi"), "");
  }
  // Event handlers, in any spelling of the attribute.
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
  // Anything that navigates or loads: javascript:, data:, and any http(s)
  // reference out to another host.
  out = out.replace(/(href|xlink:href|src)\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/(href|xlink:href|src)\s*=\s*'[^']*'/gi, "");
  out = out.replace(/url\(\s*['"]?\s*(?!#)[^)]*\)/gi, "none");
  return out.trim();
}

export type LogoResult =
  | { readonly ok: true; readonly dataUri: string; readonly type: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Checks and normalises what an advertiser sent, returning either a data
 * URI safe to store or the reason it was refused.
 *
 * The refusal text is shown to whoever is composing the campaign in the
 * control centre, so it says what to do rather than what went wrong.
 */
export function acceptLogo(dataUri: string): LogoResult {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUri.trim());
  if (match == null) {
    return { ok: false, reason: "Send the logo as a file, not a link." };
  }
  const type = match[1]!.toLowerCase();
  if (!ALLOWED_LOGO_TYPES.has(type)) {
    return {
      ok: false,
      reason: "Logos may be SVG, PNG, JPEG or WebP.",
    };
  }
  let bytes: Buffer;
  try {
    bytes = Buffer.from(match[2]!, "base64");
  } catch {
    return { ok: false, reason: "That file could not be read." };
  }
  if (bytes.length === 0) {
    return { ok: false, reason: "That file is empty." };
  }
  if (bytes.length > LOGO_MAX_BYTES) {
    return {
      ok: false,
      reason: `Logos must be under ${Math.round(LOGO_MAX_BYTES / 1024)} KB. Send an SVG for a mark this size.`,
    };
  }
  if (type === "image/svg+xml") {
    const cleaned = sanitiseSvg(bytes.toString("utf8"));
    if (!/<svg[\s>]/i.test(cleaned)) {
      return { ok: false, reason: "That SVG had no drawing left in it." };
    }
    return {
      ok: true,
      type,
      dataUri: `data:image/svg+xml;base64,${Buffer.from(cleaned, "utf8").toString("base64")}`,
    };
  }
  return {
    ok: true,
    type,
    dataUri: `data:${type};base64,${bytes.toString("base64")}`,
  };
}
