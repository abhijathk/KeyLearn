import { useProfiles } from "@keylearn/page-account";
import { classicActive, KidsPage } from "@keylearn/page-kids";
import { ResultLoader } from "@keylearn/result-loader";

export default function Page() {
  // An active kid profile gets its own local history; with no profile
  // selected we fall back to the shared local kids trail.
  const { namespace } = useProfiles();
  // Classic is a separate course, so it reads and writes its own history
  // beside the guided one. Switching between the two reloads the page, which
  // is what lets the store be chosen here rather than swapped underneath a
  // lesson in progress.
  const course =
    namespace != null && classicActive() ? `${namespace}.classic` : namespace;
  return (
    <ResultLoader kids={course == null} namespace={course}>
      <KidsPage />
    </ResultLoader>
  );
}
