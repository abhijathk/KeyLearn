import { KeyCharacters, type KeyId } from "@keylearn/keyboard";
import { LayoutBuilder } from "@keylearn/keyboard-io";
import { Tab, TabList } from "@keylearn/widget";
import { useState } from "react";
import { useIntl } from "react-intl";
import { KeyLayer } from "../KeyLayer.tsx";
import { VirtualKeyboard } from "../VirtualKeyboard.tsx";
import { useCustomLayout } from "./context.tsx";
import { KeyDetails } from "./KeyDetails.tsx";
import { LayoutJson } from "./LayoutJson.tsx";
import { LayoutTable } from "./LayoutTable.tsx";

export function LayoutView({
  keyId,
  setKeyId,
}: {
  readonly keyId: KeyId;
  readonly setKeyId: (keyId: KeyId) => void;
}) {
  const { formatMessage } = useIntl();
  const { keyboard, layout } = useCustomLayout();
  const [index, setIndex] = useState(0);
  return (
    <TabList selectedIndex={index} onSelect={setIndex}>
      <Tab
        label={formatMessage({
          id: "customLayout.tab.keyboard",
          defaultMessage: "Keyboard",
        })}
      >
        <VirtualKeyboard keyboard={keyboard}>
          <KeyLayer
            depressedKeys={[keyId]}
            onKeyClick={(key) => {
              if (LayoutBuilder.isKey(key)) {
                setKeyId(key);
              }
            }}
          />
        </VirtualKeyboard>
        <KeyDetails
          characters={layout.get(keyId) ?? new KeyCharacters(keyId, 0, 0, 0, 0)}
        />
      </Tab>
      <Tab
        label={formatMessage({
          id: "customLayout.tab.table",
          defaultMessage: "Table",
        })}
      >
        <LayoutTable />
      </Tab>
      <Tab label="JSON">
        <LayoutJson />
      </Tab>
    </TabList>
  );
}
