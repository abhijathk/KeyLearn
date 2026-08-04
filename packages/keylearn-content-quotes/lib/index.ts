import { randomSample, type RNG } from "@keylearn/rand";
import quotes from "./data/quotes.json" with { type: "json" };

export type Quote = {
  readonly text: string;
  readonly author: string;
};

/** A random quote for callers that don't care about determinism. */
export function nextQuote(): string {
  const [text, author] = randomSample(quotes);
  return `${text} ${author}`;
}

/** A random quote from a caller-supplied stream, for reproducible lessons. */
export function randomQuote(rng: RNG): Quote {
  const [text, author] = randomSample(quotes, rng);
  return { text, author };
}

export function quoteCount(): number {
  return quotes.length;
}
