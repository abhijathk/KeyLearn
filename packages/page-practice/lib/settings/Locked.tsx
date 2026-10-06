import { clsx } from "clsx";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import * as styles from "./Locked.module.less";

/** A small closed padlock, beside a setting a visitor cannot change. */
export function LockIcon(): ReactNode {
  return (
    <svg className={styles.lock} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10V7a5 5 0 0 1 10 0v3" />
      <rect x="4.6" y="10" width="14.8" height="10.4" rx="2.4" />
    </svg>
  );
}

/** How long the "sign in to choose" note stays under a locked control. */
const LOCKED_NOTICE_MS = 3500;

/**
 * The "sign in to choose" note: whether it is up, and `say` to put it up.
 * One note, re-timed on each call, so a visitor poking at a locked control is
 * told, not shouted at.
 */
export function useLockedNotice(): {
  readonly shown: boolean;
  readonly say: () => void;
} {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) {
      return;
    }
    const id = window.setTimeout(() => setShown(false), LOCKED_NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [shown]);
  const say = useCallback(() => {
    // Off then on, so a second click restarts the timer on the same note.
    setShown(false);
    window.setTimeout(() => setShown(true), 0);
  }, []);
  return { shown, say };
}

/**
 * The note itself, drawn in the settings window rather than as a site toast:
 * the window blurs the page behind it, and a toast down there was a message
 * nobody could read (owner, 5 Oct 2026).
 */
export function LockedNotice({
  shown,
  notice,
  under = "control",
}: {
  readonly shown: boolean;
  readonly notice: string;
  /** Under a single control, or under a row of tiles. */
  readonly under?: "control" | "tiles";
}): ReactNode {
  return (
    shown && (
      <p
        role="status"
        className={clsx(
          styles.lockedNotice,
          under === "tiles" && styles.underTiles,
        )}
      >
        {notice}
      </p>
    )
  );
}

/**
 * A control a visitor may SEE but not use (owner, 5 Oct 2026). Shown dimmed
 * and padlocked; a click or a key press on it is stopped before the control
 * opens, and a short note says — only because they asked — that signing in
 * opens it.
 */
export function LockedFor({
  locked,
  notice,
  children,
}: {
  readonly locked: boolean;
  readonly notice: string;
  readonly children: ReactNode;
}): ReactNode {
  const { shown, say } = useLockedNotice();
  if (!locked) {
    return children;
  }
  const stop = (ev: { preventDefault(): void; stopPropagation(): void }) => {
    ev.preventDefault();
    ev.stopPropagation();
  };
  return (
    <div className={styles.lockedWrap}>
      <div
        className={styles.locked}
        aria-disabled="true"
        title={notice}
        onPointerDownCapture={stop}
        onMouseDownCapture={stop}
        onClickCapture={(ev) => {
          stop(ev);
          say();
        }}
        onKeyDownCapture={(ev) => {
          if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(ev.key)) {
            stop(ev);
            say();
          }
        }}
      >
        {children}
      </div>
      <LockedNotice shown={shown} notice={notice} />
    </div>
  );
}

/** The padlock beside a label, for a label that is locked. */
export function LockedLabel({
  locked,
  children,
}: {
  readonly locked: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <span className={locked ? styles.lockedLabel : undefined}>
      {children}
      {locked && <LockIcon />}
    </span>
  );
}
