import { test } from "node:test";
import { FakePhoneticModel } from "@keylearn/phonetic-model";
import { type KeyStats, speedToTime } from "@keylearn/result";
import { Settings } from "@keylearn/settings";
import { equal, isTrue, throws } from "rich-assert";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";

const { letter1 } = FakePhoneticModel;

test("time to confidence", () => {
  const settings = new Settings().set(lessonProps.targetSpeed, /* 50WPM */ 250);
  const target = new Target(settings);
  throws(() => target.confidence(NaN));
  throws(() => target.confidence(0));
  equal(target.confidence(1000 / (500 / 60)), 2.0);
  equal(target.confidence(1000 / (250 / 60)), 1.0);
  equal(target.confidence(1000 / (125 / 60)), 0.5);
});

test("keyConfidence defaults to the classic speed ratio", () => {
  const settings = new Settings().set(lessonProps.targetSpeed, 250);
  const target = new Target(settings);
  const stats = keyStats({
    timeToType: 1000 / (250 / 60),
    bestTimeToType: 1000 / (500 / 60),
    samples: [],
  });
  const { confidence, bestConfidence } = target.keyConfidence(stats);
  equal(confidence, 1.0);
  equal(bestConfidence, 2.0);
});

test("smartConfidence rewards a fast+accurate history with mastery", () => {
  const settings = new Settings()
    .set(lessonProps.targetSpeed, 250)
    .set(lessonProps.guided.smartConfidence, true)
    // Isolate BKT: no decay factor multiplying the posterior.
    .set(lessonProps.guided.skillDecay, false);
  const target = new Target(settings);
  const samples = Array.from({ length: 8 }, () =>
    sample({ timeStamp: 0, timeToType: 180, hitCount: 10, missCount: 0 }),
  );
  const { confidence } = target.keyConfidence(keyStats({ samples }));
  isTrue((confidence ?? 0) >= 1);
});

test("smartConfidence withholds mastery from a fast-but-sloppy history", () => {
  const settings = new Settings()
    .set(lessonProps.targetSpeed, 250)
    .set(lessonProps.guided.smartConfidence, true);
  const target = new Target(settings);
  const samples = Array.from({ length: 8 }, () =>
    sample({ timeStamp: 0, timeToType: 180, hitCount: 6, missCount: 4 }),
  );
  const { confidence } = target.keyConfidence(keyStats({ samples }));
  isTrue((confidence ?? 1) < 1);
});

test("smartConfidence lets accuracy separate two learners of equal speed", () => {
  // What the blend is actually for. Both of these type the key at exactly the
  // target speed, so the classic ratio cannot tell them apart at all — one is
  // clean and the other misses one press in four.
  //
  // This used to be tested by handing the key a stored average that disagreed
  // with its own samples (400ms stored, 180ms in every sample), which is not a
  // state a real learner can be in — and reading that stale average instead of
  // the samples was the bug that made progress take thirty lessons to register.
  const settings = new Settings()
    .set(lessonProps.targetSpeed, 250)
    .set(lessonProps.guided.smartConfidence, true)
    .set(lessonProps.guided.skillDecay, false);
  const target = new Target(settings);
  const atTarget = speedToTime(250);
  const history = (missCount: number) =>
    Array.from({ length: 8 }, () =>
      sample({
        timeStamp: 0,
        timeToType: atTarget,
        hitCount: 30,
        missCount,
      }),
    );

  const clean = target.keyConfidence(
    keyStats({ timeToType: atTarget, samples: history(0) }),
  ).confidence;
  const sloppy = target.keyConfidence(
    keyStats({ timeToType: atTarget, samples: history(10) }),
  ).confidence;

  isTrue((clean ?? 0) > (sloppy ?? 0), "accuracy has to count for something");
  // And the speed ratio stays dominant: missing presses costs the sloppy one
  // real confidence, but does not erase a key they can genuinely type.
  isTrue((sloppy ?? 0) > 0.5, `a third of the way down, not wiped out`);
});

const day = 24 * 60 * 60 * 1000;

test("time away never changes what a key is worth", () => {
  // Forgetting used to be multiplied into the confidence, so a key came back
  // the next morning visibly duller than it was left — and hardest hit were the
  // keys still being learned, because misses shortened their half-life. What a
  // key is worth is now decided by how it was typed, and by nothing else.
  const base = new Settings()
    .set(lessonProps.targetSpeed, 250)
    .set(lessonProps.guided.skillDecay, false);
  const decayed = new Settings()
    .set(lessonProps.targetSpeed, 250)
    .set(lessonProps.guided.skillDecay, true);
  const samples = [
    ...Array.from({ length: 3 }, () =>
      sample({ timeStamp: 0, timeToType: 180, hitCount: 10, missCount: 3 }),
    ),
    ...Array.from({ length: 3 }, () =>
      sample({ timeStamp: 0, timeToType: 180, hitCount: 10, missCount: 0 }),
    ),
  ];
  const stats = keyStats({ timeToType: 180, bestTimeToType: 180, samples });
  for (const now of [0, day, 90 * day]) {
    const plain = new Target(base, now).keyConfidence(stats).confidence ?? 0;
    const other = new Target(decayed, now).keyConfidence(stats).confidence ?? 0;
    equal(other, plain, `confidence moved after ${now / day} days away`);
  }
});

test("recall fades with time away, and is what schedules review", () => {
  const settings = new Settings()
    .set(lessonProps.targetSpeed, 250)
    .set(lessonProps.guided.skillDecay, true);
  const samples = Array.from({ length: 6 }, () =>
    sample({ timeStamp: 0, timeToType: 180, hitCount: 10, missCount: 0 }),
  );
  const stats = keyStats({ timeToType: 180, bestTimeToType: 180, samples });
  const fresh = new Target(settings, 0).recall(stats);
  const overnight = new Target(settings, day).recall(stats);
  const months = new Target(settings, 90 * day).recall(stats);
  equal(fresh, 1);
  // A night away costs almost nothing; a season away costs a great deal. That
  // ordering is the whole point, and the overnight figure is what the previous
  // parameters got wrong.
  isTrue(overnight > 0.95, `overnight recall was ${overnight}`);
  isTrue(months < overnight);
});

test("switching decay off leaves recall neutral", () => {
  const settings = new Settings()
    .set(lessonProps.targetSpeed, 250)
    .set(lessonProps.guided.skillDecay, false);
  const samples = Array.from({ length: 6 }, () =>
    sample({ timeStamp: 0, timeToType: 180, hitCount: 10, missCount: 0 }),
  );
  const stats = keyStats({ timeToType: 180, bestTimeToType: 180, samples });
  equal(new Target(settings, 90 * day).recall(stats), 1);
});

function keyStats({
  timeToType = null,
  bestTimeToType = null,
  samples = [],
}: {
  timeToType?: number | null;
  bestTimeToType?: number | null;
  samples?: KeyStats["samples"];
}): KeyStats {
  return { letter: letter1, samples, timeToType, bestTimeToType };
}

function sample({
  timeStamp,
  timeToType,
  hitCount,
  missCount,
}: {
  timeStamp: number;
  timeToType: number;
  hitCount: number;
  missCount: number;
}) {
  return {
    index: 0,
    timeStamp,
    hitCount,
    missCount,
    timeToType,
    filteredTimeToType: timeToType,
  };
}

test("the unlock gate asks for the target speed, and nothing more", () => {
  // `bestConfidence` gates whether a new letter is introduced, and it means one
  // thing: this key was once typed at the target speed. Blending the accuracy
  // posterior into it used to raise that bar without saying so — at a posterior
  // of 0.5 the gate silently wanted 1.19x the target — so a learner practising
  // steadily but not brilliantly was never given a new letter.
  const settings = new Settings()
    .set(lessonProps.targetSpeed, 250)
    .set(lessonProps.guided.smartConfidence, true);
  // Reached the target exactly, with enough misses to keep the posterior low.
  const samples = Array.from({ length: 8 }, () =>
    sample({ timeStamp: 0, timeToType: 240, hitCount: 8, missCount: 4 }),
  );
  const atTarget = speedToTime(250);
  const stats = keyStats({
    timeToType: 240,
    bestTimeToType: atTarget,
    samples,
  });
  const { confidence, bestConfidence } = new Target(settings, 0).keyConfidence(
    stats,
  );
  isTrue(
    (bestConfidence ?? 0) >= 1,
    `hit the target but the gate said ${bestConfidence}`,
  );
  // Accuracy still has a say in the live figure, which is what drives which key
  // is focused and how it is coloured.
  isTrue((confidence ?? 0) < (bestConfidence ?? 0));
});
