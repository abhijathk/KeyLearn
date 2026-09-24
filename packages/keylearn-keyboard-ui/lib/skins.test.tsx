import { test } from "node:test";
import {
  KeyboardContext,
  keyboardProps,
  KeyboardStyle,
  Layout,
  loadKeyboard,
} from "@keylearn/keyboard";
import { FakeSettingsContext, Settings } from "@keylearn/settings";
import { render } from "@testing-library/react";
import { equal, isFalse, isNotNull, isTrue } from "rich-assert";
import { KeyLayer } from "./KeyLayer.tsx";
import { backlightOn, skinFor } from "./lighting.ts";
import {
  capLook,
  KIDS_CRAYON_SKIN,
  KIDS_RAINBOW_SKIN,
  KIDS_ZONE,
  ROUND_SKINS,
  type Skin,
} from "./skins.ts";

const withStyle = (style: KeyboardStyle) =>
  new Settings().set(keyboardProps.style, style);

test("the kids finishes are selected by keyboard.style", () => {
  equal(skinFor(withStyle(KeyboardStyle.KIDS_CRAYON), true), KIDS_CRAYON_SKIN);
  equal(skinFor(withStyle(KeyboardStyle.KIDS_CRAYON), false), KIDS_CRAYON_SKIN);
  equal(
    skinFor(withStyle(KeyboardStyle.KIDS_RAINBOW), true),
    KIDS_RAINBOW_SKIN,
  );
  equal(
    skinFor(withStyle(KeyboardStyle.KIDS_RAINBOW), false),
    KIDS_RAINBOW_SKIN,
  );
});

test("the kids finishes are not lit and not listed", () => {
  for (const style of [KeyboardStyle.KIDS_CRAYON, KeyboardStyle.KIDS_RAINBOW]) {
    isFalse(style.lightable);
    isFalse(style.listed);
    isFalse(backlightOn(withStyle(style), true));
    // Still parseable from a stored value.
    equal(KeyboardStyle.ALL.get(style.id), style);
  }
  isTrue(KeyboardStyle.ROUND.listed);
});

const paint = (skin: Skin, cap: Parameters<NonNullable<Skin["paint"]>>[0]) =>
  skin.paint!(cap);

test("crayon rings a cap in its finger colour, and the frame in clay", () => {
  const f = paint(KIDS_CRAYON_SKIN, {
    id: "KeyF",
    finger: "leftIndex",
    legend: "F",
    frame: false,
  });
  equal(f.zone?.ring, KIDS_ZONE.leftIndex);
  equal(f.ring, "#c9b8a8");
  // 78% seafoam into #6a6a5a, as kids.module.less writes it.
  equal(f.zone?.skirt, "#61b496");
  const tab = paint(KIDS_CRAYON_SKIN, {
    id: "Tab",
    finger: "pinky",
    legend: null,
    frame: true,
  });
  equal(tab.zone, undefined);
  equal(tab.ring, "#c9b8a8");
});

test("rainbow sorts caps into its four groups", () => {
  const top = (id: string, legend: string | null, frame = false) =>
    paint(KIDS_RAINBOW_SKIN, { id, finger: "pinky", legend, frame }).top;
  equal(top("Tab", null, true), "#4ab86a");
  equal(top("Space", null, true), "#4ab86a");
  equal(top("Digit1", "1"), "#e35d51");
  equal(top("Semicolon", ";"), "#e35d51");
  equal(top("KeyQ", "Q"), "#4a5fb8");
  equal(top("KeyY", "Y"), "#4a5fb8");
  equal(top("KeyA", "A"), "#6fb8e4");
  equal(top("KeyE", "É"), "#6fb8e4");
});

test("render both kids finishes", () => {
  const keyboard = loadKeyboard(Layout.EN_US);
  for (const style of [KeyboardStyle.KIDS_CRAYON, KeyboardStyle.KIDS_RAINBOW]) {
    const r = render(
      <FakeSettingsContext initialSettings={withStyle(style)}>
        <KeyboardContext.Provider value={keyboard}>
          <KeyLayer showColors={true} cuedKey="KeyF" cuedRing={true} />
        </KeyboardContext.Provider>
      </FakeSettingsContext>,
    );
    isNotNull(r.container.querySelector('[data-key="KeyF"]'));
    r.unmount();
  }
});

test("capLook dresses Enter as each board does", () => {
  const enter = {
    id: "Enter",
    finger: "pinky",
    legend: null,
    frame: true,
  } as const;
  const crayon = capLook(KIDS_CRAYON_SKIN, enter);
  equal(crayon.face, "var(--primary-l2, #ffffff)");
  equal(crayon.ring, "#c9b8a8"); // a frame key: clay, as on the trail
  const rainbow = capLook(KIDS_RAINBOW_SKIN, enter);
  equal(rainbow.face, "#4ab86a");
  equal(rainbow.edge, "#2f9a4e");
  equal(rainbow.ring, null);
  // Round accents Enter.
  const round = capLook(ROUND_SKINS.graphite!, enter);
  equal(round.edge, "#847c0e");
  equal(round.radiusRatio, 0.5);
});
