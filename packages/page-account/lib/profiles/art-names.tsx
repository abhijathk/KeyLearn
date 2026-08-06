// Translated names for the avatar families. The registry carries English
// fallbacks so tests and exports have something to read; every name a person
// sees comes from here. The FormatJS transformer needs a literal id at the
// call site, so these are written out one by one.

import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export const familyNames: Readonly<Record<string, ReactNode>> = {
  grid: <FormattedMessage id="art.grid" defaultMessage="Grid" />,
  flow: <FormattedMessage id="art.flow" defaultMessage="Flow" />,
  arc: <FormattedMessage id="art.arc" defaultMessage="Arc" />,
  bars: <FormattedMessage id="art.bars" defaultMessage="Bars" />,
  coil: <FormattedMessage id="art.coil" defaultMessage="Coil" />,
  bloom: <FormattedMessage id="art.bloom" defaultMessage="Bloom" />,
  bubbles: <FormattedMessage id="art.bubbles" defaultMessage="Bubbles" />,
  splat: <FormattedMessage id="art.splat" defaultMessage="Splat" />,
  zigzag: <FormattedMessage id="art.zigzag" defaultMessage="Zigzag" />,
  swirl: <FormattedMessage id="art.swirl" defaultMessage="Swirl" />,
  ripple: <FormattedMessage id="art.ripple" defaultMessage="Ripple" />,
  stars: <FormattedMessage id="art.stars" defaultMessage="Stars" />,
};
