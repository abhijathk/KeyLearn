import { booleanProp, itemProp } from "@keylearn/settings";
import { SpeedUnit } from "./speedunit.ts";

export const uiProps = {
  speedUnit: itemProp("ui.speedUnit", SpeedUnit.ALL, SpeedUnit.WPM),
  ghostRace: booleanProp("ui.ghostRace", false),
  // Hide the on-screen keyboard so the learner types without looking down.
  hideKeyboard: booleanProp("ui.hideKeyboard", false),
  // Slide the page header out of the way while typing (it returns when idle),
  // so nothing competes with the practice text.
  hideHeaderWhileTyping: booleanProp("ui.hideHeaderWhileTyping", true),
  // Explicit, rather than inferred from Settings.isNew: "never touched any
  // preference" and "never dismissed the tour" are different facts, and
  // conflating them meant the tour reappeared on every visit for anybody who
  // simply never opened the settings screen, closing the tour notwithstanding.
  tourSeen: booleanProp("ui.tourSeen", false),
} as const;
