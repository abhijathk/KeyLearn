import { useCollator } from "@keylearn/intl";
import {
  Backlight,
  Emulation,
  Geometry,
  KeyboardColour,
  KeyboardOptions,
  keyboardProps,
  KeyboardStyle,
  Language,
  Layout,
  useFormattedNames,
  useKeyboard,
  ZoneMod,
} from "@keylearn/keyboard";
import {
  KeyLayer,
  PointersLayer,
  VirtualKeyboard,
} from "@keylearn/keyboard-ui";
import { Tasks } from "@keylearn/lang";
import {
  canChooseAccent,
  usePageData,
  useTypingLanguages,
} from "@keylearn/pages-shared";
import { useSettings } from "@keylearn/settings";
import { ModifierState, useDepressedKeys } from "@keylearn/textinput-events";
import { SoundsThemeProp } from "@keylearn/textinput-ui";
import { type CodePoint } from "@keylearn/unicode";
import {
  OptionList,
  Range,
  RowSeparator,
  SettingRow,
  SettingsCard,
  Switch,
} from "@keylearn/widget";
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
      <SettingsCard
        caption={
          <FormattedMessage
            id="settings.group.keyboardStyle"
            defaultMessage="Style"
          />
        }
      >
        <StyleProp />
      </SettingsCard>
    </>
  );
}

/**
 * The keyboard's finish, and the backlight that comes with two of them.
 *
 * The backlight rows only appear for a style that has one. A control that is
 * present but does nothing is worse than one that is absent: it invites the
 * learner to change it and then wonder why the board looks the same.
 */
function StyleProp(): ReactNode {
  const { settings, updateSettings } = useSettings();
  const style = settings.get(keyboardProps.style);
  const stored = settings.get(keyboardProps.colour);
  // "Graphite + theme colour" wears `--accent`, and the accent is an
  // account's to choose — a signed-out visitor always gets the default one.
  // Offering the colourway to them is offering a choice that does nothing,
  // which is the same trap the style picker's own comment warns about: a
  // control that invites a change and then looks identical. So it leaves the
  // list, and a board already wearing it shows as Graphite until they sign
  // in — which is what it looks like anyway.
  const themed = canChooseAccent();
  // The site keeps the board's finish for account holders, and nobody is
  // signed in. Decided on the server (PageData.boardChoiceLocked) so one
  // answer serves every screen.
  const boardLocked = usePageData().boardChoiceLocked === true;
  const colour =
    !themed && stored === KeyboardColour.THEME
      ? KeyboardColour.GRAPHITE
      : stored;
  const backlight = settings.get(keyboardProps.backlight);
  const intensity = settings.get(keyboardProps.backlightIntensity);
  return (
    <>
      {/* The site can keep the board's finish for account holders. The row
          goes rather than turning inert, on the same reasoning the colour row
          below already follows: a picker with nothing to pick is worse than
          no picker. Everything a visitor actually needs to type — the layout,
          the language, the shape, the finger zones — is in the cards above
          and is never gated. */}
      {!boardLocked && (
        <SettingRow
          label={
            <FormattedMessage
              id="settings.keyboardStyle.label"
              defaultMessage="Keyboard"
            />
          }
          description={
            <FormattedMessage
              id="settings.keyboardStyle.short"
              defaultMessage="Key positions, sizes and labels are the same on all five — only the finish changes. Flat Silver and Flat Midnight are the same board in two finishes, each worn on whichever theme you like; Round comes in six colours."
            />
          }
        >
          <OptionList
            options={[...KeyboardStyle.ALL].map((item) => ({
              value: item.id,
              name: item.name,
            }))}
            value={style.id}
            onSelect={(id) => {
              updateSettings(
                settings.set(keyboardProps.style, KeyboardStyle.ALL.get(id)),
              );
            }}
          />
        </SettingRow>
      )}

      {/* Only the round board is sold in more than one colour, so the row
          only exists under it. A picker with nothing to pick is worse than
          no picker. */}
      {style.colourable && (
        <>
          <RowSeparator />
          <SettingRow
            label={
              <FormattedMessage
                id="settings.keyboardColour.label"
                defaultMessage="Colour"
              />
            }
            description={
              <FormattedMessage
                id="settings.keyboardColour.short"
                defaultMessage="The board keeps this colour on both themes — a keyboard on a desk doesn’t repaint itself when the lamp goes off. Only the light follows the page."
              />
            }
          >
            <OptionList
              options={[...KeyboardColour.ALL]
                .filter((item) => themed || item !== KeyboardColour.THEME)
                .map((item) => ({
                  value: item.id,
                  name: item.name,
                }))}
              value={colour.id}
              onSelect={(id) => {
                updateSettings(
                  settings.set(
                    keyboardProps.colour,
                    KeyboardColour.ALL.get(id),
                  ),
                );
              }}
            />
          </SettingRow>
        </>
      )}

      {/* Nothing above it when the finish row is gone — a hairline at the top
          of the card reads as a rule under a heading that isn't there. */}
      {!boardLocked && <RowSeparator />}
      {/* The pack belongs to the board you picked, so it lives here rather
          than under Text Input, and its options are filtered by that board. */}
      <SoundsThemeProp />

      {style.lightable && (
        <>
          <RowSeparator />
          <SettingRow
            label={
              <FormattedMessage
                id="settings.backlight.label"
                defaultMessage="Backlight"
              />
            }
            description={
              <FormattedMessage
                id="settings.backlight.short"
                defaultMessage="Per-key colour on the mechanical board, a plain warm light on the flat and round ones. Automatic means lit at night and dark by day."
              />
            }
          >
            <OptionList
              options={[
                { value: String(Backlight.Auto), name: "Automatic" },
                { value: String(Backlight.On), name: "On" },
                { value: String(Backlight.Off), name: "Off" },
              ]}
              value={String(backlight)}
              onSelect={(id) => {
                updateSettings(
                  settings.set(keyboardProps.backlight, Number(id)),
                );
              }}
            />
          </SettingRow>

          {backlight !== Backlight.Off && (
            <>
              <RowSeparator />
              <SettingRow
                label={
                  <FormattedMessage
                    id="settings.backlightIntensity.label"
                    defaultMessage="Light intensity"
                  />
                }
                description={
                  <FormattedMessage
                    id="settings.backlightIntensity.short"
                    defaultMessage="How brightly the light sits under the keys."
                  />
                }
              >
                <Range
                  min={0}
                  max={100}
                  step={5}
                  value={intensity}
                  onChange={(value) => {
                    updateSettings(
                      settings.set(keyboardProps.backlightIntensity, value),
                    );
                  }}
                />
              </SettingRow>
            </>
          )}
        </>
      )}
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
  // Typing languages the control centre has switched on; null means all.
  const typing = useTypingLanguages();
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
            .filter((item) => typing == null || typing.has(item.id))
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
