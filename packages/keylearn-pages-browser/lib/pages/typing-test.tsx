import { KeyboardProvider } from "@keylearn/keyboard";
import { TypingTestPage } from "@keylearn/page-typing-test";
import { ResultLoader } from "@keylearn/result-loader";

export default function Page() {
  return (
    <ResultLoader>
      <KeyboardProvider>
        <TypingTestPage />
      </KeyboardProvider>
    </ResultLoader>
  );
}
