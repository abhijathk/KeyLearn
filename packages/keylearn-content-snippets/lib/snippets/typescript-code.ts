import { type Snippet } from "../types.ts";

/**
 * Writing the code, rather than describing it: interfaces, classes,
 * collections, asynchrony, modules and error handling.
 *
 * Most of a TypeScript file is still JavaScript, and this is that part — with
 * the annotations where a real codebase puts them and not one more.
 */
export const typescriptCode: readonly Snippet[] = [
  {
    id: "ts-interface",
    title: "An interface",
    level: 2,
    tags: ["interfaces"],
    code: `// Interfaces are open: two declarations of the same name merge. That is
// occasionally what you want and usually a surprise.
interface Order {
  readonly id: string;
  quantity: number;
  total: number;
  createdAt: Date;
}`,
  },
  {
    id: "ts-type-vs-interface",
    title: "type or interface",
    level: 3,
    tags: ["interfaces"],
    code: `// A type alias can name anything — a union, a tuple, a primitive — and
// cannot be reopened. An interface can only describe an object shape. The
// usual rule: type by default, interface when you want it extensible.
type Id = string | number;

interface Timestamped {
  createdAt: Date;
}`,
  },
  {
    id: "ts-interface-extends",
    title: "Extend an interface",
    level: 3,
    tags: ["interfaces"],
    code: `// Several at once is allowed, and the compiler checks the result is
// coherent — which an intersection of type aliases does not.
interface StoredOrder extends Order, Timestamped {
  version: number;
}`,
  },
  {
    id: "ts-implements",
    title: "A class that implements an interface",
    level: 3,
    tags: ["classes", "interfaces"],
    code: `// implements checks the class without changing it. The type of the class
// is still whatever it declares, so extra members stay visible.
class InMemoryRepository implements OrderRepository {
  async findById(id: string): Promise<Order | null> {
    return this.#orders.get(id) ?? null;
  }
}`,
  },
  {
    id: "ts-class-fields",
    title: "A class, with its fields declared",
    level: 2,
    tags: ["classes"],
    code: `// Under strictPropertyInitialization every field must be assigned in the
// constructor or given a default, which removes a whole class of undefined.
class Order {
  readonly id: string;
  quantity = 1;

  constructor(id: string) {
    this.id = id;
  }
}`,
  },
  {
    id: "ts-parameter-properties",
    title: "Declare and assign in one line",
    level: 3,
    tags: ["classes"],
    code: `// A modifier on a constructor parameter declares the field and assigns
// it. TypeScript-only syntax, and the one piece of it worth the exception.
class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly clock: Clock,
  ) {}
}`,
  },
  {
    id: "ts-private-field",
    title: "#private, not private",
    level: 4,
    tags: ["classes"],
    code: `// The keyword is checked at compile time and gone at run time; the hash
// is real and enforced by the engine. Prefer the hash for anything that
// must actually stay private.
class Cache {
  readonly #entries = new Map<string, unknown>();
}`,
  },
  {
    id: "ts-getter-setter",
    title: "An accessor pair",
    level: 3,
    tags: ["classes"],
    code: `// From the outside these look like a property, which is the point: the
// validation can be added later without changing a single call site.
class Order {
  #quantity = 1;

  get quantity(): number {
    return this.#quantity;
  }

  set quantity(value: number) {
    if (value < 1) {
      throw new RangeError("quantity must be at least 1");
    }
    this.#quantity = value;
  }
}`,
  },
  {
    id: "ts-static",
    title: "A static factory",
    level: 3,
    tags: ["classes"],
    code: `// A named constructor. It can validate, it can fail, and it can return
// a cached instance — none of which a constructor can do well.
class Money {
  private constructor(readonly cents: number) {}

  static fromDollars(dollars: number): Money {
    return new Money(Math.round(dollars * 100));
  }
}`,
  },
  {
    id: "ts-abstract",
    title: "An abstract base class",
    level: 4,
    tags: ["classes"],
    code: `// Cannot be instantiated, and the abstract members must be supplied by
// every subclass — checked at compile time rather than thrown at run time.
abstract class Reporter {
  abstract format(result: Result): string;

  print(result: Result): void {
    console.log(this.format(result));
  }
}`,
  },
  {
    id: "ts-array-methods",
    title: "The array methods, with their types",
    level: 2,
    tags: ["collections"],
    code: `// Each step's type follows from the last, so the final value is known to
// be a number without a single annotation.
const revenue = orders
  .filter((order) => order.status === "published")
  .map((order) => order.total)
  .reduce((sum, total) => sum + total, 0);`,
  },
  {
    id: "ts-array-find-undefined",
    title: "find returns undefined, and the type says so",
    level: 2,
    tags: ["collections"],
    code: `// The union is not pedantry: an empty result is the normal case, and
// this is where the check belongs.
const order = orders.find((item) => item.id === id);
if (order === undefined) {
  throw new Error(\`no order \${id}\`);
}`,
  },
  {
    id: "ts-array-flatmap",
    title: "flatMap, for one-to-many",
    level: 3,
    tags: ["collections"],
    code: `// map followed by flat, in one pass. Returning an empty array from the
// callback is how an element is dropped.
const skus = orders.flatMap((order) => order.items.map((item) => item.sku));`,
  },
  {
    id: "ts-map-set",
    title: "Map and Set, typed",
    level: 2,
    tags: ["collections"],
    code: `// A Map keeps insertion order and accepts any key type; a plain object
// does neither. get returns the union with undefined, as it must.
const byId = new Map<string, Order>();
const seen = new Set<string>();`,
  },
  {
    id: "ts-object-entries",
    title: "Iterate an object's entries",
    level: 3,
    tags: ["collections"],
    code: `// Object.entries widens the key back to string — a known limitation, not
// a mistake — so a cast is needed when the exact key type matters.
for (const [key, value] of Object.entries(defaults)) {
  console.log(\`\${key} = \${String(value)}\`);
}`,
  },
  {
    id: "ts-destructure",
    title: "Destructure with types and defaults",
    level: 2,
    tags: ["collections"],
    code: `// The annotation goes on the whole pattern, not on each name inside it —
// the colon inside a pattern means renaming, which is a common first trip.
const { id, total = 0 }: Order = await loadOrder();`,
  },
  {
    id: "ts-spread",
    title: "Copy an object with one field changed",
    level: 2,
    tags: ["collections"],
    code: `// Shallow: nested objects are shared with the original. That is usually
// fine and occasionally the source of a very confusing bug.
const discounted = { ...order, total: order.total * 0.9 };`,
  },
  {
    id: "ts-async-await",
    title: "An async function",
    level: 2,
    tags: ["async"],
    code: `// async always wraps the return in a promise, so the annotation is
// Promise<Order> even though the body returns an Order.
async function loadOrder(id: string): Promise<Order> {
  const response = await fetch(\`/api/orders/\${id}\`);
  return (await response.json()) as Order;
}`,
  },
  {
    id: "ts-promise-all",
    title: "Run several at once",
    level: 3,
    tags: ["async"],
    code: `// Promise.all preserves the tuple's types position by position, so
// destructuring gives two correctly typed values and not two unknowns.
const [orders, profile] = await Promise.all([loadOrders(), loadProfile()]);`,
  },
  {
    id: "ts-promise-allsettled",
    title: "When one failure should not lose the rest",
    level: 4,
    tags: ["async"],
    code: `// allSettled never rejects. The status field is a discriminant, so the
// narrowing inside the filter is real and value is safe to read.
const results = await Promise.allSettled(ids.map(loadOrder));
const loaded = results
  .filter((r) => r.status === "fulfilled")
  .map((r) => r.value);`,
  },
  {
    id: "ts-await-loop",
    title: "Sequential when it has to be",
    level: 3,
    tags: ["async"],
    code: `// A for..of with an await inside runs one at a time, which is right when
// each step depends on the last and wrong when they are independent.
for (const id of ids) {
  await archive(id);
}`,
  },
  {
    id: "ts-abort",
    title: "Cancel an in-flight request",
    level: 4,
    tags: ["async"],
    code: `// The signal is the standard way to cancel, and the same controller can
// abort several requests at once.
const controller = new AbortController();
const response = await fetch(url, { signal: controller.signal });`,
  },
  {
    id: "ts-async-iterator",
    title: "An async generator",
    level: 5,
    tags: ["async"],
    code: `// Pages fetched lazily, one at a time, consumed with for await. Nothing
// is held in memory that the caller has not asked for yet.
async function* pages(url: string): AsyncGenerator<Order[]> {
  let next: string | null = url;
  while (next !== null) {
    const response = await fetch(next);
    const body = (await response.json()) as Page;
    yield body.items;
    next = body.next;
  }
}`,
  },
  {
    id: "ts-error-class",
    title: "An error type of your own",
    level: 3,
    tags: ["errors"],
    code: `// The name assignment is not decoration: without it every instance
// reports "Error", and cause carries the original for the stack trace.
class ValidationError extends Error {
  constructor(
    readonly field: string,
    message: string,
    options?: { cause: unknown },
  ) {
    super(message, options);
    this.name = "ValidationError";
  }
}`,
  },
  {
    id: "ts-catch-unknown",
    title: "The catch parameter is unknown",
    level: 3,
    tags: ["errors"],
    code: `// Anything can be thrown, including a string, so the check is required
// before message can be read. useUnknownInCatchVariables makes it so.
try {
  await save(order);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
}`,
  },
  {
    id: "ts-result-type",
    title: "Return a failure instead of throwing",
    level: 4,
    tags: ["errors"],
    code: `// The caller cannot ignore it: the union has to be narrowed before
// either field can be read, which a try/catch never forces.
type Outcome<T> = { ok: true; value: T } | { ok: false; error: Error };`,
  },
  {
    id: "ts-import-type",
    title: "Import a type as a type",
    level: 3,
    tags: ["modules"],
    code: `// Under verbatimModuleSyntax this is required, and it is worth having
// anyway: the import is erased, so it cannot cause a runtime cycle.
import { type Order, createOrder } from "./order.ts";`,
  },
  {
    id: "ts-export-shapes",
    title: "Named exports, and one default at most",
    level: 2,
    tags: ["modules"],
    code: `// Named exports rename consistently, autocomplete, and can be found by
// grep. A default export is a new name at every import site.
export { loadOrder, saveOrder };
export type { Order, OrderStatus };`,
  },
  {
    id: "ts-barrel",
    title: "A module's public surface, in one file",
    level: 3,
    tags: ["modules"],
    code: `// Re-exporting deliberately rather than exporting everything is what
// keeps a package's surface small enough to change later.
export { CodeLesson } from "./code.ts";
export { GuidedLesson } from "./guided.ts";
export type { Lesson } from "./lesson.ts";`,
  },
  {
    id: "ts-declaration-merging",
    title: "Add to a type you do not own",
    level: 5,
    tags: ["modules"],
    code: `// Module augmentation: the interface is reopened and merged. The only
// way to type a library's extension point without forking its types.
declare module "@playwright/test" {
  interface TestFixtures {
    signedInPage: Page;
  }
}`,
  },
  {
    id: "ts-ambient",
    title: "Describe something that exists at run time",
    level: 5,
    tags: ["modules"],
    code: `// declare says "this exists, take my word for it" and emits nothing. For
// a global a bundler injects, this is the honest way to say so.
declare global {
  const BUILD_VERSION: string;
}`,
  },
];
