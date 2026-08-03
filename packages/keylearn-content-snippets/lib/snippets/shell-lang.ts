import { type Snippet } from "../types.ts";

/**
 * Bash, written the way a script that other people rely on should be.
 *
 * Shell is the language most often written badly by people who write
 * everything else well, because it is picked up in fragments and never
 * learned. So the corpus leads with the safety rail — `set -euo pipefail` and
 * quoting — and most snippets carry the reason a naive version breaks.
 *
 * Checked by shfmt, which is the closest thing shell has to a standard
 * formatter, on the Google shell style guide's settings.
 */
export const shellLang: readonly Snippet[] = [
  {
    id: "sh-strict",
    title: "The three settings every script should open with",
    level: 2,
    tags: ["basics"],
    code: `#!/usr/bin/env bash
# -e stops on a failing command, -u on an unset variable, and pipefail makes
# a pipeline fail when any stage does rather than only the last. Without the
# third, "curl … | grep …" reports success after the download failed.
set -euo pipefail`,
  },
  {
    id: "sh-quote",
    title: "Quote every expansion",
    level: 1,
    tags: ["basics"],
    code: `# Unquoted, a path containing a space becomes two arguments and a path
# containing a star becomes a glob. There is almost no case where the
# unquoted form is the one you wanted.
cp "$source" "$destination"`,
  },
  {
    id: "sh-variables",
    title: "Assignments take no spaces",
    level: 1,
    tags: ["basics"],
    code: `# name = value would run a command called name. The braces are optional
# here and required when the name is followed by a word character.
name="keylearn"
echo "Deploying \${name}-server"`,
  },
  {
    id: "sh-default-value",
    title: "A default, and a required variable",
    level: 3,
    tags: ["basics"],
    code: `# :- supplies a fallback; :? fails with a message instead. The second is
# how a script says which variables it needs rather than failing later on.
port="\${PORT:-3000}"
token="\${API_TOKEN:?API_TOKEN must be set}"`,
  },
  {
    id: "sh-command-substitution",
    title: "Capture a command's output",
    level: 2,
    tags: ["basics"],
    code: `# The dollar-parenthesis form nests and is readable; backticks do neither
# and are worth unlearning.
branch="$(git rev-parse --abbrev-ref HEAD)"
echo "on \${branch}"`,
  },
  {
    id: "sh-arithmetic",
    title: "Arithmetic",
    level: 2,
    tags: ["basics"],
    code: `# Inside the double parentheses the variables need no dollar sign and the
# operators mean what they look like.
count=$((count + 1))
if ((count > 10)); then
  echo "too many"
fi`,
  },
  {
    id: "sh-test-string",
    title: "Compare strings with double brackets",
    level: 2,
    tags: ["conditionals"],
    code: `# [[ is a shell keyword and does no word splitting, so an empty variable
# cannot turn the test into a syntax error the way [ can.
if [[ "$environment" == "production" ]]; then
  echo "deploying to production"
fi`,
  },
  {
    id: "sh-test-file",
    title: "The file tests worth remembering",
    level: 2,
    tags: ["conditionals"],
    code: `# -f a regular file, -d a directory, -x executable, -s non-empty. The
# exclamation mark negates, as everywhere else.
if [[ -f "$config" && -s "$config" ]]; then
  source "$config"
fi`,
  },
  {
    id: "sh-case",
    title: "case, for branching on a pattern",
    level: 3,
    tags: ["conditionals"],
    code: `# Glob patterns, not regular expressions, and the double semicolon ends
# each branch. Clearer than a chain of elifs comparing the same variable.
case "$1" in
  build) run_build ;;
  test) run_tests ;;
  deploy) run_deploy ;;
  *)
    echo "usage: $0 {build|test|deploy}" >&2
    exit 1
    ;;
esac`,
  },
  {
    id: "sh-exit-code",
    title: "Branch on whether a command succeeded",
    level: 3,
    tags: ["conditionals"],
    code: `# Test the command directly rather than capturing $? — under set -e the
# bare command would abort the script, and inside an if it does not.
if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed" >&2
  exit 1
fi`,
  },
  {
    id: "sh-loop-lines",
    title: "Read a file line by line",
    level: 4,
    tags: ["loops"],
    code: `# IFS= keeps leading whitespace, -r stops backslashes being eaten, and
# the || [[ -n ]] catches a final line with no newline. All three matter.
while IFS= read -r line || [[ -n "$line" ]]; do
  echo "\${line}"
done <"$file"`,
  },
  {
    id: "sh-loop-glob",
    title: "Loop over files, safely",
    level: 3,
    tags: ["loops"],
    code: `# Looping over the output of ls breaks on any filename with a space. A
# glob does not, and the nullglob check covers the no-matches case.
shopt -s nullglob
for path in ./data/*.csv; do
  echo "importing \${path}"
done`,
  },
  {
    id: "sh-loop-array",
    title: "An array, and iterating it",
    level: 3,
    tags: ["loops"],
    code: `# The quoted [@] form expands to one word per element. Without the quotes
# an element containing a space becomes two.
services=(web worker scheduler)
for service in "\${services[@]}"; do
  systemctl restart "$service"
done`,
  },
  {
    id: "sh-function",
    title: "A function, with local variables",
    level: 3,
    tags: ["functions"],
    code: `# Without local, every variable is global, and two functions that both
# use "i" will quietly corrupt each other.
usage() {
  local script
  script="$(basename "$0")"
  echo "usage: \${script} [--verbose] <command>" >&2
}`,
  },
  {
    id: "sh-function-return",
    title: "Return a value, and return a status",
    level: 4,
    tags: ["functions"],
    code: `# return sets an exit status, not a value: to return data, echo it and
# capture it at the call site.
latest_tag() {
  git describe --tags --abbrev=0 2>/dev/null || return 1
}`,
  },
  {
    id: "sh-args",
    title: "Parse the arguments",
    level: 4,
    tags: ["functions"],
    code: `# shift moves the next argument into $1, and the double dash convention
# stops option parsing so the rest can be filenames.
verbose=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v | --verbose)
      verbose=true
      shift
      ;;
    --)
      shift
      break
      ;;
    *) break ;;
  esac
done`,
  },
  {
    id: "sh-trap",
    title: "Clean up on the way out",
    level: 4,
    tags: ["safety"],
    code: `# EXIT fires however the script ends, including on an error under set -e,
# so the temporary directory is removed even when something goes wrong.
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT`,
  },
  {
    id: "sh-heredoc",
    title: "A here-document",
    level: 3,
    tags: ["basics"],
    code: `# Quoting the delimiter stops expansion inside the block, which is what
# you want when the text contains dollar signs of its own.
cat >"$config" <<'EOF'
server:
  host: localhost
  port: 3000
EOF`,
  },
  {
    id: "sh-redirect",
    title: "Redirect the right stream",
    level: 3,
    tags: ["safety"],
    code: `# Errors go to stderr so they survive a pipeline and are visible when
# stdout is being captured. 2>&1 must come after the stdout redirect.
echo "starting" >&2
./build.sh >build.log 2>&1`,
  },
  {
    id: "sh-pipeline",
    title: "A pipeline that fails properly",
    level: 4,
    tags: ["safety"],
    code: `# With pipefail set at the top, a failure in curl fails the whole line.
# Without it the exit status is jq's, and a failed download looks like an
# empty result.
curl --fail --silent --show-error "$url" | jq -r '.items[].sku'`,
  },
  {
    id: "sh-retry",
    title: "Retry with a growing delay",
    level: 5,
    tags: ["safety"],
    code: `# Backing off rather than hammering, and failing for good after the last
# attempt instead of returning success by accident.
for attempt in 1 2 3; do
  if curl --fail --silent "$url" >"$output"; then
    break
  fi
  if ((attempt == 3)); then
    echo "giving up after \${attempt} attempts" >&2
    exit 1
  fi
  sleep "$((attempt * 2))"
done`,
  },
  {
    id: "sh-lock",
    title: "Stop two copies running at once",
    level: 5,
    tags: ["safety"],
    code: `# A lock on the script's own file descriptor. Released when the process
# ends, including when it is killed, which a lock file is not.
exec 9>"/tmp/$(basename "$0").lock"
if ! flock -n 9; then
  echo "already running" >&2
  exit 0
fi`,
  },
  {
    id: "sh-find-exec",
    title: "Act on found files without a loop",
    level: 4,
    tags: ["loops"],
    code: `# The plus at the end batches the arguments into as few calls as
# possible; a semicolon would run one process per file.
find . -name '*.tmp' -type f -mtime +7 -exec rm -- {} +`,
  },
  {
    id: "sh-xargs-null",
    title: "Pipe filenames safely",
    level: 5,
    tags: ["loops"],
    code: `# -print0 and -0 separate on a null byte, which is the only character a
# filename cannot contain. Any other separator breaks on some real path.
find . -name '*.log' -print0 | xargs -0 gzip --best`,
  },
  {
    id: "sh-script-dir",
    title: "Find the script's own directory",
    level: 4,
    tags: ["basics"],
    code: `# So the script can be run from anywhere and still find the files beside
# it. cd -P resolves any symlink in the path.
script_dir="$(cd -P "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
source "\${script_dir}/lib/common.sh"`,
  },
];
