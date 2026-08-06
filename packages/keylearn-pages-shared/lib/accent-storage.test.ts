import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import { canChooseAccent, loadAccent, saveAccent } from "./accent-storage.ts";
import { saveActiveProfileId } from "./profile-storage.ts";

const ABHIJATH = {
  id: "p1",
  kind: "adult",
  firstName: "Abhijath",
  visionSupport: false,
};
const BRAILLE = {
  id: "p2",
  kind: "adult",
  firstName: "Braille",
  visionSupport: true,
};
const DHEV = { id: "p3", kind: "kid", firstName: "Dhev", visionSupport: false };

function asAccount(signedIn: boolean, active: string | null = null) {
  // localStorage first: saveActiveProfileId keys off the account id, so the
  // page data has to be in place before anything is written.
  localStorage.clear();
  (globalThis as any)["__PAGE_DATA__"] = {
    publicUser: signedIn ? { id: "u1", name: "Abhijath" } : {},
    profiles: signedIn ? [ABHIJATH, BRAILLE, DHEV] : [],
  };
  saveActiveProfileId(active);
}

test("a signed-out visitor always gets the signature mint", () => {
  asAccount(false);
  isFalse(canChooseAccent());
  equal(loadAccent(), "keylearn");
  // Nothing is stored, so a shared machine cannot leak one visitor's choice
  // to the next person at the keyboard.
  isFalse(saveAccent("sepia"));
  equal(loadAccent(), "keylearn");
});

test("one accent per learner", () => {
  asAccount(true, ABHIJATH.id);
  isTrue(canChooseAccent());

  isTrue(saveAccent("sepia", ABHIJATH.id));
  isTrue(saveAccent("bubblegum", DHEV.id));

  equal(loadAccent(ABHIJATH.id), "sepia");
  equal(loadAccent(DHEV.id), "bubblegum");
  // Untouched learners keep the default for their kind, not each other's.
  equal(loadAccent(BRAILLE.id), "keylearn");
});

test("the learner at the keyboard is the default subject", () => {
  asAccount(true, DHEV.id);
  isTrue(saveAccent("dino-blue"));
  equal(loadAccent(), "dino-blue");
  equal(loadAccent(DHEV.id), "dino-blue");
  // And switching learners switches whose accent applies.
  saveActiveProfileId(ABHIJATH.id);
  equal(loadAccent(), "keylearn");
});

test("a braille learner gets the grown-up list", () => {
  // Adult and braille profiles are both kind: "adult", so braille needs no
  // special case — the whole point of keying the list on kind.
  asAccount(true, BRAILLE.id);
  isTrue(saveAccent("cerulean", BRAILLE.id));
  equal(loadAccent(BRAILLE.id), "cerulean");
  isFalse(saveAccent("sunbeam", BRAILLE.id));
});

test("a learner cannot be given another kind's accent", () => {
  asAccount(true, ABHIJATH.id);
  isFalse(saveAccent("trail-green", ABHIJATH.id));
  equal(loadAccent(ABHIJATH.id), "keylearn");
  isFalse(saveAccent("amethyst", DHEV.id));
  equal(loadAccent(DHEV.id), "trail-green");
});

test("a stored accent the learner may not wear is ignored, not honoured", () => {
  // A profile that was edited from grown-up to kid would otherwise keep an
  // academic colour a child was never offered.
  asAccount(true, ABHIJATH.id);
  localStorage.setItem(`profile-${DHEV.id}.keylearn.accent`, "sepia");
  equal(loadAccent(DHEV.id), "trail-green");
});

test("an accent that no longer exists falls back", () => {
  asAccount(true, ABHIJATH.id);
  localStorage.setItem(`profile-${ABHIJATH.id}.keylearn.accent`, "amber");
  equal(loadAccent(ABHIJATH.id), "keylearn");
});

test("a signed-in account with no learner selected still has a slot", () => {
  // profileStorageKey returns the bare key when nothing is selected, which is
  // how every other per-learner preference behaves — one code path, not two.
  asAccount(true, null);
  isTrue(saveAccent("crimson"));
  equal(loadAccent(), "crimson");
  equal(localStorage.getItem("keylearn.accent"), "crimson");
});
