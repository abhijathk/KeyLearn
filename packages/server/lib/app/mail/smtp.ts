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

@injectable()
export class SmtpMailer extends Mailer {
  readonly #transporter: Transporter;

  constructor(readonly config: SmtpConfig) {
    super();
    this.#transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
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
