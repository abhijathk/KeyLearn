import { usePageData } from "@keylearn/pages-shared";
import { useIsDark } from "@keylearn/themes";
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
  // Turnstile's own default is "auto", which reads the DEVICE preference —
  // so a reader who picked the day theme on a dark laptop got a black
  // Cloudflare card sitting in a white form. The theme the page is actually
  // painted in is the one to match, and `useIsDark` already answers that
  // for the auto case as well as the two explicit ones.
  const dark = useIsDark();
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
          "sitekey": siteKey,
          "callback": onToken,
          "theme": dark ? "dark" : "light",
          // Fills the column it is given, so its edges match the email
          // field above it and the button below. Left at the default the
          // widget is a fixed 300px box centred in a wider form — close
          // enough to read as a misplaced element rather than a step.
          "size": "flexible",
          // A token is good for five minutes. Somebody who is challenged,
          // solves it, then goes to find their password manager will
          // outlast that and be refused for having taken too long — with
          // a widget still showing "Success!" beside the refusal. Refresh
          // instead, and drop the stale token on the floor so nothing
          // resubmits one that is known to be dead.
          "refresh-expired": "auto",
          "expired-callback": () => onToken(""),
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
  }, [siteKey, dark]);
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
  // Bumped each time the server asks again. A Turnstile token is
  // single-use: without a fresh widget, a second challenge re-sent the one
  // already spent on the first, was refused for exactly that reason, and
  // asked again — a loop whose only exit is reloading the page.
  const [nonce, setNonce] = useState(0);

  const widget =
    needed && siteKey ? (
      <TurnstileWidget key={nonce} siteKey={siteKey} onToken={setToken} />
    ) : null;

  return {
    /** The solved token, if any — pass it as `turnstileToken` on the request. */
    token,
    /** Whether the challenge is currently being shown. */
    needed,
    /** Show the challenge (call after a "captcha required" response). */
    require: () => {
      setNeeded(true);
      setToken(undefined);
      setNonce((n) => n + 1);
    },
    /** The rendered widget (or null). Place it above the submit button. */
    widget,
  };
}
