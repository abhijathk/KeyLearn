import { randomBytes } from "node:crypto";
import { type Context, type Middleware, type Next } from "@fastr/core";
import { Env } from "@keylearn/config";

// Third-party origins the app actually loads code or frames from. Everything
// else is denied by the policy below, so adding an integration means adding it
// here deliberately rather than discovering later that anything goes.
const SCRIPT_HOSTS = [
  "https://www.googletagmanager.com",
  "https://cdn.paddle.com",
  "https://challenges.cloudflare.com",
  "https://static.cloudflareinsights.com",
];
const FRAME_HOSTS = [
  "https://challenges.cloudflare.com", // Turnstile widget.
  "https://buy.paddle.com", // Paddle checkout overlay.
];
const CONNECT_HOSTS = [
  "https://www.google-analytics.com",
  "https://cloudflareinsights.com",
  "https://challenges.cloudflare.com",
  "https://api.paddle.com",
];

/**
 * Baseline security response headers.
 *
 * These are defence-in-depth: none of them fixes a specific bug, but together
 * they decide how much damage any future mistake can do. Without a CSP an
 * injected string is arbitrary script; without frame-ancestors the sign-in page
 * can be framed; without nosniff a user-supplied blob can be re-interpreted as
 * HTML.
 */
/**
 * Where the per-request nonce is left for the renderer to find.
 *
 * A nonce is only worth anything if the inline scripts we mean to allow can
 * carry it, so it is generated here — before the handler runs — and read back
 * out by the page controller when it renders the shell.
 */
export const CSP_NONCE = "cspNonce";

/** The nonce for this request, or "" outside a request that has one. */
export function cspNonce(ctx: Context): string {
  return (ctx.state as Record<string, unknown>)[CSP_NONCE] as string;
}

export function securityHeaders(): Middleware {
  return async (ctx: Context, next: Next): Promise<void> => {
    // 128 bits, fresh per request. Anything less, or anything reused across
    // requests, and an attacker who can read one page can sign their own
    // script into the next.
    const nonce = randomBytes(16).toString("base64");
    (ctx.state as Record<string, unknown>)[CSP_NONCE] = nonce;

    await next();

    const { headers } = ctx.response;

    // The one inline script left is the bootstrap page data, and it now carries
    // this request's nonce — so 'unsafe-inline' is gone from script-src and an
    // injected <script> no longer runs. 'unsafe-inline' stays on style-src:
    // React writes element style attributes, which a nonce cannot cover, and
    // an injected style is a far smaller prize than an injected script.
    const csp = [
      "default-src 'self'",
      // 'wasm-unsafe-eval' permits WebAssembly and NOTHING else — the kids
      // world decodes its 3D meshes with a wasm module, which CSP blocks by
      // default. It is deliberately not 'unsafe-eval': that would also re-enable
      // eval() of strings and hand any future injection a code-execution
      // primitive, which is most of what this policy exists to prevent.
      `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' ${SCRIPT_HOSTS.join(" ")}`,
      "style-src 'self' 'unsafe-inline'",
      // Avatars are stored as data: URLs; OAuth provider avatars are remote.
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // blob: — the kids world streams its decoded 3D assets from blob URLs
      // created in-page. These are same-origin by construction and cannot carry
      // data in from elsewhere.
      `connect-src 'self' blob: ws: wss: ${CONNECT_HOSTS.join(" ")}`,
      "media-src 'self' data:",
      `frame-src 'self' ${FRAME_HOSTS.join(" ")}`,
      // The app is never a legitimate frame target: this is the clickjacking
      // control that actually applies to modern browsers.
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "worker-src 'self' blob:",
    ].join("; ");

    // The site-wide policy, and only a default — the same rule as the
    // referrer policy below, and for the same reason. A route that serves
    // supplier-supplied bytes from our own origin (an advertiser's logo)
    // locks itself down to `default-src 'none'`, and overwriting that here
    // with the application's policy, which necessarily allows scripts and
    // images, would hand those bytes back the privileges they were denied.
    if (!headers.has("Content-Security-Policy")) {
      headers.set("Content-Security-Policy", csp);
    }
    // Superseded by frame-ancestors, kept for older browsers.
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-Content-Type-Options", "nosniff");
    // The site-wide default, and only a default: a route may have already
    // set a TIGHTER policy for itself, and overwriting it here would
    // quietly loosen it. The sponsor redirect does exactly that, because
    // "the advertiser learns nothing about you" is a promise made in
    // writing on the "why this ad" page.
    if (!headers.has("Referrer-Policy")) {
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    }
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("X-Permitted-Cross-Domain-Policies", "none");

    // HSTS only makes sense once the deployment is actually on HTTPS, and
    // sending it over plain HTTP in development would pin localhost to TLS.
    if (Env.getBoolean("COOKIE_SECURE", true)) {
      headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }
  };
}
