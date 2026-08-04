import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import { showAds } from "./ads.ts";

const grownUpOnPractice = {
  adNetworkConfigured: true,
  path: "/",
  activeProfileKind: "adult",
  storedMode: "grown-ups",
};

test("a grown-up on a grown-up page is the only case that shows an ad", () => {
  isTrue(showAds(grownUpOnPractice));
});

test("the kids page never shows an ad, whatever is remembered", () => {
  // The old gate consulted only the stored mode, which is written just once —
  // when somebody uses the drawer's switch. A household that never touched it,
  // or switched back to grown-ups once, got an ad slot on the kids page.
  for (const storedMode of ["grown-ups", null, "", "kids"]) {
    isFalse(
      showAds({ ...grownUpOnPractice, path: "/kids", storedMode }),
      `stored mode ${JSON.stringify(storedMode)} still reached the kids page`,
    );
  }
});

test("a child learner is ad-free on every page", () => {
  // A kid profile is guarded onto the kids page, but that guard is client-side
  // and this must not depend on it holding.
  for (const path of ["/", "/kids", "/profile", "/texts", "/help"]) {
    isFalse(
      showAds({
        ...grownUpOnPractice,
        path,
        activeProfileKind: "kid",
      }),
      `a child saw an ad on ${path}`,
    );
  }
});

test("an unreadable storage setting does not grant ads", () => {
  // The old gate returned true when localStorage threw — private mode and
  // embedded webviews both do. Failing open put ads on the kids page of every
  // browser that blocks storage.
  isFalse(
    showAds({
      ...grownUpOnPractice,
      path: "/kids",
      storedMode: null,
    }),
  );
});

test("the household's stated preference can still take ads away", () => {
  isFalse(showAds({ ...grownUpOnPractice, storedMode: "kids" }));
});

test("an unconfigured build loads no ad network at all", () => {
  // Development and self-hosted builds have no AdSense client id, and must
  // stay free of third-party script entirely.
  for (const path of ["/", "/kids"]) {
    isFalse(
      showAds({ ...grownUpOnPractice, path, adNetworkConfigured: false }),
    );
  }
});

test("no signed-in learner is not treated as a grown-up on the kids page", () => {
  equal(
    showAds({
      ...grownUpOnPractice,
      path: "/kids",
      activeProfileKind: null,
      storedMode: null,
    }),
    false,
  );
});
