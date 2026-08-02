import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

function getDataDir() {
  return resolve(tmpdir(), `keybr-tests-${randomBytes(6).toString("hex")}`);
}

function getPublicDir() {
  return resolve(import.meta.dirname, "..", "..", "..", "root", "public");
}

process.env.DATA_DIR ??= getDataDir();
process.env.PUBLIC_DIR ??= getPublicDir();

process.env.DATABASE_CLIENT ??= "mysql";
process.env.DATABASE_HOST ??= "127.0.0.1";
process.env.DATABASE_PORT ??= "3306";
process.env.DATABASE_DATABASE ??= "keybr_tests";
process.env.DATABASE_USERNAME ??= "keybr";
process.env.DATABASE_PASSWORD ??= "";
process.env.DATABASE_FILENAME ??= ":memory:";

process.env.COOKIE_DOMAIN = "";
process.env.COOKIE_PATH = "/";
process.env.COOKIE_SECURE = "false";

process.env.AUTH_GOOGLE_CLIENT_ID = "id";
process.env.AUTH_GOOGLE_CLIENT_SECRET = "secret";

process.env.AUTH_FACEBOOK_CLIENT_ID = "id";
process.env.AUTH_FACEBOOK_CLIENT_SECRET = "secret";

process.env.PADDLE_API_KEY = "apiKey";
process.env.PADDLE_SECRET_KEY = "secretKey";

// The app believes `X-Forwarded-Host` and `X-Forwarded-Proto` only when the
// peer is a proxy it has been told to trust — otherwise anybody could claim any
// host and bypass the rate limits keyed on the client address. Tests speak to
// the app over a loopback socket and set those headers to stand in for a load
// balancer, so trust loopback here; without it every page request is answered
// with a canonical-URL 301 instead of the page.
process.env.TRUSTED_PROXIES = "loopback";
