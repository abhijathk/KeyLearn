/**
 * "Something about this account's notifications just changed."
 *
 * The bell polls once a minute and refetches on focus, which is right for
 * a badge that lights up on its own — a reply can arrive at any time and
 * nothing in the page knows about it. It is wrong for the opposite
 * direction: when the person themself does the thing that clears a
 * notification, the page already knows, and making them wait up to a
 * minute to see the badge go out reads as the app not having noticed.
 *
 * Opening a support thread marks its notifications read on the server. It
 * happens in a different package from the bell, one that must not import
 * the other, so the two are joined by an event on `window` rather than by
 * shared state. Anything that clears or creates a notification can fire it;
 * the bell simply refetches, so there is no payload to keep in step and no
 * way for the two to disagree about the count.
 */
export const NOTIFICATIONS_CHANGED = "keylearn:notifications-changed";

/** Safe to call anywhere, including during SSR, where it does nothing. */
export function notificationsChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED));
}
