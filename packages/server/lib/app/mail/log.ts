import { injectable } from "@fastr/invert";
import { Logger } from "@keybr/logger";
import { Mailer } from "./types.ts";

/**
 * A development mailer that writes each message to the server log instead of
 * sending it. Selected with MAIL_TRANSPORT=log — handy for local testing where
 * real delivery is unavailable (e.g. a sender domain the relay can't authorise),
 * so verification and deletion codes can be read from the console.
 */
@injectable()
export class LogMailer extends Mailer {
  async sendMail({ to, subject, text, html }: Mailer.Message): Promise<void> {
    const body = (text ?? html?.replace(/<[^>]+>/g, " ") ?? "").trim();
    Logger.info("[mail:log] to=%s subject=%s\n%s", to, subject, body);
  }
}
