import { type Snippet } from "../types.ts";

/**
 * CSS, as layouts are actually built now.
 *
 * Grid and flexbox rather than floats, custom properties rather than a
 * preprocessor's variables, logical properties rather than left and right. The
 * old techniques are still in every tutorial and are worth being able to read,
 * but they are not what anyone should be building habits around.
 */
export const webCss: readonly Snippet[] = [
  {
    id: "css-custom-properties",
    title: "Custom properties, defined once",
    level: 2,
    tags: ["basics"],
    code: `/* Real cascading variables, not a preprocessor's: they can be changed at
   run time, inherited, and read from JavaScript. */
:root {
  --colour-ink: #1a1a1a;
  --colour-accent: #0b6e4f;
  --space: 1rem;
  --radius: 0.5rem;
}`,
  },
  {
    id: "css-dark-mode",
    title: "Two themes, one set of rules",
    level: 3,
    tags: ["basics"],
    code: `/* Only the values change. Everything below styles through the token, so
   the second theme costs four lines rather than a second stylesheet. */
@media (prefers-color-scheme: dark) {
  :root {
    --colour-ink: #e8e8e8;
    --colour-page: #121212;
  }
}`,
  },
  {
    id: "css-box-sizing",
    title: "The reset worth keeping",
    level: 1,
    tags: ["basics"],
    code: `/* With border-box, width means the width you see. Without it, padding
   and border are added on top, which is why nothing ever lines up. */
*,
*::before,
*::after {
  box-sizing: border-box;
}`,
  },
  {
    id: "css-flex-row",
    title: "A row, with gap",
    level: 2,
    tags: ["layout"],
    code: `/* gap replaces the margin-on-every-child-except-the-last dance, and it
   does not collapse or double up. */
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space);
}`,
  },
  {
    id: "css-flex-push",
    title: "Push one item to the end",
    level: 3,
    tags: ["layout"],
    code: `/* margin-inline-start: auto on the item, rather than
   justify-content on the parent — it moves one thing without changing how
   everything else is spaced. */
.toolbar__actions {
  margin-inline-start: auto;
}`,
  },
  {
    id: "css-grid-columns",
    title: "A responsive grid with no media query",
    level: 4,
    tags: ["layout"],
    code: `/* auto-fill plus minmax fits as many columns as will hold their minimum
   width. The layout responds to the container, not to the viewport. */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--space);
}`,
  },
  {
    id: "css-grid-areas",
    title: "Name the regions of a page",
    level: 4,
    tags: ["layout"],
    code: `/* The template is a picture of the layout, which is the one place in CSS
   where the source genuinely looks like the result. */
.page {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 16rem 1fr;
}`,
  },
  {
    id: "css-grid-place",
    title: "Centre something, definitively",
    level: 2,
    tags: ["layout"],
    code: `/* place-items is align-items and justify-items together. Two lines, and
   it works for any content of any size. */
.splash {
  display: grid;
  place-items: center;
  min-block-size: 100dvb;
}`,
  },
  {
    id: "css-logical-properties",
    title: "Logical properties instead of left and right",
    level: 4,
    tags: ["layout"],
    code: `/* inline is the reading direction and block is across it, so the same
   rule works in an Arabic or Hebrew layout without being mirrored. */
.card {
  padding-inline: var(--space);
  padding-block: calc(var(--space) / 2);
  border-inline-start: 3px solid var(--colour-accent);
}`,
  },
  {
    id: "css-clamp",
    title: "Fluid type without a media query",
    level: 4,
    tags: ["typography"],
    code: `/* A minimum, a preferred value that scales with the viewport, and a
   maximum. One line replaces three breakpoints. */
h1 {
  font-size: clamp(1.75rem, 1.2rem + 2.5vw, 3rem);
}`,
  },
  {
    id: "css-measure",
    title: "Limit the line length",
    level: 2,
    tags: ["typography"],
    code: `/* Around 65 characters is where reading speed peaks. The ch unit says
   that directly, so it holds when the font changes. */
.prose {
  max-inline-size: 65ch;
  line-height: 1.6;
}`,
  },
  {
    id: "css-text-wrap",
    title: "Stop a heading leaving one word alone",
    level: 3,
    tags: ["typography"],
    code: `/* balance evens out the lines of a short block; pretty only fixes the
   last line and is the right choice for a paragraph. */
h2 {
  text-wrap: balance;
}

p {
  text-wrap: pretty;
}`,
  },
  {
    id: "css-truncate",
    title: "Truncate a single line",
    level: 3,
    tags: ["typography"],
    code: `/* All three are needed: without the nowrap it wraps instead, and without
   the hidden overflow the ellipsis never appears. */
.filename {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}`,
  },
  {
    id: "css-nesting",
    title: "Nesting, in plain CSS",
    level: 3,
    tags: ["selectors"],
    code: `/* No preprocessor needed since 2023. Keep it shallow — deep nesting
   produces the specificity problems it was meant to avoid. */
.card {
  padding: var(--space);

  & > .card__title {
    font-weight: 600;
  }

  &:hover {
    border-color: var(--colour-accent);
  }
}`,
  },
  {
    id: "css-where-specificity",
    title: ":where(), for a rule that is easy to override",
    level: 5,
    tags: ["selectors"],
    code: `/* :where() has zero specificity and :is() takes its argument's. For a
   reset or a library default, :where() is the one that does not fight the
   author's own styles. */
:where(h1, h2, h3) {
  margin-block-start: 0;
}`,
  },
  {
    id: "css-has",
    title: ":has(), the parent selector",
    level: 5,
    tags: ["selectors"],
    code: `/* Style an element by what it contains — impossible in CSS until 2023,
   and the reason a great many wrapper divs no longer need a class. */
.field:has(input:invalid) {
  border-color: var(--colour-error);
}`,
  },
  {
    id: "css-attribute-selector",
    title: "Select on an attribute",
    level: 3,
    tags: ["selectors"],
    code: `/* Styling state through an attribute rather than a class means the DOM
   and the styling cannot disagree about what state the thing is in. */
[aria-expanded="true"] > .chevron {
  rotate: 180deg;
}`,
  },
  {
    id: "css-focus-visible",
    title: ":focus-visible, not :focus",
    level: 4,
    tags: ["accessibility"],
    code: `/* Shows the ring for keyboard users and not on a mouse click, which is
   the reason people were removing outlines altogether. */
.button:focus-visible {
  outline: 2px solid var(--colour-accent);
  outline-offset: 2px;
}`,
  },
  {
    id: "css-reduced-motion",
    title: "Respect a preference for less motion",
    level: 3,
    tags: ["accessibility"],
    code: `/* For some people animation causes nausea, not delight. This is one
   media query and it is not optional. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}`,
  },
  {
    id: "css-visually-hidden",
    title: "Hidden from sight, not from a screen reader",
    level: 4,
    tags: ["accessibility"],
    code: `/* display: none removes it from the accessibility tree too. This keeps
   the text available to anyone listening rather than looking. */
.visually-hidden {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}`,
  },
  {
    id: "css-transition",
    title: "Transition the properties that are cheap",
    level: 3,
    tags: ["motion"],
    code: `/* transform and opacity are composited and do not trigger layout;
   animating width or top does, on every frame. */
.card {
  transition:
    transform 150ms ease-out,
    opacity 150ms ease-out;
}`,
  },
  {
    id: "css-keyframes",
    title: "A keyframe animation",
    level: 3,
    tags: ["motion"],
    code: `/* Named percentages rather than from and to once there is a middle, so
   the timing is visible at a glance. */
@keyframes rise {
  0% {
    opacity: 0;
    translate: 0 0.5rem;
  }
  100% {
    opacity: 1;
    translate: 0 0;
  }
}`,
  },
  {
    id: "css-container-query",
    title: "Style by the container, not the viewport",
    level: 5,
    tags: ["layout"],
    code: `/* The same card in a sidebar and in a main column can now lay itself out
   differently, which a media query could never express. */
.card-list {
  container-type: inline-size;
}

@container (min-width: 30rem) {
  .card {
    grid-template-columns: 8rem 1fr;
  }
}`,
  },
  {
    id: "css-layer",
    title: "Cascade layers, to settle specificity arguments",
    level: 5,
    tags: ["selectors"],
    code: `/* The order here decides which wins, regardless of selector
   specificity — so a library's rules can no longer beat your own. */
@layer reset, library, components, utilities;`,
  },
  {
    id: "css-aspect-ratio",
    title: "Reserve the space an image will need",
    level: 3,
    tags: ["layout"],
    code: `/* Stops the page jumping when the image loads, which is most of what a
   cumulative layout shift score measures. */
.thumbnail {
  aspect-ratio: 16 / 9;
  object-fit: cover;
  inline-size: 100%;
}`,
  },
  {
    id: "css-color-mix",
    title: "Derive a colour from another",
    level: 5,
    tags: ["basics"],
    code: `/* A hover state that stays correct when the accent changes, because it
   is computed from it rather than copied beside it. */
.button:hover {
  background: color-mix(in oklch, var(--colour-accent) 85%, white);
}`,
  },
];
