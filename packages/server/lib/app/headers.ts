import { type Context, type Middleware, type Next } from "@fastr/core";
import { Env } from "@keybr/config";

// Third-party origins the app actually loads code or frames from. Everything
// else is denied by the policy below, so adding an integration means adding it
// here deliberately rather than discovering later that anything goes.
const SCRIPT_HOSTS = [
  "https://www.googletagmanager.com",
  "https://pagead2.googlesyndication.com",
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
export function securityHeaders(): Middleware {
  return async (ctx: Context, next: Next): Promise<void> => {
    await next();

    const { headers } = ctx.response;

    // Inline <script> is still used for the bootstrap page data and the GTM
    // snippet, so 'unsafe-inline' is required until those carry a nonce. Note
    // that a modern browser ignores 'unsafe-inline' when a nonce or hash is
    // present, so this stays honest about what is actually enforced.
    const csp = [
      "default-src 'self'",
      // 'wasm-unsafe-eval' permits WebAssembly and NOTHING else — the kids
      // world decodes its 3D meshes with a wasm module, which CSP blocks by
      // default. It is deliberately not 'unsafe-eval': that would also re-enable
      // eval() of strings and hand any future injection a code-execution
      // primitive, which is most of what this policy exists to prevent.
      `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${SCRIPT_HOSTS.join(" ")}`,
      "style-src 'self' 'unsafe-inline'",
      // Avatars are stored as data: URLs; ad and provider images are remote.
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

    headers.set("Content-Security-Policy", csp);
    // Superseded by frame-ancestors, kept for older browsers.
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
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
