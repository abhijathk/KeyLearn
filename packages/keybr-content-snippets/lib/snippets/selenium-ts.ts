import { JAVA, PYTHON } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { seleniumJava } from "./selenium-java.ts";
import { seleniumPython } from "./selenium-python.ts";

/**
 * Selenium in Python.
 *
 * Formatted by Ruff, like the data corpus — a Selenium suite is ordinary
 * Python and there is no reason for it to follow a different style from the
 * rest of the repository it lives in.
 */
export const seleniumPy: SnippetSet = {
  syntax: "selenium_py",
  framework: "Selenium",
  language: "Python",
  standard: "Ruff / PEP 8",
  formatter: {
    command: "ruff",
    args: ["format", "-"],
    extension: ".py",
  },
  lineComment: ["#"],
  lexicon: PYTHON,
  topics: [
    { id: "structure", name: "Suite structure" },
    { id: "locators", name: "Locators" },
    { id: "waits", name: "Waits" },
    { id: "actions", name: "Interactions" },
    { id: "assertions", name: "Assertions" },
    { id: "browser", name: "Frames, windows & cookies" },
    { id: "config", name: "Configuration & grid" },
  ],
  snippets: seleniumPython,
};

/**
 * Selenium in Java.
 *
 * The standard named here is Google Java Style, which `google-java-format`
 * enforces: two-space indent, 100 columns, no configuration options at all.
 * That last part is the point — it is the one Java style with nothing left to
 * argue about, which is why it has spread well beyond Google.
 *
 * Java is the one language here that will not parse a fragment: it has no
 * top-level statements, so `driver.get(url);` on its own is not a program. The
 * wrappers below put each fragment where it would really live before the
 * formatter sees it, and the gate takes it back out afterwards — which is what
 * lets a snippet be three useful lines instead of three lines inside a class
 * nobody wanted to type.
 */
export const seleniumJv: SnippetSet = {
  syntax: "selenium_java",
  framework: "Selenium",
  language: "Java",
  standard: "Google Java Style",
  formatter: {
    command: "google-java-format",
    // Without the skip, formatting a snippet that is only import statements
    // deletes every one of them: nothing below uses them, because there is no
    // below.
    args: ["--skip-removing-unused-imports", "-"],
    extension: ".java",
    wrap: {
      member: { before: "class Snippet {", after: "}", indent: "  " },
      statement: {
        before: "class Snippet {\n  void snippet() throws Exception {",
        after: "  }\n}",
        indent: "    ",
      },
    },
  },
  lineComment: ["//"],
  lexicon: JAVA,
  topics: [
    { id: "structure", name: "Suite structure" },
    { id: "locators", name: "Locators" },
    { id: "waits", name: "Waits" },
    { id: "actions", name: "Interactions" },
    { id: "assertions", name: "Assertions" },
    { id: "browser", name: "Frames, windows & cookies" },
    { id: "config", name: "Configuration & grid" },
  ],
  snippets: seleniumJava,
};
