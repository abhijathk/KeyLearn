import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children at the top of the document rather than where they are
 * written.
 *
 * A dialog opened from inside the account window used to be clipped by it: the
 * window animates a `transform` and sets `overflow: hidden`, and an element
 * running a transform becomes the containing block for `position: fixed`
 * descendants — so a "full-screen" overlay was only ever as big as the window,
 * and anything taller lost its title and its buttons off both ends.
 *
 * Escaping with z-index or larger offsets does not fix that; the overlay has to
 * stop being a descendant. Hence the portal, which also means dialogs no longer
 * depend on what any ancestor happens to do with transforms later.
 */
export function Overlay({
  children,
  onClose,
}: {
  readonly children: ReactNode;
  /**
   * Dismisses the dialog. Given here so Escape closes it, which is what every
   * dialog is expected to do and what somebody who cannot use a pointer has to
   * rely on: the dialogs are dismissed by clicking their backdrop, and a
   * `<div onClick>` is invisible to the keyboard.
   */
  readonly onClose?: () => void;
}): ReactNode {
  // Portals need a real document, which the server render does not have. The
  // first client render matches the server's (nothing), then the effect mounts
  // it — so this never causes a hydration mismatch.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  useEffect(() => {
    if (onClose == null) {
      return;
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        onClose();
      }
    };
    // On the document, because focus may be anywhere inside the portal — or
    // nowhere in particular, if the dialog opened without moving it.
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);
  return host == null ? null : createPortal(children, host);
}
