import { KidsPage } from "@keybr/page-kids";
import { ResultLoader } from "@keybr/result-loader";

export default function Page() {
  return (
    // The kids trail learns in its own local history — a child's unlocks are
    // earned by the child, not inherited from the grown-up's typing.
    <ResultLoader kids={true}>
      <KidsPage />
    </ResultLoader>
  );
}
