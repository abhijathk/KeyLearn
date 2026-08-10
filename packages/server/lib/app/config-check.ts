import { Env } from "@keylearn/config";

/**
 * Settings that are right for development and dangerous in production.
 *
 * Every one of these has the same failure shape: the server starts, looks
 * healthy, and is quietly broken — session cookies the browser discards, sign-in
 * links pointing at the operator's laptop, mail written to a log file nobody
 * reads. A checklist catches those only if somebody reads it, so they are
 * checked here instead, once, in the primary process before any worker forks.
 *
 * Fatal problems stop the boot. Warnings are things a small deployment might
 * legitimately choose, so they are said out loud and then allowed.
 */
export type ConfigReport = {
  readonly fatal: readonly string[];
  readonly warnings: readonly string[];
};

export function checkProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
): ConfigReport {
  const fatal: string[] = [];
  const warnings: string[] = [];
  if ((env.NODE_ENV ?? "development") !== "production") {
    return { fatal, warnings };
  }

  const appUrl = Env.getString("APP_URL", "");
  let host = "";
  if (appUrl === "") {
    fatal.push("APP_URL is not set; emailed links have no origin to point at.");
  } else {
    let url: URL | null = null;
    try {
      url = new URL(appUrl);
    } catch {
      fatal.push(`APP_URL is not a valid URL: ${appUrl}`);
    }
    if (url != null) {
      host = url.hostname;
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        fatal.push(
          `APP_URL still points at ${host}. Every sign-in link, ` +
            "verification code and OAuth redirect is built from it.",
        );
      }
      if (url.protocol !== "https:") {
        fatal.push(
          `APP_URL is ${url.protocol} not https. Session cookies and ` +
            "OAuth redirects must not travel in the clear.",
        );
      }
    }
  }

  if (!Env.getBoolean("COOKIE_SECURE", true)) {
    fatal.push(
      "COOKIE_SECURE is false, so the session cookie would be sent over " +
        "plain HTTP.",
    );
  }

  // A cookie whose Domain does not cover the host is rejected by the browser
  // without any error the server can see: sign-in simply never sticks.
  const cookieDomain = Env.getString("COOKIE_DOMAIN", "");
  if (cookieDomain !== "" && host !== "") {
    const bare = cookieDomain.replace(/^\./, "");
    if (host !== bare && !host.endsWith(`.${bare}`)) {
      fatal.push(
        `COOKIE_DOMAIN (${cookieDomain}) does not cover the APP_URL host ` +
          `(${host}); the browser will discard the session cookie.`,
      );
    }
  }

  if (Env.getString("MAIL_TRANSPORT", "mailgun") === "log") {
    fatal.push(
      "MAIL_TRANSPORT is 'log', so no account would ever receive a sign-in " +
        "link or a verification code.",
    );
  }

  if (Env.getString("DATABASE_CLIENT", "mysql") === "sqlite") {
    warnings.push(
      "DATABASE_CLIENT is sqlite; several worker processes will contend for " +
        "the same file on write.",
    );
  }

  if (Env.getString("TRUSTED_PROXIES", "") === "") {
    warnings.push(
      "TRUSTED_PROXIES is empty. Correct when the server is exposed " +
        "directly, but behind a reverse proxy every visitor shares the " +
        "proxy's address and rate limiting applies to all of them at once.",
    );
  }

  if (Env.getBoolean("MULTIPLAYER_ENABLED", false)) {
    warnings.push(
      "MULTIPLAYER_ENABLED is true, but live practice is unfinished.",
    );
  }

  return { fatal, warnings };
}
