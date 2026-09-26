import { test } from "node:test";
import { equal } from "rich-assert";
import { smtpOptions } from "./smtp.ts";

const base = { host: "smtp-relay.example.com", port: 587, secure: false, user: "u", password: "p" };

test("STARTTLS is required on a submission port, so a stripped offer fails rather than sending the login in the clear", () => {
  equal(smtpOptions(base).requireTLS, true);
});

test("implicit TLS needs no upgrade", () => {
  equal(smtpOptions({ ...base, port: 465, secure: true }).requireTLS, false);
});

test("a loopback relay is exempt", () => {
  equal(smtpOptions({ ...base, host: "localhost" }).requireTLS, false);
  equal(smtpOptions({ ...base, host: "127.0.0.1" }).requireTLS, false);
});
