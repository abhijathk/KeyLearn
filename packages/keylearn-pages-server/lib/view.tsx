import { injectable } from "@fastr/invert";
import {
  Manifest,
  ManifestContext,
  preloadFont,
  preloadStyle,
} from "@keylearn/assets";
import { preload } from "@keylearn/themes";
import { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

@injectable()
export class View {
  readonly preloadHeaders: readonly string[];

  constructor(readonly manifest: Manifest) {
    this.preloadHeaders = [
      ...preload.styles.map((href) => preloadStyle(href)),
      ...preload.fonts.map((href) => preloadFont(href)),
    ].map((link) => this.manifest.preloadHeader(link));
  }

  renderPage(element: ReactNode): string {
    return (
      "<!DOCTYPE html>" +
      renderToStaticMarkup(
        <ManifestContext.Provider value={this.manifest}>
          {element}
        </ManifestContext.Provider>,
      )
    );
  }
}
