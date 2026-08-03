import {
  HIDE_COMMENTS,
  highlight,
  snippetSetFor,
  snippetsFor,
  withoutComments,
} from "@keylearn/content-snippets";
import { type Keyboard } from "@keylearn/keyboard";
import { Letter, type PhoneticModel } from "@keylearn/phonetic-model";
import { type RNGStream } from "@keylearn/rand";
import { type KeyStatsMap } from "@keylearn/result";
import { type Settings } from "@keylearn/settings";
import { LessonKeys } from "./key.ts";
import { Lesson } from "./lesson.ts";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";

export class CodeLesson extends Lesson {
  constructor(settings: Settings, keyboard: Keyboard, model: PhoneticModel) {
    super(settings, keyboard, model);
  }

  override get letters(): readonly Letter[] {
    return Letter.programming;
  }

  override update(keyStatsMap: KeyStatsMap) {
    return LessonKeys.includeAll(keyStatsMap, new Target(this.settings));
  }

  override generate(lessonKeys: LessonKeys, rng: RNGStream) {
    const syntax = this.settings.get(lessonProps.code.syntax);
    // A syntax with a written corpus serves that instead of generating. One
    // snippet is one lesson: they are whole units, and half a function teaches
    // half of nothing.
    const flags = this.settings.get(lessonProps.code.flags);
    const snippets = snippetsFor(syntax.id, flags);
    if (snippets.length > 0) {
      const set = snippetSetFor(syntax.id);
      const { code } = snippets[Math.floor(rng() * snippets.length)];
      const text = flags.includes(HIDE_COMMENTS)
        ? withoutComments(code, set?.lineComment, set?.lexicon.blockComment)
        : code;
      // Coloured here rather than stored coloured, so the corpus stays plain
      // text that a formatter can check and a person can read a diff of.
      return set == null ? text : highlight(text, set.lexicon);
    }
    return syntax.generate(new Set(flags), rng);
  }

  /** The coding standard this lesson's text follows, if it has one. */
  get standard(): string | null {
    const syntax = this.settings.get(lessonProps.code.syntax);
    return snippetSetFor(syntax.id)?.standard ?? null;
  }
}
