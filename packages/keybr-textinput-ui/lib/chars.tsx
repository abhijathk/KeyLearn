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
  };
  let span: Span = { chars: [], attrs: 0, cls: null, color: null };
  // Tint the letters you read/type with their key's finger-zone colour, but
  // leave errors and the caret to their own styling.
  const colorFor = (codePoint: CodePoint, attrs: number): string | null =>
    colorOf != null && (attrs === Attr.Normal || attrs === Attr.Hit)
      ? colorOf(codePoint)
      : null;
  const styleFor = (s: Span, special: boolean): CSSProperties | undefined => {
    const base = getTextStyle(s, special);
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
      if (span.attrs !== attrs || span.cls !== cls || span.color !== color) {
        pushSpan({ chars: [], attrs, cls, color });
      }
      span.chars.push(codePoint);
    } else {
      pushSpan({ chars: [], attrs, cls, color: null });
      nodes.push(
        <span
          key={nodes.length}
          className={getClassName(span)}
          style={styleFor(span, /* special= */ true)}
        >
          {specialChar(settings.whitespaceStyle, codePoint)}
        </span>,
      );
    }
  }
  pushSpan({ chars: [], attrs: 0, cls: null, color: null });
  return nodes;
}

function specialChar(whitespaceStyle: WhitespaceStyle, codePoint: CodePoint) {
  switch (codePoint) {
    case 0x0009:
      return "\uE002";
    case 0x000a:
      return "\uE003";
    case 0x0020:
      switch (whitespaceStyle) {
        case WhitespaceStyle.Bar:
          return "\uE001";
        case WhitespaceStyle.Bullet:
          return "\uE000";
        default:
          return "\u00A0";
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
