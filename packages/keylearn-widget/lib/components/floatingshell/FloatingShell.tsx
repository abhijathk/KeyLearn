import { clsx } from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";
import { StrokeIcon } from "../icon/StrokeIcon.tsx";
import * as styles from "./FloatingShell.module.less";

/**
 * The floating settings-style window the account, auth, and other modal-like
 * pages live in: a dimmed, blurred backdrop and a centred panel in the road
 * design language. `compact` hugs the content instead of filling the
 * viewport — combined with `AnimatedHeight` the panel expands and contracts
 * smoothly when its content changes.
 */
export function FloatingShell({
  title,
  children,
  compact = false,
  flush = false,
  hideClose = false,
  onClose,
  closeLabel,
}: {
  /** Optional: the auth window carries no heading of its own. */
  readonly title?: ReactNode;
  readonly children: ReactNode;
  readonly compact?: boolean;
  /** Remove the body padding so a full-bleed rail/pane layout can fill it. */
  readonly flush?: boolean;
  /**
   * Omits the corner close button and (with no title) the head bar
   * entirely, for a dialog whose own content already offers an explicit
   * way out — backdrop click and Escape still close it.
   */
  readonly hideClose?: boolean;
  /**
   * Most callers are a routed page — closing means leaving it, so the
   * default navigates home. A shell shown inline over the current page
   * (not reached via its own route) passes this instead, so closing just
   * dismisses it in place.
   */
  readonly onClose?: () => void;
  /**
   * Overrides the close button's title/aria text. The default ("Close and
   * return to practice") only makes sense for the navigate-home behavior —
   * a caller with a custom `onClose` should usually supply its own.
   */
  readonly closeLabel?: string;
}): ReactNode {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const close = onClose ?? (() => navigate("/"));
  const closeTitle =
    closeLabel ??
    formatMessage({
      id: "account.close",
      defaultMessage: "Close and return to practice",
    });
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) {
          close();
        }
      }}
    >
      <div
        className={clsx(
          styles.window,
          compact && styles.compact,
          flush && styles.flushWindow,
        )}
        role="dialog"
        aria-modal={true}
      >
        {flush ? (
          // Full-bleed layout: a floating close button replaces the title bar
          // so the rail can meet the top edge.
          <>
            <button
              className={styles.floatClose}
              title={closeTitle}
              onClick={close}
            >
              <StrokeIcon name="close" />
            </button>
            <div className={clsx(styles.windowBody, styles.flush)}>
              {children}
            </div>
          </>
        ) : title != null || !hideClose ? (
          <>
            <div
              className={clsx(styles.windowHead, title == null && styles.bare)}
            >
              {title != null && (
                <span className={styles.windowTitle}>{title}</span>
              )}
              {!hideClose && (
                <button
                  className={styles.windowClose}
                  title={closeTitle}
                  onClick={close}
                >
                  <StrokeIcon name="close" />
                </button>
              )}
            </div>
            <div className={styles.windowBody}>{children}</div>
          </>
        ) : (
          <div className={styles.windowBody}>{children}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Measures its content and animates the wrapper's height towards it, so a
 * form gaining or losing fields glides instead of jumping.
 */
export function AnimatedHeight({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = inner.current;
    if (el == null) {
      return;
    }
    const observer = new ResizeObserver(() => {
      setHeight(el.offsetHeight);
    });
    observer.observe(el);
    setHeight(el.offsetHeight);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className={styles.animatedHeight}
      style={height != null ? { blockSize: height } : undefined}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
