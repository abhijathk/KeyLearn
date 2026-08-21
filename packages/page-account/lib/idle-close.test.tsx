import { afterEach, test } from "node:test";
import { act, cleanup, render } from "@testing-library/react";
import { type ReactNode } from "react";
import { equal, isTrue } from "rich-assert";
import { useIdleClose } from "./AccountPage.tsx";

/**
 * The account window closes itself when nobody is there, and closing is
 * what hands the support PIN back. If this timer is wrong the lock is
 * wrong, so it is worth pinning down.
 *
 * Run in milliseconds rather than minutes by passing the durations in.
 * The alternative — faking `Date.now` and `setInterval` — fights React's
 * own scheduler, which uses both.
 */

// node:test does not run testing-library's auto-cleanup, so renders pile
// up in the same document and every query finds several of them.
afterEach(cleanup);

const CLOSE = 400;
const WARN = 200;
const TICK = 20;

function Probe({ onIdle }: { readonly onIdle: () => void }): ReactNode {
  const remaining = useIdleClose(onIdle, CLOSE, WARN, TICK);
  return <span data-testid="left">{remaining == null ? "-" : "warning"}</span>;
}

const wait = (ms: number) =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

test("it closes once nobody has been there for the whole window", async () => {
  let closed = 0;
  const r = render(<Probe onIdle={() => closed++} />);

  await wait(CLOSE - WARN - TICK * 3);
  equal(closed, 0);
  equal(r.getByTestId("left").textContent, "-", "no warning yet");

  await wait(WARN);
  equal(r.getByTestId("left").textContent, "warning", "counting down");
  equal(closed, 0, "still open while it warns");

  await wait(WARN + TICK * 3);
  equal(closed, 1);
});

test("activity resets it, and withdraws a warning already showing", async () => {
  let closed = 0;
  const r = render(<Probe onIdle={() => closed++} />);

  await wait(CLOSE - WARN + TICK * 2);
  equal(r.getByTestId("left").textContent, "warning", "warning showing");

  // Somebody is there after all.
  await act(async () => {
    window.dispatchEvent(new window.Event("pointermove"));
  });
  await wait(TICK * 3);
  equal(r.getByTestId("left").textContent, "-", "warning withdrawn");
  equal(closed, 0, "the clock restarted from the movement");
});

test("reading counts as being there", async () => {
  let closed = 0;
  render(<Probe onIdle={() => closed++} />);
  // Somebody working through a long thread may never move the mouse, so
  // scrolling has to count or the window closes under them.
  for (let i = 0; i < 6; i++) {
    await wait(CLOSE - WARN);
    await act(async () => {
      window.dispatchEvent(new window.Event("scroll"));
    });
  }
  equal(closed, 0);
});

test("it closes once, not once per late tick", async () => {
  // A background tab throttles the interval, so it fires late and in a
  // burst on the way back — the close must not run per tick.
  let closed = 0;
  render(<Probe onIdle={() => closed++} />);
  await wait(CLOSE * 3);
  equal(closed, 1);
});

test("it stops listening once the window is gone", async () => {
  let closed = 0;
  const r = render(<Probe onIdle={() => closed++} />);
  r.unmount();
  await new Promise<void>((resolve) => setTimeout(resolve, CLOSE * 2));
  equal(closed, 0, "an unmounted window must not close anything");
  isTrue(true);
});
