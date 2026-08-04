import { test } from "node:test";
import { equal } from "rich-assert";
import { practiceRedirect, practiceSurfaceOf } from "./surface.ts";

const kid = { kind: "kid", visionSupport: false };
const adult = { kind: "adult", visionSupport: false };
const braille = { kind: "adult", visionSupport: true };
const brailleKid = { kind: "kid", visionSupport: true };

test("each learner has exactly one surface, and vision support wins", () => {
  equal(practiceSurfaceOf(kid), "kids");
  equal(practiceSurfaceOf(adult), "adult");
  equal(practiceSurfaceOf(braille), "braille");
  equal(practiceSurfaceOf(brailleKid), "braille");
});

test("a kid never reaches an adult drill, in either spelling of it", () => {
  equal(practiceRedirect(kid, "/"), "/kids");
  equal(practiceRedirect(kid, "/typing-test"), "/kids");
  equal(practiceRedirect(kid, "/braille"), "/kids");
  equal(practiceRedirect(kid, "/kids"), null);
});

test("a grown-up never lands in the kids game or in braille", () => {
  equal(practiceRedirect(adult, "/kids"), "/");
  equal(practiceRedirect(adult, "/braille"), "/");
  equal(practiceRedirect(adult, "/"), null);
  equal(practiceRedirect(adult, "/typing-test"), null);
});

test("a learner on vision support only ever sees braille", () => {
  equal(practiceRedirect(braille, "/"), "/braille");
  equal(practiceRedirect(braille, "/kids"), "/braille");
  equal(practiceRedirect(braille, "/typing-test"), "/braille");
  equal(practiceRedirect(braille, "/braille"), null);
});

test("non-drill pages are never redirected", () => {
  // The profile, account and help pages belong to everyone; the guard only
  // owns the drills themselves.
  for (const p of [kid, adult, braille]) {
    equal(practiceRedirect(p, "/profile"), null);
    equal(practiceRedirect(p, "/account"), null);
    equal(practiceRedirect(p, "/help"), null);
  }
});

test("with no learner selected nothing is restricted", () => {
  // Anonymous practice, and the admin between profiles, keep the old
  // behaviour on every page.
  equal(practiceRedirect(null, "/"), null);
  equal(practiceRedirect(null, "/kids"), null);
  equal(practiceRedirect(null, "/braille"), null);
});
