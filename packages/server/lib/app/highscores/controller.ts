import { controller, http } from "@fastr/controller";
import { Context } from "@fastr/core";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { Profile } from "@keylearn/database";
import {
  HighScoresFactory,
  type HighScoresRow,
  type Range,
} from "@keylearn/highscores";
import { type AuthState } from "../auth/index.ts";
import { mapEntries } from "./model.ts";
import { leaderboardReady } from "./readiness.ts";

/** The board shows this many, and no more. */
const TOP = 20;

const RANGES: readonly Range[] = ["week", "month", "overall"];

@injectable()
@controller()
export class Controller {
  constructor(readonly highScores: HighScoresFactory) {}

  @http.GET("/_/high-scores")
  async getHighScores(ctx: Context<RouterState & AuthState>) {
    const table = await this.highScores.load();
    const query = ctx.request.query;
    const asked = String(query.get("range") ?? "week") as Range;
    const range: Range = RANGES.includes(asked) ? asked : "week";

    const rows = table.ranking(range);

    if (!(await leaderboardReady(rows.length))) {
      // Nothing is served until the board is meaningful, not even to a caller
      // who guessed the endpoint — so the gate cannot be stepped around.
      ctx.response.body = { ready: false };
      ctx.response.headers.set("Cache-Control", "public, max-age=300");
      return;
    }

    const meIndex = await this.#findViewer(ctx, rows);
    const you =
      meIndex >= 0
        ? {
            rank: meIndex + 1,
            speed: rows[meIndex].speed,
            score: rows[meIndex].score,
            // The only number here that suggests an achievable next step.
            gapToTop: Math.max(
              0,
              (rows[Math.min(TOP, rows.length) - 1]?.speed ?? 0) -
                rows[meIndex].speed,
            ),
          }
        : null;

    ctx.response.body = {
      ready: true,
      range,
      top: await mapEntries(rows.slice(0, TOP)),
      you:
        you == null
          ? null
          : { ...you, entry: (await mapEntries([rows[meIndex]]))[0] },
      // What it would take to appear at all, for someone not yet ranked. Framed
      // as a target rather than as an absence — never a position that reads as
      // last.
      entryScore: rows.length >= TOP ? rows[TOP - 1].score : 0,
    };
    // Carries the viewer's own standing, so it is theirs alone.
    ctx.response.headers.set("Cache-Control", "private, no-store");
  }

  /** The index of the viewer's own row, or -1. */
  async #findViewer(
    ctx: Context<RouterState & AuthState>,
    rows: readonly HighScoresRow[],
  ): Promise<number> {
    const { user } = ctx.state;
    if (user == null) {
      return -1;
    }
    // Which learner is at the keyboard. Verified, not trusted — the id comes
    // from the client.
    const claimed = Number(ctx.request.query.get("profile"));
    let profileId: number | null = null;
    if (Number.isSafeInteger(claimed) && claimed > 0) {
      profileId = (await Profile.findOwned(user.id!, claimed))?.id ?? null;
    }
    return rows.findIndex(
      (row) =>
        row.user === user.id &&
        (profileId == null || (row.profile ?? null) === profileId),
    );
  }
}
