#!/usr/bin/env bash
#
# The formatters that decide whether the code snippets really do follow the
# standards they claim to.
#
# Prettier arrives with `npm install` and swift-format already lives inside the
# Apple toolchain, where the gate finds it with `xcrun`. The other four are a
# PyPI package or a jar, so they go in a toolbox beside the workspace that
# `lib/format.ts` knows to look in.
#
# Without them those gates skip: the suite still passes, but the Python, SQL,
# Java and Kotlin corpora are then unchecked, and "follows the standard"
# becomes a claim by the author rather than a fact checked by a tool.
#
# Usage: ./scripts/install-formatters.sh
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p .tools/jars

# Ruff (Python) and sqlfluff (SQL), from PyPI. A virtualenv rather than a
# global install, so nothing outside this directory changes.
python3 -m venv .tools
.tools/bin/pip install --quiet --disable-pip-version-check --upgrade pip
.tools/bin/pip install --quiet --disable-pip-version-check ruff sqlfluff

# google-java-format, from Maven Central. Needs the --add-exports flags on
# JDK 16 and later: it uses javac internals the module system closed off.
GJF_VERSION=1.28.0
curl -sSL -o .tools/jars/google-java-format.jar \
  "https://repo1.maven.org/maven2/com/google/googlejavaformat/google-java-format/${GJF_VERSION}/google-java-format-${GJF_VERSION}-all-deps.jar"
cat > .tools/bin/google-java-format <<'WRAPPER'
#!/usr/bin/env bash
exec java \
  --add-exports jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED \
  --add-exports jdk.compiler/com.sun.tools.javac.file=ALL-UNNAMED \
  --add-exports jdk.compiler/com.sun.tools.javac.parser=ALL-UNNAMED \
  --add-exports jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED \
  --add-exports jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED \
  -jar "$(dirname "$0")/../jars/google-java-format.jar" "$@"
WRAPPER
chmod +x .tools/bin/google-java-format

# ktlint (Kotlin), a self-executing jar from its GitHub releases. The style it
# enforces comes from the [*.kt] section of the repo's .editorconfig.
curl -sSL -o .tools/bin/ktlint \
  "https://github.com/pinterest/ktlint/releases/latest/download/ktlint"
chmod +x .tools/bin/ktlint

# shfmt (Bash) and gofumpt (Go), both single Go binaries from their releases.
for tool in mvdan/sh:shfmt mvdan/gofumpt:gofumpt; do
  repo="${tool%%:*}"
  name="${tool##*:}"
  version="$(curl -sSL "https://api.github.com/repos/${repo}/releases/latest" |
    grep '"tag_name"' | head -1 | sed 's/.*"v\([^"]*\)".*/\1/')"
  arch="$(uname -m)"
  [ "$arch" = "arm64" ] || arch=amd64
  curl -sSL -o ".tools/bin/${name}" \
    "https://github.com/${repo}/releases/download/v${version}/${name}_v${version}_darwin_${arch}"
  chmod +x ".tools/bin/${name}"
done

echo "installed:"
.tools/bin/ruff --version
.tools/bin/sqlfluff --version
.tools/bin/ktlint --version
.tools/bin/google-java-format --version 2>&1 | head -1
.tools/bin/shfmt --version
.tools/bin/gofumpt --version
echo "swift-format: $(xcrun --find swift-format 2>/dev/null || echo 'not on this platform')"
