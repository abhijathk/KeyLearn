import { usePageData } from "@keybr/pages-shared";
import { type ReactNode, useEffect, useRef, useState } from "react";
import * as styles from "./AuthPage.module.less";

// Loads the Cloudflare Turnstile script once, on demand. Resolves immediately
// when it's already present (or when there's no DOM, e.g. during SSR).
let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (scriptPromise != null) {
    return scriptPromise;
  }
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      resolve();
      return;
    }
    if ((window as any).turnstile != null) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** True when a thrown request error is the server asking for a CAPTCHA. */
export function isCaptchaRequired(err: any): boolean {
  return err?.status === 428 || err?.body?.error?.captcha === true;
}

function TurnstileWidget({
  siteKey,
  onToken,
}: {
  readonly siteKey: string;
  readonly onToken: (token: string) => void;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let widgetId: string | undefined;
    loadTurnstile()
      .then(() => {
        const t = (window as any).turnstile;
        if (cancelled || ref.current == null || t == null) {
          return;
        }
        widgetId = t.render(ref.current, {
          sitekey: siteKey,
          callback: onToken,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      try {
        (window as any).turnstile?.remove(widgetId);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);
  return <div ref={ref} className={styles.turnstile} />;
}

/**
 * Adaptive-CAPTCHA helper for the auth forms. Normally invisible; when a submit
 * comes back as "challenge required" the caller sets `needed`, which renders the
 * widget. Once the visitor solves it, `token` is set and the caller resubmits.
 */
export function useCaptcha() {
  const siteKey = usePageData().turnstileSiteKey;
  const [needed, setNeeded] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);

  const widget =
    needed && siteKey ? (
      <TurnstileWidget siteKey={siteKey} onToken={setToken} />
    ) : null;

  return {
    /** The solved token, if any — pass it as `turnstileToken` on the request. */
    token,
    /** Whether the challenge is currently being shown. */
    needed,
    /** Show the challenge (call after a "captcha required" response). */
    require: () => setNeeded(true),
    /** The rendered widget (or null). Place it above the submit button. */
    widget,
  };
}
