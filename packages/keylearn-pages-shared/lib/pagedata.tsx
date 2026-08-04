import { createContext, type ReactNode, useContext } from "react";
import { type AnyUser, type PageData } from "./types.ts";

const pageDataGlobalName = "__PAGE_DATA__";

export function getPageData(): PageData {
  return (globalThis as any)[pageDataGlobalName];
}

/**
 * The CSP nonce for this response, so the one inline script the app ships can
 * be allowed by name instead of by allowing every inline script.
 *
 * Empty outside a server render — in the browser this component never runs,
 * and a nonce attribute with no policy behind it would mean nothing anyway.
 */
export const NonceContext = createContext<string>("");

export function PageDataScript(): ReactNode {
  const nonce = useContext(NonceContext);
  const pageDataJson = JSON.stringify(usePageData())
    // Anything that could end the script element early, or be read as markup
    // by a parser that gets here before the JSON does.
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    // Legal inside a JSON string and, before ES2019, a line break inside a
    // JavaScript one — which would end the statement mid-object.
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  return (
    <script
      id="page-data"
      nonce={nonce || undefined}
      dangerouslySetInnerHTML={{
        __html: `var ${pageDataGlobalName} = ${pageDataJson};`,
      }}
    />
  );
}

export const PageDataContext = createContext<PageData>(null!);

export function usePageData(): PageData {
  const value = useContext(PageDataContext);
  if (value == null) {
    throw new Error(
      process.env.NODE_ENV !== "production"
        ? "PageDataContext is missing"
        : undefined,
    );
  }
  return value;
}

export function isPremiumUser(user: AnyUser): boolean {
  return user.id != null && user.premium;
}
