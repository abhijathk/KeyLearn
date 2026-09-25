import { randomSample } from "@keylearn/rand";
import quotes from "./data/quotes.json" with { type: "json" };

/**
 * The whole corpus, loaded synchronously — for the multiplayer server, which
 * picks a quote per room and has no page to keep light. The browser goes
 * through `loadQuotes()` in index.ts instead, so the 750 KB corpus stays out
 * of the bundle every page loads.
 */

/** A random quote for callers that don't care about determinism. */
export function nextQuote(): string {
  const [text, author] = randomSample(quotes);
  return `${text} ${author}`;
}

export function quoteCount(): number {
  return quotes.length;
}
