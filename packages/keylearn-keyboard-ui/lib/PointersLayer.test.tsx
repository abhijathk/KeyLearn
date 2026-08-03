import { test } from "node:test";
import { KeyboardContext, Layout, loadKeyboard } from "@keylearn/keyboard";
import { act, render } from "@testing-library/react";
import { equal } from "rich-assert";
import { PointersLayer } from "./PointersLayer.tsx";

test("empty", (ctx) => {
  ctx.mock.timers.enable({ apis: ["setTimeout"] });

  const keyboard = loadKeyboard(Layout.EN_US);

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <PointersLayer suffix={[]} />
    </KeyboardContext.Provider>,
  );

  act(() => {
    ctx.mock.timers.runAll();
  });

  equal(r.container.querySelectorAll("rect").length, 0);

  r.unmount();
});

test("unknown", (ctx) => {
  ctx.mock.timers.enable({ apis: ["setTimeout"] });

  const keyboard = loadKeyboard(Layout.EN_US);

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <PointersLayer suffix={[0x0000]} />
    </KeyboardContext.Provider>,
  );

  act(() => {
    ctx.mock.timers.runAll();
  });

  equal(r.container.querySelectorAll("rect").length, 0);

  r.unmount();
});

test("without modifiers", (ctx) => {
  ctx.mock.timers.enable({ apis: ["setTimeout"] });

  const keyboard = loadKeyboard(Layout.EN_US);

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <PointersLayer suffix={[/* "a" */ 0x0061]} />
    </KeyboardContext.Provider>,
  );

  act(() => {
    ctx.mock.timers.runAll();
  });

  // the comet cue draws eight rects per key: rail, six tail layers, spark
  equal(r.container.querySelectorAll("rect").length, 8);

  r.unmount();
});

test("with modifiers", (ctx) => {
  ctx.mock.timers.enable({ apis: ["setTimeout"] });

  const keyboard = loadKeyboard(Layout.EN_US);

  const r = render(
    <KeyboardContext.Provider value={keyboard}>
      <PointersLayer suffix={[/* "A" */ 0x0041]} />
    </KeyboardContext.Provider>,
  );

  act(() => {
    ctx.mock.timers.runAll();
  });

  // eight comet rects for the key, plus one ring on the shift modifier
  equal(r.container.querySelectorAll("rect").length, 9);

  r.unmount();
});
