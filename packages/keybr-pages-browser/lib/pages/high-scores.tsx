import { HighScoresPage, type Range } from "@keybr/page-highscores";
import { useState } from "react";
import { useHighScoresLoader } from "../loader/HighScoresLoader.tsx";

export default function Page() {
  // The week is the window a learner can still change, and where a new name can
  // realistically appear — so that is where the board opens.
  const [range, setRange] = useState<Range>("week");
  const { board, loading } = useHighScoresLoader(range);
  return (
    <HighScoresPage
      board={board}
      range={range}
      onRangeChange={setRange}
      loading={loading}
    />
  );
}
