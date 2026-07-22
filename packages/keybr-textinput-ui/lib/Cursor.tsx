import {
  CaretMovementStyle,
  CaretShapeStyle,
  type TextDisplaySettings,
} from "@keybr/textinput";
import {
  Component,
  createRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { findCursor } from "./chars.tsx";
import * as styles from "./Cursor.module.less";
import { getCursorStyle } from "./styles.ts";

export class Cursor extends Component<{
  readonly settings: TextDisplaySettings;
  readonly children: ReactNode;
}> {
  readonly #containerRef = createRef<HTMLDivElement>();
  readonly #cursorRef = createRef<HTMLSpanElement>();
  readonly #veilPastRef = createRef<HTMLDivElement>();
  readonly #veilNextRef = createRef<HTMLDivElement>();
  #initial = true;
  #animation: Animation | null = null;

  #mounted = false;

  override componentDidMount() {
    this.#mounted = true;
    this.#position();
    // The block caret is measured from char.offsetLeft. On first mount the
    // monospace web font may not be loaded yet, so the char is measured in
    // fallback-font metrics; once the real font swaps in the centred text
    // reflows and the caret would be left stranded. Re-snap it after fonts are
    // ready and on the next frame so it lands on the letter, not beside it.
    this.#reposition();
    if (typeof document !== "undefined" && document.fonts?.ready != null) {
      document.fonts.ready.then(() => {
        this.#reposition();
      });
    }
    window.addEventListener("keylearn:wrong-key", this.#shake);
  }

  override componentDidUpdate() {
    this.#position();
  }

  override componentWillUnmount() {
    this.#mounted = false;
    window.removeEventListener("keylearn:wrong-key", this.#shake);
    if (this.#animation != null) {
      this.#animation.cancel();
    }
  }

  // Snap the caret to the current char without a movement animation (used to
  // correct for late layout such as web-font loading).
  readonly #reposition = () => {
    requestAnimationFrame(() => {
      if (this.#mounted) {
        this.#initial = true;
        this.#position();
      }
    });
  };

  // The wrong keystroke: the block flinches — pale red fill, red halo, and a
  // quick shake — then settles back to the accent.
  readonly #shake = () => {
    const cursor = this.#cursorRef.current;
    if (cursor == null) {
      return;
    }
    cursor.classList.add(styles.flinch);
    window.setTimeout(() => {
      cursor.classList.remove(styles.flinch);
    }, 380);
    if (
      typeof cursor.animate === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      cursor.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-3px)", offset: 0.25 },
          { transform: "translateX(3px)", offset: 0.5 },
          { transform: "translateX(-2px)", offset: 0.75 },
          { transform: "translateX(0)" },
        ],
        { duration: 250, easing: "ease-out" },
      );
    }
  };

  #position() {
    const container = this.#containerRef.current;
    const cursor = this.#cursorRef.current;
    if (container != null && cursor != null) {
      const char = findCursor(container);
      if (char != null) {
        this.#move(cursor, char);
      } else {
        this.#hide(cursor);
      }
    }
  }

  #move(cursor: HTMLElement, char: HTMLElement) {
    const {
      caretShapeStyle,
      caretMovementStyle,
      language: { direction },
    } = this.props.settings;

    const { style } = cursor;

    const from = window.getComputedStyle(char);
    style.fontFamily = from.fontFamily;
    style.fontSize = from.fontSize;
    style.fontStyle = from.fontStyle;
    style.fontWeight = from.fontWeight;
    style.fontVariant = from.fontVariant;
    style.fontKerning = from.fontKerning;
    style.lineHeight = from.lineHeight;

    const x = char.offsetLeft;
    const y = char.parentElement!.offsetTop;
    const w = char.offsetWidth;
    const h = char.parentElement!.offsetHeight;

    let left: number;
    let top: number;

    switch (caretShapeStyle) {
      case CaretShapeStyle.Block:
        cursor.textContent = char.textContent;
        style.display = "block";
        style.borderWidth = "";
        style.width = "";
        style.height = "";
        left = x;
        top = y;
        break;

      case CaretShapeStyle.Box:
        cursor.textContent = "";
        style.display = "block";
        style.borderWidth = "1px";
        style.width = `${w + 4}px`;
        style.height = `${h + 4}px`;
        left = x - 2;
        top = y - 2;
        break;

      case CaretShapeStyle.Line:
        cursor.textContent = "";
        style.display = "block";
        style.borderWidth = "";
        style.width = "2px";
        style.height = `${h}px`;
        switch (direction) {
          case "ltr":
            left = x - 2;
            break;
          case "rtl":
            left = x + w;
            break;
        }
        top = y;
        break;

      case CaretShapeStyle.Underline:
        cursor.textContent = "";
        style.display = "block";
        style.borderWidth = "";
        style.width = `${w}px`;
        style.height = "2px";
        left = x;
        top = y + h - 2;
        break;
    }

    // The focus band: veils dim the finished stretch above the caret's line
    // and the not-yet stretch below it. As the caret nears the end of its
    // line the lower veil steps down early, so the next line brightens while
    // the eye still has time to read ahead.
    const veilPast = this.#veilPastRef.current;
    const veilNext = this.#veilNextRef.current;
    const container = this.#containerRef.current;
    if (veilPast != null && veilNext != null && container != null) {
      const width = container.clientWidth || 1;
      const nearEnd = x + w * 14 >= width;
      const activeBottom = y + (nearEnd ? h * 2 : h);
      veilPast.style.display = "block";
      veilPast.style.insetBlockStart = "0";
      veilPast.style.blockSize = `${Math.max(0, y)}px`;
      veilNext.style.display = "block";
      veilNext.style.insetBlockStart = `${activeBottom}px`;
      veilNext.style.insetBlockEnd = "0";
    }

    const fromLeft = cursor.offsetLeft;
    const fromTop = cursor.offsetTop;

    style.left = `${left}px`;
    style.top = `${top}px`;

    if (this.#initial || caretMovementStyle !== CaretMovementStyle.Smooth) {
      if (this.#animation != null) {
        this.#animation.cancel();
        this.#animation = null;
      }
    } else {
      if (this.#animation != null) {
        this.#animation.cancel();
        this.#animation = null;
      } else {
        this.#animation = cursor.animate(
          [
            {
              left: `${fromLeft}px`,
              top: `${fromTop}px`,
            },
            {
              left: `${left}px`,
              top: `${top}px`,
            },
          ],
          {
            duration: wpmToDuration(120),
            iterations: 1,
            easing: "linear",
          },
        );
        const clear = () => {
          this.#animation = null;
        };
        this.#animation.onfinish = clear;
        this.#animation.oncancel = clear;
        this.#animation.onremove = clear;
      }
    }

    this.#initial = false;
  }

  #hide(cursor: HTMLElement) {
    const { style } = cursor;

    const veilPast = this.#veilPastRef.current;
    const veilNext = this.#veilNextRef.current;
    if (veilPast != null) {
      veilPast.style.display = "none";
    }
    if (veilNext != null) {
      veilNext.style.display = "none";
    }

    cursor.textContent = "";

    style.display = "none";
    style.left = "";
    style.top = "";
    style.width = "";
    style.height = "";

    this.#initial = true;
  }

  override render(): ReactNode {
    return (
      <div ref={this.#containerRef} style={containerStyle}>
        <div ref={this.#veilPastRef} className={styles.veilPast} />
        <div ref={this.#veilNextRef} className={styles.veilNext} />
        <span
          ref={this.#cursorRef}
          className={
            this.props.settings.caretShapeStyle === CaretShapeStyle.Block
              ? styles.caret
              : undefined
          }
          style={{
            ...cursorStyle,
            ...getCursorStyle(this.props.settings.caretShapeStyle),
          }}
        />
        {this.props.children}
      </div>
    );
  }
}

const containerStyle = {
  display: "block",
  position: "relative",
} satisfies CSSProperties;

const cursorStyle = {
  display: "block",
  position: "absolute",
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  // above the focus-band veils
  zIndex: 2,
} satisfies CSSProperties;

function wpmToDuration(wpm: number): number {
  return Math.round(1000 / ((wpm * 5) / 60));
}
