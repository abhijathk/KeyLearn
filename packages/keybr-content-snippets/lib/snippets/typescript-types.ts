import { type Snippet } from "../types.ts";

/**
 * The type system itself: annotations, inference, unions and narrowing.
 *
 * The part of TypeScript that is genuinely different from JavaScript, and the
 * part most people learn by absorbing rather than by reading the handbook —
 * which is exactly what a typing corpus is good for.
 */
export const typescriptTypes: readonly Snippet[] = [
  {
    id: "ts-annotate",
    title: "Annotate only what inference cannot reach",
    level: 1,
    tags: ["types"],
    code: `// The annotation on a literal is noise: TypeScript already knows. Save
// them for the boundaries — parameters, returns, and empty containers.
const name = "Ada";
const attempts = 0;
const scores: number[] = [];`,
  },
  {
    id: "ts-const-vs-let",
    title: "const narrows, let widens",
    level: 2,
    tags: ["types"],
    code: `// A const string literal has the literal as its type; a let has string.
// This is why a const reads as a constant to the type system too.
const method = "GET";
let verb = "GET";`,
  },
  {
    id: "ts-primitives",
    title: "The primitive types, and the ones to avoid",
    level: 1,
    tags: ["types"],
    code: `// Lower case, always: String and Number are the wrapper objects and are
// almost never what is meant.
let title: string;
let count: number;
let enabled: boolean;
let missing: null | undefined;`,
  },
  {
    id: "ts-any-unknown",
    title: "unknown instead of any",
    level: 3,
    tags: ["types", "narrowing"],
    code: `// any switches the checker off; unknown keeps it on and forces a check
// before use. At the edge of the program — JSON, a library without types —
// unknown is the one that keeps the rest of the code honest.
function parse(input: unknown): number {
  if (typeof input === "number") {
    return input;
  }
  throw new TypeError("expected a number");
}`,
  },
  {
    id: "ts-never",
    title: "never, and what it is for",
    level: 4,
    tags: ["types", "narrowing"],
    code: `// The type with no values. A function that always throws returns never,
// and a variable of type never is how exhaustiveness is proved below.
function fail(message: string): never {
  throw new Error(message);
}`,
  },
  {
    id: "ts-void-undefined",
    title: "void is not undefined",
    level: 3,
    tags: ["types"],
    code: `// void means "the return value is not to be used". undefined means the
// value really is undefined, and only the second can be assigned from.
function log(message: string): void {
  console.log(message);
}`,
  },
  {
    id: "ts-union",
    title: "A union type",
    level: 2,
    tags: ["types"],
    code: `// A value that is one of several things. The checker will not let you
// use it as either until you have established which.
type Id = string | number;
type Status = "draft" | "published" | "archived";`,
  },
  {
    id: "ts-literal-union",
    title: "A union of literals instead of a string",
    level: 2,
    tags: ["types"],
    code: `// The single highest-value habit in TypeScript. A misspelling is now a
// compile error, and the editor offers the three valid values.
function setStatus(status: "draft" | "published" | "archived"): void {
  element.dataset.status = status;
}`,
  },
  {
    id: "ts-intersection",
    title: "An intersection type",
    level: 3,
    tags: ["types"],
    code: `// Both at once, not either. Useful for adding a field to a type you do
// not own, and for composing small named pieces.
type Timestamped = { createdAt: Date; updatedAt: Date };
type Order = { id: string; total: number };
type StoredOrder = Order & Timestamped;`,
  },
  {
    id: "ts-narrow-typeof",
    title: "Narrow with typeof",
    level: 2,
    tags: ["narrowing"],
    code: `// Inside the branch the type is narrowed to string, so string methods
// are available without a cast.
function format(value: string | number): string {
  if (typeof value === "string") {
    return value.trim();
  }
  return value.toFixed(2);
}`,
  },
  {
    id: "ts-narrow-in",
    title: "Narrow with the in operator",
    level: 3,
    tags: ["narrowing"],
    code: `// Checking for a property distinguishes two object shapes without
// needing a class or a discriminant field.
function area(shape: { radius: number } | { side: number }): number {
  if ("radius" in shape) {
    return Math.PI * shape.radius ** 2;
  }
  return shape.side ** 2;
}`,
  },
  {
    id: "ts-narrow-instanceof",
    title: "Narrow with instanceof",
    level: 2,
    tags: ["narrowing", "errors"],
    code: `// The only reliable way to tell what was thrown: a catch parameter is
// unknown, and anything at all can be thrown in JavaScript.
try {
  await save();
} catch (error) {
  if (error instanceof TypeError) {
    console.error(error.message);
  }
}`,
  },
  {
    id: "ts-narrow-truthy",
    title: "Narrow by truthiness, and its one trap",
    level: 3,
    tags: ["narrowing"],
    code: `// A plain if removes null, undefined and the empty string together. When
// "" is a legitimate value, compare against null instead.
function greet(name: string | null): string {
  if (name != null) {
    return "Hello, " + name;
  }
  return "Hello";
}`,
  },
  {
    id: "ts-discriminated-union",
    title: "A discriminated union",
    level: 4,
    tags: ["narrowing", "types"],
    code: `// One shared literal field tells the branches apart, and the compiler
// narrows on it. The most useful pattern in the language.
type Result =
  | { kind: "success"; orders: Order[] }
  | { kind: "failure"; message: string }
  | { kind: "loading" };`,
  },
  {
    id: "ts-switch-exhaustive",
    title: "Prove a switch is exhaustive",
    level: 5,
    tags: ["narrowing"],
    code: `// In the default branch every case has been handled, so the value is
// never. Add a fourth kind above and this line stops compiling.
function render(result: Result): string {
  switch (result.kind) {
    case "success":
      return \`\${result.orders.length} orders\`;
    case "failure":
      return \`Failed: \${result.message}\`;
    case "loading":
      return "Loading…";
    default: {
      const unreachable: never = result;
      throw new Error(\`unhandled: \${String(unreachable)}\`);
    }
  }
}`,
  },
  {
    id: "ts-type-predicate",
    title: "A type guard of your own",
    level: 4,
    tags: ["narrowing"],
    code: `// The return type is what makes this useful: the compiler trusts it and
// narrows at every call site, so the check is written once.
function isOrder(value: unknown): value is Order {
  return typeof value === "object" && value !== null && "id" in value;
}`,
  },
  {
    id: "ts-assertion-function",
    title: "An assertion function",
    level: 5,
    tags: ["narrowing"],
    code: `// asserts narrows everything after the call rather than inside a branch,
// which suits a precondition better than an if does.
function assertDefined<T>(
  value: T | undefined,
  what: string,
): asserts value is T {
  if (value === undefined) {
    throw new Error(\`\${what} is not defined\`);
  }
}`,
  },
  {
    id: "ts-as-const",
    title: "as const, and what it freezes",
    level: 4,
    tags: ["types"],
    code: `// Without it this is string[]; with it, a readonly tuple of three exact
// literals. That is what lets a union be derived from it below.
const STATUSES = ["draft", "published", "archived"] as const;
type Status = (typeof STATUSES)[number];`,
  },
  {
    id: "ts-typeof-operator",
    title: "Derive a type from a value",
    level: 4,
    tags: ["types"],
    code: `// The type follows the object rather than being maintained beside it, so
// they cannot disagree.
const defaults = { retries: 3, timeout: 30, verbose: false };
type Options = typeof defaults;`,
  },
  {
    id: "ts-keyof",
    title: "The keys of a type, as a type",
    level: 4,
    tags: ["types"],
    code: `// A union of the literal key names. Passing anything else is a compile
// error, which is what makes a generic getter safe.
type OptionName = keyof Options;`,
  },
  {
    id: "ts-indexed-access",
    title: "Look a property type up by name",
    level: 4,
    tags: ["types"],
    code: `// Reaching into a type the way you would reach into a value. Survives
// the original being changed, which a copied annotation does not.
type Retries = Options["retries"];
type OrderItem = Order["items"][number];`,
  },
  {
    id: "ts-optional-property",
    title: "Optional versus possibly undefined",
    level: 3,
    tags: ["types"],
    code: `// The first may be left out entirely; the second must be present and may
// hold undefined. Under exactOptionalPropertyTypes they differ in what can
// be assigned, and the distinction starts to matter.
type A = { label?: string };
type B = { label: string | undefined };`,
  },
  {
    id: "ts-readonly",
    title: "readonly properties and arrays",
    level: 3,
    tags: ["types"],
    code: `// Compile-time only — nothing is frozen at run time — but it documents
// intent and catches the accidental push.
type Config = {
  readonly name: string;
  readonly tags: readonly string[];
};`,
  },
  {
    id: "ts-tuple",
    title: "A tuple, with its elements named",
    level: 3,
    tags: ["types"],
    code: `// Fixed length and a type per position. The labels do nothing at run
// time and everything for the person reading the signature.
type Range = [start: number, end: number];
type Entry = [key: string, value: unknown];`,
  },
  {
    id: "ts-record",
    title: "An object used as a dictionary",
    level: 3,
    tags: ["types"],
    code: `// Record says both halves at once. With noUncheckedIndexedAccess on,
// reading a key gives string | undefined, which is the honest answer.
const labels: Record<Status, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};`,
  },
  {
    id: "ts-index-signature",
    title: "An index signature",
    level: 4,
    tags: ["types"],
    code: `// For an object whose keys are not known ahead of time. Every declared
// property must be assignable to the signature's type.
type Headers = {
  [name: string]: string | undefined;
};`,
  },
  {
    id: "ts-satisfies",
    title: "satisfies: check without widening",
    level: 5,
    tags: ["types"],
    code: `// An annotation would widen each value to string; satisfies checks the
// shape and keeps the literal types, so routes.home is "/" and not string.
const routes = {
  home: "/",
  orders: "/orders",
} satisfies Record<string, \`/\${string}\`>;`,
  },
  {
    id: "ts-assertion-cast",
    title: "as, and why it is a claim rather than a check",
    level: 4,
    tags: ["types"],
    code: `// No conversion happens and nothing is verified: this only tells the
// compiler to stop asking. Every one is a place a bug can enter.
const element = document.getElementById("root") as HTMLDivElement;`,
  },
  {
    id: "ts-nullish",
    title: "?? and ?. and where they differ from || and .",
    level: 2,
    tags: ["narrowing"],
    code: `// ?? falls back only on null and undefined, so a legitimate 0 or "" is
// kept — which || would silently replace.
const port = config.port ?? 3000;
const host = config.server?.host ?? "localhost";`,
  },
  {
    id: "ts-non-null",
    title: "The non-null assertion, and its cost",
    level: 4,
    tags: ["narrowing"],
    code: `// Removes null and undefined from the type with no check at all. When
// it is wrong the failure is a run-time TypeError somewhere else.
const root = document.getElementById("root")!;`,
  },
  {
    id: "ts-enum-vs-union",
    title: "A const object instead of an enum",
    level: 4,
    tags: ["types"],
    code: `// enum emits real code and has surprising rules; this pattern gives the
// same ergonomics, erases completely, and works with plain JavaScript.
const Level = {
  Debug: "debug",
  Info: "info",
  Error: "error",
} as const;

type Level = (typeof Level)[keyof typeof Level];`,
  },
  {
    id: "ts-branded",
    title: "Two strings the compiler will not confuse",
    level: 5,
    tags: ["types"],
    code: `// A branded type: both are strings at run time, but passing a UserId
// where an OrderId is expected no longer compiles. Worth it wherever two
// ids of different things are passed side by side.
type UserId = string & { readonly brand: unique symbol };
type OrderId = string & { readonly brand: unique symbol };`,
  },
];
