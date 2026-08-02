import { test } from "node:test";
import { KeyboardContext, Layout, loadKeyboard } from "@keybr/keyboard";
import { render } from "@testing-library/react";
import { equal } from "rich-assert";
import * as styles from "./TransitionsLayer.module.less";
import { TransitionsLayer } from "./TransitionsLayer.tsx";

/**
 * The layer draws one arc per undirected key pair. The strongest few are drawn
 * one way and the rarest few another, so the count is taken over both classes:
 * an arc that moves between them is still an arc.
 */
function arcs(container: HTMLElement): number {
  return container.querySelectorAll(`.${styles.strong}, .${styles.weak}`)
    .length;
}

test("empty", () => {
  const keyboard = loadKeyboard(Layout.EN_US);

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <TransitionsLayer histogram={[]} />
    </KeyboardContext.Provider>,
  );

  equal(arcs(r.container), 0);

  r.unmount();
});

test("equal counts", () => {
  const keyboard = loadKeyboard(Layout.EN_US);

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <TransitionsLayer
        histogram={[
          [/* "a" */ 0x0061, /* "b" */ 0x0062, 1],
          [/* "b" */ 0x0062, /* "c" */ 0x0063, 1],
        ]}
      />
    </KeyboardContext.Provider>,
  );

  equal(arcs(r.container), 2);

  r.unmount();
});

test("different counts", () => {
  const keyboard = loadKeyboard(Layout.EN_US);

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <TransitionsLayer
        histogram={[
          [/* "a" */ 0x0061, /* "b" */ 0x0062, 1],
          [/* "b" */ 0x0062, /* "c" */ 0x0063, 2],
        ]}
      />
    </KeyboardContext.Provider>,
  );

  equal(arcs(r.container), 2);

  r.unmount();
});

test("fold the two directions of a pair into one arc", () => {
  const keyboard = loadKeyboard(Layout.EN_US);

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <TransitionsLayer
        histogram={[
          [/* "a" */ 0x0061, /* "b" */ 0x0062, 1],
          [/* "b" */ 0x0062, /* "a" */ 0x0061, 1],
        ]}
      />
    </KeyboardContext.Provider>,
  );

  // "ab" and "ba" join the same two keys, so drawing both would lay one arc
  // exactly over another and show the pair as two.
  equal(arcs(r.container), 1);

  r.unmount();
});

test("self arrow", () => {
  const keyboard = loadKeyboard(Layout.EN_US);

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <TransitionsLayer histogram={[[/* "a" */ 0x0061, /* "a" */ 0x0061, 1]]} />
    </KeyboardContext.Provider>,
  );

  equal(arcs(r.container), 0);

  r.unmount();
});
