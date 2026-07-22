import {
  Attr,
  type Char,
  type TextDisplaySettings,
  WhitespaceStyle,
} from "@keybr/textinput";
import { type CodePoint } from "@keybr/unicode";
import { type CSSProperties, type ReactNode } from "react";
import * as styles from "./chars.module.less";
import { getTextStyle } from "./styles.ts";

// The cooling ink: the few characters just behind the caret still glow warm
// with the accent, then settle into the dimmed "road behind you" colour.
const freshStyles: readonly CSSProperties[] = [
  {},
  {
    color:
      "color-mix(in oklab, var(--textinput-cursor__background-color) 85%, var(--textinput--hit__color))",
    textShadow:
      "0 0 8px color-mix(in oklab, var(--textinput-cursor__background-color) 45%, transparent)",
  },
  {
    color:
      "color-mix(in oklab, var(--textinput-cursor__background-color) 55%, var(--textinput--hit__color))",
  },
  {
    color:
      "color-mix(in oklab, var(--textinput-cursor__background-color) 28%, var(--textinput--hit__color))",
  },
];

export function renderChars(
  settings: TextDisplaySettings,
  chars: readonly Char[],
  colorOf?: (codePoint: CodePoint) => string | null,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  type Span = {
    chars: CodePoint[];
    attrs: number;
    cls: string | null;
    color: string | null;
    fresh: number;
  };
  let span: Span = { chars: [], attrs: 0, cls: null, color: null, fresh: 0 };
  // Tint the letters you read/type with their key's finger-zone colour, but
  // leave errors and the caret to their own styling.
  const colorFor = (codePoint: CodePoint, attrs: number): string | null =>
    colorOf != null && (attrs === Attr.Normal || attrs === Attr.Hit)
      ? colorOf(codePoint)
      : null;
  // The ember tail: up to three hit characters right before the caret.
  const cursorIndex = chars.findIndex(({ attrs }) => attrs === Attr.Cursor);
  const freshFor = (index: number, attrs: number): number => {
    if (cursorIndex > 0 && attrs === Attr.Hit) {
      const distance = cursorIndex - index;
      if (distance >= 1 && distance <= 3) {
        return distance;
      }
    }
    return 0;
  };
  const styleFor = (s: Span, special: boolean): CSSProperties | undefined => {
    const base = getTextStyle(s, special);
    const fresh = s.fresh > 0 ? freshStyles[s.fresh] : null;
    if (fresh != null) {
      return { ...base, ...fresh };
    }
    return s.color != null ? { ...base, color: s.color } : base;
  };
  const pushSpan = (nextSpan: Span) => {
    if (span.chars.length > 0) {
      nodes.push(
        <span
          key={nodes.length}
          className={getClassName(span)}
          style={styleFor(span, /* special= */ false)}
        >
          {String.fromCodePoint(...span.chars)}
        </span>,
      );
    }
    span = nextSpan;
  };
  for (let i = 0; i < chars.length; i++) {
    const { codePoint, attrs, cls = null } = chars[i];
    if (codePoint > 0x0020) {
      const color = colorFor(codePoint, attrs);
      const fresh = freshFor(i, attrs);
      if (
        span.attrs !== attrs ||
        span.cls !== cls ||
        span.color !== color ||
        span.fresh !== fresh
      ) {
        pushSpan({ chars: [], attrs, cls, color, fresh });
      }
      span.chars.push(codePoint);
    } else {
      pushSpan({ chars: [], attrs, cls, color: null, fresh: 0 });
      nodes.push(
        <span
          key={nodes.length}
          className={getClassName(span)}
          style={styleFor(span, /* special= */ true)}
        >
          {specialChar(settings.whitespaceStyle, codePoint, attrs)}
        </span>,
      );
    }
  }
  pushSpan({ chars: [], attrs: 0, cls: null, color: null, fresh: 0 });
  return nodes;
}

function specialChar(
  whitespaceStyle: WhitespaceStyle,
  codePoint: CodePoint,
  attrs: number,
) {
  switch (codePoint) {
    case 0x0009:
      return "";
    case 0x000a:
      return "";
    case 0x0020:
      // A fumbled space leaves a drop of red ink: the invisible becomes
      // visible exactly where you stumbled.
      if (attrs === Attr.Miss && whitespaceStyle === WhitespaceStyle.Space) {
        return "·";
      }
      switch (whitespaceStyle) {
        case WhitespaceStyle.Bar:
          return "";
        case WhitespaceStyle.Bullet:
          return "";
        default:
          return " ";
      }
    default:
      return `U+${codePoint.toString(16).padStart(4, "0")}`;
  }
}

function getClassName({ attrs }: { readonly attrs: Attr }) {
  switch (attrs) {
    case Attr.Cursor:
      return styles.cursor;
    case Attr.Miss:
      return styles.miss;
    default:
      return undefined;
  }
}

const cursorSelector = `.${styles.cursor}`;

export function findCursor(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(cursorSelector) ?? null;
}
