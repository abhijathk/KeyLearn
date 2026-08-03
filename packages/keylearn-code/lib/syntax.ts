import { Enum, type EnumItem } from "@keylearn/lang";
import { type RNG } from "@keylearn/rand";
import { type StyledText } from "@keylearn/textinput";
import { type Grammar } from "./ast.ts";
import { findFlags } from "./find-flags.ts";
import { type Flags } from "./flags.ts";
import { generate } from "./generate.ts";
import { Output } from "./output.ts";
import { pruneCond } from "./prune.ts";
import {
  grammar_cpp,
  grammar_csharp,
  grammar_go,
  grammar_html_css,
  grammar_java,
  grammar_javascript,
  grammar_php,
  grammar_python,
  grammar_regex,
  grammar_rust,
  grammar_shell,
  grammar_typescript,
} from "./syntax/grammars.ts";
import { validate } from "./validate.ts";

/**
 * One language, several things you might practise in it.
 *
 * C/C++ ships three grammars off the same rules — whole code, prototypes only,
 * statements only — which is one language and three exercises, not three
 * languages. As separate menu entries they took three lines of an alphabetical
 * list to say "C/C++" three times, so they collapse to one entry with the
 * choice moved inside.
 */
export type Variant = {
  /** The single name shown in the language list. */
  readonly group: string;
  /** This variant's label on the radio beneath it. */
  readonly name: string;
};

export class Syntax implements EnumItem {
  static readonly CPP = new Syntax("cpp", "C/C++", grammar_cpp, "start", { group: "C/C++", name: "Everything" });
  static readonly CPP_FPROTO = new Syntax("cpp_fproto", "C/C++ Function Prototypes", grammar_cpp, "start_fproto", {
    group: "C/C++",
    name: "Function prototypes",
  });
  static readonly CPP_STMT = new Syntax("cpp_stmt", "C/C++ Statements", grammar_cpp, "start_stmt", {
    group: "C/C++",
    name: "Statements",
  });
  static readonly CPP_CODE = new Syntax("cpp_code", "C/C++ code", null, "start", { group: "C/C++", name: "Real code" });
  static readonly CSHARP = new Syntax("csharp", "C#", grammar_csharp, "start", {
    group: "C#",
    name: "Language syntax",
  });
  static readonly CSHARP_CODE = new Syntax("csharp_code", "C# code", null, "start", { group: "C#", name: "Real code" });
  static readonly CSS = new Syntax("css", "CSS", grammar_html_css, "css", { group: "CSS", name: "Language syntax" });
  static readonly CSS_CODE = new Syntax("css_code", "CSS code", null, "start", { group: "CSS", name: "Real code" });
  static readonly GO = new Syntax("go", "Go", grammar_go, "start", { group: "Go", name: "Language syntax" });
  static readonly GO_CODE = new Syntax("go_code", "Go code", null, "start", { group: "Go", name: "Real code" });
  static readonly HTML = new Syntax("html", "HTML", grammar_html_css, "html", {
    group: "HTML",
    name: "Language syntax",
  });
  static readonly HTML_CODE = new Syntax("html_code", "HTML code", null, "start", { group: "HTML", name: "Real code" });
  static readonly JAVA = new Syntax("java", "Java", grammar_java, "start", { group: "Java", name: "Language syntax" });
  static readonly JAVA_CODE = new Syntax("java_code", "Java code", null, "start", { group: "Java", name: "Real code" });
  static readonly JAVASCRIPT_EXP = new Syntax("javascript_exp", "JavaScript expressions", grammar_javascript, "start", {
    group: "JavaScript",
    name: "Expressions",
  });
  static readonly JAVASCRIPT_CODE = new Syntax("javascript_code", "JavaScript code", null, "start", {
    group: "JavaScript",
    name: "Real code",
  });
  static readonly PHP = new Syntax("php", "PHP", grammar_php, "start", { group: "PHP", name: "Language syntax" });
  static readonly PHP_CODE = new Syntax("php_code", "PHP code", null, "start", { group: "PHP", name: "Real code" });
  static readonly PHP_LARAVEL = new Syntax("php_laravel", "PHP Laravel", grammar_php, "start_laravel");
  static readonly PYTHON = new Syntax("python", "Python", grammar_python, "start", {
    group: "Python",
    name: "Language syntax",
  });
  /** The written corpus: pandas, NumPy and the analysis that uses them. */
  static readonly PYTHON_DATA = new Syntax("python_data", "Python for data", null, "start", {
    group: "Python",
    name: "Data analysis",
  });
  static readonly REGEX = new Syntax("regex", "Regex", grammar_regex, "start", {
    group: "Regex",
    name: "Language syntax",
  });
  static readonly REGEX_CODE = new Syntax("regex_code", "Regex patterns", null, "start", {
    group: "Regex",
    name: "Real patterns",
  });
  static readonly RUST = new Syntax("rust", "Rust", grammar_rust, "start", { group: "Rust", name: "Language syntax" });
  static readonly RUST_CODE = new Syntax("rust_code", "Rust code", null, "start", { group: "Rust", name: "Real code" });
  static readonly SHELL = new Syntax("shell", "Shell", grammar_shell, "start", {
    group: "Shell",
    name: "Language syntax",
  });
  static readonly SHELL_CODE = new Syntax("shell_code", "Shell scripts", null, "start", {
    group: "Shell",
    name: "Real scripts",
  });
  static readonly TYPESCRIPT = new Syntax("typescript", "TypeScript", grammar_typescript, "start", {
    group: "TypeScript",
    name: "Language syntax",
  });
  /** The written corpus: the type system, generics, and real code. */
  static readonly TYPESCRIPT_CODE = new Syntax("typescript_code", "TypeScript code", null, "start", {
    group: "TypeScript",
    name: "Real code",
  });
  /**
   * Backed by written snippets rather than by a grammar.
   *
   * A grammar can teach the shape of a language and nothing beyond it. Which
   * Playwright call to reach for, and what a suite looks like when it is put
   * together well, is not something a production rule can express — so this one
   * is a corpus. `@keylearn/content-snippets` holds the text; the lesson picks
   * from it and never asks this class to generate anything.
   */
  static readonly PLAYWRIGHT_TS = new Syntax("playwright_ts", "Playwright", null);
  static readonly PLAYWRIGHT_JS = new Syntax("playwright_js", "Playwright (JavaScript)", null);
  static readonly SQL_POSTGRES = new Syntax("sql_postgres", "SQL", null);
  static readonly SQL_TSQL = new Syntax("sql_tsql", "SQL", null);
  static readonly REACT_TSX = new Syntax("react_tsx", "React", null);
  static readonly JSON = new Syntax("json", "JSON", null);
  static readonly YAML = new Syntax("yaml", "YAML", null);
  static readonly CYPRESS_JS = new Syntax("cypress_js", "Cypress", null);
  static readonly KOTLIN = new Syntax("kotlin", "Kotlin", null);
  static readonly SWIFT = new Syntax("swift", "Swift", null);
  /** One framework, two languages; the settings screen offers the choice. */
  static readonly SELENIUM_PY = new Syntax("selenium_py", "Selenium (Python)", null);
  static readonly SELENIUM_JAVA = new Syntax("selenium_java", "Selenium (Java)", null);

  static readonly ALL = new Enum<Syntax>(
    Syntax.CPP,
    Syntax.CPP_FPROTO,
    Syntax.CPP_STMT,
    Syntax.CPP_CODE,
    Syntax.CSHARP,
    Syntax.CSHARP_CODE,
    Syntax.CSS,
    Syntax.CSS_CODE,
    Syntax.GO,
    Syntax.GO_CODE,
    Syntax.HTML,
    Syntax.HTML_CODE,
    Syntax.JAVA,
    Syntax.JAVA_CODE,
    Syntax.JAVASCRIPT_EXP,
    Syntax.JAVASCRIPT_CODE,
    Syntax.PHP,
    Syntax.PHP_CODE,
    Syntax.PHP_LARAVEL,
    Syntax.PYTHON,
    Syntax.PYTHON_DATA,
    Syntax.REGEX,
    Syntax.REGEX_CODE,
    Syntax.RUST,
    Syntax.RUST_CODE,
    Syntax.SHELL,
    Syntax.SHELL_CODE,
    Syntax.TYPESCRIPT,
    Syntax.TYPESCRIPT_CODE,
    Syntax.PLAYWRIGHT_TS,
    Syntax.PLAYWRIGHT_JS,
    Syntax.SQL_POSTGRES,
    Syntax.SQL_TSQL,
    Syntax.REACT_TSX,
    Syntax.JSON,
    Syntax.YAML,
    Syntax.CYPRESS_JS,
    Syntax.KOTLIN,
    Syntax.SWIFT,
    Syntax.SELENIUM_PY,
    Syntax.SELENIUM_JAVA,
  );

  /**
   * Which heading a syntax sits under in the language list.
   *
   * Kept beside the syntaxes rather than in the settings screen, so adding one
   * and filing it are the same edit. Anything missing from here falls under
   * "Other", which is visible enough that it gets noticed.
   */
  static readonly CATEGORIES: ReadonlyMap<string, string> = new Map([
    ["cpp", "Programming"],
    ["cpp_fproto", "Programming"],
    ["cpp_stmt", "Programming"],
    ["cpp_code", "Programming"],
    ["csharp", "Programming"],
    ["csharp_code", "Programming"],
    ["go", "Programming"],
    ["go_code", "Programming"],
    ["java", "Programming"],
    ["java_code", "Programming"],
    ["javascript_exp", "Programming"],
    ["javascript_code", "Programming"],
    ["php", "Programming"],
    ["php_code", "Programming"],
    ["python", "Programming"],
    ["python_data", "Programming"],
    ["rust", "Programming"],
    ["rust_code", "Programming"],
    ["typescript", "Programming"],
    ["typescript_code", "Programming"],
    ["css", "Markup & styles"],
    ["css_code", "Markup & styles"],
    ["html", "Markup & styles"],
    ["html_code", "Markup & styles"],
    ["regex", "Scripting & patterns"],
    ["regex_code", "Scripting & patterns"],
    ["shell", "Scripting & patterns"],
    ["shell_code", "Scripting & patterns"],
    ["sql_postgres", "Data & queries"],
    ["sql_tsql", "Data & queries"],
    ["json", "Data & queries"],
    ["yaml", "Data & queries"],
    ["react_tsx", "Frameworks & automation"],
    ["php_laravel", "Frameworks & automation"],
    ["playwright_ts", "Frameworks & automation"],
    ["playwright_js", "Frameworks & automation"],
    ["kotlin", "Programming"],
    ["swift", "Programming"],
    ["cypress_js", "Frameworks & automation"],
    ["selenium_py", "Frameworks & automation"],
    ["selenium_java", "Frameworks & automation"],
  ]);

  /** The order the headings appear in; anything unlisted goes last. */
  static readonly CATEGORY_ORDER: readonly string[] = [
    "Programming",
    "Frameworks & automation",
    "Data & queries",
    "Scripting & patterns",
    "Markup & styles",
    "Other",
  ];

  static readonly FLAGS = [
    "capitals", //
    "comments",
    "defs",
    "numbers",
    "strings",
    "types",
  ] as readonly string[];

  /** Every syntax sharing this one's group, in list order; empty if it has none. */
  static variantsOf(id: string): readonly Syntax[] {
    const group = Syntax.ALL.get(id).variant?.group;
    if (group == null) {
      return [];
    }
    return [...Syntax.ALL].filter((item) => item.variant?.group === group);
  }

  readonly id: string;
  readonly name: string;
  /** Null for a syntax whose text is written rather than generated. */
  readonly grammar: Grammar | null;
  readonly start: string;
  readonly flags: ReadonlySet<string>;
  /** Set when this is one of several exercises in the same language. */
  readonly variant: Variant | null;

  private constructor(
    id: string,
    name: string,
    grammar: Grammar | null,
    start: string = "start",
    variant: Variant | null = null,
  ) {
    this.id = id;
    this.name = name;
    this.grammar = grammar != null ? validate(grammar) : null;
    this.start = start;
    this.flags = grammar != null ? findFlags(grammar.rules) : new Set();
    this.variant = variant;
    Object.freeze(this);
  }

  /** Whether this syntax generates its own text. */
  get generated(): boolean {
    return this.grammar != null;
  }

  generate(flags: Flags, rng?: RNG): StyledText {
    const { grammar } = this;
    if (grammar == null) {
      throw new Error(`${this.id} has no grammar; it is served from snippets.`);
    }
    const output = new Output(200);
    while (true) {
      try {
        if (output.length > 0) {
          output.separate(" ");
        }
        generate(pruneCond(grammar, flags), { start: this.start, output, rng });
      } catch (err) {
        if (err === Output.Stop) {
          break;
        } else {
          throw err;
        }
      }
    }
    return output.text;
  }

  toString() {
    return this.id;
  }

  toJSON() {
    return this.id;
  }
}
