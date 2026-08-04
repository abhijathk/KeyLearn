import {
  type Keyboard,
  KeyboardOptions,
  type WeightedCodePointSet,
} from "@keylearn/keyboard";
import { type Letter, PhoneticModel } from "@keylearn/phonetic-model";
import { LCG, type RNGStream } from "@keylearn/rand";
import { type KeyStatsMap, type Result, ResultGroups } from "@keylearn/result";
import { type Settings } from "@keylearn/settings";
import { type StyledText } from "@keylearn/textinput";
import { type LessonKeys } from "./key.ts";
import { lessonProps } from "./settings.ts";

export abstract class Lesson {
  static rng: RNGStream = LCG(Date.now());

  readonly settings: Settings;
  readonly keyboard: Keyboard;
  readonly codePoints: WeightedCodePointSet;
  readonly model: PhoneticModel;

  protected constructor(
    settings: Settings,
    keyboard: Keyboard,
    model: PhoneticModel,
  ) {
    this.settings = settings;
    this.keyboard = keyboard;
    this.codePoints = keyboard.getCodePoints();
    this.model = PhoneticModel.restrict(model, this.codePoints);
  }

  /**
   * The history this lesson's figures should be drawn from.
   *
   * By layout family *and* by text type. Typing prose, code and digits are
   * different sports: code runs slower per character because of where the
   * punctuation falls, and numbers are slower again. Pooling them meant that
   * switching modes made "recent form" report a dip, sent every delta
   * negative, and quietly retired the top-speed and top-score awards for good —
   * a code speed will never beat a prose record, so once somebody moved to Code
   * craft the award system went silent permanently.
   *
   * It also feeds the key statistics behind the unlock gate, where the same
   * argument applies with more force: the target speed is a prose target, and
   * judging a letter by how fast it was typed inside a regular expression is
   * not judging the same skill.
   *
   * The four text types are the same buckets the profile page offers as its
   * statistics filter, so the two pages now agree about what counts as
   * comparable.
   */
  filter(results: readonly Result[]): readonly Result[] {
    const sameLayout = ResultGroups.byLayoutFamily(results).get(
      KeyboardOptions.from(this.settings).layout.family,
    );
    return ResultGroups.byTextType(sameLayout).get(
      this.settings.get(lessonProps.type).textType,
    );
  }

  abstract get letters(): readonly Letter[];

  abstract update(keyStatsMap: KeyStatsMap): LessonKeys;

  abstract generate(lessonKeys: LessonKeys, rng: RNGStream): StyledText;
}
