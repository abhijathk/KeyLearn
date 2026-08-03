import { booleanProp, Preferences } from "@keylearn/settings";
import { Button, Field, FieldList, useExplainerState } from "@keylearn/widget";
import { useLayoutEffect } from "react";
import { useIntl } from "react-intl";

const propExplainSettings = booleanProp("prefs.profile.explain", true);

export function ExplainProfile() {
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
                id: "t_Explain_charts",
                defaultMessage: "Show chart explanations",
              })}`}
        </Button>
      </Field>
    </FieldList>
  );
}
