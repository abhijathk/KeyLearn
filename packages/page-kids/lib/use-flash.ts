import { useEffect, useRef } from "react";

/**
 * Lights an element for a moment whenever `value` changes.
 *
 * ON THE ELEMENT, NOT IN STATE. As a boolean in state this was two extra
 * renders of the whole game for every point scored — one to light the row
 * and one, 750ms later, to put it out — and the score changes on every
 * correct key. The class is toggled on the element directly; the element's
 * own `className` never changes, so React has no reason to write over it.
 */
export function useFlash<T extends HTMLElement>(
  value: unknown,
  className: string | undefined,
  ms = 750,
) {
  const el = useRef<T>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) {
      return;
    }
    prev.current = value;
    const node = el.current;
    if (node == null || className == null) {
      return;
    }
    node.classList.add(className);
    const id = setTimeout(() => node.classList.remove(className), ms);
    return () => clearTimeout(id);
  }, [value, className, ms]);
  return el;
}
