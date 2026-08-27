import { booleanProp, itemProp, numberProp } from "@keylearn/settings";
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
  // Whether the learner may move past a lesson without finishing it.
  //
  // Asked for by a customer whose learners were skipping every lesson that got
  // hard — which is exactly the lesson worth staying on, and the one the
  // guided course would otherwise have kept bringing back until it was
  // learned. Off, the skip control is not shown and its shortcut does nothing.
  //
  // Defaults to allowed, because taking a control away from every existing
  // learner is not a decision this setting's existence is entitled to make.
  // It is a setting per profile like the rest, so a learner who needs to move
  // on from a lesson they cannot type is not stuck with somebody else's rule.
  allowSkip: booleanProp("ui.allowSkip", true),
  // A slow curl of fog trailing the mouse pointer. Decoration, nothing else.
  //
  // Lives here rather than in `accountProps` because it is a fact about how
  // the chrome behaves, like `hideHeaderWhileTyping` above, and because both
  // the settings screen and the browser shell have to read it — `accountProps`
  // is not exported past the account page.
  //
  // Off by default, and that is not the usual caution about changing things
  // for existing learners: this is an app people come to in order to
  // concentrate, and motion near the text is the last thing to opt somebody
  // into. It is also per profile like the rest, so a parent can have it
  // without their child getting it.
  cursorEffect: booleanProp("ui.cursorEffect", false),
  // How much of it, 10–100. Scales density, opacity and turbulence together,
  // because those are the three that read as "more" and moving one alone just
  // looks wrong — denser fog at the same opacity turns into a solid smear.
  //
  // Defaults to the top of the range rather than the middle: this is off
  // unless somebody asks for it, and somebody who has just asked for it means
  // the version they were shown.
  cursorEffectIntensity: numberProp("ui.cursorEffectIntensity", 100, {
    min: 10,
    max: 100,
  }),
} as const;
