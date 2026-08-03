import { LoadingProgress, usePageData } from "@keylearn/pages-shared";
import { type ReactNode, useMemo } from "react";
import { useLoader } from "./internal/loader.ts";
import { ResultProvider } from "./internal/ResultProvider.tsx";
import { openResultStorage } from "./internal/storage.ts";
import { type ResultStorage } from "./internal/types.ts";

export function ResultLoader({
  children,
  kids = false,
  namespace = null,
  profileName = null,
  profileAvatar = null,
  kidProfile = false,
}: {
  readonly children: ReactNode;
  /** Load the kids trail history instead of the grown-up history. */
  readonly kids?: boolean;
  /** Load a household-profile local history instead of the default. */
  readonly namespace?: string | null;
  /** Whose history this is, for the export filename. */
  readonly profileName?: string | null;
  /** That learner's avatar, already rendered. */
  readonly profileAvatar?: ReactNode;
  /** Whether this is a child's profile, for what gets offered. */
  readonly kidProfile?: boolean;
}): ReactNode {
  const storage = useResultStorage(kids, namespace);
  const state = useLoader(storage);
  if (state.type === "loading") {
    return <LoadingProgress total={state.total} current={state.current} />;
  } else {
    return (
      <ResultProvider
        storage={storage}
        initialResults={state.results}
        namespace={namespace}
        profileName={profileName}
        profileAvatar={profileAvatar}
        kidProfile={kidProfile}
      >
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
