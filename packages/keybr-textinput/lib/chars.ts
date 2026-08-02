import { type CodePoint, toCodePoints } from "@keybr/unicode";

export type StyledText = string | StyledTextSpan | readonly StyledText[];

export type StyledTextSpan = { readonly text: string; readonly cls: string };

export const enum Attr {
  Normal = 0,
  Hit = 1,
  Miss = 2,
  Garbage = 4,
  Cursor = 8,
}

export type Char = {
  readonly codePoint: CodePoint;
  readonly attrs: number;
  readonly cls?: string | null;
};

export type Line = {
  readonly text: string;
  readonly chars: readonly Char[];
};

export type LineList<T extends Line = Line> = {
  readonly text: string;
  readonly lines: readonly T[];
};

export function flattenStyledText(text: StyledText): string {
  const list: Array<string> = [];
  if (Array.isArray(text)) {
    for (const item of text) {
      list.push(flattenStyledText(item));
    }
  } else if (typeof text === "string") {
    list.push(text);
  } else if (isStyledTextSpan(text)) {
    list.push(text.text);
  } else {
    throw new TypeError();
  }
  return list.join("");
}

export function splitStyledText(
  text: StyledText,
  attrs: Attr = Attr.Normal,
): Char[] {
  const list: Array<Char> = [];
  if (Array.isArray(text)) {
    for (const item of text) {
      list.push(...splitStyledText(item));
    }
  } else if (typeof text === "string") {
    list.push(
      ...[...toCodePoints(text)].map((codePoint) => ({
        codePoint,
        cls: null,
        attrs,
      })),
    );
  } else if (isStyledTextSpan(text)) {
    list.push(
      ...[...toCodePoints(text.text)].map((codePoint) => ({
        codePoint,
        cls: text.cls,
        attrs,
      })),
    );
  } else {
    throw new TypeError();
  }
  return list;
}

export function isStyledTextSpan(v: unknown): v is StyledTextSpan {
  return v != null && typeof v === "object" && "text" in v;
}

export function charsAreEqual(a: Char, b: Char): boolean {
  if (a !== b) {
    if (a.codePoint !== b.codePoint) {
      return false;
    }
    if (a.attrs !== b.attrs) {
      return false;
    }
    if (a.cls !== b.cls) {
      return false;
    }
  }
  return true;
}

export function charArraysAreEqual(
  a: readonly Char[],
  b: readonly Char[],
): boolean {
  if (a !== b) {
    const { length } = a;
    if (length !== b.length) {
      return false;
    }
    for (let i = 0; i < length; i++) {
      const x = a[i];
      const y = b[i];
      if (!charsAreEqual(x, y)) {
        return false;
      }
    }
  }
  return true;
}

export function toLine(styledText: StyledText): Line {
  const text = flattenStyledText(styledText);
  const chars = splitStyledText(styledText);
  return { text, chars };
}

/**
 * Breaks already-typed characters into the lines the text actually has.
 *
 * Code is the first lesson kind with real lines in it. Everything else is one
 * line and comes back as one line, so this costs those nothing.
 *
 * The newline itself stays at the end of the line it terminates rather than
 * being dropped: it is a character the learner has to type, and a line that
 * did not show it would leave the caret with nowhere to sit while they did.
 */
export function toLines(text: string, chars: readonly Char[]): LineList {
  if (!text.includes("\n")) {
    return { text, lines: [{ text, chars }] };
  }
  const lines: Line[] = [];
  let from = 0;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i].codePoint === 0x000a) {
      const slice = chars.slice(from, i + 1);
      lines.push({ text: textOf(slice), chars: slice });
      from = i + 1;
    }
  }
  if (from < chars.length) {
    const slice = chars.slice(from);
    lines.push({ text: textOf(slice), chars: slice });
  }
  return { text, lines };
}

function textOf(chars: readonly Char[]): string {
  return chars.map(({ codePoint }) => String.fromCodePoint(codePoint)).join("");
}

export function singleLine(styledText: StyledText): LineList {
  const text = flattenStyledText(styledText);
  const chars = splitStyledText(styledText);
  return { text, lines: [{ text, chars }] };
}
