import { createContext, useContext } from "react";

/**
 * Whether this practice page is the kids' Classic screen.
 *
 * Classic IS this page — same engine, same keyboard, same hands — framed in
 * the kids palette by page-kids. A handful of things on it are the grown-up
 * page's alone: the lesson-settings gear (Classic is always guided
 * practice, and its settings are the kids sheet in the header) and the
 * session recap panel. Those read this, rather than being hidden from
 * outside with a stylesheet that would break the first time they moved.
 */
export const KidsPracticeContext = createContext(false);

export function useKidsPractice(): boolean {
  return useContext(KidsPracticeContext);
}
