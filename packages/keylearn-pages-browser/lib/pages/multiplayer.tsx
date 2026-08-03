import { MultiplayerPage } from "@keylearn/page-multiplayer";
import { ResultLoader } from "@keylearn/result-loader";

export default function Page() {
  return (
    <ResultLoader>
      <MultiplayerPage />
    </ResultLoader>
  );
}
