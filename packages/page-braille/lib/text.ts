/**
 * Practice lines.
 *
 * Short, ordinary words — the learner already reads braille, so the point is
 * the motor skill of chording, not vocabulary. Lines are kept to roughly a
 * screen's width so the print and braille rows stay aligned without wrapping.
 */
const WORDS = [
  "the",
  "and",
  "you",
  "that",
  "was",
  "for",
  "are",
  "with",
  "his",
  "they",
  "have",
  "this",
  "from",
  "one",
  "had",
  "word",
  "but",
  "not",
  "what",
  "all",
  "were",
  "when",
  "your",
  "said",
  "there",
  "use",
  "each",
  "which",
  "she",
  "how",
  "their",
  "will",
  "other",
  "about",
  "out",
  "many",
  "then",
  "them",
  "these",
  "some",
  "her",
  "would",
  "make",
  "like",
  "him",
  "into",
  "time",
  "has",
  "look",
  "two",
  "more",
  "write",
  "see",
  "number",
  "way",
  "could",
  "people",
  "than",
  "first",
  "water",
  "been",
  "call",
  "who",
  "oil",
  "its",
  "now",
  "find",
  "long",
  "down",
  "day",
  "did",
  "get",
  "come",
  "made",
  "may",
];

/** A line of eight random words, which fits comfortably in both rows. */
export function nextLine(count = 8): string {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return out.join(" ");
}
