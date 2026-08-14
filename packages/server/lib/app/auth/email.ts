import { type VerificationPurpose } from "@keylearn/database";
import { type Mailer } from "../mail/index.ts";

// ── Brand palette (matches the KeyLearn theme) ──
const INK = "#141620";
const ACCENT = "#37c871"; // CTA green
const ACCENT_SOFT = "#eaf8f0";
const PAGE_BG = "#eef0f4";
const CARD_BG = "#ffffff";
const MUTED = "#6b7280";
const BORDER = "#e6e8ee";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Minimal HTML escaping for values we interpolate into the markup.
function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// A text wordmark — reliable across email clients (no external fonts/images):
// "Key" in ink, "Learn" in the brand green.
function wordmark(): string {
  return (
    `<span style="font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${INK}">` +
    `Key<span style="color:${ACCENT}">Learn</span></span>`
  );
}

// A "bulletproof" call-to-action button: a padded, rounded anchor that renders
// as a real clickable button in every major client.
function button(href: string, label: string): string {
  return (
    `<a href="${esc(href)}" ` +
    `style="display:inline-block;background:${ACCENT};color:#ffffff;` +
    `font-family:${FONT};font-size:16px;font-weight:700;text-decoration:none;` +
    `padding:14px 30px;border-radius:10px;line-height:1">${esc(label)}</a>`
  );
}

// Wraps the message body in the branded shell (header wordmark, white card,
// muted footer). `inner` is trusted HTML built by the callers below.
function shell(previewText: string, inner: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:${PAGE_BG}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(previewText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="padding:4px 8px 20px">${wordmark()}</td></tr>
<tr><td style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;padding:32px 28px">
${inner}
</td></tr>
<tr><td style="padding:20px 8px;color:${MUTED};font-family:${FONT};font-size:12px;line-height:1.6">
You're receiving this because someone used this address on KeyLearn. If it wasn't you, you can safely ignore this email.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;font-weight:800;color:${INK}">${esc(text)}</h1>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.6;color:#374151">${esc(text)}</p>`;
}

// A small muted "or paste this link" fallback under a CTA button.
function fallbackLink(link: string): string {
  return (
    `<p style="margin:20px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED}">` +
    `Or paste this link into your browser:<br>` +
    `<a href="${esc(link)}" style="color:${ACCENT};word-break:break-all">${esc(link)}</a></p>`
  );
}

export function messageWithLink({
  email,
  link,
}: {
  readonly email: string;
  readonly link: string;
}): Mailer.Message {
  const subject = `Sign in to KeyLearn`;
  const text = `Hello!

Use this link to sign in to KeyLearn:

${link}

The link works once and expires in 24 hours. Please keep it secret and don't share it.

If you didn't ask to sign in, you can safely ignore this email.

Happy typing!`;
  const html = shell(
    "Your KeyLearn sign-in link",
    heading("Sign in to KeyLearn") +
      paragraph("Tap the button below to sign in. No password needed.") +
      `<div style="margin:4px 0 4px">${button(link, "Sign in")}</div>` +
      fallbackLink(link) +
      `<p style="margin:22px 0 0;font-family:${FONT};font-size:13px;color:${MUTED}">This link works once and expires in 24 hours.</p>`,
  );
  return { to: email, subject, text, html };
}

// What the code is FOR, in the reader's words. One template served every
// purpose, so a code for deleting an account arrived headed "Verify your email"
// and told the reader to finish signing up — wrong on its face, and impossible
// to find later by searching the inbox for what you were actually doing.
const PURPOSE_COPY: Record<
  VerificationPurpose,
  {
    readonly subject: string;
    readonly noun: string;
    readonly heading: string;
    readonly lead: string;
    readonly ignore: string;
  }
> = {
  ["verify-email"]: {
    subject: "KeyLearn sign-up code",
    noun: "sign-up",
    heading: "Verify your email",
    lead: "Enter this code on the sign-up screen to finish creating your account:",
    ignore: "If you didn't try to create a KeyLearn account",
  },
  ["change-email"]: {
    subject: "KeyLearn email-change code",
    noun: "email-change",
    heading: "Confirm your new email",
    lead: "Enter this code to move your KeyLearn account to this address:",
    ignore: "If you didn't ask to change your KeyLearn email address",
  },
  ["identity"]: {
    subject: "KeyLearn confirmation code",
    noun: "confirmation",
    heading: "Confirm it's you",
    lead: "Enter this code to confirm this change to your KeyLearn account:",
    ignore: "If you didn't ask to make a change to your KeyLearn account",
  },
  ["delete-account"]: {
    subject: "KeyLearn account-deletion code",
    noun: "account-deletion",
    heading: "Confirm you want to delete your account",
    lead: "Enter this code to permanently delete your KeyLearn account and everything in it:",
    ignore: "If you didn't ask to delete your KeyLearn account",
  },
};

export function messageWithCode({
  email,
  code,
  purpose = "verify-email",
}: {
  readonly email: string;
  readonly code: string;
  readonly purpose?: VerificationPurpose;
}): Mailer.Message {
  const copy = PURPOSE_COPY[purpose] ?? PURPOSE_COPY["verify-email"];
  // The code never goes in the subject or the preview line. Both surface on a
  // locked phone's notification and in any mail relay's logs, which would hand
  // the code to anyone holding the device without unlocking it.
  const subject = copy.subject;
  const text = `Hello!

Your KeyLearn ${copy.noun} code is:

${code}

${copy.lead} The code expires in 15 minutes.

${copy.ignore}, you can safely ignore this email — nothing happens until the code is entered.

Happy typing!`;
  const codeBlock =
    `<div style="margin:6px 0 4px;background:${ACCENT_SOFT};border:1px solid ${BORDER};` +
    `border-radius:12px;padding:18px 12px;text-align:center;` +
    `font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:700;` +
    `letter-spacing:0.4em;color:${INK}">${esc(code)}</div>`;
  const html = shell(
    `Your ${copy.noun} code is inside — it expires in 15 minutes.`,
    heading(copy.heading) +
      paragraph(copy.lead) +
      codeBlock +
      `<p style="margin:20px 0 0;font-family:${FONT};font-size:13px;color:${MUTED}">This code expires in 15 minutes.</p>`,
  );
  return { to: email, subject, text, html };
}

export function messageWithResetLink({
  email,
  link,
}: {
  readonly email: string;
  readonly link: string;
}): Mailer.Message {
  const subject = `Reset your KeyLearn password`;
  const text = `Hello!

We received a request to reset your KeyLearn password. Use this link to choose a new one:

${link}

This link expires in 24 hours.

If you didn't ask to reset your password, you can safely ignore this email — your account is unchanged.

Happy typing!`;
  const html = shell(
    "Reset your KeyLearn password",
    heading("Reset your password") +
      paragraph(
        "We received a request to reset your password. Tap the button below to choose a new one.",
      ) +
      `<div style="margin:4px 0 4px">${button(link, "Choose a new password")}</div>` +
      fallbackLink(link) +
      `<p style="margin:22px 0 0;font-family:${FONT};font-size:13px;color:${MUTED}">This link expires in 24 hours. If you didn't ask to reset your password, your account is unchanged.</p>`,
  );
  return { to: email, subject, text, html };
}

// A small key/value block for stating the facts of an event — when, where,
// from what. Tables rather than flex, because email clients are still 2003.
function factList(rows: readonly (readonly [string, string])[]): string {
  const cells = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;font-family:${FONT};font-size:13px;color:${MUTED};white-space:nowrap">${esc(k)}</td>` +
        `<td style="padding:6px 0 6px 16px;font-family:${FONT};font-size:13px;color:${INK}">${esc(v)}</td></tr>`,
    )
    .join("");
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" ` +
    `style="margin:6px 0 4px;background:${ACCENT_SOFT};border:1px solid ${BORDER};` +
    `border-radius:12px;padding:14px 18px;width:100%">${cells}</table>`
  );
}

/**
 * Tells an account holder that something security-relevant just happened.
 *
 * These are never optional. A takeover that arrives silently is one nobody can
 * act on, and the whole value of the notice is that it reaches someone who did
 * NOT perform the action.
 */
export function messageSecurityAlert({
  email,
  event,
  when,
  ip,
  device,
  manageLink,
}: {
  readonly email: string;
  readonly event: string;
  readonly when: string;
  readonly ip: string | null;
  readonly device: string | null;
  readonly manageLink: string;
}): Mailer.Message {
  const subject = `KeyLearn security alert: ${event}`;
  const facts: [string, string][] = [
    ["What", event],
    ["When", when],
  ];
  if (device) {
    facts.push(["Device", device]);
  }
  if (ip) {
    facts.push(["Address", ip]);
  }
  const text = `Hello!

${event} on your KeyLearn account.

When: ${when}
${device ? `Device: ${device}\n` : ""}${ip ? `Address: ${ip}\n` : ""}
If this was you, nothing more is needed.

If it wasn't, change your password and sign out of all devices straight away:
${manageLink}

Happy typing!`;
  const html = shell(
    `${event} on your KeyLearn account`,
    heading("Security alert") +
      paragraph(`${event} on your KeyLearn account.`) +
      factList(facts) +
      paragraph("If this was you, there's nothing to do.") +
      paragraph(
        "If it wasn't, change your password and sign out of all devices now.",
      ) +
      `<div style="margin:4px 0 4px">${button(manageLink, "Review account security")}</div>` +
      `<p style="margin:22px 0 0;font-family:${FONT};font-size:13px;color:${MUTED}">Security alerts can't be turned off — they're how you find out if someone else gets in.</p>`,
  );
  return { to: email, subject, text, html };
}

/**
 * The practice nudge. Sent only to accounts that asked for it, and worded as an
 * invitation rather than a scolding — this goes to households with children,
 * and guilt is a poor teacher.
 */
export function messagePracticeReminder({
  email,
  name,
  days,
  practiceLink,
  settingsLink,
}: {
  readonly email: string;
  readonly name: string;
  readonly days: number;
  readonly practiceLink: string;
  readonly settingsLink: string;
}): Mailer.Message {
  const subject = `A few minutes of typing today?`;
  const text = `Hi ${name},

It's been ${days} days since your last practice. Even five minutes keeps the muscle memory going.

${practiceLink}

Don't want these? Turn reminders off in your preferences:
${settingsLink}

Happy typing!`;
  const html = shell(
    "A few minutes of typing today?",
    heading(`Ready for a few minutes, ${name}?`) +
      paragraph(
        `It's been ${days} days since your last session. Even five minutes keeps the muscle memory going — there's no streak to lose here.`,
      ) +
      `<div style="margin:4px 0 4px">${button(practiceLink, "Start practising")}</div>` +
      `<p style="margin:22px 0 0;font-family:${FONT};font-size:13px;color:${MUTED}">Don't want these? <a href="${esc(settingsLink)}" style="color:${ACCENT}">Turn reminders off</a>.</p>`,
  );
  return { to: email, subject, text, html };
}

/** Product news. Only to accounts that opted in, and always unsubscribable. */
export function messageProductNews({
  email,
  title,
  body,
  link,
  settingsLink,
}: {
  readonly email: string;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly settingsLink: string;
}): Mailer.Message {
  const text = `${title}

${body}
${link ? `\n${link}\n` : ""}
Don't want these? Turn product news off:
${settingsLink}`;
  const html = shell(
    title,
    heading(title) +
      paragraph(body) +
      (link
        ? `<div style="margin:4px 0 4px">${button(link, "Take a look")}</div>`
        : "") +
      `<p style="margin:22px 0 0;font-family:${FONT};font-size:13px;color:${MUTED}">You're getting this because you turned on product news. <a href="${esc(settingsLink)}" style="color:${ACCENT}">Turn it off</a>.</p>`,
  );
  return { to: email, subject: title, text, html };
}

/**
 * Forwards a business enquiry from the support desk to the configured inbox.
 *
 * General support tickets stay queue-only — staff triage those from the
 * desk. A business enquiry is different: it usually wants a faster, more
 * personal reply than the queue gives it, so it also lands directly in an
 * inbox a person is actually watching.
 */
export function messageBusinessEnquiry({
  to,
  name,
  fromEmail,
  subject,
  message,
  ticketLink,
}: {
  readonly to: string;
  readonly name: string;
  readonly fromEmail: string;
  readonly subject: string;
  readonly message: string;
  readonly ticketLink: string;
}): Mailer.Message {
  const mailSubject = `Business enquiry: ${subject}`;
  const text = `New business enquiry from the KeyLearn support desk.

From: ${name} <${fromEmail}>
Subject: ${subject}

${message}

View in the staff desk:
${ticketLink}`;
  const html = shell(
    mailSubject,
    heading("Business enquiry") +
      factList([
        ["From", `${name} <${fromEmail}>`],
        ["Subject", subject],
      ]) +
      paragraph(message) +
      `<div style="margin:4px 0 4px">${button(ticketLink, "Open in the staff desk")}</div>`,
  );
  return { to, subject: mailSubject, text, html };
}
