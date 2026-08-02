import {
  Attr,
  type Char,
  charArraysAreEqual,
  type Line,
  type LineList,
  type TextDisplaySettings,
  textDisplaySettings,
} from "@keybr/textinput";
import { clsx } from "clsx";
import {
  type ComponentType,
  type CSSProperties,
  memo,
  type ReactNode,
} from "react";
import { renderChars } from "./chars.tsx";
import { Cursor } from "./Cursor.tsx";
import { textItemStyle } from "./styles.ts";
import * as styles from "./TextLines.module.less";

export type TextLineSize = "X0" | "X1" | "X2" | "X3";

export const TextLines = memo(function TextLines({
  settings = textDisplaySettings,
  lines,
  wrap = true,
  size = "X0",
  lineTemplate: LineTemplate,
  cursor,
  focus,
  colorOf,
  lineNumbers = false,
}: {
  readonly lines: LineList;
  readonly settings?: TextDisplaySettings;
  readonly wrap?: boolean;
  readonly size?: TextLineSize;
  readonly lineTemplate?: ComponentType<any>;
  readonly cursor: boolean;
  readonly focus: boolean;
  readonly colorOf?: (codePoint: number) => string | null;
  /**
   * A numbered gutter down the left, as an editor draws one.
   *
   * Only worth it for code: prose has no line numbers to refer to, and a
   * column of digits beside a sentence is noise. For a snippet it is the thing
   * that makes the block read as a file rather than as a paragraph.
   */
  readonly lineNumbers?: boolean;
}): ReactNode {
  const className = clsx(
    styles.root,
    wrap ? styles.wrap : styles.nowrap,
    focus ? styles.focus : styles.blur,
    size === "X0" && styles.size_X0,
    size === "X1" && styles.size_X1,
    size === "X2" && styles.size_X2,
    size === "X3" && styles.size_X3,
  );
  // The focus band: the line the caret is on owns the light; the finished
  // line recedes furthest, the coming lines wait a little dimmed. As the caret
  // nears the end of its line, the next line brightens early so the eye can
  // read ahead across the line break without slowing down.
  const activeIndex = cursor
    ? lines.lines.findIndex(({ chars }) =>
        chars.some(({ attrs }) => attrs === Attr.Cursor),
      )
    : -1;
  let nearEnd = false;
  if (activeIndex >= 0) {
    const { chars } = lines.lines[activeIndex];
    const cursorAt = chars.findIndex(({ attrs }) => attrs === Attr.Cursor);
    nearEnd = cursorAt >= 0 && chars.length - cursorAt <= 12;
  }
  const bandOf = (index: number): string | false =>
    cursor &&
    activeIndex >= 0 &&
    clsx(
      styles.band,
      index < activeIndex
        ? styles.band_past
        : index === activeIndex || (nearEnd && index === activeIndex + 1)
          ? styles.band_active
          : styles.band_next,
    );
  const numbered = (index: number, line: ReactNode): ReactNode =>
    lineNumbers ? (
      // The focus filter goes on the wrapper so the gutter dims with the code
      // it belongs to. On the line alone, the numbers stayed sharp beside
      // blurred text and read as chrome rather than as part of the file.
      <span
        key={index}
        className={clsx(styles.numbered, focus ? styles.focus : styles.blur)}
      >
        {/* aria-hidden: a screen reader reading "one" before every line would
            bury the code it is there to announce. */}
        <span className={styles.lineNumber} aria-hidden={true}>
          {index + 1}
        </span>
        {line}
      </span>
    ) : (
      line
    );
  const children = lines.lines.map(({ text, chars, ...props }: Line, index) =>
    LineTemplate != null ? (
      <LineTemplate key={text} {...props}>
        {numbered(
          index,
          <TextLine
            key={text}
            settings={settings}
            chars={chars}
            className={clsx(className, bandOf(index))}
            style={settings.font.cssProperties}
            colorOf={colorOf}
          />,
        )}
      </LineTemplate>
    ) : (
      numbered(
        index,
        <TextLine
          key={text}
          settings={settings}
          chars={chars}
          className={clsx(className, bandOf(index))}
          style={settings.font.cssProperties}
          colorOf={colorOf}
        />,
      )
    ),
  );
  return cursor ? <Cursor settings={settings}>{children}</Cursor> : children;
});

const TextLine = memo(
  function TextLine({
    settings,
    chars,
    className,
    style,
    colorOf,
  }: {
    readonly settings: TextDisplaySettings;
    readonly chars: readonly Char[];
    readonly className: string;
    readonly style: CSSProperties;
    readonly colorOf?: (codePoint: number) => string | null;
  }): ReactNode {
    const items: Char[][] = [];
    let itemChars: Char[] = [];
    let ws = false;
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      switch (char.codePoint) {
        case 0x0009:
        case 0x000a:
        case 0x0020:
          ws = true;
          break;
        default:
          if (ws) {
            if (itemChars.length > 0) {
              items.push(itemChars);
              itemChars = [];
            }
            ws = false;
          }
          break;
      }
      itemChars.push(char);
    }
    if (itemChars.length > 0) {
      items.push(itemChars);
      itemChars = [];
    }
    return (
      <div
        className={className}
        style={style}
        dir={settings.language.direction}
      >
        {items.map((chars, index) => (
          <TextItem
            key={index}
            settings={settings}
            chars={chars}
            colorOf={colorOf}
          />
        ))}
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.settings === nextProps.settings &&
    charArraysAreEqual(prevProps.chars, nextProps.chars) && // deep equality
    prevProps.className === nextProps.className &&
    prevProps.colorOf === nextProps.colorOf,
);

const TextItem = memo(
  function TextItem({
    settings,
    chars,
    colorOf,
  }: {
    readonly settings: TextDisplaySettings;
    readonly chars: readonly Char[];
    readonly colorOf?: (codePoint: number) => string | null;
  }): ReactNode {
    return (
      <span style={textItemStyle}>{renderChars(settings, chars, colorOf)}</span>
    );
  },
  (prevProps, nextProps) =>
    prevProps.settings === nextProps.settings &&
    prevProps.colorOf === nextProps.colorOf &&
    charArraysAreEqual(prevProps.chars, nextProps.chars), // deep equality
);
