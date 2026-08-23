import { deepEqual } from "node:assert/strict";
import { test } from "node:test";
import { render } from "@testing-library/react";
import { LoadingProgress } from "./LoadingProgress.tsx";

/**
 * Reaching the practice page crosses four loading gates in sequence — the
 * route's Suspense while the chunk downloads, LessonLoader while the model
 * arrives, then ProgressUpdater. Each renders its own LoadingProgress, so
 * each is a fresh mount, and each used to restart the 200ms hold-back from
 * zero. The page was blank for 200ms between every pair of gates, which is
 * what a person sees as the loader blinking three or four times.
 *
 * These pin the rule that fixed it: once a loader has actually been on
 * screen, the next one continues it rather than starting over — but a gate
 * that resolved inside the hold-back showed nothing, and must not persuade
 * the next one that anything is already visible.
 */

const isContinuing = (el: HTMLElement) =>
  (el.firstElementChild?.className ?? "").includes("continuing");

/** The gap the component treats as "the same wait" is 500ms. */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Let any stamp from the previous test expire.
 *
 * "Was a loader on screen a moment ago" is deliberately module-level state —
 * that is the whole mechanism, since the gates are separate elements at
 * separate positions in the tree with nothing else in common. It therefore
 * survives between tests, and a test that wants a cold start has to wait one
 * out rather than reach in and reset it. Using the real rule here also means
 * these tests would notice if SAME_WAIT_MS changed underneath them.
 */
const freshStart = () => wait(650);

test("the first loader of a wait is held back", async () => {
  await freshStart();
  const r = render(<LoadingProgress />);
  deepEqual(isContinuing(r.container), false);
  r.unmount();
});

test("a loader that was visible makes the next one continue it", async () => {
  await freshStart();
  const first = render(<LoadingProgress />);
  // Long enough to have faded in — this is a gate a person saw.
  await wait(260);
  first.unmount();

  const second = render(<LoadingProgress />);
  deepEqual(
    isContinuing(second.container),
    true,
    "the second gate should pick up where the first left off, not restart the hold-back",
  );
  second.unmount();
});

test("a gate that resolved before becoming visible does not", async () => {
  await freshStart();
  const quick = render(<LoadingProgress />);
  // Under the 200ms hold-back: nothing was ever painted.
  await wait(60);
  quick.unmount();

  const next = render(<LoadingProgress />);
  deepEqual(
    isContinuing(next.container),
    false,
    "a chain of fast gates must still show nothing — otherwise the hold-back is defeated",
  );
  next.unmount();
});

test("a genuinely separate wait starts over", async () => {
  await freshStart();
  const first = render(<LoadingProgress />);
  await wait(260);
  first.unmount();

  // Longer than the 500ms that counts as the same wait.
  await wait(650);

  const later = render(<LoadingProgress />);
  deepEqual(
    isContinuing(later.container),
    false,
    "an unrelated load later on is a new wait and earns its own hold-back",
  );
  later.unmount();
});

const barWidth = (el: HTMLElement) =>
  (el.querySelector("[role=progressbar] i") as HTMLElement | null)?.style
    .inlineSize ?? "";

test("one bar advances across the whole sequence", async () => {
  await freshStart();

  const first = render(<LoadingProgress />);
  const atStart = barWidth(first.container);
  await wait(260);
  first.unmount();

  const second = render(<LoadingProgress />);
  const afterOne = barWidth(second.container);
  await wait(260);
  second.unmount();

  const third = render(<LoadingProgress />);
  const afterTwo = barWidth(third.container);
  third.unmount();

  const pct = (s: string) => Number.parseFloat(s);
  deepEqual(
    pct(atStart) === 0,
    true,
    `the first gate starts at zero, got ${atStart}`,
  );
  deepEqual(
    pct(afterOne) > pct(atStart) && pct(afterTwo) > pct(afterOne),
    true,
    `the bar must only ever move forward: ${atStart} → ${afterOne} → ${afterTwo}`,
  );
  deepEqual(
    pct(afterTwo) < 100,
    true,
    "a guessed bar must never claim to have finished while the page is still loading",
  );
});

test("a gate with real numbers overrides the estimate", async () => {
  await freshStart();
  const r = render(<LoadingProgress total={4} current={1} />);
  deepEqual(barWidth(r.container), "25%");
  deepEqual(
    r.container
      .querySelector("[role=progressbar]")
      ?.getAttribute("aria-valuenow"),
    "25",
    "a measured figure is announced; an inferred one is not",
  );
  r.unmount();
});

test("an inferred bar is not announced as a value", async () => {
  await freshStart();
  const r = render(<LoadingProgress />);
  deepEqual(
    r.container
      .querySelector("[role=progressbar]")
      ?.hasAttribute("aria-valuenow"),
    false,
  );
  r.unmount();
});
