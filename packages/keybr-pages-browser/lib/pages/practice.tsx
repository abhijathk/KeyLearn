import { useProfiles } from "@keybr/page-account";
import { PracticePage } from "@keybr/page-practice";
import { ResultLoader } from "@keybr/result-loader";

export default function Page() {
  // When a household profile is active, practice reads that learner's own
  // local history; otherwise it's the default (synced) account history.
  const { namespace } = useProfiles();
  return (
    <ResultLoader namespace={namespace}>
      <PracticePage />
    </ResultLoader>
  );
}
