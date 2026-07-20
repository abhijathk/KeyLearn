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
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
  FieldSet,
  OptionList,
} from "@keybr/widget";
import { memo, type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function KeyboardSettings(): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <>
      <FieldSet
        legend={formatMessage({
          id: "t_Options",
          defaultMessage: "Settings",
        })}
      >
        <LayoutProp />
      </FieldSet>
      <FieldSet
        legend={formatMessage({
          id: "t_Preview",
          defaultMessage: "Live Preview",
        })}
      >
        <KeyboardPreview />
        <GeometryProp />
      </FieldSet>
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
      <FieldList>
        <Field>
          <FormattedMessage id="t_Language:" defaultMessage="Language:" />
        </Field>
        <Field>
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
        </Field>
        <Field>
          <FormattedMessage id="t_Layout:" defaultMessage="Keyboard layout:" />
        </Field>
        <Field>
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
        </Field>
      </FieldList>
      <FieldList>
        <Field>
          <CheckBox
            checked={
              settings.get(keyboardProps.emulation) === Emulation.Forward
            }
            disabled={!options.layout.emulate}
            label={formatMessage({
              id: "t_Emulate_layout",
              defaultMessage: "Simulate this layout",
            })}
            onChange={(value) => {
              updateSettings(
                settings.set(
                  keyboardProps.emulation,
                  value ? Emulation.Forward : Emulation.None,
                ),
              );
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="keyboard.emulation.forward.description"
            defaultMessage="Layout emulation overrides your system’s keyboard layout, letting you practice the layout you picked here no matter how your OS is configured. It’s usually best to leave this turned on. When the option above is greyed out, that layout can’t be emulated — this mostly happens with layouts that rely on dead keys."
          />
        </Description>
      </Explainer>
      <FieldList>
        <Field>
          <CheckBox
            checked={
              settings.get(keyboardProps.emulation) === Emulation.Reverse
            }
            disabled={!options.layout.emulate}
            label={formatMessage({
              id: "t_Keyboard_hardware_emulates_",
              defaultMessage: "My keyboard hardware already emulates this",
            })}
            onChange={(value) => {
              updateSettings(
                settings.set(
                  keyboardProps.emulation,
                  value ? Emulation.Reverse : Emulation.None,
                ),
              );
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="keyboard.emulation.reverse.description"
            defaultMessage="Turn this on if your keyboard has a built-in layout switch and the virtual keyboard is highlighting the wrong keys."
          />
        </Description>
      </Explainer>
    </>
  );
}

function GeometryProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const options = KeyboardOptions.from(settings);
  return (
    <>
      <FieldList>
        <Field>
          <FormattedMessage id="t_Geometry:" defaultMessage="Keyboard shape:" />
        </Field>
        <Field>
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
        </Field>
        <Field>
          <FormattedMessage id="t_Zones:" defaultMessage="Finger zones:" />
        </Field>
        <Field>
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
        </Field>
      </FieldList>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Colored_keys",
              defaultMessage: "Color-coded keys",
            })}
            checked={settings.get(keyboardProps.colors)}
            onChange={(value) => {
              updateSettings(settings.set(keyboardProps.colors, value));
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.keyboardColors.description"
            defaultMessage="Colors the keyboard by finger zone, so you can see at a glance which finger should press each key."
          />
        </Description>
      </Explainer>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Highlight_keys",
              defaultMessage: "Spotlight the next key",
            })}
            checked={settings.get(keyboardProps.pointers)}
            onChange={(value) => {
              updateSettings(settings.set(keyboardProps.pointers, value));
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.keyboardPointers.description"
            defaultMessage="Highlights the next key you need to press, so you can find it quickly if you’re still learning where the keys are."
          />
        </Description>
      </Explainer>
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
