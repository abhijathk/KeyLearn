/**
 * Signs out and returns to the given page.
 *
 * Sign-out is a POST rather than a link. With a `SameSite=Lax` session cookie a
 * GET endpoint still receives the cookie on any top-level navigation, so a
 * plain `/auth/logout` link can be triggered by any third-party page that
 * embeds it — harmless in isolation, but it lets someone else decide when a
 * user's session ends.
 */
export async function logout(returnTo: string = "/"): Promise<void> {
  try {
    await fetch("/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Send the session cookie, and mark this same-origin so the server's
      // cross-site guard sees a first-party request.
      credentials: "same-origin",
      body: "{}",
    });
  } finally {
    // Navigate regardless: if the request failed the session may still be live,
    // and landing on a fresh page load is the clearest signal of what happened.
    window.location.href = returnTo;
  }
}
