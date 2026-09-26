import { getPageData } from "./pagedata.tsx";

/**
 * Saves the app language just picked on the account, so it follows the person
 * to every device they sign in on (the server sends a page opened without a
 * language in its address to this one). Called as the page navigates away,
 * hence `keepalive`. A guest has no account and nothing is sent.
 */
export function rememberUiLocale(locale: string): void {
  try {
    if (getPageData()?.user == null) {
      return;
    }
    void fetch("/_/account/ui-locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Choosing a language still works; it just is not remembered elsewhere.
  }
}
