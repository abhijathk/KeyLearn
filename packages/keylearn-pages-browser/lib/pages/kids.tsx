import { useProfiles } from "@keylearn/page-account";
import { classicActive, KidsClassicFrame, KidsPage } from "@keylearn/page-kids";
import { KidsPracticeContext, PracticePage } from "@keylearn/page-practice";
import { ResultLoader } from "@keylearn/result-loader";
import { WithAdaptations } from "../adaptations.tsx";

export default function Page() {
  // An active kid profile gets its own local history; with no profile
  // selected we fall back to the shared local kids trail.
  const { namespace } = useProfiles();
  // Classic is a separate course, so it reads and writes its own history
  // beside the guided one. Switching between the two reloads the page, which
  // is what lets the store be chosen here rather than swapped underneath a
  // lesson in progress.
  const classic = classicActive();
  const course =
    namespace != null && classic ? `${namespace}.classic` : namespace;
  // Classic IS the grown-up guided practice page — the same engine, unlock
  // rule, statistics, keyboard and hands — framed in the kids palette.
  // Adaptations go inside the frame so a learner's accessibility font still
  // wins over the frame's default one.
  return (
    <ResultLoader kids={course == null} namespace={course}>
      {classic ? (
        <KidsClassicFrame>
          <KidsPracticeContext.Provider value={true}>
            <WithAdaptations>
              <PracticePage />
            </WithAdaptations>
          </KidsPracticeContext.Provider>
        </KidsClassicFrame>
      ) : (
        <KidsPage />
      )}
    </ResultLoader>
  );
}
