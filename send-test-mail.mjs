/**
 * Sends one of each staff-facing email, so their formatting can be seen
 * in a real client rather than guessed at from the source.
 *
 * The templates are the app's own — nothing here writes copy. What it
 * does is call them with plausible content and hand the result to the
 * same SMTP mailer the app uses, so what arrives is exactly what a real
 * escalation and a real business enquiry would look like.
 *
 * A one-off. Run deliberately, never on a schedule.
 */
import { createTransport } from "nodemailer";
import {
  messageBusinessEnquiry,
  messageUrgentFlag,
} from "./packages/server/lib/app/auth/email.ts";

process.loadEnvFile(".env");

const inbox = process.env["SUPPORT_INBOX_EMAIL"] ?? "";
const support = process.env["MAIL_FROM_ADDRESS"] ?? "";
if (inbox === "" || support === "") {
  throw new Error("SUPPORT_INBOX_EMAIL and MAIL_FROM_ADDRESS must both be set");
}

const transport = createTransport({
  host: process.env["MAIL_SMTP_HOST"],
  port: Number(process.env["MAIL_SMTP_PORT"] ?? 587),
  secure: false,
  auth: {
    user: process.env["MAIL_SMTP_USER"],
    pass: process.env["MAIL_SMTP_PASSWORD"],
  },
});

const from = `${process.env["MAIL_FROM_NAME"] ?? "KeyLearn"} <${support}>`;

const business = messageBusinessEnquiry({
  to: inbox,
  name: "Priya Raman",
  fromEmail: "priya@brightpath-schools.example",
  subject: "Licensing KeyLearn for 40 classrooms",
  message:
    "Hello — we run eleven primary schools in Victoria and would like to " +
    "talk about a site licence for roughly 40 classrooms from next term. " +
    "Could someone let me know how that works and what it would cost?\n\n" +
    "Happy to take a call. Priya",
  // Required, and the reason the first attempt threw: the template links
  // straight to the ticket so nobody has to go looking for it.
  ticketLink: "https://desk.keylearn.org/thread/42",
});

const urgent = messageUrgentFlag({
  to: support,
  subject: "A parent cannot get their child back into Kids mode",
  reason: "reopened twice, and asked for a person",
  detail:
    "KEY0000041 — the grown-up PIN was changed on another device and the " +
    "learner profile is now unreachable. Two replies from the assistant " +
    "did not resolve it and the sender has asked to speak to somebody.",
  deskLink: "https://desk.keylearn.org/thread/41",
});

for (const [what, message] of [
  ["business enquiry", business],
  ["escalation", urgent],
]) {
  const info = await transport.sendMail({ from, ...message });
  console.log(`${what} → ${message.to}: ${info.response ?? "sent"}`);
}

transport.close();
