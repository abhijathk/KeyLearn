import { images } from "@keylearn/themes";
import { Box, LinkButton, Para } from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import { useCustomTheme } from "./context.ts";
import { Group } from "./Group.tsx";
import { ImageInput } from "./input/ImageInput.tsx";

export function BackgroundImage() {
  const { formatMessage } = useIntl();
  const { theme, setTheme } = useCustomTheme();
  return (
    <Group
      title={formatMessage({
        id: "designer.background-image",
        defaultMessage: "Background Image",
      })}
    >
      <Box alignItems="center" justifyContent="center">
        <ImageInput
          asset={theme.getImage("--background-image")}
          onChange={(asset) => {
            setTheme(theme.set("--background-image", asset));
          }}
        />
      </Box>
      <Para align="center">
        <LinkButton
          label={formatMessage({
            id: "designer.clear",
            defaultMessage: "Clear",
          })}
          onClick={() => {
            setTheme(theme.delete("--background-image"));
          }}
        />
        {" or "}
        <LinkButton
          label={formatMessage({
            id: "designer.chocolate",
            defaultMessage: "Chocolate",
          })}
          onClick={() => {
            setTheme(theme.set("--background-image", images.chocolate));
          }}
        />
        {", "}
        <LinkButton
          label={formatMessage({
            id: "designer.coffee",
            defaultMessage: "Coffee",
          })}
          onClick={() => {
            setTheme(theme.set("--background-image", images.coffee));
          }}
        />
        {", "}
        <LinkButton
          label={formatMessage({
            id: "designer.garden",
            defaultMessage: "Garden",
          })}
          onClick={() => {
            setTheme(theme.set("--background-image", images.garden));
          }}
        />
      </Para>
    </Group>
  );
}
