import { type Snippet } from "../types.ts";

/**
 * Modern JavaScript, without the types.
 *
 * The language as it stands now: modules, optional chaining, top-level await,
 * the newer array methods. Deliberately overlaps very little with the
 * TypeScript corpus — anyone practising both should be meeting the parts that
 * are genuinely JavaScript's rather than the same code twice.
 */
export const webJavascript: readonly Snippet[] = [
  {
    id: "js-const-let",
    title: "const by default, let when it must change",
    level: 1,
    tags: ["basics"],
    code: `// var is function-scoped and hoisted, which is a source of bugs and no
// longer a source of anything else. There is no reason to write it.
const orders = [];
let attempts = 0;`,
  },
  {
    id: "js-template-literal",
    title: "Template literals",
    level: 1,
    tags: ["basics"],
    code: `// Interpolation and real newlines, so a multi-line string needs no
// concatenation and no escaped \\n.
const message = \`Order \${order.id} totals \${order.total.toFixed(2)}\`;`,
  },
  {
    id: "js-destructure",
    title: "Destructure, with defaults and renaming",
    level: 2,
    tags: ["basics"],
    code: `// The colon renames and the equals supplies a default. Both apply to
// function parameters too, which is where they earn the most.
const { id, total = 0, customer: buyer } = order;`,
  },
  {
    id: "js-spread-rest",
    title: "Spread and rest",
    level: 2,
    tags: ["basics"],
    code: `// The same three dots: spreading out on the right, collecting up on the
// left. Both make shallow copies, which is usually what you want.
const copy = { ...order, total: 0 };
const [first, ...others] = orders;`,
  },
  {
    id: "js-optional-chaining",
    title: "Optional chaining and nullish coalescing",
    level: 2,
    tags: ["basics"],
    code: `// ?? falls back only on null and undefined, so a legitimate 0 or empty
// string survives — which || would silently replace.
const city = order.customer?.address?.city ?? "unknown";`,
  },
  {
    id: "js-logical-assignment",
    title: "The logical assignment operators",
    level: 3,
    tags: ["basics"],
    code: `// ??= assigns only when the target is null or undefined, and it does not
// evaluate the right-hand side otherwise.
config.retries ??= 3;
cache[key] ??= await load(key);`,
  },
  {
    id: "js-arrow-vs-function",
    title: "An arrow function has no this of its own",
    level: 3,
    tags: ["functions"],
    code: `// Which is exactly why it works inside a callback and does not work as
// an object method that needs to read this.
element.addEventListener("click", () => {
  this.count += 1;
});`,
  },
  {
    id: "js-default-params",
    title: "Default parameters, evaluated at call time",
    level: 3,
    tags: ["functions"],
    code: `// A fresh array each call. The old pattern of a default object literal
// in the signature shares one instance in some languages; not here.
function paginate(items, page = 1, perPage = 20) {
  return items.slice((page - 1) * perPage, page * perPage);
}`,
  },
  {
    id: "js-closure",
    title: "A closure",
    level: 3,
    tags: ["functions"],
    code: `// count is private and persists between calls. The whole module pattern
// is this idea, and so is most of what a framework calls a hook.
function counter() {
  let count = 0;
  return () => (count += 1);
}`,
  },
  {
    id: "js-array-methods",
    title: "The array methods worth knowing by heart",
    level: 2,
    tags: ["arrays"],
    code: `// Each returns a new array, so the source is untouched and the chain
// reads in the order the work happens.
const ids = orders
  .filter((order) => order.total > 100)
  .sort((a, b) => b.total - a.total)
  .map((order) => order.id);`,
  },
  {
    id: "js-reduce",
    title: "reduce, with its initial value",
    level: 3,
    tags: ["arrays"],
    code: `// The initial value is not optional in practice: without it, reduce on
// an empty array throws rather than returning zero.
const revenue = orders.reduce((sum, order) => sum + order.total, 0);`,
  },
  {
    id: "js-group-by",
    title: "Group into an object",
    level: 4,
    tags: ["arrays"],
    code: `// Object.groupBy does this in one call where it is available; this is
// the version that runs everywhere.
const byCountry = {};
for (const order of orders) {
  (byCountry[order.country] ??= []).push(order);
}`,
  },
  {
    id: "js-at",
    title: "The last element, without the arithmetic",
    level: 2,
    tags: ["arrays"],
    code: `// at() takes a negative index. items[items.length - 1] is the same thing
// written three times as long and with one more chance to be wrong.
const newest = orders.at(-1);`,
  },
  {
    id: "js-flat-methods",
    title: "flat and flatMap",
    level: 3,
    tags: ["arrays"],
    code: `// flatMap is map then flat in one pass, and returning an empty array is
// how an element gets dropped.
const skus = orders.flatMap((order) => order.items.map((item) => item.sku));`,
  },
  {
    id: "js-immutable-array",
    title: "Sort without mutating",
    level: 4,
    tags: ["arrays"],
    code: `// sort() sorts in place, which surprises everyone once. toSorted returns
// a new array, as do toReversed and toSpliced.
const ranked = orders.toSorted((a, b) => b.total - a.total);`,
  },
  {
    id: "js-object-methods",
    title: "Turn an object into entries and back",
    level: 3,
    tags: ["objects"],
    code: `// The round trip through entries is how an object is mapped over, since
// there is no Object.map.
const upper = Object.fromEntries(
  Object.entries(labels).map(([key, value]) => [key, value.toUpperCase()]),
);`,
  },
  {
    id: "js-map-vs-object",
    title: "A Map, when the keys are not strings",
    level: 3,
    tags: ["objects"],
    code: `// A Map keeps insertion order, takes any key type, and has a real size.
// An object coerces every key to a string.
const byId = new Map(orders.map((order) => [order.id, order]));`,
  },
  {
    id: "js-set",
    title: "A Set, for uniqueness",
    level: 2,
    tags: ["objects"],
    code: `// The shortest way to deduplicate an array, and the fastest way to ask
// whether something has been seen.
const countries = [...new Set(orders.map((order) => order.country))];`,
  },
  {
    id: "js-structured-clone",
    title: "A deep copy, built in",
    level: 4,
    tags: ["objects"],
    code: `// Handles dates, maps, sets and cycles, which the JSON round trip
// silently destroys.
const snapshot = structuredClone(state);`,
  },
  {
    id: "js-async-await",
    title: "async and await",
    level: 2,
    tags: ["async"],
    code: `// fetch only rejects on a network failure, so a 404 arrives as a
// resolved response. Checking ok is not optional.
async function loadOrder(id) {
  const response = await fetch(\`/api/orders/\${id}\`);
  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}\`);
  }
  return response.json();
}`,
  },
  {
    id: "js-promise-all",
    title: "Run several at once",
    level: 3,
    tags: ["async"],
    code: `// Awaiting each in turn makes the total wait the sum. This makes it the
// slowest of the two.
const [orders, profile] = await Promise.all([loadOrders(), loadProfile()]);`,
  },
  {
    id: "js-promise-allsettled",
    title: "When one failure should not lose the rest",
    level: 4,
    tags: ["async"],
    code: `// allSettled never rejects, so every result is inspectable — which is
// what a batch of independent requests needs.
const results = await Promise.allSettled(ids.map(loadOrder));
const loaded = results
  .filter((r) => r.status === "fulfilled")
  .map((r) => r.value);`,
  },
  {
    id: "js-abort",
    title: "Cancel a request",
    level: 4,
    tags: ["async"],
    code: `// AbortSignal.timeout is the short form for the common case, and the
// rejection it produces is a TimeoutError rather than a generic abort.
const response = await fetch(url, { signal: AbortSignal.timeout(5000) });`,
  },
  {
    id: "js-async-iteration",
    title: "for await, over an async iterable",
    level: 5,
    tags: ["async"],
    code: `// A stream consumed a chunk at a time, so nothing is held in memory that
// has not been asked for.
for await (const chunk of response.body) {
  process(chunk);
}`,
  },
  {
    id: "js-generator",
    title: "A generator",
    level: 5,
    tags: ["async"],
    code: `// Lazy and infinite: nothing is computed until the caller asks for the
// next value, so an unbounded sequence is safe to express.
function* fibonacci() {
  let [previous, current] = [0, 1];
  while (true) {
    yield current;
    [previous, current] = [current, previous + current];
  }
}`,
  },
  {
    id: "js-error-cause",
    title: "Throw with a cause",
    level: 4,
    tags: ["errors"],
    code: `// The cause option keeps the original error attached, so the stack trace
// still says what actually failed underneath.
try {
  await save(order);
} catch (error) {
  throw new Error(\`could not save \${order.id}\`, { cause: error });
}`,
  },
  {
    id: "js-custom-error",
    title: "An error type of your own",
    level: 3,
    tags: ["errors"],
    code: `// Setting name is what makes the message read correctly and what lets a
// catch block tell one failure from another.
class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}`,
  },
  {
    id: "js-modules",
    title: "Named exports, and importing them",
    level: 2,
    tags: ["modules"],
    code: `// Named exports rename consistently and can be found by searching. A
// default export takes a new name at every import site.
export { loadOrder, saveOrder };
import { loadOrder } from "./orders.js";`,
  },
  {
    id: "js-dynamic-import",
    title: "Load a module only when it is needed",
    level: 4,
    tags: ["modules"],
    code: `// Returns a promise, so the module is fetched at the point of use rather
// than being in the initial bundle.
const { renderChart } = await import("./chart.js");`,
  },
  {
    id: "js-top-level-await",
    title: "await, at the top of a module",
    level: 3,
    tags: ["modules"],
    code: `// No wrapper function. Anything importing this module waits for it,
// which is the point and also the thing to be careful about.
const config = await fetch("/config.json").then((r) => r.json());`,
  },
  {
    id: "js-dom-query",
    title: "Find elements in the document",
    level: 2,
    tags: ["dom"],
    code: `// querySelectorAll returns a static NodeList, so it does not change
// underneath a loop the way getElementsByClassName does.
const button = document.querySelector("[data-action=save]");
const rows = document.querySelectorAll("[data-row]");`,
  },
  {
    id: "js-dom-delegation",
    title: "One listener instead of many",
    level: 4,
    tags: ["dom"],
    code: `// closest() finds the nearest matching ancestor, so this keeps working
// for rows added after the listener was attached.
table.addEventListener("click", (event) => {
  const row = event.target.closest("[data-row]");
  if (row !== null) {
    select(row.dataset.id);
  }
});`,
  },
  {
    id: "js-dom-create",
    title: "Build an element without innerHTML",
    level: 3,
    tags: ["dom"],
    code: `// textContent escapes nothing because it interprets nothing, which is
// what makes it safe where innerHTML is an injection waiting to happen.
const item = document.createElement("li");
item.textContent = order.id;
item.dataset.total = order.total;`,
  },
  {
    id: "js-dom-fragment",
    title: "Insert many nodes at once",
    level: 4,
    tags: ["dom"],
    code: `// One insertion instead of a hundred, so the browser lays the page out
// once rather than after every append.
const fragment = document.createDocumentFragment();
for (const order of orders) {
  fragment.append(render(order));
}
list.append(fragment);`,
  },
  {
    id: "js-debounce",
    title: "Debounce an input handler",
    level: 4,
    tags: ["dom"],
    code: `// Waits until the typing stops. A throttle, by contrast, runs at a fixed
// rate — right for scroll, wrong for search.
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}`,
  },
  {
    id: "js-intl",
    title: "Format for the reader's locale",
    level: 3,
    tags: ["basics"],
    code: `// Built in, and correct for every locale — including the ones that use a
// comma as the decimal separator and put the symbol on the other side.
const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
}).format(order.total);`,
  },
];
