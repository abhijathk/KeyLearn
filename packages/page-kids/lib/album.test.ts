import { test } from "node:test";
import { equal, isNotNull, isNull, isTrue } from "rich-assert";
import {
  catalogue,
  earn,
  HATCHLINGS,
  loadAlbum,
  MILESTONES,
  nextHatchling,
} from "./album.ts";

// The album lives in localStorage, which node does not have.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

test("there is always a next companion, the whole way along", () => {
  for (const world of ["dino", "hero"] as const) {
    const table = HATCHLINGS[world];
    isTrue(table.length >= 5, `${world} has ${table.length} companions`);
    // The old pair were both earned between the eighth and tenth key, so a
    // child past ten keys had nothing left to collect for the rest of the
    // alphabet. Nothing may sit more than five keys from the one before it.
    let prev = 0;
    for (const { at } of table) {
      isTrue(at - prev <= 5, `${world}: a ${at - prev} key gap before ${at}`);
      prev = at;
    }
    // And the first one comes early enough that a beginner reaches it.
    isTrue(table[0].at <= 5, `${world} makes them wait ${table[0].at} keys`);
  }
});

test("the hero world is not left without rewards", () => {
  // It is the default world for the two youngest bands, and it used to have no
  // earnable characters at all.
  isTrue(HATCHLINGS.hero.length > 0);
});

test("a sticker is earned once, and remembered", () => {
  store.clear();
  const first = earn("Vela");
  isNotNull(first, "new");
  isTrue("Vela" in first!);
  isNull(earn("Vela"), "already had it — no second fuss");
  isTrue("Vela" in loadAlbum(), "and it survives a reload");
});

test("junk in the storage slot does not take the page down", () => {
  store.clear();
  store.set([...store.keys()][0] ?? "x", "x");
  // Whatever key it lands under, a non-object value must read as empty.
  for (const bad of ["not json", "[1,2,3]", "null", '"a string"']) {
    store.clear();
    const probe = earn("probe")!;
    const key = [...store.keys()][0];
    store.set(key, bad);
    equal(Object.keys(loadAlbum()).length, 0, `for ${bad}`);
    isTrue(probe != null);
  }
});

test("the album shows what is still out there, not only what is held", () => {
  const all = catalogue("dino");
  isTrue(all.length > HATCHLINGS.dino.length, "lands and milestones too");
  // Every outline has to say how it is earned, or it is just a locked box.
  isTrue(all.every(({ hint }) => hint !== ""));
});

test("the next egg is the next one not yet reached", () => {
  equal(nextHatchling("dino", 0)!.at, 4);
  equal(nextHatchling("dino", 4)!.at, 8);
  isNull(nextHatchling("dino", 99), "once they are all out");
});

test("the trail has somewhere to go after the last letter", () => {
  // Finishing the alphabet used to be the end of the page: no marker, no next
  // thing, and no mention that a grown-up page existed.
  const end = MILESTONES.find(({ id }) => id === "alphabet");
  isNotNull(end, "the whole alphabet is a moment worth keeping");
});

test("the album rewards turning up, not typing fast", () => {
  // A slow child who practises daily must be able to fill this. Nothing in it
  // may be gated on speed.
  isTrue(
    MILESTONES.every(({ hint }) => !/wpm|fast|speed|minute/i.test(hint)),
    "a milestone is asking for speed",
  );
});
