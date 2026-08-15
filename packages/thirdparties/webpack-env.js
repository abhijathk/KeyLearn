import { join } from "node:path";

// Mirrors keylearn-config/lib/env.ts's Env.getFiles() precedence: webpack
// (unlike the server) never loaded dotenv files on its own, so every one of
// these constants silently fell back to unset unless the shell invoking
// `npx webpack` happened to export it. Checking the same files the server
// reads means a plain `npm run build`/`build-dev` picks up local .env or
// production's /etc/keylearn/env with no special exports required, in dev
// or prod alike.
const nodeEnv = process.env.NODE_ENV || "development";

for (const path of [
  // First definition wins, so list the paths in the reversed order.
  join(process.cwd(), `.env.${nodeEnv}`),
  join(process.cwd(), ".env"),
  `/etc/keylearn/env.${nodeEnv}`,
  `/etc/keylearn/env`,
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
