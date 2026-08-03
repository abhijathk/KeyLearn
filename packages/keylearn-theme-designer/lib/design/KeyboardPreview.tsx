import { useKeyboard } from "@keylearn/keyboard";
import { KeyLayer, VirtualKeyboard } from "@keylearn/keyboard-ui";
import { useSettings } from "@keylearn/settings";
import { ModifierState, useDepressedKeys } from "@keylearn/textinput-events";
import { Box } from "@keylearn/widget";

export function KeyboardPreview() {
  const { settings } = useSettings();
  const keyboard = useKeyboard();
  const depressedKeys = useDepressedKeys(settings, keyboard);
  return (
    <Box alignItems="center" justifyContent="center">
      <VirtualKeyboard keyboard={keyboard}>
        <KeyLayer
          depressedKeys={depressedKeys}
          toggledKeys={ModifierState.modifiers}
          showColors={true}
        />
      </VirtualKeyboard>
    </Box>
  );
}
