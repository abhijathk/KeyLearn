import { MultiplayerPage } from "@keylearn/page-multiplayer";
import { ResultLoader } from "@keylearn/result-loader";
import { WithAdaptations } from "../adaptations.tsx";

export default function Page() {
  return (
    <ResultLoader>
      <WithAdaptations>
        <MultiplayerPage />
      </WithAdaptations>
    </ResultLoader>
  );
}
