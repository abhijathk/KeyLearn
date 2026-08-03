import { type Snippet } from "../types.ts";

/**
 * Functions, generics, and the type-level machinery built on them.
 *
 * Generics are where most people stall: the syntax is small and the intuition
 * is not, so the snippets here lead with the constraint — which is the part
 * that decides what a generic can actually do.
 */
export const typescriptFunctions: readonly Snippet[] = [
  {
    id: "ts-fn-signature",
    title: "Annotate the boundary, infer the inside",
    level: 1,
    tags: ["functions"],
    code: `// Parameters always need a type; the return type usually does not, but
// stating it on an exported function turns a mistake into an error here
// rather than at the call site.
function total(items: readonly Order[]): number {
  return items.reduce((sum, item) => sum + item.total, 0);
}`,
  },
  {
    id: "ts-fn-arrow",
    title: "An arrow function's type",
    level: 2,
    tags: ["functions"],
    code: `// The fat arrow in a type position means "a function that", not a
// function body. Reading it aloud helps: takes a string, returns a number.
type Parser = (input: string) => number;

const toLength: Parser = (input) => input.length;`,
  },
  {
    id: "ts-fn-optional-default",
    title: "Optional parameters and defaults",
    level: 2,
    tags: ["functions"],
    code: `// A default makes the parameter optional and gives it a non-optional
// type inside the body, which is why it needs no null check.
function paginate(items: readonly Order[], page = 1, perPage = 20): Order[] {
  return items.slice((page - 1) * perPage, page * perPage);
}`,
  },
  {
    id: "ts-fn-rest",
    title: "Rest parameters, typed",
    level: 3,
    tags: ["functions"],
    code: `// An array type on a rest parameter, and a tuple type when the arity is
// known — which lets the compiler check each position separately.
function join(separator: string, ...parts: string[]): string {
  return parts.join(separator);
}`,
  },
  {
    id: "ts-fn-object-param",
    title: "An options object instead of four booleans",
    level: 3,
    tags: ["functions"],
    code: `// Named at the call site, extensible without breaking anyone, and
// impossible to pass in the wrong order.
function request(
  url: string,
  { method = "GET", timeout = 30_000, retries = 0 }: RequestOptions = {},
): Promise<Response> {
  return fetch(url, { method, signal: AbortSignal.timeout(timeout) });
}`,
  },
  {
    id: "ts-fn-overload",
    title: "Overloads, when the return depends on the argument",
    level: 5,
    tags: ["functions"],
    code: `// The implementation signature is not callable — it only has to be
// compatible with both. Reach for a union return first; overloads are for
// when the caller genuinely needs to know which one it got.
function parse(input: string): number;
function parse(input: string[]): number[];
function parse(input: string | string[]): number | number[] {
  return Array.isArray(input) ? input.map(Number) : Number(input);
}`,
  },
  {
    id: "ts-fn-this",
    title: "Type the this a function expects",
    level: 5,
    tags: ["functions"],
    code: `// A fake first parameter that is erased at run time. It stops the
// function being called with the wrong receiver, which no other annotation
// can express.
function handleClick(this: HTMLButtonElement, event: MouseEvent): void {
  this.disabled = true;
}`,
  },
  {
    id: "ts-fn-callback",
    title: "A callback's type, and why the return is void",
    level: 4,
    tags: ["functions"],
    code: `// A void return in a callback type means "whatever you return will be
// ignored", so a function returning something is still assignable — which
// is why array.forEach accepts a one-line arrow.
type Listener = (event: Event) => void;`,
  },
  {
    id: "ts-generic-identity",
    title: "The smallest useful generic",
    level: 3,
    tags: ["generics"],
    code: `// The type parameter carries the caller's type through, so the return is
// exactly what went in — which unknown or any would both lose.
function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}`,
  },
  {
    id: "ts-generic-constraint",
    title: "Constrain a type parameter",
    level: 4,
    tags: ["generics"],
    code: `// The constraint is what makes the body legal: without it there is no
// length to read, and the compiler says so rather than trusting you.
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}`,
  },
  {
    id: "ts-generic-keyof",
    title: "A property getter that cannot be misused",
    level: 4,
    tags: ["generics"],
    code: `// K is one of T's actual keys, and the return is that property's type —
// so a typo is an error and the result needs no cast.
function pluck<T, K extends keyof T>(item: T, key: K): T[K] {
  return item[key];
}`,
  },
  {
    id: "ts-generic-default",
    title: "A default type parameter",
    level: 4,
    tags: ["generics"],
    code: `// Callers who do not care say nothing; callers who do, say it once. The
// default has to satisfy the constraint like any other argument.
type ApiResponse<T = unknown> = {
  status: number;
  body: T;
};`,
  },
  {
    id: "ts-generic-infer-call",
    title: "Let the call site infer the type argument",
    level: 3,
    tags: ["generics"],
    code: `// Passing the type explicitly is nearly always unnecessary, and it is
// how a wrong one gets locked in. Let inference do it.
const names = pluck(order, "id");`,
  },
  {
    id: "ts-generic-class",
    title: "A generic class",
    level: 4,
    tags: ["generics", "classes"],
    code: `// The parameter is fixed when the instance is created, so every method
// agrees about what is inside.
class Cache<T> {
  readonly #entries = new Map<string, T>();

  get(key: string): T | undefined {
    return this.#entries.get(key);
  }

  set(key: string, value: T): void {
    this.#entries.set(key, value);
  }
}`,
  },
  {
    id: "ts-generic-two-params",
    title: "Two type parameters, related by a constraint",
    level: 5,
    tags: ["generics"],
    code: `// Neither parameter is free: the second is derived from the first, which
// is what stops the two arguments drifting apart.
function groupBy<T, K extends string | number>(
  items: readonly T[],
  key: (item: T) => K,
): Record<K, T[]> {
  const groups = {} as Record<K, T[]>;
  for (const item of items) {
    (groups[key(item)] ??= []).push(item);
  }
  return groups;
}`,
  },
  {
    id: "ts-util-partial",
    title: "Partial, for an update payload",
    level: 3,
    tags: ["utility"],
    code: `// Every property optional. The right shape for a PATCH body, and the
// wrong one for anything that must be complete.
function update(id: string, changes: Partial<Order>): Promise<Order> {
  return api.patch(\`/orders/\${id}\`, changes);
}`,
  },
  {
    id: "ts-util-required-readonly",
    title: "Required and Readonly",
    level: 3,
    tags: ["utility"],
    code: `// The inverses of Partial and of a mutable type. Both are one level
// deep — a nested object keeps whatever it had.
type CompleteOrder = Required<Order>;
type FrozenOrder = Readonly<Order>;`,
  },
  {
    id: "ts-util-pick-omit",
    title: "Pick and Omit",
    level: 3,
    tags: ["utility"],
    code: `// Pick names what to keep and Omit names what to drop. Prefer Pick: it
// stays correct when a field is added to the source type.
type OrderSummary = Pick<Order, "id" | "total">;
type NewOrder = Omit<Order, "id" | "createdAt">;`,
  },
  {
    id: "ts-util-return-type",
    title: "The return type of a function, as a type",
    level: 4,
    tags: ["utility"],
    code: `// Derived rather than restated, so it cannot fall out of step with the
// function it describes.
type Loaded = ReturnType<typeof loadOrders>;
type LoadedValue = Awaited<ReturnType<typeof loadOrders>>;`,
  },
  {
    id: "ts-util-parameters",
    title: "A function's parameters, as a tuple",
    level: 5,
    tags: ["utility"],
    code: `// What makes a wrapper possible without repeating the signature — and
// without it silently diverging when the original changes.
function logged<F extends (...args: never[]) => unknown>(fn: F) {
  return (...args: Parameters<F>): ReturnType<F> => {
    console.log(fn.name, args);
    return fn(...args) as ReturnType<F>;
  };
}`,
  },
  {
    id: "ts-util-exclude-extract",
    title: "Exclude and Extract, on a union",
    level: 4,
    tags: ["utility"],
    code: `// They filter the members of a union. Exclude removes what matches;
// Extract keeps it.
type Settled = Exclude<Status, "draft">;
type Textual = Extract<Id, string>;`,
  },
  {
    id: "ts-util-nonnullable",
    title: "Drop null and undefined from a type",
    level: 3,
    tags: ["utility"],
    code: `// Pairs with a filter that removes them at run time, so the type and the
// value agree about what survived.
const defined = values.filter((v): v is NonNullable<typeof v> => v != null);`,
  },
  {
    id: "ts-mapped-type",
    title: "A mapped type",
    level: 5,
    tags: ["advanced"],
    code: `// How Partial and Readonly are themselves written. The modifiers can be
// added with + or removed with -.
type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};`,
  },
  {
    id: "ts-mapped-remap",
    title: "Rename the keys while mapping",
    level: 5,
    tags: ["advanced"],
    code: `// The as clause rewrites each key. This turns { total: number } into
// { getTotal: () => number }, which is how a getter type is generated.
type Getters<T> = {
  [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K];
};`,
  },
  {
    id: "ts-conditional-type",
    title: "A conditional type",
    level: 5,
    tags: ["advanced"],
    code: `// A ternary at the type level. Over a union it distributes, applying
// itself to each member and rebuilding the union from the results.
type Unwrap<T> = T extends Promise<infer U> ? U : T;`,
  },
  {
    id: "ts-infer",
    title: "infer, for pulling a type back out",
    level: 5,
    tags: ["advanced"],
    code: `// infer declares a type variable inside the condition and binds it to
// whatever matched. It is the only way to reach inside a generic type.
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;`,
  },
  {
    id: "ts-template-literal-type",
    title: "A template literal type",
    level: 5,
    tags: ["advanced"],
    code: `// Strings checked by shape rather than by an enumerated list, so a route
// must start with a slash and an event must be one of nine combinations.
type Route = \`/\${string}\`;
type EventName = \`\${"mouse" | "key" | "touch"}\${"down" | "up" | "move"}\`;`,
  },
  {
    id: "ts-recursive-type",
    title: "A recursive type",
    level: 5,
    tags: ["advanced"],
    code: `// JSON described exactly, in five lines. Recursion at the type level is
// allowed as long as it goes through an object or an array.
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };`,
  },
  {
    id: "ts-deep-partial",
    title: "A recursive utility type",
    level: 5,
    tags: ["advanced"],
    code: `// Partial one level deep is rarely what a config merge needs. This is
// the version that goes all the way down.
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};`,
  },
];
