import { type ReactNode } from "react";

/**
 * The KeyLearn wordmark: K, E and Y on keycaps, then "learn".
 *
 * Inline rather than an image tag, and that is the whole point of it. The caps
 * are painted with the theme's own custom properties — the top face in
 * "accent", the front wall in "accent-d2", the letters in "accent-ink" — so
 * the logo follows whichever accent the learner picked, custom ones included.
 * Through an image tag there is no theme to inherit from and it would be stuck
 * in whatever colour the file was saved with.
 *
 * "accent-ink" is worth naming: the themes compute it against a 21% contrast
 * target, which is why the letters stay legible on a pale accent and on a dark
 * one without this component having to know which it got.
 *
 * Two rectangles per key. The lower one is the cap's front wall, the upper one
 * its top face, and the 10% lip between them is the entire 3D effect — no
 * gradients, no shadows, nothing that falls apart at 16px or in one colour.
 *
 * The wordmark itself is Geist Regular converted to outlines, at the same
 * 0.068 scale the Q apps use, so KeyLearn's lockup sits beside QMeet's,
 * QDashboard's and QDesk's as one family. It does NOT borrow their
 * magnifying-glass glyph: a lens is a ring, a ring reads as an O, and every
 * attempt to work one into this name spelled something other than KeyLearn.
 *
 * The wordmark's baseline is 95.6, not the 83 the Q apps use. The keycaps'
 * front wall ends at 99.4 and their top face at 88.5; sitting the word on the
 * very bottom edge made it look like it had slipped off the keys, and sitting
 * it on the letter baseline left it floating a sixth of a cap above them.
 * Between the two, closer to the bottom.
 *
 * Hidden from assistive technology on purpose — the link around it already
 * carries the accessible name, and a title element in here would make a
 * screen reader announce "KeyLearn" twice.
 */
export function Wordmark({
  className,
}: {
  readonly className?: string;
}): ReactNode {
  return (
    <svg
      className={className}
      // Cropped from y=5.4, not 0, so that `align-items: center` centres the
      // ink rather than the box. The drawing runs from y=31.4 (the keycap top
      // face) to y=99.4 (the front wall's bottom edge), which left 31.4 units
      // of air above it and 20.6 below — so the logo rendered 1.8px lower than
      // every other item in the header, all of which sit on a 32.3px centre
      // line. Shifting the window down by half that difference puts 26 units
      // either side. Width and height are untouched, so nothing reflows.
      viewBox="0 5.4 412 120"
      fill="none"
      aria-hidden={true}
      focusable={false}
    >
      <g>
        <rect
          x="20.0"
          y="38.2"
          width="68"
          height="61.2"
          rx="12.9"
          fill="var(--accent-d2)"
        />
        <rect
          x="20.0"
          y="31.4"
          width="68"
          height="57.1"
          rx="11.6"
          fill="var(--accent)"
        />
        <g fill="var(--accent-ink)" transform="translate(38.8, 75.7)">
          <g transform="scale(0.0441, -0.0441)">
            <path d="M74 0V710H226V400L484 710H661L400 397L677 0H504L300 295L226 209V0Z" />
          </g>
        </g>
        <rect
          x="95.5"
          y="38.2"
          width="68"
          height="61.2"
          rx="12.9"
          fill="var(--accent-d2)"
        />
        <rect
          x="95.5"
          y="31.4"
          width="68"
          height="57.1"
          rx="11.6"
          fill="var(--accent)"
        />
        <g fill="var(--accent-ink)" transform="translate(115.8, 75.7)">
          <g transform="scale(0.0441, -0.0441)">
            <path d="M74 0V710H568V582H226V419H556V293H226V128H576V0Z" />
          </g>
        </g>
        <rect
          x="171.0"
          y="38.2"
          width="68"
          height="61.2"
          rx="12.9"
          fill="var(--accent-d2)"
        />
        <rect
          x="171.0"
          y="31.4"
          width="68"
          height="57.1"
          rx="11.6"
          fill="var(--accent)"
        />
        <g fill="var(--accent-ink)" transform="translate(191.1, 75.7)">
          <g transform="scale(0.0441, -0.0441)">
            <path d="M240 0V276L-7 710H161L316 424L470 710H638L392 276V0Z" />
          </g>
        </g>
      </g>
      {/* "learn" set smaller than the keycaps and centred on THEIR height
          rather than sitting on their baseline. The caps' faces run y=31.4 to
          y=88.5, so their middle is y=60; the word's x-height band is centred
          a shade below that, which is where a lowercase word reads as level
          with something taller beside it.

          The whole group is scaled rather than each glyph: the five inner
          translates are the font's own advances, computed for 0.068, and
          scaling them here keeps the spacing correct without recomputing
          five numbers by hand. */}
      <g fill="currentColor" transform="translate(254.0, 78.5) scale(0.853)">
        <g transform="translate(0.0, 0) scale(0.068, -0.068)">
          <path d="M184 0Q138 0 109 24Q80 48 80 100V710H164V107Q164 74 197 74H243V0Z" />
        </g>
        <g transform="translate(18.16, 0) scale(0.068, -0.068)">
          <path d="M287 -12Q212 -12 157.5 22Q103 56 73.5 118.5Q44 181 44 265Q44 349 73.5 411Q103 473 156.5 507.5Q210 542 283 542Q352 542 405 509.5Q458 477 487.5 415Q517 353 517 264V239H132Q137 154 177.5 111Q218 68 287 68Q339 68 372.5 92.5Q406 117 419 157L509 150Q488 79 429.5 33.5Q371 -12 287 -12ZM132 313H425Q419 390 380.5 426Q342 462 283 462Q222 462 182.5 424.5Q143 387 132 313Z" />
        </g>
        <g transform="translate(56.3, 0) scale(0.068, -0.068)">
          <path d="M223 -12Q141 -12 92.5 26Q44 64 44 132Q44 200 84 239Q124 278 211 294L399 329Q399 462 273 462Q218 462 186 437.5Q154 413 142 367L53 374Q68 449 125.5 495.5Q183 542 273 542Q375 542 429 484.5Q483 427 483 326V107Q483 74 511 74H532V0Q520 -2 500 -2Q454 -2 430.5 16.5Q407 35 401 77L400 82Q380 41 331 14.5Q282 -12 223 -12ZM231 62Q311 62 355 107Q399 152 399 218V256L227 224Q173 214 152.5 193.5Q132 173 132 140Q132 103 158.5 82.5Q185 62 231 62Z" />
        </g>
        <g transform="translate(93.77, 0) scale(0.068, -0.068)">
          <path d="M80 0V530H154L157 432Q184 530 283 530H335V450H284Q164 450 164 320V0Z" />
        </g>
        <g transform="translate(119.54, 0) scale(0.068, -0.068)">
          <path d="M80 0V530H157L159 435Q180 490 223.5 516Q267 542 322 542Q383 542 422.5 515Q462 488 481.5 442.5Q501 397 501 341V0H417V317Q417 391 390.5 429.5Q364 468 304 468Q243 468 203.5 429.5Q164 391 164 317V0Z" />
        </g>
      </g>
    </svg>
  );
}
