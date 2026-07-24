import { booleanProp, itemProp } from "@keybr/settings";
import { SpeedUnit } from "./speedunit.ts";

export const uiProps = {
  speedUnit: itemProp("ui.speedUnit", SpeedUnit.ALL, SpeedUnit.WPM),
  ghostRace: booleanProp("ui.ghostRace", false),
  // Hide the on-screen keyboard so the learner types without looking down.
  hideKeyboard: booleanProp("ui.hideKeyboard", false),
} as const;
