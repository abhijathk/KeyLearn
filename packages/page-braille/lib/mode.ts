/**
 * How the lesson is presented.
 *
 * These are genuinely different interfaces rather than one interface with the
 * sound turned up. Reading leads with the two scripts side by side, for a
 * sighted learner picking braille up by association. Listening has no board at
 * all — speech and tones *are* the interface, because for the people this page
 * is built for the board conveys nothing.
 *
 * In its own module so the preferences can name it without depending on the
 * page component.
 */
export type Mode = "reading" | "listening";
