import { type Binder, type Module } from "@fastr/invert";
import { Env } from "@keybr/config";
import { LogMailer } from "./log.ts";
import { MailgunMailer } from "./mailgun.ts";
import { SmtpMailer } from "./smtp.ts";
import { Mailer } from "./types.ts";

export class MailModule implements Module {
  configure({ bind }: Binder) {
    // MAIL_TRANSPORT=smtp uses a plain SMTP relay (Brevo, Gmail, etc);
    // MAIL_TRANSPORT=log writes messages to the server log (local dev, no real
    // delivery); anything else keeps the original Mailgun API transport.
    switch (Env.getString("MAIL_TRANSPORT", "mailgun")) {
      case "smtp":
        bind(Mailer).to(SmtpMailer);
        break;
      case "log":
        bind(Mailer).to(LogMailer);
        break;
      default:
        bind(Mailer).to(MailgunMailer);
        break;
    }
  }
}
