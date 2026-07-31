import { type Layout } from "@keybr/keyboard";
import { type AnyUser } from "@keybr/pages-shared";

/** Which window a board covers. */
export type Range = "week" | "month" | "overall";

export type Entry = {
  readonly user: AnyUser;
  readonly layout: Layout;
  readonly speed: number;
  readonly score: number;
};

/** The viewer's own standing, when they are ranked. */
export type Standing = {
  readonly rank: number;
  readonly speed: number;
  readonly score: number;
  /** How much faster they would need to be to reach the board. */
  readonly gapToTop: number;
  readonly entry: Entry;
};

export type Board = {
  /**
   * False until the community is large enough for a ranking to mean anything.
   * The page says so plainly rather than showing a board of four people.
   */
  readonly ready: boolean;
  readonly range: Range;
  readonly top: readonly Entry[];
  readonly you: Standing | null;
  /** The score that would put an unranked learner on the board. */
  readonly entryScore: number;
};

export type EntriesProps = {
  readonly entries: readonly Entry[];
};
