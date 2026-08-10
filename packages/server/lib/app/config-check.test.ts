import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import { checkProductionConfig } from "./config-check.ts";

// The checks read process.env through Env, so each case sets it up and restores
// it afterwards.
function withEnv(vars: Record<string, string>, body: () => void) {
  const saved = { ...process.env };
  try {
    for (const [key, value] of Object.entries(vars)) {
      process.env[key] = value;
    }
    body();
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, saved);
  }
}

const sane = {
  NODE_ENV: "production",
  APP_URL: "https://app.keylearn.org/",
  COOKIE_DOMAIN: "app.keylearn.org",
  COOKIE_SECURE: "true",
  MAIL_TRANSPORT: "smtp",
  DATABASE_CLIENT: "mysql",
  TRUSTED_PROXIES: "loopback",
};

test("say nothing outside production", () => {
  withEnv(
    { ...sane, NODE_ENV: "development", APP_URL: "http://localhost:4000/" },
    () => {
      const { fatal, warnings } = checkProductionConfig();
      equal(fatal.length, 0);
      equal(warnings.length, 0);
    },
  );
});

test("accept a sane production configuration", () => {
  withEnv(sane, () => {
    equal(checkProductionConfig().fatal.length, 0);
  });
});

test("refuse a localhost APP_URL", () => {
  withEnv(
    { ...sane, APP_URL: "http://localhost:4000/", COOKIE_DOMAIN: "" },
    () => {
      const { fatal } = checkProductionConfig();
      isTrue(fatal.some((m) => m.includes("localhost")));
    },
  );
});

test("refuse a plain-HTTP APP_URL", () => {
  withEnv({ ...sane, APP_URL: "http://app.keylearn.org/" }, () => {
    const { fatal } = checkProductionConfig();
    isTrue(fatal.some((m) => m.includes("not https")));
  });
});

test("refuse an insecure cookie", () => {
  withEnv({ ...sane, COOKIE_SECURE: "false" }, () => {
    const { fatal } = checkProductionConfig();
    isTrue(fatal.some((m) => m.includes("COOKIE_SECURE")));
  });
});

// The silent one: the browser discards the cookie and sign-in never sticks.
test("refuse a cookie domain that cannot cover the host", () => {
  withEnv({ ...sane, COOKIE_DOMAIN: "example.com" }, () => {
    const { fatal } = checkProductionConfig();
    isTrue(fatal.some((m) => m.includes("COOKIE_DOMAIN")));
  });
});

test("accept a parent cookie domain", () => {
  withEnv({ ...sane, COOKIE_DOMAIN: ".keylearn.org" }, () => {
    equal(checkProductionConfig().fatal.length, 0);
  });
});

test("refuse a mail transport that sends nothing", () => {
  withEnv({ ...sane, MAIL_TRANSPORT: "log" }, () => {
    const { fatal } = checkProductionConfig();
    isTrue(fatal.some((m) => m.includes("MAIL_TRANSPORT")));
  });
});

test("warn about sqlite and about trusting no proxy", () => {
  withEnv({ ...sane, DATABASE_CLIENT: "sqlite", TRUSTED_PROXIES: "" }, () => {
    const { fatal, warnings } = checkProductionConfig();
    equal(fatal.length, 0);
    isTrue(warnings.some((m) => m.includes("sqlite")));
    isTrue(warnings.some((m) => m.includes("TRUSTED_PROXIES")));
  });
});
