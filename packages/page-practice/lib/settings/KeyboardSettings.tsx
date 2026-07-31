import { useCollator } from "@keybr/intl";
import {
  Emulation,
  Geometry,
  KeyboardOptions,
  keyboardProps,
  Language,
  Layout,
  useFormattedNames,
  useKeyboard,
  ZoneMod,
} from "@keybr/keyboard";
import { KeyLayer, PointersLayer, VirtualKeyboard } from "@keybr/keyboard-ui";
import { Tasks } from "@keybr/lang";
import { useSettings } from "@keybr/settings";
import { ModifierState, useDepressedKeys } from "@keybr/textinput-events";
import { type CodePoint } from "@keybr/unicode";
import {
  OptionList,
  RowSeparator,
  SettingRow,
  SettingsCard,
  Switch,
} from "@keybr/widget";
import { memo, type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function KeyboardSettings(): ReactNode {
  return (
    <>
      <SettingsCard
        caption={
          <FormattedMessage
            id="settings.group.layout"
            defaultMessage="Layout"
          />
        }
      >
        <LayoutProp />
      </SettingsCard>
      <KeyboardPreview />
      <SettingsCard
        caption={
          <FormattedMessage
            id="settings.group.keyboardShape"
            defaultMessage="Shape & guides"
          />
        }
      >
        <GeometryProp />
      </SettingsCard>
    </>
  );
}

function LayoutProp(): ReactNode {
  const { formatMessage } = useIntl();
  const {
    formatLanguageName, //
    formatLayoutName,
    formatFullLayoutName,
  } = useFormattedNames();
  const { compare } = useCollator();
  const { settings, updateSettings } = useSettings();
  const options = KeyboardOptions.from(settings);
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="settings.language.label"
            defaultMessage="Language"
          />
        }
        description={
          <FormattedMessage
            id="settings.language.short"
            defaultMessage="The language the practice words are drawn from."
          />
        }
      >
        <OptionList
          options={options
            .selectableLanguages()
            .map((item) => ({
              value: item.id,
              name: formatLanguageName(item),
            }))
            .sort((a, b) => compare(a.name, b.name))}
          value={options.language.id}
          onSelect={(id) => {
            updateSettings(
              options
                .withLanguage(Language.ALL.get(id))
                .withGeometry(options.geometry)
                .withZones(options.zones)
                .save(settings),
            );
          }}
        />
      </SettingRow>

      <RowSeparator />

      <SettingRow
        label={
          <FormattedMessage
            id="settings.layout.label"
            defaultMessage="Keyboard layout"
          />
        }
        description={
          <FormattedMessage
            id="settings.layout.short"
            defaultMessage="Where the letters sit on the keys you are learning."
          />
        }
      >
        <OptionList
          options={options.selectableLayouts().map((item) => ({
            value: item.id,
            name:
              item.language.id === options.language.id
                ? formatLayoutName(item)
                : formatFullLayoutName(item),
          }))}
          value={options.layout.id}
          onSelect={(id) => {
            updateSettings(
              options
                .withLayout(Layout.ALL.get(id))
                .withGeometry(options.geometry)
                .withZones(options.zones)
                .save(settings),
            );
          }}
        />
      </SettingRow>

      <RowSeparator />

      <SettingRow
        label={
          <FormattedMessage
            id="t_Emulate_layout"
            defaultMessage="Simulate this layout"
          />
        }
        description={
          <FormattedMessage
            id="keyboard.emulation.forward.short"
            defaultMessage="Practise the layout chosen above whatever your system is set to. Best left on."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Emulate_layout",
            defaultMessage: "Simulate this layout",
          })}
          checked={settings.get(keyboardProps.emulation) === Emulation.Forward}
          disabled={!options.layout.emulate}
          onChange={(value) => {
            updateSettings(
              settings.set(
                keyboardProps.emulation,
                value ? Emulation.Forward : Emulation.None,
              ),
            );
          }}
        />
      </SettingRow>

      <RowSeparator />

      <SettingRow
        label={
          <FormattedMessage
            id="t_Keyboard_hardware_emulates_"
            defaultMessage="My keyboard hardware already emulates this"
          />
        }
        description={
          <FormattedMessage
            id="keyboard.emulation.reverse.short"
            defaultMessage="Turn on if your keyboard switches layout itself and the wrong keys light up."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Keyboard_hardware_emulates_",
            defaultMessage: "My keyboard hardware already emulates this",
          })}
          checked={settings.get(keyboardProps.emulation) === Emulation.Reverse}
          disabled={!options.layout.emulate}
          onChange={(value) => {
            updateSettings(
              settings.set(
                keyboardProps.emulation,
                value ? Emulation.Reverse : Emulation.None,
              ),
            );
          }}
        />
      </SettingRow>
    </>
  );
}

function GeometryProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const options = KeyboardOptions.from(settings);
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="settings.geometry.label"
            defaultMessage="Keyboard shape"
          />
        }
        description={
          <FormattedMessage
            id="settings.geometry.short"
            defaultMessage="Which physical keyboard the preview should look like."
          />
        }
      >
        <OptionList
          options={options.selectableGeometries().map((item) => ({
            value: item.id,
            name: item.name,
          }))}
          value={options.geometry.id}
          onSelect={(id) => {
            updateSettings(
              options
                .withGeometry(Geometry.ALL.get(id))
                .withZones(options.zones)
                .save(settings),
            );
          }}
        />
      </SettingRow>

      <RowSeparator />

      <SettingRow
        label={
          <FormattedMessage
            id="settings.zones.label"
            defaultMessage="Finger zones"
          />
        }
        description={
          <FormattedMessage
            id="settings.zones.short"
            defaultMessage="How the keys are divided between your fingers."
          />
        }
      >
        <OptionList
          options={options.selectableZones().map((item) => ({
            value: item.id,
            name: item.name,
          }))}
          value={options.zones.id}
          onSelect={(id) => {
            updateSettings(
              options.withZones(ZoneMod.ALL.get(id)).save(settings),
            );
          }}
        />
      </SettingRow>

      <RowSeparator />

      <SettingRow
        label={
          <FormattedMessage
            id="t_Colored_keys"
            defaultMessage="Color-coded keys"
          />
        }
        description={
          <FormattedMessage
            id="settings.keyboardColors.short"
            defaultMessage="Tints each key by finger zone, so you can see which finger to use."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Colored_keys",
            defaultMessage: "Color-coded keys",
          })}
          checked={settings.get(keyboardProps.colors)}
          onChange={(value) => {
            updateSettings(settings.set(keyboardProps.colors, value));
          }}
        />
      </SettingRow>

      <RowSeparator />

      <SettingRow
        label={
          <FormattedMessage
            id="t_Highlight_keys"
            defaultMessage="Spotlight the next key"
          />
        }
        description={
          <FormattedMessage
            id="settings.keyboardPointers.short"
            defaultMessage="Lights up the key you need next while you are still learning where they are."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Highlight_keys",
            defaultMessage: "Spotlight the next key",
          })}
          checked={settings.get(keyboardProps.pointers)}
          onChange={(value) => {
            updateSettings(settings.set(keyboardProps.pointers, value));
          }}
        />
      </SettingRow>
    </>
  );
}

const KeyboardPreview = memo(function KeyboardPreview(): ReactNode {
  const { settings } = useSettings();
  const keyboard = useKeyboard();
  const depressedKeys = useDepressedKeys(settings, keyboard);
  const colors = settings.get(keyboardProps.colors);
  const pointers = settings.get(keyboardProps.pointers);
  return (
    <VirtualKeyboard keyboard={keyboard} height="16rem">
      <KeyLayer
        depressedKeys={depressedKeys}
        toggledKeys={ModifierState.modifiers}
        showColors={colors}
      />
      {pointers && <PointersPreview />}
    </VirtualKeyboard>
  );
});

const PointersPreview = memo(function PointersPreview(): ReactNode {
  const keyboard = useKeyboard();
  const [index, setIndex] = useState(0);
  const [suffix, setSuffix] = useState<CodePoint[]>([]);
  useEffect(() => {
    setIndex(0);
    setSuffix(keyboard.getExampleLetters());
  }, [keyboard]);
  useEffect(() => {
    const tasks = new Tasks();
    tasks.delayed(1000, () => {
      let newIndex = index + 1;
      if (newIndex >= suffix.length) {
        newIndex = 0;
      }
      setIndex(newIndex);
    });
    return () => {
      tasks.cancelAll();
    };
  }, [index, suffix]);
  return <PointersLayer suffix={suffix.slice(index)} delay={10} />;
});
