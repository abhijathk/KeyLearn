import { type ReactNode } from "react";
import { useManifest } from "./context.ts";
import { type FavIconLink, type PreloadLink } from "./types.ts";

export function StylesheetAssets({
  entrypoint,
}: {
  readonly entrypoint: string;
}): ReactNode {
  const manifest = useManifest();
  const { stylesheets } = manifest.entrypoint(entrypoint);
  return stylesheets.map((link) => <link key={link.href} {...link} />);
}

export function ScriptAssets({
  entrypoint,
}: {
  readonly entrypoint: string;
}): ReactNode {
  const manifest = useManifest();
  const { scripts } = manifest.entrypoint(entrypoint);
  return scripts.map((script) => <script key={script.src} {...script} />);
}

/**
 * Bumped whenever a tab icon's ARTWORK changes.
 *
 * Browsers keep favicons in a store of their own, separate from the HTTP
 * cache, and they are famously unwilling to let one go: replacing the file and
 * reloading leaves the old icon in the tab, sometimes for days. A URL the
 * browser has not seen before is what actually forces the re-fetch.
 *
 * Every other asset gets this for free — the manifest fingerprints them, so
 * changing the bytes changes the path. Favicons do not: they are referenced by
 * a stable path on purpose, because a fingerprinted favicon would break every
 * bookmark and feed reader that guessed at the old one. So the version goes
 * on here, AFTER the manifest has resolved the path, and only for icons.
 *
 * Putting it on the manifest KEY instead is the obvious mistake and it takes
 * the whole site down with "Unknown asset" — the key is a lookup, not a URL.
 */
const ICON_VERSION = "2";

export function FavIconAssets({
  links,
}: {
  readonly links: readonly FavIconLink[];
}): ReactNode {
  const manifest = useManifest();
  return links
    .map(({ href, ...rest }) => {
      const path = manifest.assetPath(href);
      return {
        href: `${path}${path.includes("?") ? "&" : "?"}v=${ICON_VERSION}`,
        ...rest,
      };
    })
    .map((link) => <link key={link.href} {...link} />);
}

export function PreloadAssets({
  links,
}: {
  readonly links: readonly PreloadLink[];
}) {
  const manifest = useManifest();
  return links
    .map(({ href, ...rest }) => ({
      href: manifest.assetPath(href),
      ...rest,
    }))
    .map((link) => <link key={link.href} {...link} />);
}
