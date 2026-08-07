import { alphabetName, BRAILLE_ALPHABET } from "@keylearn/certificate";
import { type Layout } from "@keylearn/keyboard";

/**
 * How a learner's alphabet is named wherever it is shown to a person.
 *
 * A thin wrapper over `alphabetName`, which holds the reasoning and is shared
 * with the verification page — this one exists only because the account page
 * has a `Layout` in hand where the others have a stored key.
 */
export function languageLineOf(layout: Layout, braille: boolean): string {
  return alphabetName(braille ? BRAILLE_ALPHABET : layout.language.id);
}
