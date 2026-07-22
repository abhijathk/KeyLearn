import { booleanProp, Preferences } from "@keybr/settings";
import { useExplainerState } from "@keybr/widget";
import { type ReactNode, useLayoutEffect } from "react";
import { useIntl } from "react-intl";
import * as styles from "./SettingsScreen.module.less";

// Tips are tucked away by default; the header toggle brings them back for
// anyone who wants the full explanations.
const propExplainSettings = booleanProp("prefs.settings.explain", false);

export function ExplainSettings(): ReactNode {
  const { formatMessage } = useIntl();
  const { explainersVisible, toggleExplainers } = useExplainerState();
  useLayoutEffect(() => {
    toggleExplainers(Preferences.get(propExplainSettings));
  });
  return (
    <button
      type="button"
      className={styles.tips}
      onClick={() => {
        toggleExplainers(!explainersVisible);
        Preferences.set(propExplainSettings, !explainersVisible);
      }}
    >
      {explainersVisible
        ? `▾ ${formatMessage({
            id: "t_Hide_explanations",
            defaultMessage: "Hide the tips",
          })}`
        : `▸ ${formatMessage({
            id: "t_Explain_settings",
            defaultMessage: "Show tips for these settings",
          })}`}
    </button>
  );
}
