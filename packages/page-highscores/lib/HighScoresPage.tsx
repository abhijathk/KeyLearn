import { Article, Figure } from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { HighScoresTable } from "./HighScoresTable.tsx";
import { type EntriesProps } from "./types.ts";

export function HighScoresPage({ entries }: EntriesProps): ReactNode {
  return (
    <Article>
      <FormattedMessage
        id="page.highScores.content"
        defaultMessage={
          "<h1>High Scores</h1>" +
          "<p>This table ranks the fastest typists from the past few days, sorted from the highest score down. Your typing score factors in your typing speed, how long the text was, how many distinct characters it contained, and how many errors you made. The formula rewards faster speeds, longer passages, and a wider variety of characters, while it penalizes mistakes.</p>"
        }
      />

      <Figure>
        <HighScoresTable entries={entries} />
      </Figure>
    </Article>
  );
}
