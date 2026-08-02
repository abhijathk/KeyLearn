import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type FormatterCheck, type Snippet, type SnippetSet } from "./types.ts";

/**
 * Running a corpus through the tool that decides whether it follows its
 * standard.
 *
 * Shared by the test that reports the mismatches and the script that fixes
 * them, so the two can never disagree about what "correctly formatted" means —
 * which would be the one bug in here capable of quietly corrupting the corpus.
 */

/**
 * The repo's own toolbox, for formatters not published to npm.
 *
 * Ruff and sqlfluff come from PyPI and google-java-format and ktlint are jars,
 * so `npm install` fetches none of them. `scripts/install-formatters.sh` puts
 * them here instead. The directory is git-ignored, so a checkout without it
 * skips those gates rather than failing them.
 */
const TOOLBOX = fileURLToPath(new URL("../../../.tools/bin/", import.meta.url));

/**
 * Where a formatter actually lives.
 *
 * Three places, in order: PATH, the toolbox above, and the Apple toolchain —
 * which ships `swift-format` somewhere `which` will never look and expects
 * `xcrun` to be asked. Without the last one the Swift gate would skip on the
 * one kind of machine that can certainly run it.
 */
export function resolve(command: string): string | null {
  if (spawnSync("which", [command]).status === 0) {
    return command;
  }
  if (existsSync(TOOLBOX + command)) {
    return TOOLBOX + command;
  }
  const found = spawnSync("xcrun", ["--find", command], { encoding: "utf8" });
  const path = found.status === 0 ? found.stdout.trim() : "";
  return path.length > 0 ? path : null;
}

export function available({ command }: FormatterCheck): boolean {
  return resolve(command) != null;
}

/** What the formatter did to a snippet. */
export type FormatResult =
  | { readonly ok: true; readonly code: string }
  /** The formatter could not parse it, which the caller reports rather than fixes. */
  | { readonly ok: false; readonly reason: string };

/**
 * The snippet as its formatter would leave it.
 *
 * A fragment is wrapped, formatted and unwrapped again, so what comes back is
 * comparable with what went in.
 */
export async function format(
  set: SnippetSet,
  snippet: Snippet,
): Promise<FormatResult> {
  const { formatter } = set;
  const command = resolve(formatter.command);
  if (command == null) {
    return { ok: false, reason: `${formatter.command} is not installed` };
  }
  const scope = snippet.scope ?? "unit";
  const wrap = scope === "unit" ? null : formatter.wrap?.[scope];
  if (scope !== "unit" && wrap == null) {
    return { ok: false, reason: `no wrapper for a ${scope} in ${set.syntax}` };
  }

  const input =
    wrap == null
      ? snippet.code
      : [wrap.before, indent(snippet.code, wrap.indent), wrap.after]
          // An empty half is no lines at all, not one blank one. PHP's wrapper
          // is an opening tag and nothing after it.
          .filter((part) => part !== "")
          .join("\n");

  const result = await run(command, formatter.args, input);
  if (result.status !== 0) {
    return { ok: false, reason: firstLine(result.stderr) };
  }
  if (wrap == null) {
    return { ok: true, code: result.stdout.trim() };
  }

  // Take back exactly the lines the snippet occupied. Counting them rather
  // than searching for a marker means a formatter that reflows the wrapper
  // itself — google-java-format will join a short class onto fewer lines —
  // cannot silently shift what gets extracted.
  //
  // Trimmed first: the trailing newline every formatter emits would otherwise
  // count as a line, and the slice would take the wrapper's closing brace
  // instead of the snippet's last line.
  const lines = result.stdout.trim().split("\n");
  const start = countLines(wrap.before);
  const end = lines.length - countLines(wrap.after);
  return {
    ok: true,
    code: dedent(lines.slice(start, end).join("\n"), wrap.indent).trim(),
  };
}

/** Feed the snippet in on stdin and collect what comes back. */
function run(
  command: string,
  args: readonly string[],
  input: string,
): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status: status ?? 1, stdout, stderr });
    });
    // A formatter that rejects the input may exit before reading all of it,
    // which lands here as EPIPE rather than as the parse error it really is.
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

function indent(code: string, pad: string): string {
  return code
    .split("\n")
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\n");
}

function dedent(code: string, pad: string): string {
  return code
    .split("\n")
    .map((line) => (line.startsWith(pad) ? line.slice(pad.length) : line))
    .join("\n");
}

/** How many lines a wrapper half occupies; an empty one occupies none. */
function countLines(part: string): number {
  return part === "" ? 0 : part.split("\n").length;
}

function firstLine(text: string): string {
  return text.trim().split("\n")[0] ?? "could not be parsed";
}

/**
 * A whole corpus, formatted concurrently.
 *
 * One process per snippet is unavoidable — none of these tools will take a
 * batch on stdin — but they need not be waited for one at a time. sqlfluff
 * takes about a second and a half to start, and a JVM is no quicker, so
 * running them serially puts the suite into the minutes. The pool is small
 * enough to leave the machine usable.
 */
export async function formatAll(
  set: SnippetSet,
  concurrency = 8,
): Promise<Map<string, FormatResult>> {
  const results = new Map<string, FormatResult>();
  let next = 0;
  const worker = async () => {
    while (next < set.snippets.length) {
      const snippet = set.snippets[next++];
      results.set(snippet.id, await format(set, snippet));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, set.snippets.length) }, worker),
  );
  return results;
}
