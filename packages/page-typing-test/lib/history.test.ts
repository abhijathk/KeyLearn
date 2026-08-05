import { test } from "node:test";
import { equal, isNotNull, isNull } from "rich-assert";
import { loadSummary, recordTest, type SpeedTestRecord } from "./history.ts";

const PAGE_DATA = "__PAGE_DATA__";

/**
 * Runs a block as one learner.
 *
 * The storage namespace comes from the active profile, which is read from page
 * data and localStorage — so a test about learner separation has to set both.
 */
function asProfile(id: string | null, run: () => void): void {
  const had = (globalThis as any)[PAGE_DATA];
  (globalThis as any)[PAGE_DATA] = {
    publicUser: { id: "acct" },
    profiles: [
      { id: "1", birthYear: null },
      { id: "2", birthYear: null },
    ],
  };
  if (id == null) {
    localStorage.removeItem("keylearn.activeProfile.acct");
  } else {
    localStorage.setItem("keylearn.activeProfile.acct", id);
  }
  try {
    run();
  } finally {
    (globalThis as any)[PAGE_DATA] = had;
    localStorage.removeItem("keylearn.activeProfile.acct");
  }
}

const run = (cpm: number): SpeedTestRecord => ({
  ts: Date.now(),
  cpm,
  accuracy: 1,
  mode: "time",
  lengthLabel: "30s",
  chars: 100,
  errors: 0,
});

test("one learner's speed test never becomes another's personal best", () => {
  localStorage.clear();
  // The bug this covers: the history used one flat key for the whole device,
  // so a child's run set the parent's record, and a learner opening the Speed
  // Test for the first time was greeted by somebody else's best.
  asProfile("1", () => {
    recordTest(run(600));
    equal(loadSummary().best?.cpm, 600);
  });

  asProfile("2", () => {
    const summary = loadSummary();
    isNull(summary.best, "a new learner starts with no record at all");
    equal(summary.count, 0);
  });
});

test("each learner keeps their own record", () => {
  localStorage.clear();
  asProfile("1", () => {
    recordTest(run(500));
  });
  asProfile("2", () => {
    recordTest(run(300));
    equal(loadSummary().best?.cpm, 300);
  });
  asProfile("1", () => {
    equal(loadSummary().best?.cpm, 500, "the first learner's record is intact");
  });
});

test("the day streak counts the learner's own days, not the household's", () => {
  localStorage.clear();
  asProfile("1", () => {
    recordTest(run(400));
    equal(loadSummary().streakDays, 1);
  });
  asProfile("2", () => {
    equal(loadSummary().streakDays, 0, "somebody else practising is not a day");
  });
});

test("an anonymous visitor still gets a history", () => {
  localStorage.clear();
  // No profile selected is the signed-out case, and that visitor's runs are
  // their own — the fallback must work, not throw.
  asProfile(null, () => {
    recordTest(run(250));
    isNotNull(loadSummary().best);
    equal(loadSummary().best?.cpm, 250);
  });
});
