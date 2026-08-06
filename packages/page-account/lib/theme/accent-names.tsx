// Translated names for the accent themes.
//
// The registry in @keylearn/themes carries English fallbacks so tests and
// exports have something to read, but every name a person sees comes from
// here. The FormatJS transformer needs a literal string id at the call site,
// so these are written out one by one rather than built from the accent id.

import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export const accentNames: Readonly<Record<string, ReactNode>> = {
  "keylearn": (
    <FormattedMessage id="theme.keylearn" defaultMessage="KeyLearn" />
  ),
  "home-row": <FormattedMessage id="theme.homeRow" defaultMessage="Home Row" />,
  "top-row": <FormattedMessage id="theme.topRow" defaultMessage="Top Row" />,
  "bottom-row": (
    <FormattedMessage id="theme.bottomRow" defaultMessage="Bottom Row" />
  ),
  "space-bar": (
    <FormattedMessage id="theme.spaceBar" defaultMessage="Space Bar" />
  ),
  "persimmon": (
    <FormattedMessage id="theme.persimmon" defaultMessage="Persimmon" />
  ),
  "crimson": <FormattedMessage id="theme.crimson" defaultMessage="Crimson" />,
  "amethyst": (
    <FormattedMessage id="theme.amethyst" defaultMessage="Amethyst" />
  ),
  "cerulean": (
    <FormattedMessage id="theme.cerulean" defaultMessage="Cerulean" />
  ),
  "sepia": <FormattedMessage id="theme.sepia" defaultMessage="Sepia" />,
  "trail-green": (
    <FormattedMessage id="theme.trailGreen" defaultMessage="Trail Green" />
  ),
  "sunbeam": <FormattedMessage id="theme.sunbeam" defaultMessage="Sunbeam" />,
  "dino-blue": (
    <FormattedMessage id="theme.dinoBlue" defaultMessage="Dino Blue" />
  ),
  "bubblegum": (
    <FormattedMessage id="theme.bubblegum" defaultMessage="Bubblegum" />
  ),
  "ember": <FormattedMessage id="theme.ember" defaultMessage="Ember" />,
  "grape": <FormattedMessage id="theme.grape" defaultMessage="Grape" />,
};

/** The colour family, shown under the name. */
export const accentHues: Readonly<Record<string, ReactNode>> = {
  mint: <FormattedMessage id="theme.hue.mint" defaultMessage="mint" />,
  citron: <FormattedMessage id="theme.hue.citron" defaultMessage="citron" />,
  indigo: <FormattedMessage id="theme.hue.indigo" defaultMessage="indigo" />,
  orchid: <FormattedMessage id="theme.hue.orchid" defaultMessage="orchid" />,
  slate: <FormattedMessage id="theme.hue.slate" defaultMessage="slate" />,
  orange: <FormattedMessage id="theme.hue.orange" defaultMessage="orange" />,
  red: <FormattedMessage id="theme.hue.red" defaultMessage="red" />,
  purple: <FormattedMessage id="theme.hue.purple" defaultMessage="purple" />,
  blue: <FormattedMessage id="theme.hue.blue" defaultMessage="blue" />,
  brown: <FormattedMessage id="theme.hue.brown" defaultMessage="brown" />,
  green: <FormattedMessage id="theme.hue.green" defaultMessage="green" />,
  yellow: <FormattedMessage id="theme.hue.yellow" defaultMessage="yellow" />,
  pink: <FormattedMessage id="theme.hue.pink" defaultMessage="pink" />,
};
