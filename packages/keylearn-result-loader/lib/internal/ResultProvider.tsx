import { type Result, ResultContext } from "@keylearn/result";
import { type ReactNode, useState } from "react";
import { catchError } from "./debug.tsx";
import { type ResultStorage } from "./types.ts";

export function ResultProvider({
  storage,
  initialResults,
  namespace = null,
  profileName = null,
  profileAvatar = null,
  kidProfile = false,
  profileBirthYear = null,
  children,
}: {
  readonly storage: ResultStorage;
  readonly initialResults: readonly Result[];
  /** The profile history namespace these results belong to (see context). */
  readonly namespace?: string | null;
  /** Whose history it is, for the export filename (see context). */
  readonly profileName?: string | null;
  /** That learner's avatar, already rendered (see context). */
  readonly profileAvatar?: ReactNode;
  /** Whether this is a child's profile (see context). */
  readonly kidProfile?: boolean;
  /** That learner's birth year (see context). */
  readonly profileBirthYear?: number | null;
  readonly children: ReactNode;
}): ReactNode {
  const [results, setResults] = useState(initialResults);
  return (
    <ResultContext.Provider
      value={{
        results,
        namespace,
        profileName,
        profileAvatar,
        kidProfile,
        profileBirthYear,
        appendResults: (newResults) => {
          setResults([...results, ...newResults]);
          storage.append(newResults).catch(catchError);
        },
        clearResults: () => {
          setResults([]);
          storage.clear().catch(catchError);
        },
      }}
    >
      {children}
    </ResultContext.Provider>
  );
}
