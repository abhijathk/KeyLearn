import { singleLine, type TextDisplaySettings } from "@keylearn/textinput";
import { StaticText } from "@keylearn/textinput-ui";
import { memo, useMemo } from "react";
import {
  generateExample,
  type TextGenerator,
} from "../../../generators/index.ts";

export const TextPreview = memo(function TextPreview({
  settings,
  textGenerator,
}: {
  settings: TextDisplaySettings;
  textGenerator: TextGenerator;
}) {
  const text = useMemo(() => generateExample(textGenerator), [textGenerator]);
  return <StaticText settings={settings} lines={singleLine(text)} />;
});
