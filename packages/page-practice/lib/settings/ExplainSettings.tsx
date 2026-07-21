import { booleanProp, Preferences } from "@keybr/settings";
import { Button, Field, FieldList, useExplainerState } from "@keybr/widget";
import { type ReactNode, useLayoutEffect } from "react";
import { useIntl } from "react-intl";

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
    <FieldList>
      <Field.Filler />
      <Field>
        <Button
          onClick={() => {
            toggleExplainers(!explainersVisible);
            Preferences.set(propExplainSettings, !explainersVisible);
          }}
        >
          {explainersVisible
            ? `\u25BC ${formatMessage({
                id: "t_Hide_explanations",
                defaultMessage: "Hide the tips",
              })}`
            : `\u25BA ${formatMessage({
                id: "t_Explain_settings",
                defaultMessage: "Show tips for these settings",
              })}`}
        </Button>
      </Field>
    </FieldList>
  );
}
