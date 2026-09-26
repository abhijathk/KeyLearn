import { injectable } from "@fastr/invert";
import { Env } from "@keylearn/config";
import { createTransport, type Transporter } from "nodemailer";
import { Mailer } from "./types.ts";

/**
 * A plain SMTP transport for providers like Brevo, Gmail or any relay.
 * Selected with MAIL_TRANSPORT=smtp.
 */
@injectable({ singleton: true })
export class SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly password: string;
  readonly from: string;

  constructor() {
    this.host = Env.getString("MAIL_SMTP_HOST");
    this.port = Env.getNumber("MAIL_SMTP_PORT", 587);
    // Port 465 wants implicit TLS; 587 upgrades via STARTTLS.
    this.secure = Env.getBoolean("MAIL_SMTP_SECURE", this.port === 465);
    this.user = Env.getString("MAIL_SMTP_USER");
    this.password = Env.getString("MAIL_SMTP_PASSWORD");
    const fromAddress = Env.getString("MAIL_FROM_ADDRESS");
    const fromName = Env.getString("MAIL_FROM_NAME", "KeyLearn");
    this.from = `${fromName} <${fromAddress}>`;
  }
}

/**
 * On 587 nodemailer upgrades with STARTTLS only if the server offers it, so
 * a relay (or anything in the path) that leaves the offer out gets the
 * login in the clear. `requireTLS` makes a missing upgrade a failed send
 * instead. Loopback is exempt: a local relay never crosses a network.
 */
export function smtpOptions(config: Pick<SmtpConfig, "host" | "port" | "secure" | "user" | "password">) {
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(config.host.toLowerCase());
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure && !loopback,
    auth: {
      user: config.user,
      pass: config.password,
    },
  };
}

@injectable()
export class SmtpMailer extends Mailer {
  readonly #transporter: Transporter;

  constructor(readonly config: SmtpConfig) {
    super();
    this.#transporter = createTransport(smtpOptions(config));
  }

  async sendMail({
    from = this.config.from,
    to,
    subject,
    text,
    html,
    headers,
  }: Mailer.Message): Promise<void> {
    await this.#transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
      headers,
    });
  }
}
