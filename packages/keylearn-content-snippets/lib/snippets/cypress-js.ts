import { type Snippet } from "../types.ts";

/**
 * Cypress, in JavaScript.
 *
 * Cypress is not Playwright with different names. Its commands are enqueued
 * rather than awaited, every one retries its assertions until they pass or the
 * timeout expires, and the value a command yields is only reachable inside a
 * `.then()`. Most Cypress bugs are somebody writing it as if it were promises,
 * so a good share of this corpus is about that difference.
 */
export const cypressJs: readonly Snippet[] = [
  {
    id: "cy-first-test",
    title: "A test, start to finish",
    level: 1,
    tags: ["structure", "ui"],
    code: `// No async and no await: cy commands go into a queue that Cypress runs
// after the test body has finished registering them.
describe("sign in", () => {
  it("lets a known user in", () => {
    cy.visit("/login");
    cy.get("[data-cy=email]").type("ada@example.com");
    cy.get("[data-cy=password]").type("correct horse");
    cy.get("[data-cy=submit]").click();
    cy.location("pathname").should("eq", "/dashboard");
  });
});`,
  },
  {
    id: "cy-beforeeach",
    title: "Shared setup for every test in a block",
    level: 1,
    tags: ["structure"],
    code: `// beforeEach, not before: Cypress resets the browser between tests, so
// state set up once in before() is gone by the second one.
describe("dashboard", () => {
  beforeEach(() => {
    cy.visit("/dashboard");
  });
});`,
  },
  {
    id: "cy-data-cy",
    title: "Select by test attribute",
    level: 1,
    tags: ["locators"],
    code: `// A class is styling and an id is often generated. A data-cy attribute
// exists only for the tests, so a redesign cannot silently break them.
cy.get("[data-cy=submit]").click();`,
  },
  {
    id: "cy-contains",
    title: "Find by the text a user reads",
    level: 1,
    tags: ["locators"],
    code: `// Substring by default and case sensitive. Passing a selector first
// narrows it, which matters on a page where the word appears twice.
cy.contains("button", "Add to cart").click();`,
  },
  {
    id: "cy-within",
    title: "Scope commands to one region",
    level: 3,
    tags: ["locators"],
    code: `// Everything inside the callback is scoped to that element, so a generic
// selector cannot wander off and match the same thing in the header.
cy.get("[data-cy=cart]").within(() => {
  cy.get("[data-cy=total]").should("have.text", "$51.25");
  cy.get("button").contains("Checkout").click();
});`,
  },
  {
    id: "cy-find-vs-get",
    title: "find searches inside; get searches the document",
    level: 2,
    tags: ["locators"],
    code: `// cy.get() always starts from the root, even mid-chain. To stay inside
// the element you already have, the command is find().
cy.get("[data-cy=order-row]").first().find("[data-cy=status]").should("exist");`,
  },
  {
    id: "cy-eq-filter",
    title: "Pick one out of a list",
    level: 2,
    tags: ["locators"],
    code: `// eq() is zero-based. filter() takes a selector and keeps the matches,
// which survives the list being reordered in a way an index does not.
cy.get("[data-cy=row]").eq(2).should("contain", "KB-01");
cy.get("[data-cy=row]").filter(".unpaid").should("have.length", 3);`,
  },
  {
    id: "cy-should-visible",
    title: "The assertion that waits",
    level: 1,
    tags: ["assertions"],
    code: `// should() retries the whole chain until it passes or the timeout runs
// out, so this covers an element that appears a moment later on its own.
cy.get("[data-cy=toast]").should("be.visible").and("contain", "Saved");`,
  },
  {
    id: "cy-should-length",
    title: "Assert on a count",
    level: 2,
    tags: ["assertions"],
    code: `// Retried like any other assertion, so it waits for the list to finish
// rendering rather than counting whatever happens to be there first.
cy.get("[data-cy=result]").should("have.length", 12);`,
  },
  {
    id: "cy-not-exist",
    title: "Assert something has gone",
    level: 2,
    tags: ["assertions"],
    code: `// not.exist and not.be.visible are different claims. Use the first for
// an element removed from the DOM, the second for one merely hidden.
cy.get("[data-cy=spinner]").should("not.exist");`,
  },
  {
    id: "cy-should-callback",
    title: "An assertion that needs real logic",
    level: 4,
    tags: ["assertions"],
    code: `// The callback form is retried too, so anything inside it must be free
// of side effects — it may run a dozen times before it passes.
cy.get("[data-cy=price]").should(($prices) => {
  const values = $prices.toArray().map((el) => Number(el.dataset.value));
  expect(values).to.deep.equal([...values].sort((a, b) => a - b));
});`,
  },
  {
    id: "cy-then",
    title: "Reach the value a command yielded",
    level: 3,
    tags: ["assertions", "structure"],
    code: `// then() is the only way out of the queue and into ordinary JavaScript.
// It is not a promise: returning a value passes it to the next command.
cy.get("[data-cy=total]").then(($el) => {
  const total = Number($el.text().replace("$", ""));
  expect(total).to.be.greaterThan(0);
});`,
  },
  {
    id: "cy-alias",
    title: "Name something and use it later",
    level: 3,
    tags: ["structure"],
    code: `// An alias is re-queried when it is used, so it survives the element
// being re-rendered — which a variable holding the old node would not.
cy.get("[data-cy=cart]").as("cart");
cy.get("@cart").should("be.visible");`,
  },
  {
    id: "cy-variable-trap",
    title: "Why a variable does not work here",
    level: 4,
    tags: ["structure"],
    code: `// The commented line is the mistake everyone makes once. cy.get() returns
// a chainable, not the element, so the assignment yields nothing useful.
// const button = cy.get("[data-cy=submit]"); // does not do what it looks like
cy.get("[data-cy=submit]").as("submit");
cy.get("@submit").click();`,
  },
  {
    id: "cy-type-options",
    title: "Type into a field",
    level: 1,
    tags: ["actions"],
    code: `// delay 0 skips the per-character wait, which is worth it on a long
// string and worth keeping on a field with typeahead behaviour to test.
cy.get("[data-cy=search]").type("keyboard{enter}", { delay: 0 });`,
  },
  {
    id: "cy-clear-type",
    title: "Replace the contents of a field",
    level: 2,
    tags: ["actions"],
    code: `// type() appends. Without the clear() the field ends up holding the old
// value and the new one run together.
cy.get("[data-cy=quantity]").clear().type("3");`,
  },
  {
    id: "cy-select",
    title: "Choose from a select element",
    level: 2,
    tags: ["actions"],
    code: `// The argument matches the visible text or the value attribute. An array
// selects several, for a multiple select.
cy.get("[data-cy=country]").select("Australia");`,
  },
  {
    id: "cy-check-radio",
    title: "Checkboxes and radios",
    level: 2,
    tags: ["actions"],
    code: `// check() is idempotent where click() is not: on an already-ticked box,
// click unticks it and check leaves it alone.
cy.get("[data-cy=terms]").check();
cy.get("[data-cy=plan]").check("premium");`,
  },
  {
    id: "cy-force-click",
    title: "force: true, and when it is a mistake",
    level: 4,
    tags: ["actions"],
    code: `// force skips the actionability checks, so it also skips the bug where a
// cookie banner is covering the button. Reach for it only when the element
// is genuinely fine and Cypress is wrong about it.
cy.get("[data-cy=hidden-input]").type("value", { force: true });`,
  },
  {
    id: "cy-trigger",
    title: "Hover, and other events without a command",
    level: 4,
    tags: ["actions"],
    code: `// Cypress has no hover() because a real hover cannot be synthesised.
// Triggering the event is the honest approximation.
cy.get("[data-cy=menu]").trigger("mouseover");`,
  },
  {
    id: "cy-file-upload",
    title: "Attach a file",
    level: 3,
    tags: ["actions"],
    code: `// The fixture path is relative to cypress/fixtures, and selectFile is
// built in — no plugin needed since version 9.
cy.get("[data-cy=upload]").selectFile("cypress/fixtures/orders.csv");`,
  },
  {
    id: "cy-intercept-wait",
    title: "Wait for a request, not for a duration",
    level: 3,
    tags: ["network"],
    code: `// This is the single most valuable thing Cypress does. Waiting on the
// call is exact; cy.wait(2000) is a guess that is either slow or flaky.
cy.intercept("GET", "/api/orders").as("orders");
cy.visit("/orders");
cy.wait("@orders");`,
  },
  {
    id: "cy-intercept-stub",
    title: "Reply with a fixture instead of the server",
    level: 3,
    tags: ["network"],
    code: `// The test now covers the UI and nothing else, which makes it fast and
// makes a failure unambiguous about where the fault lies.
cy.intercept("GET", "/api/orders", { fixture: "orders.json" }).as("orders");`,
  },
  {
    id: "cy-intercept-error",
    title: "Force an error the server will not produce on demand",
    level: 4,
    tags: ["network"],
    code: `// The empty state and the error state are the two screens nobody tests,
// because reproducing them against a real backend is awkward.
cy.intercept("GET", "/api/orders", {
  statusCode: 500,
  body: { error: "Internal Server Error" },
}).as("failed");
cy.visit("/orders");
cy.get("[data-cy=error]").should("be.visible");`,
  },
  {
    id: "cy-intercept-delay",
    title: "Test the loading state",
    level: 4,
    tags: ["network"],
    code: `// Holding the response back is the only reliable way to assert on a
// spinner that would otherwise be gone before the assertion runs.
cy.intercept("GET", "/api/orders", (req) => {
  req.reply({ delay: 1000, fixture: "orders.json" });
});
cy.visit("/orders");
cy.get("[data-cy=spinner]").should("be.visible");`,
  },
  {
    id: "cy-intercept-assert",
    title: "Assert on what was actually sent",
    level: 4,
    tags: ["network"],
    code: `// The interception carries both halves of the exchange, so the request
// body can be checked as well as the response.
cy.wait("@createOrder").then(({ request, response }) => {
  expect(request.body).to.have.property("quantity", 2);
  expect(response.statusCode).to.eq(201);
});`,
  },
  {
    id: "cy-intercept-glob",
    title: "Match a family of URLs",
    level: 3,
    tags: ["network"],
    code: `// A glob pattern, so one intercept covers every id. The alias then
// applies to whichever of them the page happens to call.
cy.intercept("GET", "/api/orders/*").as("order");`,
  },
  {
    id: "cy-intercept-times",
    title: "Stub only the first call",
    level: 5,
    tags: ["network"],
    code: `// times limits how many calls the stub answers; after that they go
// through to the server. Useful for testing a retry.
cy.intercept(
  { method: "GET", url: "/api/orders", times: 1 },
  { statusCode: 503 },
);`,
  },
  {
    id: "cy-request-api",
    title: "Call an API directly",
    level: 2,
    tags: ["api"],
    code: `// cy.request goes over the network from Node, outside the browser, so it
// is not subject to CORS and does not touch the page under test.
cy.request("GET", "/api/orders").then((response) => {
  expect(response.status).to.eq(200);
  expect(response.body).to.be.an("array");
});`,
  },
  {
    id: "cy-request-post",
    title: "Create something through the API",
    level: 3,
    tags: ["api"],
    code: `// Setting up state through the API rather than the UI: faster, and a
// failure in the sign-up form no longer fails every other test.
cy.request("POST", "/api/orders", {
  sku: "KB-01",
  quantity: 2,
}).then((response) => {
  expect(response.status).to.eq(201);
  cy.wrap(response.body.id).as("orderId");
});`,
  },
  {
    id: "cy-request-failonstatus",
    title: "Assert on an error response",
    level: 3,
    tags: ["api"],
    code: `// By default a non-2xx fails the test outright. Turning that off is what
// lets the error path be asserted on rather than merely survived.
cy.request({
  method: "POST",
  url: "/api/orders",
  body: { quantity: -1 },
  failOnStatusCode: false,
}).then((response) => {
  expect(response.status).to.eq(422);
  expect(response.body.error.code).to.eq("VALIDATION_FAILED");
});`,
  },
  {
    id: "cy-request-headers",
    title: "Send an authenticated request",
    level: 3,
    tags: ["api"],
    code: `// The token comes from the environment, so the same spec runs against
// staging and against a local server without being edited.
cy.request({
  method: "GET",
  url: "/api/profile",
  headers: { Authorization: \`Bearer \${Cypress.env("token")}\` },
});`,
  },
  {
    id: "cy-request-schema",
    title: "Check the shape of a response",
    level: 4,
    tags: ["api"],
    code: `// Asserting on the contract rather than on the values, so the test does
// not have to be edited every time the seed data changes.
cy.request("GET", "/api/orders/1")
  .its("body")
  .should("include.keys", ["id", "status", "createdAt"]);`,
  },
  {
    id: "cy-its",
    title: "Reach into a property without a callback",
    level: 3,
    tags: ["api", "assertions"],
    code: `// its() is retried like any other command, so it waits for the property
// to exist rather than reading undefined and moving on.
cy.request("GET", "/api/orders")
  .its("body")
  .should("have.length.greaterThan", 0);`,
  },
  {
    id: "cy-session",
    title: "Log in once and reuse it",
    level: 5,
    tags: ["api", "structure"],
    code: `// cy.session caches the cookies and storage under the key, so the second
// test restores them instead of signing in again. On a large suite this is
// usually the single biggest saving available.
cy.session("ada", () => {
  cy.request("POST", "/api/session", {
    email: "ada@example.com",
    password: "correct horse",
  });
});`,
  },
  {
    id: "cy-custom-command",
    title: "A custom command",
    level: 4,
    tags: ["structure"],
    code: `// Registered once in cypress/support/commands.js and then available as
// cy.login() everywhere, so the login flow is described in one place.
Cypress.Commands.add("login", (email, password) => {
  cy.session([email, password], () => {
    cy.request("POST", "/api/session", { email, password });
  });
});`,
  },
  {
    id: "cy-fixture",
    title: "Load test data from a file",
    level: 2,
    tags: ["structure"],
    code: `// The fixture is read once and cached. Aliasing it makes the same data
// reachable from a later command without nesting the callbacks.
cy.fixture("orders.json").as("orders");`,
  },
  {
    id: "cy-env",
    title: "Read configuration from the environment",
    level: 3,
    tags: ["structure"],
    code: `// Set with CYPRESS_apiUrl in the shell or in cypress.env.json, so a
// credential never has to be committed alongside the spec.
const apiUrl = Cypress.env("apiUrl");`,
  },
  {
    id: "cy-data-driven",
    title: "The same test over a table of cases",
    level: 4,
    tags: ["structure"],
    code: `// The loop runs while the file is being read, so this registers three
// separate tests — each with its own name in the report.
const plans = ["basic", "standard", "premium"];

plans.forEach((plan) => {
  it(\`shows the price for \${plan}\`, () => {
    cy.visit(\`/plans/\${plan}\`);
    cy.get("[data-cy=price]").should("be.visible");
  });
});`,
  },
  {
    id: "cy-viewport",
    title: "Test at a phone size",
    level: 2,
    tags: ["ui"],
    code: `// Set before the visit, so the first render already knows the size and
// the mobile layout is what gets tested.
cy.viewport("iphone-x");
cy.visit("/");
cy.get("[data-cy=menu-toggle]").should("be.visible");`,
  },
  {
    id: "cy-clock",
    title: "Take control of time",
    level: 5,
    tags: ["ui"],
    code: `// Freezing the clock and stepping it forward tests a timeout in
// milliseconds rather than by actually waiting thirty seconds.
cy.clock();
cy.visit("/session");
cy.tick(30 * 60 * 1000);
cy.get("[data-cy=expired]").should("be.visible");`,
  },
  {
    id: "cy-a11y-focus",
    title: "Check the keyboard path",
    level: 4,
    tags: ["ui"],
    code: `// A form that cannot be completed from the keyboard is broken for more
// people than any browser-compatibility bug ever affects.
cy.get("[data-cy=email]").focus().should("have.focus");
cy.focused().should("have.attr", "data-cy", "email");`,
  },
  {
    id: "cy-download",
    title: "Assert a file was downloaded",
    level: 5,
    tags: ["ui"],
    code: `// Cypress writes downloads to a known folder, so the assertion is an
// ordinary file read rather than anything to do with the browser chrome.
cy.get("[data-cy=export]").click();
cy.readFile("cypress/downloads/orders.csv").should("contain", "order_id");`,
  },
  {
    id: "cy-config",
    title: "The configuration file",
    level: 3,
    tags: ["structure"],
    code: `// retries only on run, not on open: a test that passes on the second
// attempt in CI is worth having, but locally it hides the flake from you.
const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    viewportWidth: 1280,
    viewportHeight: 720,
    retries: { runMode: 2, openMode: 0 },
    video: false,
  },
});`,
  },
  {
    id: "cy-uncaught-exception",
    title: "Ignore an error you have decided to accept",
    level: 5,
    tags: ["structure"],
    code: `// Cypress fails a test on any uncaught exception from the app, which is
// usually right. Returning false suppresses it — narrow the condition, or
// this will hide the next real crash too.
Cypress.on("uncaught:exception", (err) => {
  return !err.message.includes("ResizeObserver loop");
});`,
  },
];
