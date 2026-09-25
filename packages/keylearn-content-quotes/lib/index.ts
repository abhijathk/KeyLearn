import { randomSample, type RNG } from "@keylearn/rand";

export type Quote = {
  readonly text: string;
  readonly author: string;
};

/** The corpus as stored: `[text, author]` pairs. */
export type Quotes = readonly (readonly [text: string, author: string])[];

let loaded: Promise<Quotes> | null = null;

/**
 * The corpus, fetched on first use as its own chunk — the same way the books
 * are — rather than inside the bundle every page loads. A failed fetch is not
 * remembered, so the next lesson asks again.
 */
export function loadQuotes(): Promise<Quotes> {
  loaded ??= import(
    /* webpackChunkName: "quotes" */
    "./data/quotes.json",
    { with: { type: "json" } }
  ).then(
    (module) => module.default as unknown as Quotes,
    (err: unknown) => {
      loaded = null;
      throw err;
    },
  );
  return loaded;
}

/** A random quote from a caller-supplied stream, for reproducible lessons. */
export function randomQuote(quotes: Quotes, rng: RNG): Quote {
  const [text, author] = randomSample(quotes, rng);
  return { text, author };
}
