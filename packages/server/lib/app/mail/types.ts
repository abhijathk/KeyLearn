import { injectable } from "@fastr/invert";

@injectable()
export abstract class Mailer {
  abstract sendMail(message: Mailer.Message): Promise<void>;
}

export declare namespace Mailer {
  export type Message = {
    readonly from?: string;
    readonly to: string;
    readonly subject: string;
    readonly text?: string;
    readonly html?: string;
    /**
     * Extra RFC 5322 headers, by name. Used for `List-Unsubscribe` on the
     * mail a person can opt out of; never for the mail they cannot.
     */
    readonly headers?: Readonly<Record<string, string>>;
  };
}
