import { PYTHON } from "../highlight.ts";
import { type SnippetSet } from "../types.ts";
import { pythonNumpy } from "./python-numpy.ts";
import { pythonPandas } from "./python-pandas.ts";

/**
 * Python for data analysis, formatted by Ruff.
 *
 * `ruff format` is Black's layout reimplemented — double quotes, 88 columns, a
 * magic trailing comma that forces a call to stay expanded — and it has become
 * the default in new Python projects because it runs in a fraction of the
 * time. Practising against it is practising against what a modern repository
 * will actually leave behind.
 *
 * The gate skips where Ruff is not installed. That is honest but weaker than
 * the Prettier corpora: until `ruff format` runs over these, "follows PEP 8"
 * is a claim made by the author rather than a fact checked by a tool.
 */
export const python: SnippetSet = {
  syntax: "python_data",
  framework: "Python",
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
    { id: "basics", name: "Loading data" },
    { id: "select", name: "Filtering" },
    { id: "transform", name: "Transforming" },
    { id: "aggregate", name: "Grouping" },
    { id: "join", name: "Joining" },
    { id: "reshape", name: "Reshaping" },
    { id: "quality", name: "Cleaning" },
    { id: "timeseries", name: "Time series" },
    { id: "stats", name: "Statistics" },
    { id: "testing", name: "Significance tests" },
    { id: "viz", name: "Charts" },
    { id: "idiom", name: "Idiomatic Python" },
    { id: "performance", name: "Performance" },
  ],
  snippets: [...pythonPandas, ...pythonNumpy],
};
