import { type ReactNode, useEffect, useRef } from "react";
import { adSenseClientId, adSenseSlotId } from "./config.ts";

declare global {
  var adsbygoogle: unknown[] | undefined;
}

/**
 * A single, unobtrusive ad banner. Renders nothing at all unless an AdSense
 * client id is configured at build time, so development and self-hosted
 * builds stay completely ad-free and load no third-party scripts.
 */
export const AdBanner = ({
  className,
}: {
  readonly className?: string;
}): ReactNode => {
  const ref = useRef<HTMLModElement>(null);
  const enabled = adSenseClientId !== "0";
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const id = "adsbygoogle-js";
    if (document.getElementById(id) == null) {
      const script = document.createElement("script");
      script.id = id;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adSenseClientId}`;
      document.head.appendChild(script);
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Blocked or unavailable; the empty slot simply stays empty.
    }
  }, [enabled]);
  if (!enabled) {
    return null;
  }
  return (
    <ins
      ref={ref}
      className={`adsbygoogle ${className ?? ""}`}
      style={{ display: "block", minHeight: "90px" }}
      data-ad-client={adSenseClientId}
      data-ad-slot={adSenseSlotId}
      data-ad-format="horizontal"
      data-full-width-responsive="false"
    />
  );
};
