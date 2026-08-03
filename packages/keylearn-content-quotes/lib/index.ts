import { randomSample } from "@keylearn/rand";
import quotes from "./data/quotes.json" with { type: "json" };

export function nextQuote(): string {
  const [text, author] = randomSample(quotes);
  return `${text} ${author}`;
}
