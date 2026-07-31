import { catchError } from "@keybr/debug";
import { Layout } from "@keybr/keyboard";
import { type Board, type Range } from "@keybr/page-highscores";
import { type AnyUser, loadActiveProfileId } from "@keybr/pages-shared";
import { expectType, request } from "@keybr/request";
import { useEffect, useState } from "react";

type WireEntry = {
  readonly user: AnyUser | null;
  readonly layout: string;
  readonly speed: number;
  readonly score: number;
};

export function useHighScoresLoader(range: Range): {
  board: Board | null;
  loading: boolean;
} {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadBoard(range)
      .then((next) => {
        if (!cancelled) {
          setBoard(next);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoading(false);
        }
        catchError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return { board, loading };
}

function toEntry(e: WireEntry) {
  return {
    // A row whose account has since been deleted still ranks; it just has no
    // name to show.
    user: e.user ?? { id: null, name: "Deleted User", imageUrl: null },
    layout: Layout.ALL.get(e.layout),
    speed: e.speed,
    score: e.score,
  };
}

async function loadBoard(range: Range): Promise<Board> {
  const params = new URLSearchParams({ range });
  // Which learner is at the keyboard, so the standing shown is theirs and not
  // the account holder's. The server verifies it before trusting it.
  const profile = loadActiveProfileId();
  if (profile != null) {
    params.set("profile", profile);
  }
  const response = await request
    .use(expectType("application/json"))
    .GET(`/_/high-scores?${params}`)
    .send();
  const body = await response.json<{
    ready: boolean;
    range?: Range;
    top?: WireEntry[];
    you?: {
      rank: number;
      speed: number;
      score: number;
      gapToTop: number;
      entry: WireEntry;
    } | null;
    entryScore?: number;
  }>();

  if (!body.ready) {
    return { ready: false, range, top: [], you: null, entryScore: 0 };
  }
  return {
    ready: true,
    range: body.range ?? range,
    top: (body.top ?? []).map(toEntry),
    you:
      body.you == null ? null : { ...body.you, entry: toEntry(body.you.entry) },
    entryScore: body.entryScore ?? 0,
  };
}
