import { useProfiles } from "@keylearn/page-account";
import { KidsPage } from "@keylearn/page-kids";
import { ResultLoader } from "@keylearn/result-loader";

export default function Page() {
  // An active kid profile gets its own local history; with no profile
  // selected we fall back to the shared local kids trail.
  const { namespace } = useProfiles();
  return (
    <ResultLoader kids={namespace == null} namespace={namespace}>
      <KidsPage />
    </ResultLoader>
  );
}
