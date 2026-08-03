import { useSettings } from "@keylearn/settings";
import {
  Attr,
  type LineList,
  splitStyledText,
  toTextDisplaySettings,
} from "@keylearn/textinput";
import { StaticText } from "@keylearn/textinput-ui";
import { Box } from "@keylearn/widget";

export function TextInputPreview() {
  const { settings } = useSettings();
  return (
    <Box alignItems="center" justifyContent="center">
      <StaticText
        settings={toTextDisplaySettings(settings)}
        lines={
          {
            text: "abc",
            lines: [
              {
                text: "abc",
                chars: [
                  ...splitStyledText("one", Attr.Hit),
                  ...splitStyledText(" ", Attr.Hit),
                  ...splitStyledText("two", Attr.Miss),
                  ...splitStyledText(" ", Attr.Hit),
                  ...splitStyledText("three", Attr.Garbage),
                  ...splitStyledText("   ", Attr.Normal),
                  ...splitStyledText("four", Attr.Normal),
                ],
              },
            ],
          } as LineList
        }
        cursor={true}
        size="X1"
      />
    </Box>
  );
}
