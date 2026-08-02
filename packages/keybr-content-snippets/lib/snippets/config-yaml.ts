import { type Snippet } from "../types.ts";

/**
 * YAML, as pipelines and manifests are actually written.
 *
 * Worth practising for a reason no other language here shares: indentation is
 * syntax. A stray space is a different document, not a formatting preference,
 * and the failure usually shows up as a job that silently does nothing rather
 * than an error that says where.
 */
export const configYaml: readonly Snippet[] = [
  {
    id: "yaml-scalars",
    title: "Keys, values and the types they imply",
    level: 1,
    tags: ["yaml", "syntax"],
    code: `# Unquoted values are typed by shape: this is a string, a number and a
# boolean, in that order, whether or not that was intended.
name: keylearn
version: 1.4
private: true`,
  },
  {
    id: "yaml-quoting",
    title: "When a value has to be quoted",
    level: 3,
    tags: ["yaml", "syntax"],
    code: `# The famous ones: unquoted, "no" is a boolean and 1.10 loses its zero.
# Version numbers and country codes want quotes for exactly this reason.
country: "NO"
version: "1.10"
port: "8080"`,
  },
  {
    id: "yaml-nesting",
    title: "Nested maps",
    level: 1,
    tags: ["yaml", "syntax"],
    code: `# Two spaces per level, and never a tab: a tab is invalid YAML and the
# parser's complaint rarely points at the line that caused it.
server:
  host: localhost
  port: 4000
  tls:
    enabled: false`,
  },
  {
    id: "yaml-lists",
    title: "Lists, and lists of maps",
    level: 2,
    tags: ["yaml", "syntax"],
    code: `# A dash starts an item; the keys of a map item line up under it.
workspaces:
  - packages/*
  - scripts
projects:
  - name: chromium
    retries: 2
  - name: firefox
    retries: 0`,
  },
  {
    id: "yaml-multiline",
    title: "Multi-line strings, folded and literal",
    level: 3,
    tags: ["yaml", "syntax"],
    code: `# The pipe keeps the newlines; the angle bracket folds them into spaces.
# Choosing the wrong one turns a shell script into one very long line.
script: |
  npm ci
  npm run build
  npm test
description: >
  A long sentence that will be joined back together
  into a single line when it is read.`,
  },
  {
    id: "yaml-anchors",
    title: "Define once, reuse with an anchor",
    level: 4,
    tags: ["yaml", "syntax"],
    code: `# The anchor names a block and the merge key pulls it in. Handy, and
# unsupported by enough tools that it is worth checking before relying on it.
defaults: &defaults
  retries: 2
  timeout: 30

unit:
  <<: *defaults
  name: unit`,
  },
  {
    id: "yaml-null-empty",
    title: "Empty values and explicit nulls",
    level: 3,
    tags: ["yaml", "syntax"],
    code: `# A key with nothing after it is null, not an empty string. Tools that
# treat the two the same are the reason this catches people out.
retries:
timeout: null
label: ""`,
  },
  {
    id: "yaml-ci-workflow",
    title: "A CI workflow",
    level: 3,
    tags: ["yaml", "ci"],
    code: `# Pinning an action to a major version rather than a branch: the branch
# moves, and a build that passed yesterday is not evidence about today.
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm test`,
  },
  {
    id: "yaml-ci-matrix",
    title: "Run the same job across several versions",
    level: 4,
    tags: ["yaml", "ci"],
    code: `# fail-fast false is the setting worth knowing: left true, the first
# failing combination cancels the rest and hides how wide the problem is.
strategy:
  fail-fast: false
  matrix:
    node: [20, 22, 24]
    os: [ubuntu-latest, macos-latest]`,
  },
  {
    id: "yaml-compose",
    title: "A container composition",
    level: 3,
    tags: ["yaml", "docker"],
    code: `# The healthcheck is what makes depends_on mean "ready" rather than
# "started", which is the difference between a working stack and a race.
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: example
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      retries: 5`,
  },
  {
    id: "yaml-k8s-deployment",
    title: "A Kubernetes deployment",
    level: 5,
    tags: ["yaml", "kubernetes"],
    code: `# The selector must match the pod template's labels. When they disagree
# the deployment reports success and manages nothing at all.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keylearn
spec:
  replicas: 3
  selector:
    matchLabels:
      app: keylearn
  template:
    metadata:
      labels:
        app: keylearn
    spec:
      containers:
        - name: web
          image: keylearn:1.4.0
          ports:
            - containerPort: 3000`,
  },
  {
    id: "yaml-k8s-resources",
    title: "Resource requests and limits",
    level: 5,
    tags: ["yaml", "kubernetes"],
    code: `# Requests decide where the pod is scheduled; limits decide when it is
# throttled or killed. Setting only the limit is how pods land badly.
resources:
  requests:
    memory: 256Mi
    cpu: 250m
  limits:
    memory: 512Mi
    cpu: 500m`,
  },
];
