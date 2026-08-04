/**
 * Whether a WebSocket upgrade may proceed, judged by its `Origin`.
 *
 * The HTTP side of the app refuses cross-site state changes (see csrf.ts), but
 * that guard never sees this: an upgrade is a GET, and the game server runs as
 * its own application with its own middleware chain. Nothing was checking who
 * opened the socket.
 *
 * A browser always sends `Origin` on a WebSocket handshake — the protocol
 * requires it, and script cannot override it — so any page on the web could
 * open game sockets from its visitors' browsers. `SameSite=Lax` keeps the
 * session cookie off such a handshake, so this is not account takeover: the
 * socket connects anonymously, and anonymous play is allowed on purpose. What
 * it is, is every visitor to a hostile page silently becoming a connection
 * against us, each from their own address and so each with their own share of
 * the per-address ceiling — and a channel for pushing chat into rooms from
 * people who never opened the game.
 *
 * A missing `Origin` is allowed. Non-browser clients (a load-balancer health
 * check, a test harness, a native client) legitimately send none, and a
 * handshake with no origin is not the cross-site case this is aimed at.
 */
export function allowWebSocketOrigin(
  origin: string | null,
  self: string,
): boolean {
  if (origin == null || origin === "") {
    return true;
  }
  // "null" is what a sandboxed iframe or a file:// page sends. It is not our
  // origin and it is exactly the sort of caller worth refusing.
  if (origin === "null") {
    return false;
  }
  return equalOrigin(origin, self);
}

/**
 * Origins compare case-insensitively on scheme and host, and not at all on
 * anything after them — a header carrying a path or a trailing slash is not
 * our origin, whatever it is a prefix of.
 */
function equalOrigin(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
