import { type ReactNode } from "react";
import { defineMessages, FormattedMessage } from "react-intl";

/**
 * What each role is called on screen.
 *
 * The role is an enum in the database — "owner", "admin", "teacher",
 * "guardian" — and until now it was rendered straight out of the API,
 * so a school reading KeyLearn in Malayalam still saw the English word.
 *
 * We say "teacher" rather than "educator" deliberately. At a weekend
 * school the teachers are parents who volunteer on a Sunday, and they
 * call themselves teachers; "educator" is sector jargon that sounds
 * like a credential they have not been asked for. If an institution
 * ever needs the other word, it belongs here as a label — not in the
 * schema, the API or the permission table.
 *
 * "Guardian" is the exception to plainness: "parent" would be wrong for
 * the grandmother who actually brings the child, and the tier's whole
 * consent story rests on that person, whoever they are.
 */
const labels = defineMessages({
  owner: {
    id: "org.role.owner",
    defaultMessage: "owner",
  },
  admin: {
    id: "org.role.admin",
    defaultMessage: "admin",
  },
  teacher: {
    id: "org.role.teacher",
    defaultMessage: "teacher",
  },
  guardian: {
    id: "org.role.guardian",
    defaultMessage: "guardian",
  },
});

/** The role, in the reader's language. */
export function RoleName({ role }: { readonly role: string }): ReactNode {
  const message = labels[role as keyof typeof labels];
  // An unknown role is shown as it came rather than hidden — a blank
  // where a role should be is harder to report than a strange word.
  return message == null ? role : <FormattedMessage {...message} />;
}
