import { usePageData } from "@keylearn/pages-shared";
import { type ReactNode, useEffect, useRef, useState } from "react";
import * as styles from "./SupportPage.module.less";

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
  eager = false,
}: {
  readonly siteKey: string;
  readonly onToken: (token: string) => void;
  /** Run invisibly from mount rather than waiting to be asked. */
  readonly eager?: boolean;
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
          "sitekey": siteKey,
          "callback": onToken,
          // "interaction-only": Cloudflare shows nothing at all unless it
          // genuinely cannot decide, in which case a single checkbox
          // appears. A real visitor on the support form should never learn
          // this exists; a headless client has to run a browser engine to
          // get past it, which is the cost we are actually buying.
          "appearance": eager ? "interaction-only" : "always",
          // Named so Cloudflare's own analytics can tell the guest form
          // apart from sign-in when a rule needs tuning.
          "action": eager ? "support-send" : "support-challenge",
          // A token is good for five minutes. Somebody composing a long
          // first message will outlast that, so refresh rather than let
          // them press send and be refused for having thought too long.
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
  }, [siteKey, eager]);
  return <div ref={ref} className={styles.turnstile} />;
}

/**
 * Adaptive-CAPTCHA helper for the contact form. Normally invisible; when a
 * submit comes back as "challenge required" the caller sets `needed`, which
 * renders the widget. Once the visitor solves it, `token` is set and the
 * caller resubmits.
 */
export function useCaptcha({
  eager = false,
}: { readonly eager?: boolean } = {}) {
  const siteKey = usePageData().turnstileSiteKey;
  const [needed, setNeeded] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);

  // Eager mounts the widget immediately, so a token is in hand BEFORE the
  // first submission rather than after one has been refused. That is what
  // lets the server require a token on every send from the public form
  // without a visitor ever seeing a round trip fail.
  //
  // Reactive (the default) stays right for signed-in surfaces, where the
  // check is a backstop and mounting a challenge nobody needs would be
  // noise.
  const widget =
    (eager || needed) && siteKey ? (
      <TurnstileWidget
        siteKey={siteKey}
        onToken={setToken}
        eager={eager && !needed}
      />
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
