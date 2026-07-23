import { KidsPage } from "@keybr/page-kids";
import { ResultLoader } from "@keybr/result-loader";

export default function Page() {
  return (
    <ResultLoader>
      <KidsPage />
    </ResultLoader>
  );
}
