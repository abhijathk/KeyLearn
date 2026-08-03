import { type Snippet } from "../types.ts";

/**
 * Testing an API directly, with no browser in the way.
 *
 * Playwright's `request` fixture is a full HTTP client, which makes it the
 * shortest path from "the UI works" to "the thing behind the UI works". Two
 * habits run through this whole set and are worth absorbing rather than being
 * told: assert the status before reading the body, because a 500 whose body
 * you parse produces a confusing failure three lines later; and set data up
 * over the API rather than by clicking through the UI, because a test that
 * spends thirty seconds arranging its own preconditions is a test nobody runs.
 */
export const api: readonly Snippet[] = [
  {
    id: "pw-api-get",
    title: "A GET request and its status",
    level: 1,
    tags: ["api", "request"],
    code: `// Assert the status before touching the body — parsing the body of a 500
// fails three lines later with a far less useful message.
const response = await request.get('/api/health');
expect(response.status()).toBe(200);`,
  },
  {
    id: "pw-api-ok",
    title: "Assert any 2xx rather than one exact code",
    level: 1,
    tags: ["api", "request"],
    code: `// ok() covers any 2xx, which is what you want when the endpoint may
// legitimately answer 200 or 204.
const response = await request.get('/api/products');
expect(response.ok()).toBeTruthy();`,
  },
  {
    id: "pw-api-json",
    title: "Read the body as JSON",
    level: 1,
    tags: ["api", "request"],
    code: `// Parsed once into a variable: calling json() twice on one response
// throws, because the body has already been consumed.
const response = await request.get('/api/products/42');
const product = await response.json();
expect(product.name).toBe('Mechanical keyboard');`,
  },
  {
    id: "pw-api-text",
    title: "Read the body as text",
    level: 1,
    tags: ["api", "request"],
    code: `// For anything that is not JSON. text() can be read only once, same as
// json().
const response = await request.get('/robots.txt');
expect(await response.text()).toContain('User-agent: *');`,
  },
  {
    id: "pw-api-query",
    title: "Send query parameters without building the string yourself",
    level: 2,
    tags: ["api", "request"],
    code: `// params encodes for you, so a value containing a space or an ampersand
// cannot quietly corrupt the URL.
const response = await request.get('/api/products', {
  params: { category: 'keyboards', inStock: true, page: 2 },
});
expect(response.ok()).toBeTruthy();`,
  },
  {
    id: "pw-api-post-json",
    title: "POST a JSON body",
    level: 1,
    tags: ["api", "request"],
    code: `// 201 rather than ok(): a creation endpoint answering 200 is worth
// noticing, not waving through.
const response = await request.post('/api/orders', {
  data: { sku: 'KB-01', quantity: 2 },
});
expect(response.status()).toBe(201);`,
  },
  {
    id: "pw-api-put-patch",
    title: "Replace a resource, then change one field of it",
    level: 2,
    tags: ["api", "request"],
    code: `// PUT replaces the whole resource, PATCH changes one field. Sending a
// PUT with one field is how the other fields get erased.
await request.put('/api/profile', {
  data: { name: 'Ada Lovelace', locale: 'en-AU' },
});

const patched = await request.patch('/api/profile', {
  data: { locale: 'en-GB' },
});
expect(patched.ok()).toBeTruthy();`,
  },
  {
    id: "pw-api-delete",
    title: "DELETE and confirm it is gone",
    level: 2,
    tags: ["api", "request"],
    code: `// Deleting is only half the test. The 404 afterwards is what proves it
// actually went.
const deleted = await request.delete('/api/orders/42');
expect(deleted.status()).toBe(204);

const missing = await request.get('/api/orders/42');
expect(missing.status()).toBe(404);`,
  },
  {
    id: "pw-api-head",
    title: "Ask only for the headers",
    level: 2,
    tags: ["api", "request"],
    code: `// HEAD returns the headers without the body, which is the cheap way to
// check a large file is being served correctly.
const response = await request.head('/downloads/report.pdf');
expect(response.headers()['content-type']).toBe('application/pdf');`,
  },
  {
    id: "pw-api-headers",
    title: "Send a header with one request",
    level: 1,
    tags: ["api", "auth"],
    code: `// Per-request when only this call needs it. If every call does, put it on
// the context instead.
const response = await request.get('/api/orders', {
  headers: { authorization: 'Bearer ' + token },
});
expect(response.ok()).toBeTruthy();`,
  },
  {
    id: "pw-api-assert-header",
    title: "Assert a response header",
    level: 2,
    tags: ["api", "assertion"],
    code: `// Headers arrive lower-cased whatever the server sent, so match on the
// lower-case name.
const response = await request.get('/api/products');
const headers = response.headers();
expect(headers['content-type']).toContain('application/json');
expect(headers['cache-control']).toBe('no-store');`,
  },
  {
    id: "pw-api-status-text",
    title: "Report the body when a request fails",
    level: 3,
    tags: ["api", "assertion"],
    code: `const response = await request.post('/api/orders', {
  data: { sku: 'KB-01' },
});
// Putting the body in the message turns "expected 201, got 400" into a
// failure that says which field the server objected to.
expect(response.status(), await response.text()).toBe(201);`,
  },
  {
    id: "pw-api-expect-response",
    title: "Assert on the response object itself",
    level: 2,
    tags: ["api", "assertion"],
    code: `// toBeOK prints the status and the body on failure, which a bare
// expect(ok()).toBeTruthy() does not.
const response = await request.get('/api/products');
await expect(response).toBeOK();`,
  },
  {
    id: "pw-api-body-shape",
    title: "Check the shape of a payload, not just one field",
    level: 3,
    tags: ["api", "assertion"],
    code: `// toMatchObject asserts the fields that matter and ignores the rest, so
// adding a field to the payload does not break the test.
const order = await (await request.get('/api/orders/42')).json();
expect(order).toMatchObject({
  id: 42,
  status: 'confirmed',
  items: expect.any(Array),
});`,
  },
  {
    id: "pw-api-array-body",
    title: "Assert something about every item in a list",
    level: 3,
    tags: ["api", "assertion"],
    code: `// Asserting a property of every item catches the one row that came back
// with a null price, which a length check never would.
const products = await (await request.get('/api/products')).json();
expect(products.length).toBeGreaterThan(0);
for (const product of products) {
  expect(product.price).toBeGreaterThan(0);
  expect(typeof product.sku).toBe('string');
}`,
  },
  {
    id: "pw-api-context",
    title: "A client with a base URL and headers of its own",
    level: 3,
    tags: ["api", "context"],
    code: `// A context of its own for calls that are not the browser's. Dispose it,
// or the run holds the connection open until the process exits.
const api = await playwright.request.newContext({
  baseURL: 'https://staging.example.com',
  extraHTTPHeaders: {
    accept: 'application/json',
    authorization: 'Bearer ' + process.env.API_TOKEN,
  },
});

const response = await api.get('/api/orders');
expect(response.ok()).toBeTruthy();

await api.dispose();`,
  },
  {
    id: "pw-api-fixture",
    title: "That client as a fixture, disposed for you",
    level: 4,
    tags: ["api", "fixture"],
    code: `// The same context as a fixture: created once, disposed after the test,
// and impossible to forget.
export const test = base.extend<{ api: APIRequestContext }>({
  api: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: process.env.API_URL,
      extraHTTPHeaders: { authorization: 'Bearer ' + process.env.API_TOKEN },
    });
    await use(context);
    await context.dispose();
  },
});`,
  },
  {
    id: "pw-api-basic-auth",
    title: "Basic authentication",
    level: 2,
    tags: ["api", "auth"],
    code: `// Reading the password from the environment keeps it out of the
// repository and out of the report when a test fails.
const api = await playwright.request.newContext({
  httpCredentials: { username: 'ada', password: process.env.API_PASSWORD! },
});`,
  },
  {
    id: "pw-api-login-token",
    title: "Log in once and reuse the token",
    level: 3,
    tags: ["api", "auth"],
    code: `// Assert the login worked before using the token. A failed login yields
// an undefined token and a confusing 401 further down.
const login = await request.post('/api/auth/login', {
  data: { email: 'ada@example.com', password: process.env.TEST_PASSWORD },
});
expect(login.ok()).toBeTruthy();

const { accessToken } = await login.json();
expect(accessToken).toBeTruthy();`,
  },
  {
    id: "pw-api-unauthorised",
    title: "Assert that an endpoint refuses an anonymous caller",
    level: 2,
    tags: ["api", "auth", "negative"],
    code: `// The cheapest security test there is, and the one most often missing.
const response = await request.get('/api/admin/users');
expect(response.status()).toBe(401);`,
  },
  {
    id: "pw-api-forbidden",
    title: "Assert that a signed-in user cannot reach somebody else's data",
    level: 3,
    tags: ["api", "auth", "negative"],
    code: `// The one authorisation test worth having: a valid token for the wrong
// account. A 401 here would be a bug — the caller is authenticated.
const response = await request.get('/api/accounts/99/invoices', {
  headers: { authorization: 'Bearer ' + otherUsersToken },
});
expect(response.status()).toBe(403);`,
  },
  {
    id: "pw-api-validation",
    title: "Assert the error a bad payload produces",
    level: 3,
    tags: ["api", "negative"],
    code: `// Asserting which field the server objected to, not just that it
// objected — otherwise the test passes when validation breaks entirely.
const response = await request.post('/api/orders', {
  data: { sku: '', quantity: -1 },
});
expect(response.status()).toBe(422);

const body = await response.json();
expect(body.errors).toMatchObject({
  sku: 'must not be empty',
  quantity: 'must be greater than zero',
});`,
  },
  {
    id: "pw-api-not-found",
    title: "Assert a missing resource",
    level: 1,
    tags: ["api", "negative"],
    code: `// 404 rather than a 200 with an empty body: the difference matters to
// every client that has to handle it.
const response = await request.get('/api/products/does-not-exist');
expect(response.status()).toBe(404);`,
  },
  {
    id: "pw-api-conflict",
    title: "Assert that a duplicate is rejected",
    level: 3,
    tags: ["api", "negative"],
    code: `// Sending the same payload twice is how you find out whether the
// uniqueness constraint is real or only in the UI.
const payload = { email: 'ada@example.com' };
const first = await request.post('/api/invites', { data: payload });
expect(first.status()).toBe(201);

const second = await request.post('/api/invites', { data: payload });
expect(second.status()).toBe(409);`,
  },
  {
    id: "pw-api-crud",
    title: "A whole resource lifecycle in one test",
    level: 4,
    tags: ["api", "crud"],
    code: `// One test for the whole lifecycle, so nothing is left behind and each
// step proves the previous one really happened.
test('a product can be created, read, updated and deleted', async ({
  request,
}) => {
  const created = await request.post('/api/products', {
    data: { sku: 'KB-99', name: 'Test keyboard', price: 149 },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();

  const read = await request.get('/api/products/' + id);
  expect((await read.json()).name).toBe('Test keyboard');

  const updated = await request.patch('/api/products/' + id, {
    data: { price: 129 },
  });
  expect((await updated.json()).price).toBe(129);

  const removed = await request.delete('/api/products/' + id);
  expect(removed.status()).toBe(204);
});`,
  },
  {
    id: "pw-api-cleanup",
    title: "Clean up what the test created, whatever happened",
    level: 4,
    tags: ["api", "hooks"],
    code: `let orderId: string | null = null;

test.afterEach(async ({ request }) => {
  // In afterEach rather than at the end of the test, so a failure halfway
  // through does not leave a row behind for the next run to trip over.
  if (orderId !== null) {
    await request.delete('/api/orders/' + orderId);
    orderId = null;
  }
});`,
  },
  {
    id: "pw-api-unique-data",
    title: "Make test data unique so parallel runs cannot collide",
    level: 3,
    tags: ["api", "parallel"],
    code: `// The test id makes the address unique per test, so parallel workers
// cannot collide on the same record.
const email = 'ada+' + test.info().testId + '@example.com';
const response = await request.post('/api/invites', { data: { email } });
expect(response.status()).toBe(201);`,
  },
  {
    id: "pw-api-form",
    title: "Send a URL-encoded form",
    level: 2,
    tags: ["api", "request"],
    code: `// form sends url-encoded rather than JSON, which is what an endpoint
// behind an HTML form expects.
const response = await request.post('/api/subscribe', {
  form: { email: 'ada@example.com', plan: 'monthly' },
});
expect(response.ok()).toBeTruthy();`,
  },
  {
    id: "pw-api-multipart",
    title: "Upload a file as multipart",
    level: 3,
    tags: ["api", "file"],
    code: `// multipart builds the boundaries for you; hand-rolling them is how file
// upload tests come to fail for reasons nobody can read.
const response = await request.post('/api/documents', {
  multipart: {
    title: 'Q3 report',
    file: {
      name: 'report.pdf',
      mimeType: 'application/pdf',
      buffer: readFileSync('tests/fixtures/report.pdf'),
    },
  },
});
expect(response.status()).toBe(201);`,
  },
  {
    id: "pw-api-download-bytes",
    title: "Check the bytes a download actually returns",
    level: 3,
    tags: ["api", "file"],
    code: `// Checking the first line proves the export has its header row, which a
// size check alone would not.
const response = await request.get('/api/exports/orders.csv');
const body = await response.body();
expect(body.byteLength).toBeGreaterThan(0);
expect(body.toString('utf8').split('\\n')[0]).toBe('id,sku,quantity');`,
  },
  {
    id: "pw-api-timeout",
    title: "Give one slow endpoint longer",
    level: 2,
    tags: ["api", "timeout"],
    code: `// Raised for this call only. Raising it globally would make every
// unrelated failure take a minute to report.
const response = await request.post('/api/reports/generate', {
  data: { range: 'last-quarter' },
  timeout: 60_000,
});
expect(response.ok()).toBeTruthy();`,
  },
  {
    id: "pw-api-no-throw",
    title: "Stop a failing status from throwing, so you can assert on it",
    level: 3,
    tags: ["api", "negative"],
    code: `// Without this the request throws on a 4xx and the assertion never runs,
// so the test fails for the wrong reason.
const response = await request.get('/api/products/0', {
  failOnStatusCode: false,
});
expect(response.status()).toBe(400);`,
  },
  {
    id: "pw-api-poll-until-ready",
    title: "Poll an asynchronous job until it finishes",
    level: 4,
    tags: ["api", "polling"],
    code: `// Growing intervals: quick early checks for the common fast case, then
// backing off so a slow job is not hammered.
const { jobId } = await (
  await request.post('/api/reports', { data: { range: 'ytd' } })
).json();

await expect
  .poll(
    async () => {
      const status = await request.get('/api/reports/' + jobId);
      return (await status.json()).state;
    },
    { timeout: 60_000, intervals: [1_000, 2_000, 5_000] },
  )
  .toBe('ready');`,
  },
  {
    id: "pw-api-pagination",
    title: "Walk every page of a paginated endpoint",
    level: 4,
    tags: ["api", "pagination"],
    code: `// The Set at the end catches a paginator that returns the same page
// twice, which is the usual off-by-one in this code.
const seen: string[] = [];
let page = 1;

while (true) {
  const response = await request.get('/api/products', {
    params: { page, perPage: 50 },
  });
  const { items, hasMore } = await response.json();
  seen.push(...items.map((item: { sku: string }) => item.sku));
  if (!hasMore) {
    break;
  }
  page += 1;
}

expect(new Set(seen).size).toBe(seen.length);`,
  },
  {
    id: "pw-api-cookies",
    title: "Read the cookies a request set",
    level: 3,
    tags: ["api", "auth"],
    code: `// httpOnly and sameSite are the two attributes that decide whether a
// session cookie can be stolen; assert them rather than assume them.
const context = await playwright.request.newContext();
await context.post('/api/auth/login', {
  data: { email: 'ada@example.com', password: process.env.TEST_PASSWORD },
});

const { cookies } = await context.storageState();
const session = cookies.find(({ name }) => name === 'session');
expect(session?.httpOnly).toBe(true);
expect(session?.sameSite).toBe('Lax');`,
  },
  {
    id: "pw-api-storage-state",
    title: "Save an API session and hand it to the browser",
    level: 4,
    tags: ["api", "auth"],
    code: `const context = await playwright.request.newContext();
await context.post('/api/auth/login', {
  data: { email: 'ada@example.com', password: process.env.TEST_PASSWORD },
});
// Signing in over the API and handing the cookies to the browser is far
// faster than driving the login form, and it tests the form only once.
await context.storageState({ path: 'playwright/.auth/user.json' });
await context.dispose();`,
  },
  {
    id: "pw-api-graphql",
    title: "Send a GraphQL query",
    level: 3,
    tags: ["api", "graphql"],
    code: `// GraphQL reports failures in the body, so errors has to be checked even
// when the status is 200.
const response = await request.post('/graphql', {
  data: {
    query: 'query Product($id: ID!) { product(id: $id) { name price } }',
    variables: { id: '42' },
  },
});

const { data, errors } = await response.json();
expect(errors).toBeUndefined();
expect(data.product.name).toBe('Mechanical keyboard');`,
  },
  {
    id: "pw-api-graphql-error",
    title: "Assert a GraphQL error, which arrives with status 200",
    level: 4,
    tags: ["api", "graphql", "negative"],
    code: `const response = await request.post('/graphql', {
  data: { query: 'query { product(id: "nope") { name } }' },
});
// GraphQL reports failures in the body, not the status line, so asserting
// ok() here would pass while the query was broken.
expect(response.status()).toBe(200);

const { errors } = await response.json();
expect(errors?.[0].extensions.code).toBe('NOT_FOUND');`,
  },
  {
    id: "pw-api-seed-then-ui",
    title: "Set the world up over the API, then check it in the browser",
    level: 4,
    tags: ["api", "hybrid"],
    code: `// Arrange over the API, assert in the browser: the test covers the thing
// it is named for and nothing else.
test('a seeded order shows in the history', async ({ page, request }) => {
  const created = await request.post('/api/orders', {
    data: { sku: 'KB-01', quantity: 1 },
  });
  const { id } = await created.json();

  await page.goto('/account/orders');
  await expect(page.getByRole('row', { name: new RegExp(id) })).toBeVisible();
});`,
  },
  {
    id: "pw-api-ui-then-verify",
    title: "Act in the browser, then check the API agrees",
    level: 4,
    tags: ["api", "hybrid"],
    code: `await page.getByRole('button', { name: 'Save profile' }).click();
await expect(page.getByRole('status')).toHaveText('Saved');

// The UI saying "Saved" and the server having saved it are two different
// claims, and only one of them is worth trusting.
const profile = await (await request.get('/api/profile')).json();
expect(profile.displayName).toBe('Ada L.');`,
  },
  {
    id: "pw-api-contract",
    title: "Check a payload against a schema",
    level: 4,
    tags: ["api", "contract"],
    code: `// Parsing against a schema catches a field that changed type, which a
// few toBe assertions would sail straight past.
import { z } from 'zod';

const Product = z.object({
  id: z.number(),
  sku: z.string(),
  price: z.number().positive(),
  tags: z.array(z.string()),
});

const body = await (await request.get('/api/products/42')).json();
expect(() => Product.parse(body)).not.toThrow();`,
  },
  {
    id: "pw-api-idempotent",
    title: "Assert that repeating a request changes nothing",
    level: 4,
    tags: ["api", "semantics"],
    code: `// The second call must return the first order, not create another. This
// is the test that stops double-charging.
const key = 'idem-' + test.info().testId;
const options = {
  data: { sku: 'KB-01', quantity: 1 },
  headers: { 'idempotency-key': key },
};

const first = await request.post('/api/orders', options);
const second = await request.post('/api/orders', options);

expect(first.status()).toBe(201);
expect(second.status()).toBe(200);
expect((await second.json()).id).toBe((await first.json()).id);`,
  },
  {
    id: "pw-api-rate-limit",
    title: "Assert the rate limiter and the header it sets",
    level: 4,
    tags: ["api", "negative"],
    code: `// Asserting the retry-after header as well: a 429 with no guidance is
// unusable by any client that wants to behave.
const responses = [];
for (let i = 0; i < 25; i++) {
  responses.push(await request.get('/api/search', { params: { q: 'kb' } }));
}

const limited = responses.filter((r) => r.status() === 429);
expect(limited.length).toBeGreaterThan(0);
expect(limited[0].headers()['retry-after']).toBeTruthy();`,
  },
  {
    id: "pw-api-concurrent",
    title: "Fire requests at once instead of in a queue",
    level: 3,
    tags: ["api", "performance"],
    code: `// Promise.all rather than a loop, so setup costs the slowest request
// rather than the sum of all of them.
const responses = await Promise.all([
  request.get('/api/products'),
  request.get('/api/categories'),
  request.get('/api/promotions'),
]);

for (const response of responses) {
  expect(response.ok()).toBeTruthy();
}`,
  },
  {
    id: "pw-api-timing",
    title: "Assert an endpoint answers quickly enough",
    level: 3,
    tags: ["api", "performance"],
    code: `// A blunt guard against an endpoint quietly getting ten times slower.
// Keep the bound generous or it becomes the flakiest test you own.
const started = Date.now();
const response = await request.get('/api/products');
const elapsed = Date.now() - started;

expect(response.ok()).toBeTruthy();
expect(elapsed).toBeLessThan(1_000);`,
  },
  {
    id: "pw-api-attach",
    title: "Attach a response to the report when it fails",
    level: 4,
    tags: ["api", "reporting"],
    code: `// Attaching the body on failure means the report explains itself without
// anyone having to reproduce the run.
const response = await request.get('/api/orders/42');
if (!response.ok()) {
  await test.info().attach('orders-42.json', {
    body: await response.text(),
    contentType: 'application/json',
  });
}
expect(response.ok()).toBeTruthy();`,
  },
  {
    id: "pw-api-setup-project",
    title: "Seed reference data once for the whole run",
    level: 5,
    tags: ["api", "config"],
    code: `// A setup project runs once before everything that depends on it, so
// this cost is paid a single time however many tests follow.
import { test as setup, expect } from '@playwright/test';

setup('seed catalogue', async ({ request }) => {
  const response = await request.post('/api/test/seed', {
    data: { fixture: 'catalogue' },
  });
  expect(response.ok()).toBeTruthy();
});`,
  },
];
