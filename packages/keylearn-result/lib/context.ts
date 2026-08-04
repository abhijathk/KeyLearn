import { createContext, type ReactNode, useContext } from "react";
import { type Result } from "./result.ts";

export type ResultContextProps = {
  readonly results: readonly Result[];
  readonly appendResults: (newResults: readonly Result[]) => void;
  readonly clearResults: () => void;
  /** The per-profile history namespace these results are scoped to (e.g.
   * "profile-p123"), or null for the default account history. Used to key
   * per-profile side data (like the n-gram "slowest transitions") to the same
   * profile the charts are showing — not merely the globally-active one. */
  readonly namespace?: string | null;
  /** Whose history this is, for anything shown to a person — the export
   * filename, above all. The namespace beside it is an id and is no use in a
   * filename; this is the name the learner would recognise. Null when the
   * history is the account's own rather than a named profile's. */
  readonly profileName?: string | null;
  /**
   * That learner's avatar, already rendered.
   *
   * A node rather than the avatar data, because the component that draws one
   * lives with the profile screens and the charts have no business depending
   * on them — the page that knows which learner is selected is the page that
   * renders their face.
   */
  readonly profileAvatar?: ReactNode;
  /**
   * Whether this is a child's profile.
   *
   * Only for deciding what to offer — Code craft is not something a kid
   * profile practises, so filtering their statistics by it would offer a view
   * that is always empty. Not to be confused with the loader's `kids` flag,
   * which selects which history is opened.
   */
  readonly kidProfile?: boolean;
  /**
   * That learner's birth year, or null when unknown or not a named profile.
   *
   * Here rather than read from the active profile, for the same reason
   * `namespace` is: the profile page's tabs choose whose history is on screen
   * WITHOUT changing who is at the keyboard, so the globally-active profile is
   * routinely a different person from the one whose charts are being read.
   */
  readonly profileBirthYear?: number | null;
};

export const ResultContext = createContext<ResultContextProps>(null!);

export function useResults(): ResultContextProps {
  const value = useContext(ResultContext);
  if (value == null) {
    throw new Error(
      process.env.NODE_ENV !== "production"
        ? "ResultContext is missing"
        : undefined,
    );
  }
  return value;
}
