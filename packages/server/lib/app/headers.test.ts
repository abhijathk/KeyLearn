import { test } from "node:test";
import { Application } from "@fastr/core";
import { equal, isNotNull, isTrue } from "rich-assert";
import { kMain } from "./module.ts";
import { TestContext } from "./test/context.ts";
import { startApp } from "./test/request.ts";

const context = new TestContext();

// The canonical handler redirects anything that did not arrive at the real
// host, and a redirect never renders a page — so every request here says it
// did, the way the page tests do.
const page = async () => {
  const request = startApp(context.get(Application, kMain));
  return await request
    .GET("/")
    .header("X-Forwarded-Host", "www.keylearn.org")
    .header("X-Forwarded-Proto", "https")
    .send();
};

const cspOf = async () => {
  const csp = (await page()).headers.get("Content-Security-Policy");
  isNotNull(csp);
  return csp!;
};

test("an injected script cannot run: script-src allows no inline", async () => {
  // The whole point of the policy. With 'unsafe-inline' any string that
  // reaches the page as markup becomes executable code, which is most of what
  // a CSP exists to stop.
  const csp = await cspOf();
  const scriptSrc = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith("script-src"))!;
  isNotNull(scriptSrc);
  isTrue(
    !scriptSrc.includes("'unsafe-inline'"),
    `script-src still allows inline: ${scriptSrc}`,
  );
  isTrue(
    !scriptSrc.includes("'unsafe-eval'"),
    `script-src still allows eval: ${scriptSrc}`,
  );
  isTrue(/'nonce-[A-Za-z0-9+/=]{16,}'/.test(scriptSrc), scriptSrc);
});

test("the nonce is fresh on every response", async () => {
  // A nonce reused across responses is no better than 'unsafe-inline': read
  // one page, sign your own script into the next.
  const seen = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const csp = await cspOf();
    seen.add(/'nonce-([^']+)'/.exec(csp)![1]);
  }
  equal(seen.size, 5, "a nonce was repeated across responses");
});

test("the page's own inline script carries that response's nonce", async () => {
  // Otherwise the policy would be tight and the app would be broken — the
  // bootstrap data would be blocked and nothing would load.
  const response = await page();
  const csp = response.headers.get("Content-Security-Policy")!;
  const nonce = /'nonce-([^']+)'/.exec(csp)![1];
  const html = await response.body.text();
  isTrue(
    html.includes(`nonce="${nonce}"`),
    "the page-data script does not carry the nonce from its own CSP",
  );
});

test("the rest of the policy still holds the line", async () => {
  const csp = await cspOf();
  for (const directive of [
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "default-src 'self'",
  ]) {
    isTrue(csp.includes(directive), `${directive} is missing from: ${csp}`);
  }
});
