import { test } from "node:test";
import { Layout, loadKeyboard } from "@keylearn/keyboard";
import { GuidedLesson, kidsLetterOrder, lessonProps } from "@keylearn/lesson";
import { FakePhoneticModel, Letter } from "@keylearn/phonetic-model";
import { type KeyStats, type KeyStatsMap, speedToTime } from "@keylearn/result";
import { Settings } from "@keylearn/settings";
import { equal, isTrue } from "rich-assert";
import { KidsLesson } from "./kids-lesson.ts";

// `keylearn-lesson` keeps its own test fakes internal, so this builds the
// smallest stats map the engines actually read: a time-to-type per letter,
// derived from the target speed so that `confidence` lands exactly where the
// test wants it.
function statsMap(settings: Settings, at: Map<string, number>): KeyStatsMap {
  const speed = settings.get(lessonProps.targetSpeed);
  const map = new Map<unknown, KeyStats>(
    FakePhoneticModel.letters.map((letter) => {
      const confidence = at.get(letter.label.toLowerCase()) ?? 0;
      const timeToType =
        confidence === 0 ? null : speedToTime(speed) / confidence;
      return [
        letter,
        { letter, samples: [], timeToType, bestTimeToType: timeToType },
      ] as [unknown, KeyStats];
    }),
  );
  return {
    letters: [...FakePhoneticModel.letters],
    results: [],
    get: (letter: unknown) => (map as Map<unknown, KeyStats>).get(letter),
    [Symbol.iterator]: () => map.values(),
  } as unknown as KeyStatsMap;
}

// The order keys arrive in is not the model's own: for children it is the one
// that spells words early. The in-play six are the first six of THAT.
const order = kidsLetterOrder(
  Letter.frequencyOrder(FakePhoneticModel.letters),
).map((letter) => letter.label.toLowerCase());

function kidsSettings() {
  return new Settings()
    .set(lessonProps.guided.kidsWords, true)
    .set(lessonProps.guided.alphabetSize, 0);
}

// The bar is 0.8 of the goal. `hot` clears it, `cold` does not.
const hot = 1.2;
const cold = 0.4;

function unlockedCount(
  lesson: GuidedLesson | KidsLesson,
  settings: Settings,
  behind: number,
) {
  // Six keys are in play at alphabetSize 0. Put `behind` of them under the
  // bar and the rest comfortably over it.
  const at = new Map(
    order.slice(0, 6).map((letter, i) => [letter, i < behind ? cold : hot]),
  );
  return lesson.update(statsMap(settings, at)).findIncludedKeys().length;
}

test("one weak key does not lock the alphabet for a child", () => {
  const settings = kidsSettings();
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();
  const kids = new KidsLesson(settings, keyboard, model, []);
  const grownUp = new GuidedLesson(settings, keyboard, model, []);

  // Everyone up to speed: both engines hand out the next letter.
  isTrue(unlockedCount(kids, settings, 0) > 6);
  isTrue(unlockedCount(grownUp, settings, 0) > 6);

  // ONE key behind. This is the whole difference: the shared engine stops
  // dead at six, the kids engine carries on.
  equal(unlockedCount(grownUp, settings, 1), 6);
  isTrue(unlockedCount(kids, settings, 1) > 6);
});

test("two weak keys still hold the alphabet — the bar has not moved", () => {
  const settings = kidsSettings();
  const kids = new KidsLesson(
    settings,
    loadKeyboard(Layout.EN_US),
    new FakePhoneticModel(),
    [],
  );

  // A child who is behind on two letters has not earned a third. Were this
  // to pass, the rule would be a giveaway rather than a forgiveness.
  equal(unlockedCount(kids, settings, 2), 6);
  equal(unlockedCount(kids, settings, 3), 6);
});

test("a forgiven key is not a forgotten one", () => {
  const settings = kidsSettings();
  const kids = new KidsLesson(
    settings,
    loadKeyboard(Layout.EN_US),
    new FakePhoneticModel(),
    [],
  );

  // Every letter up to speed but one. There is nothing left to unlock, so
  // the excused key is the weakest thing in play — and that is what the next
  // passage gets built around. Forgiveness buys a child the rest of the
  // alphabet; it does not let the weak letter drop out of practice.
  const at = new Map(order.map((letter) => [letter, hot]));
  at.set(order[2]!, cold);

  const keys = kids.update(statsMap(settings, at));
  const focused = keys.findIncludedKeys().find((key) => key.isFocused);
  equal(focused?.letter.label.toLowerCase(), order[2]);
});

test("the lesson never focuses a key that already passes", () => {
  const settings = kidsSettings();
  const kids = new KidsLesson(
    settings,
    loadKeyboard(Layout.EN_US),
    new FakePhoneticModel(),
    [],
  );

  // One behind, so a new letter arrives this update. Whichever key ends up
  // focused — the arrival at zero or the laggard — it must be one that is
  // actually behind, never a key the child has already earned.
  const at = new Map(order.slice(0, 6).map((letter) => [letter, hot]));
  at.set(order[2]!, cold);

  const keys = kids.update(statsMap(settings, at));
  const focused = keys.findIncludedKeys().find((key) => key.isFocused);
  isTrue(focused != null);
  isTrue((focused!.confidence ?? 0) < 0.8, `focused ${focused!.letter.label}`);
});
