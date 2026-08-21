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

/**
 * The shapes a leftover development secret takes. Not a strength test —
 * a real key can contain any of these words by chance — but every one of
 * them is a string somebody typed rather than generated, which is the
 * thing worth catching.
 */
function looksLikePlaceholder(value: string): boolean {
  return /^(dev|test|local|example|changeme|secret|placeholder)[-_]?/i.test(
    value,
  );
}

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

  const transport = Env.getString("MAIL_TRANSPORT", "mailgun");
  if (transport === "log") {
    fatal.push(
      "MAIL_TRANSPORT is 'log', so no account would ever receive a sign-in " +
        "link or a verification code. It also writes every message body to " +
        "the server log, one-time codes included.",
    );
  }
  // Naming a transport is not the same as being able to send. Without
  // these the mailer throws on its first send — long after boot, on the
  // one request where somebody was waiting for a code.
  if (transport === "smtp") {
    for (const name of [
      "MAIL_SMTP_HOST",
      "MAIL_SMTP_USER",
      "MAIL_SMTP_PASSWORD",
      "MAIL_FROM_ADDRESS",
    ]) {
      if (Env.getString(name, "") === "") {
        fatal.push(`MAIL_TRANSPORT is 'smtp' but ${name} is not set.`);
      }
    }
  }
  if (transport !== "smtp" && transport !== "log") {
    for (const name of ["MAIL_DOMAIN", "MAIL_KEY"]) {
      if (Env.getString(name, "") === "") {
        fatal.push(`MAIL_TRANSPORT is '${transport}' but ${name} is not set.`);
      }
    }
  }

  // The secrets the two apps trust each other with.
  //
  // These are shared strings in two `.env` files, not hashed anywhere, and
  // each grants a great deal: the ops key reaches this app's whole
  // internal API, and the desk's app key can open and answer tickets. A
  // placeholder that works in development works just as well for anybody
  // who reads the repository, so a deployment carrying one is stopped
  // here rather than discovered later.
  for (const [name, what] of [
    ["OPS_API_KEY", "the desk's access to this app's internal API"],
    ["QDESK_APP_KEY", "this app's access to the desk"],
  ] as const) {
    const value = Env.getString(name, "");
    if (value === "") {
      // Absent is a real choice — it means that direction is switched off
      // — so it is not an error, only worth saying.
      warnings.push(`${name} is not set, so ${what} is disabled.`);
      continue;
    }
    if (looksLikePlaceholder(value)) {
      fatal.push(
        `${name} looks like a development placeholder ("${value.slice(0, 12)}…"). ` +
          `It controls ${what}.`,
      );
    } else if (value.length < 24) {
      fatal.push(
        `${name} is only ${value.length} characters. It controls ${what} ` +
          "and has no lockout of its own, so it must be long and random.",
      );
    }
  }

  // A business enquiry is forwarded to this address and nowhere else.
  // Unset, the forward is skipped silently — so a partnership or
  // licensing approach lands in the queue and nobody is told, which is
  // indistinguishable from working until somebody goes looking.
  if (Env.getString("SUPPORT_INBOX_EMAIL", "") === "") {
    warnings.push(
      "SUPPORT_INBOX_EMAIL is not set, so business enquiries are not " +
        "forwarded to anybody — they will only be seen by opening the desk.",
    );
  }

  const qdeskUrl = Env.getString("QDESK_URL", "");
  if (qdeskUrl !== "") {
    try {
      const url = new URL(qdeskUrl);
      if (url.protocol !== "https:" && url.hostname !== "127.0.0.1") {
        fatal.push(
          `QDESK_URL is ${url.protocol} not https; the app key would travel ` +
            "in the clear on every forwarded ticket.",
        );
      }
    } catch {
      fatal.push(`QDESK_URL is not a valid URL: ${qdeskUrl}`);
    }
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
