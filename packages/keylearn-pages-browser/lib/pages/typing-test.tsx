import { KeyboardProvider } from "@keylearn/keyboard";
import { TypingTestPage } from "@keylearn/page-typing-test";
import { ResultLoader } from "@keylearn/result-loader";
import { WithAdaptations } from "../adaptations.tsx";

export default function Page() {
  return (
    <ResultLoader>
      <KeyboardProvider>
        <WithAdaptations>
          <TypingTestPage />
        </WithAdaptations>
      </KeyboardProvider>
    </ResultLoader>
  );
}
