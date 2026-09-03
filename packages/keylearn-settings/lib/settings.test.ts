import { test } from "node:test";
import { deepEqual, equal, throws } from "rich-assert";
import { stringProp } from "./props.ts";
import { Settings } from "./settings.ts";

test("validate arguments", () => {
  // @ts-expect-error Test invalid arguments.
  throws(() => new Settings(null));
  // @ts-expect-error Test invalid arguments.
  throws(() => new Settings([]));
  // @ts-expect-error Test invalid arguments.
  throws(() => new Settings(new Map()));
});

test("defaults", () => {
  const a = stringProp("prop.a", "a");
  const b = stringProp("prop.b", "b");
  const c = stringProp("prop.c", "c");

  equal(new Settings().get(a), "a");
  equal(new Settings().get(b), "b");
  equal(new Settings().get(c), "c");

  Settings.addDefaults(new Settings().set(a, "a0"));
  Settings.addDefaults(new Settings().set(b, "b0"));
  Settings.addDefaults(new Settings().set(a, "a1"));

  equal(new Settings().get(a), "a1");
  equal(new Settings().get(b), "b0");
  equal(new Settings().get(c), "c");

  deepEqual(
    Object.keys(
      new Settings() //
        .set(b, "b0")
        .set(c, "c")
        .toJSON(),
    ),
    ["prop.b", "prop.c"],
  );
});

test("to json sorts keys", () => {
  const x = stringProp("prop.x", "x");
  const y = stringProp("prop.y", "y");
  const z = stringProp("prop.z", "z");

  deepEqual(
    Object.keys(
      new Settings() //
        .set(z, "3")
        .set(x, "1")
        .set(y, "2")
        .toJSON(),
    ),
    ["prop.x", "prop.y", "prop.z"],
  );
});

test("forced values win over the learner's own, without touching it", () => {
  const f = stringProp("prop.f", "f");
  const own = new Settings().set(f, "mine");
  equal(own.get(f), "mine");
  Settings.setForced(new Settings().set(f, "site"), ["prop.f"]);
  equal(own.get(f), "site", "the site decides while forced");
  equal(Settings.isForced(f), true);
  equal(Settings.isHidden(f), true);
  equal(own.toJSON()["prop.f"], "mine", "the learner's own value is kept");
  Settings.setForced(new Settings());
  equal(own.get(f), "mine", "lifting the override gives it back");
  equal(Settings.isForced(f), false);
});
