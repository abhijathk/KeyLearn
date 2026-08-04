import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import { defaultPrefs, GOALS, loadPrefs, RATES, savePrefs } from "./prefs.ts";

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

test("preferences survive a visit", () => {
  // They did not, and on this page that matters more than it sounds: somebody
  // who runs a voice at three times speed had to find and re-set the rate at
  // the start of every session, in an interface they navigate by ear.
  store.clear();
  savePrefs({ ...defaultPrefs, rate: 2.5, mode: "listening" }, "p1");
  const back = loadPrefs("p1");
  equal(back.rate, 2.5);
  equal(back.mode, "listening");
});

test("one learner's settings are not another's", () => {
  store.clear();
  savePrefs({ ...defaultPrefs, rate: 3 }, "p1");
  equal(loadPrefs("p2").rate, defaultPrefs.rate);
});

test("a silent rate is never loaded", () => {
  // A rate of zero is a page that has gone quiet with no way to work out why,
  // for somebody who cannot see that a control is at its minimum.
  store.clear();
  savePrefs({ ...defaultPrefs, rate: 0 }, "p1");
  isTrue(loadPrefs("p1").rate >= 0.5, "a rate must stay audible");
  savePrefs({ ...defaultPrefs, rate: 99 }, "p1");
  isTrue(loadPrefs("p1").rate <= 4);
});

test("rubbish in storage falls back rather than throwing", () => {
  store.clear();
  for (const bad of ["not json", "null", "[1,2]", '{"mode":"sideways"}']) {
    store.set("keylearn.braille.prefs.p1", bad);
    const back = loadPrefs("p1");
    equal(back.mode, defaultPrefs.mode, `for ${bad}`);
    isTrue(back.rate > 0);
  }
});

test("the rates offered span what this audience actually uses", () => {
  // Screen reader users habitually run at two to three times conversational
  // speed; a list that stopped at 1.5 would be no use to most of them.
  isTrue(RATES.includes(1), "conversational has to be there");
  isTrue(Math.max(...RATES) >= 3, `fastest offered is ${Math.max(...RATES)}`);
  isTrue(Math.min(...RATES) < 1, "and slower, for somebody starting out");
});

test("the daily goal defaults to a braille-sized one", () => {
  // Half what the grown-up page asks for. Chording six keys at once is slower
  // and more effortful than typing, so half an hour of it is not the same ask.
  equal(defaultPrefs.goalMinutes, 15);
  isTrue(GOALS.includes(0), "and it must be possible to want no goal at all");
  isTrue(GOALS.includes(15));
});

test("a goal survives a visit, per learner", () => {
  store.clear();
  savePrefs({ ...defaultPrefs, goalMinutes: 30 }, "p1");
  equal(loadPrefs("p1").goalMinutes, 30);
  equal(loadPrefs("p2").goalMinutes, defaultPrefs.goalMinutes);
});

test("a nonsense goal falls back rather than being believed", () => {
  store.clear();
  for (const bad of [-5, 1e9, Number.NaN]) {
    savePrefs({ ...defaultPrefs, goalMinutes: bad }, "p1");
    const back = loadPrefs("p1").goalMinutes;
    isTrue(back >= 0 && back <= 120, `${bad} loaded as ${back}`);
  }
});
