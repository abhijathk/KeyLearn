import { FloatingShell } from "@keylearn/page-account";
import { type ReactNode, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./HighScoresPage.module.less";
import { HighScoresTable, type Unit } from "./HighScoresTable.tsx";
import { type Board, type Range } from "./types.ts";

const RANGES: readonly { id: Range; label: ReactNode }[] = [
  {
    id: "week",
    label: <FormattedMessage id="highScores.week" defaultMessage="This week" />,
  },
  {
    id: "month",
    label: (
      <FormattedMessage id="highScores.month" defaultMessage="This month" />
    ),
  },
  {
    id: "overall",
    label: (
      <FormattedMessage id="highScores.overall" defaultMessage="Overall" />
    ),
  },
];

export function HighScoresPage({
  board,
  range,
  onRangeChange,
  loading,
}: {
  readonly board: Board | null;
  readonly range: Range;
  readonly onRangeChange: (range: Range) => void;
  readonly loading: boolean;
}): ReactNode {
  const [unit, setUnit] = useState<Unit>("wpm");

  // Nothing is shown until there is a community to rank. A board of four people
  // teaches a beginner the wrong thing twice over — the top looks arbitrary, and
  // their own position is decided by who happened to show up.
  const title = (
    <FormattedMessage id="highScores.title" defaultMessage="Leaderboard" />
  );

  if (board != null && !board.ready) {
    return (
      <FloatingShell title={title}>
        <p className={styles.empty}>
          <FormattedMessage
            id="highScores.notYet"
            defaultMessage="The leaderboard opens once enough learners are practising. Keep going — your results are already being counted."
          />
        </p>
      </FloatingShell>
    );
  }

  return (
    <FloatingShell title={title}>
      <div className={styles.page}>
        <div className={styles.bar}>
          <span className={styles.ranges} role="group">
            {RANGES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={range === id}
                onClick={() => onRangeChange(id)}
              >
                {label}
              </button>
            ))}
          </span>
        </div>

        {loading || board == null ? (
          <p className={styles.empty}>
            <FormattedMessage
              id="highScores.loading"
              defaultMessage="Loading…"
            />
          </p>
        ) : board.top.length === 0 ? (
          <p className={styles.empty}>
            <FormattedMessage
              id="highScores.emptyRange"
              defaultMessage="Nobody has practised in this window yet."
            />
          </p>
        ) : (
          <>
            <HighScoresTable
              entries={board.top}
              you={board.you}
              unit={unit}
              onUnitChange={setUnit}
            />

            {/* Not yet ranked: show what would put them on the board, never a
              position that reads as last. */}
            {board.you == null && board.entryScore > 0 && (
              <p className={styles.entry}>
                <FormattedMessage
                  id="highScores.entryScore"
                  defaultMessage="A score of {score} puts you on the board."
                  values={{ score: Math.round(board.entryScore) }}
                />
              </p>
            )}

            {/* The closing line. It sits after your position deliberately, so the
              last thing read is encouragement rather than a gap in words per
              minute. */}
            <blockquote className={styles.quote}>
              <span className={styles.mark} aria-hidden={true}>
                &ldquo;
              </span>
              <div>
                <p>
                  <FormattedMessage
                    id="highScores.quote"
                    defaultMessage="Every minute at the keyboard is one your fingers remember."
                  />
                </p>
                <cite>KeyLearn</cite>
              </div>
            </blockquote>
          </>
        )}
      </div>
    </FloatingShell>
  );
}
