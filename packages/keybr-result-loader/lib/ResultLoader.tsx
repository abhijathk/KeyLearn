import { LoadingProgress, usePageData } from "@keybr/pages-shared";
import { type ReactNode, useMemo } from "react";
import { useLoader } from "./internal/loader.ts";
import { ResultProvider } from "./internal/ResultProvider.tsx";
import { openResultStorage } from "./internal/storage.ts";
import { type ResultStorage } from "./internal/types.ts";

export function ResultLoader({
  children,
  kids = false,
  namespace = null,
}: {
  readonly children: ReactNode;
  /** Load the kids trail history instead of the grown-up history. */
  readonly kids?: boolean;
  /** Load a household-profile local history instead of the default. */
  readonly namespace?: string | null;
}): ReactNode {
  const storage = useResultStorage(kids, namespace);
  const state = useLoader(storage);
  if (state.type === "loading") {
    return <LoadingProgress total={state.total} current={state.current} />;
  } else {
    return (
      <ResultProvider storage={storage} initialResults={state.results}>
        {children}
      </ResultProvider>
    );
  }
}

function useResultStorage(
  kids: boolean,
  namespace: string | null,
): ResultStorage {
  const pageData = usePageData();
  return useMemo(() => {
    const { publicUser } = pageData;
    return openResultStorage({
      type: "private",
      userId: publicUser.id,
      kids,
      namespace,
    });
  }, [pageData, kids, namespace]);
}
