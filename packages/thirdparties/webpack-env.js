import { join } from "node:path";

// Webpack (unlike the server, see keylearn-config/lib/env.ts) never loaded
// dotenv files on its own — every one of these constants silently fell back
// to its unset default unless the shell invoking `npx webpack` happened to
// export it. The repo-root .env files are checked first, so the same .env
// that already configures the server (SUPPORT_URL and friends) also drives
// the build, and a plain `npm run build-dev` picks it up with no special
// exports required.
const repoRoot = join(import.meta.dirname, "..", "..");
const nodeEnv = process.env.NODE_ENV || "development";

for (const path of [
  // First definition wins, so list the paths in the reversed order.
  join(repoRoot, `.env.${nodeEnv}`),
  join(repoRoot, ".env"),
  join(import.meta.dirname, "lib", "config-env"),
  join(import.meta.dirname, "lib", "config-env.example"),
]) {
  try {
    process.loadEnvFile(path);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

const ENV = {};

for (const key of [
  "GOOGLE_TAG_MANAGER_ID",
  "CLOUDFLARE_ANALYTICS_ID",
  "COOKIEBOT_CLIENT_ID",
  "PADDLE_TOKEN",
  "PADDLE_PRICE_ID",
  "ADSENSE_CLIENT_ID",
  "ADSENSE_SLOT_ID",
  "SUPPORT_URL",
]) {
  ENV[`process.env.${key}`] = JSON.stringify(process.env[key]);
}

export { ENV };
