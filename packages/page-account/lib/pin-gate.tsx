import { type ReactNode, useCallback, useState } from "react";
import { PinPrompt } from "./profiles/PinPrompt.tsx";
import { AccountService, isParentPinRequired } from "./service.ts";

type Held = {
  readonly retry: () => Promise<void>;
  readonly cancel: () => void;
};

/**
 * Runs a request, and when the server answers 428 asking for the grown-up
 * PIN, asks for it with the same prompt the learner editor uses and then
 * replays the request — the person already pressed the button once.
 *
 * `gated(run)` resolves with the replayed result, or rejects with the
 * original 428 if the prompt is cancelled. Render `prompt` somewhere in the
 * tree; it is null until a request is held.
 */
export function useParentPinGate(): {
  readonly gated: <T>(run: () => Promise<T>) => Promise<T>;
  readonly prompt: ReactNode;
} {
  const [held, setHeld] = useState<Held | null>(null);

  const gated = useCallback(
    <T,>(run: () => Promise<T>): Promise<T> =>
      run().catch((err: unknown) => {
        if (!isParentPinRequired(err)) {
          throw err;
        }
        return new Promise<T>((resolve, reject) => {
          setHeld({
            retry: () => run().then(resolve, reject),
            cancel: () => reject(err),
          });
        });
      }),
    [],
  );

  const prompt =
    held == null ? null : (
      <PinPrompt
        onProve={async (pin) => {
          try {
            await AccountService.verifyParentPin(pin);
          } catch {
            return false;
          }
          setHeld(null);
          await held.retry();
          return true;
        }}
        onCancel={() => {
          held.cancel();
          setHeld(null);
        }}
      />
    );

  return { gated, prompt };
}
