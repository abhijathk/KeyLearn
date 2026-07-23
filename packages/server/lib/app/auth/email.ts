import { type Mailer } from "../mail/index.ts";

export function messageWithLink({
  email,
  link,
}: {
  readonly email: string;
  readonly link: string;
}): Mailer.Message {
  const subject = `Login link for KeyLearn`;
  const text = `Hello, KeyLearn user!

Here is the link to log you in into the web-site: ${link}

Please keep this link secret and don't share it with anybody!

We wish you happy typing!
`;
  return {
    to: email,
    subject,
    text,
  };
}

export function messageWithResetLink({
  email,
  link,
}: {
  readonly email: string;
  readonly link: string;
}): Mailer.Message {
  const subject = `Reset your KeyLearn password`;
  const text = `Hello, KeyLearn user!

We received a request to reset your password. Use the link below to choose a new one: ${link}

If you didn't ask to reset your password, you can safely ignore this email — your account is unchanged.

This link expires in 24 hours.

We wish you happy typing!
`;
  return {
    to: email,
    subject,
    text,
  };
}
