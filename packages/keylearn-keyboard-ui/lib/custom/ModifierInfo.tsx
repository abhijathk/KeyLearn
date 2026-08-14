import { KeyModifier } from "@keylearn/keyboard";
import { FormattedMessage } from "react-intl";

export function ModifierInfo({ modifier }: { readonly modifier: KeyModifier }) {
  switch (modifier) {
    case KeyModifier.None:
      return (
        <span>
          <FormattedMessage
            id="modifierInfo.default"
            defaultMessage="Default"
          />
        </span>
      );
    case KeyModifier.Shift:
      return (
        <span>
          <FormattedMessage id="modifierInfo.shift" defaultMessage="Shift" />
        </span>
      );
    case KeyModifier.Alt:
      return <span>AltGr</span>;
    case KeyModifier.ShiftAlt:
      return (
        <span>
          <FormattedMessage
            id="modifierInfo.shiftAltGr"
            defaultMessage="Shift AltGr"
          />
        </span>
      );
  }
  return null;
}
