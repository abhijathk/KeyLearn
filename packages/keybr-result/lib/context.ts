import { createContext, useContext } from "react";
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
