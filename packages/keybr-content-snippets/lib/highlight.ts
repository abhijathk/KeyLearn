/**
 * Colouring the snippets.
 *
 * The corpus is stored as plain text so that a formatter can be run over it and
 * a human can read the diff. Highlighting is therefore applied here, at the
 * point of use, rather than baked into the source — which also means a snippet
 * cannot drift out of step with its own markup.
 *
 * Deliberately small: four classes, because that is what the text renderer
 * knows how to colour. This is not a parser and does not try to be one — it
 * recognises comments, strings, numbers and keywords, in that order of
 * precedence, and leaves everything else alone. A tokeniser that got 95% of a
 * language right would be worse than this one, because the 5% would be wrong
 * in ways nobody could predict while typing.
 */

/**
 * A run of characters and the class that colours it. Shaped as the text
 * renderer's own span so the result can be handed straight to it.
 */
export type Token = { readonly text: string; readonly cls: string };

export type Lexicon = {
  /** How a line comment opens, e.g. `//` or `--`. */
  readonly lineComment: readonly string[];
  /**
   * The delimiters of a block comment, or null where the language has none.
   *
   * A pair rather than a flag because HTML's is not `/* *\/` — and a corpus
   * whose comments cannot be recognised is one whose comment toggle silently
   * does nothing.
   */
  readonly blockComment: readonly [open: string, close: string] | null;
  /** Quote characters that open a string. */
  readonly quotes: readonly string[];
  /** Reserved words, lower-cased; matching is case-insensitive. */
  readonly keywords: ReadonlySet<string>;
};

const WORD = /[A-Za-z_$][A-Za-z0-9_$]*/y;
const NUMBER = /\d[\d_]*(\.\d+)?([eE][-+]?\d+)?|0[xX][0-9a-fA-F]+/y;

export function highlight(
  code: string,
  lexicon: Lexicon,
): readonly (string | Token)[] {
  // Plain runs go back as bare strings and coloured ones as spans, which is
  // exactly the shape the renderer's StyledText already accepts.
  const out: (string | Token)[] = [];
  let plain = "";
  const flush = () => {
    if (plain !== "") {
      out.push(plain);
      plain = "";
    }
  };
  const emit = (text: string, cls: string) => {
    flush();
    out.push({ text, cls });
  };

  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);

    const opener = lexicon.lineComment.find((p) => rest.startsWith(p));
    if (opener != null) {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? code.length : end;
      emit(code.slice(i, stop), "comment");
      i = stop;
      continue;
    }

    if (lexicon.blockComment != null) {
      const [open, close] = lexicon.blockComment;
      if (rest.startsWith(open)) {
        const end = code.indexOf(close, i + open.length);
        const stop = end === -1 ? code.length : end + close.length;
        emit(code.slice(i, stop), "comment");
        i = stop;
        continue;
      }
    }

    const quote = lexicon.quotes.find((q) => rest.startsWith(q));
    if (quote != null) {
      let j = i + quote.length;
      while (j < code.length) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code.startsWith(quote, j)) {
          j += quote.length;
          break;
        }
        // An unterminated string is a broken snippet, but running to the end
        // of the file would paint the rest of the lesson as one long string.
        if (code[j] === "\n") {
          break;
        }
        j += 1;
      }
      emit(code.slice(i, j), "string");
      i = j;
      continue;
    }

    NUMBER.lastIndex = i;
    const number = NUMBER.exec(code);
    // Only when a number starts here, and not in the middle of an identifier.
    if (number != null && number.index === i && !isWordChar(code[i - 1])) {
      emit(number[0], "number");
      i += number[0].length;
      continue;
    }

    WORD.lastIndex = i;
    const word = WORD.exec(code);
    if (word != null && word.index === i) {
      if (lexicon.keywords.has(word[0].toLowerCase())) {
        emit(word[0], "keyword");
      } else {
        plain += word[0];
      }
      i += word[0].length;
      continue;
    }

    plain += code[i];
    i += 1;
  }
  flush();
  return out;
}

function isWordChar(ch: string | undefined): boolean {
  return ch != null && /[A-Za-z0-9_$]/.test(ch);
}

const TS_KEYWORDS =
  "abstract as async await break case catch class const continue debugger " +
  "declare default delete do else enum export extends false finally for from " +
  "function get if implements import in instanceof interface keyof let new " +
  "null of private protected public readonly return satisfies set static " +
  "super switch this throw true try type typeof undefined var void while yield";

const SQL_KEYWORDS =
  "add all alter and as asc begin between by cascade case cast check column " +
  "commit constraint count create cross current_date default delete desc " +
  "distinct drop else end except exists false foreign from full generated " +
  "group having identity if in index inner insert intersect into is join key " +
  "left like limit merge not null nulls offset on or order outer over " +
  "partition primary references rename restrict returning right rollback " +
  "rollup row rows savepoint select set some table then to top transaction " +
  "true truncate union unique update using values view when where window with";

export const TYPESCRIPT: Lexicon = {
  lineComment: ["//"],
  blockComment: ["/*", "*/"],
  quotes: ["'", '"', "`"],
  keywords: new Set(TS_KEYWORDS.split(" ")),
};

export const SQL: Lexicon = {
  lineComment: ["--"],
  blockComment: ["/*", "*/"],
  quotes: ["'", '"'],
  keywords: new Set(SQL_KEYWORDS.split(" ")),
};

const JAVA_KEYWORDS =
  "abstract assert boolean break byte case catch char class const continue " +
  "default do double else enum extends final finally float for if implements " +
  "import instanceof int interface long native new null package private " +
  "protected public record return sealed short static super switch " +
  "synchronized this throw throws transient try var void volatile while";

export const JAVA: Lexicon = {
  lineComment: ["//"],
  blockComment: ["/*", "*/"],
  quotes: ['"', "'"],
  keywords: new Set([...JAVA_KEYWORDS.split(" "), "true", "false"]),
};

const KOTLIN_KEYWORDS =
  "actual as break by catch class companion const constructor continue crossinline " +
  "data delegate do dynamic else enum expect external false field file final " +
  "finally for fun get if import in infix init inline interface internal is " +
  "lateinit noinline null object open operator out override package private " +
  "protected public reified return sealed set super suspend tailrec this throw " +
  "true try typealias val value var vararg when where while";

export const KOTLIN: Lexicon = {
  lineComment: ["//"],
  blockComment: ["/*", "*/"],
  quotes: ['"""', '"', "'"],
  keywords: new Set(KOTLIN_KEYWORDS.split(" ")),
};

const SWIFT_KEYWORDS =
  "actor any as associatedtype async await break case catch class continue " +
  "default defer deinit do else enum extension fallthrough false fileprivate " +
  "final for func guard if import in indirect init inout internal is lazy let " +
  "mutating nil nonisolated open operator private protocol public repeat " +
  "required rethrows return self some static struct subscript super switch " +
  "throw throws true try typealias var weak where while";

export const SWIFT: Lexicon = {
  lineComment: ["//"],
  blockComment: ["/*", "*/"],
  quotes: ['"""', '"'],
  keywords: new Set(SWIFT_KEYWORDS.split(" ")),
};

/**
 * CSS has no line comment at all — only the block form — so `lineComment` is
 * empty and the comments toggle has nothing to strip but the block comments
 * `withoutComments` already understands.
 */
export const CSS_LEX: Lexicon = {
  lineComment: [],
  blockComment: ["/*", "*/"],
  quotes: ['"', "'"],
  keywords: new Set(
    (
      "and container display grid flex important inherit initial layer media " +
      "not only or supports unset var where"
    ).split(" "),
  ),
};

/** HTML's comment opens with `<!--`, which the block-comment rule cannot express. */
export const HTML_LEX: Lexicon = {
  lineComment: [],
  blockComment: ["<!--", "-->"],
  quotes: ['"'],
  keywords: new Set([]),
};

const PHP_KEYWORDS =
  "abstract and array as break callable case catch class clone const continue " +
  "declare default do echo else elseif enum extends final finally fn for " +
  "foreach function global if implements include instanceof insteadof " +
  "interface list match namespace new null or print private protected public " +
  "readonly require return self static switch throw trait try unset use var " +
  "while yield true false";

export const PHP: Lexicon = {
  lineComment: ["//", "#"],
  blockComment: ["/*", "*/"],
  quotes: ['"', "'"],
  keywords: new Set(PHP_KEYWORDS.split(" ")),
};

const GO_KEYWORDS =
  "break case chan const continue default defer else fallthrough false for " +
  "func go goto if import interface map nil package range return select " +
  "struct switch true type var";

export const GO: Lexicon = {
  lineComment: ["//"],
  blockComment: ["/*", "*/"],
  quotes: ['"', "`"],
  keywords: new Set(GO_KEYWORDS.split(" ")),
};

const CPP_KEYWORDS =
  "alignas auto bool break case catch char class concept const consteval " +
  "constexpr continue decltype default delete do double else enum explicit " +
  "export extern false float for friend goto if inline int long mutable " +
  "namespace new noexcept nullptr operator private protected public register " +
  "requires return short signed sizeof static struct switch template this " +
  "throw true try typedef typename union unsigned using virtual void volatile " +
  "while";

export const CPP: Lexicon = {
  lineComment: ["//"],
  blockComment: ["/*", "*/"],
  quotes: ['"', "'"],
  keywords: new Set(CPP_KEYWORDS.split(" ")),
};

const CSHARP_KEYWORDS =
  "abstract as async await base bool break byte case catch char checked class " +
  "const continue decimal default delegate do double else enum event explicit " +
  "extern false finally fixed float for foreach get global goto if implicit in " +
  "init int interface internal is lock long namespace new null object operator " +
  "out override params private protected public readonly record ref required " +
  "return sbyte sealed set short sizeof stackalloc static string struct switch " +
  "this throw true try typeof uint ulong unchecked unsafe ushort using var " +
  "virtual void volatile when where while yield";

export const CSHARP: Lexicon = {
  lineComment: ["//"],
  blockComment: ["/*", "*/"],
  quotes: ['"', "'"],
  keywords: new Set(CSHARP_KEYWORDS.split(" ")),
};

const SHELL_KEYWORDS =
  "case do done elif else esac exec exit export fi for function if in local " +
  "read readonly return select set shift shopt source then trap unset until " +
  "while";

export const SHELL: Lexicon = {
  lineComment: ["#"],
  blockComment: null,
  quotes: ['"', "'"],
  keywords: new Set(SHELL_KEYWORDS.split(" ")),
};

const RUST_KEYWORDS =
  "as async await break const continue crate dyn else enum extern false fn " +
  "for if impl in let loop match mod move mut pub ref return self static " +
  "struct super trait true type union unsafe use where while";

export const RUST: Lexicon = {
  lineComment: ["//"],
  blockComment: ["/*", "*/"],
  quotes: ['"'],
  keywords: new Set(RUST_KEYWORDS.split(" ")),
};

const PYTHON_KEYWORDS =
  "and as assert async await break class continue def del elif else except " +
  "false finally for from global if import in is lambda match none nonlocal " +
  "not or pass raise return self true try while with yield";

export const PYTHON: Lexicon = {
  lineComment: ["#"],
  blockComment: null,
  // Triple quotes first: `find` takes the first that matches, and a docstring
  // opened with a single `"` closes on its own second character.
  quotes: ['"""', "'''", '"', "'"],
  keywords: new Set(PYTHON_KEYWORDS.split(" ")),
};

/**
 * JSON with comments — the dialect `tsconfig.json` and editor settings are
 * really written in. Strict JSON has no comments, and a corpus that could not
 * explain itself would teach the punctuation and nothing else.
 */
export const JSON_C: Lexicon = {
  lineComment: ["//"],
  blockComment: ["/*", "*/"],
  quotes: ['"'],
  keywords: new Set(["true", "false", "null"]),
};

/**
 * YAML. The keyword set is the literals that are easy to write by accident:
 * an unquoted `no` is a boolean, and colouring it as one is the point.
 */
export const YAML: Lexicon = {
  lineComment: ["#"],
  blockComment: null,
  quotes: ['"', "'"],
  keywords: new Set(["true", "false", "null", "yes", "no", "on", "off"]),
};
