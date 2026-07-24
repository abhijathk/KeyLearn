import { StrokeIcon } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";
import * as styles from "./FloatingShell.module.less";

/**
 * The floating settings-style window the account and auth pages live in:
 * a dimmed, blurred backdrop and a centred panel in the road design
 * language. `compact` hugs the content instead of filling the viewport —
 * combined with `AnimatedHeight` the panel expands and contracts smoothly
 * when its content changes.
 */
export function FloatingShell({
  title,
  children,
  compact = false,
}: {
  readonly title: ReactNode;
  readonly children: ReactNode;
  readonly compact?: boolean;
}): ReactNode {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const close = () => navigate("/");
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
        className={clsx(styles.window, compact && styles.compact)}
        role="dialog"
        aria-modal={true}
      >
        <div className={styles.windowHead}>
          <span className={styles.windowTitle}>{title}</span>
          <button
            className={styles.windowClose}
            title={formatMessage({
              id: "account.close",
              defaultMessage: "Close and return to practice",
            })}
            onClick={close}
          >
            <StrokeIcon name="close" />
          </button>
        </div>
        <div className={styles.windowBody}>{children}</div>
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
