import { KeyboardOptions, useKeyboard } from "@keybr/keyboard";
import { Tasks } from "@keybr/lang";
import { Settings, useSettings } from "@keybr/settings";
import {
  CaretMovementStyle,
  CaretShapeStyle,
  Feedback,
  Font,
  textDisplayProps,
  textInputProps,
  toTextDisplaySettings,
  WhitespaceStyle,
} from "@keybr/textinput";
import {
  makeSoundPlayer,
  PlaySounds,
  soundProps,
  SoundTheme,
} from "@keybr/textinput-sounds";
import {
  Icon,
  IconButton,
  OptionList,
  Range,
  RowSeparator,
  Segmented,
  SettingRow,
  SettingsCard,
  Switch,
} from "@keybr/widget";
import { mdiPlayCircleOutline, mdiStopCircleOutline } from "@mdi/js";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { AnimatedText } from "./AnimatedText.tsx";
import * as styles from "./TypingSettings.module.less";

export function TypingSettings() {
  return (
    <>
      <SettingsCard
        caption={
          <FormattedMessage
            id="t_Typing_options"
            defaultMessage="Typing helpers"
          />
        }
      >
        <StopOnErrorProp />
        <RowSeparator />
        <ForgiveErrorsProp />
        <RowSeparator />
        <SpaceSkipsWordsProp />
      </SettingsCard>

      <ExampleText />

      <SettingsCard
        caption={
          <FormattedMessage
            id="t_Text_appearance"
            defaultMessage="Display settings"
          />
        }
      >
        <FontProp />
        <RowSeparator />
        <WhitespaceProp />
        <RowSeparator />
        <CursorShapeProp />
        <RowSeparator />
        <CursorMovementProp />
      </SettingsCard>

      <SettingsCard
        caption={<FormattedMessage id="t_Sounds" defaultMessage="Sound" />}
      >
        <SoundsProp />
        <RowSeparator />
        <SoundVolumeProp />
        <RowSeparator />
        <SoundsThemeProp />
      </SettingsCard>
    </>
  );
}

function ExampleText() {
  const { settings } = useSettings();
  const keyboard = useKeyboard();
  return (
    <div className={styles.exampleText}>
      <AnimatedText
        settings={toTextDisplaySettings(settings)}
        text={keyboard.getExampleText()}
      />
    </div>
  );
}

function StopOnErrorProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="t_Stop_cursor_on_error"
            defaultMessage="Pause cursor on mistakes"
          />
        }
        description={
          <FormattedMessage
            id="settings.stopCursorOnError.short"
            defaultMessage="The cursor waits for the right key instead of letting mistakes pile up."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Stop_cursor_on_error",
            defaultMessage: "Pause cursor on mistakes",
          })}
          checked={settings.get(textInputProps.stopOnError)}
          onChange={(value) => {
            updateSettings(settings.set(textInputProps.stopOnError, value));
          }}
        />
      </SettingRow>
    </>
  );
}

function ForgiveErrorsProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="t_Forgive_errors"
            defaultMessage="Auto-correct mistakes"
          />
        }
        description={
          <FormattedMessage
            id="settings.forgiveErrors.short"
            defaultMessage="Small slips are fixed for you so a lesson is not derailed by one key."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Forgive_errors",
            defaultMessage: "Auto-correct mistakes",
          })}
          checked={settings.get(textInputProps.forgiveErrors)}
          onChange={(value) => {
            updateSettings(settings.set(textInputProps.forgiveErrors, value));
          }}
        />
      </SettingRow>
    </>
  );
}

function SpaceSkipsWordsProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <SettingRow
        label={
          <FormattedMessage
            id="t_Space_skips_words"
            defaultMessage="Space jumps to next word"
          />
        }
        description={
          <FormattedMessage
            id="settings.spaceSkipsWords.short"
            defaultMessage="Pressing space moves on even if the word is not finished."
          />
        }
      >
        <Switch
          label={formatMessage({
            id: "t_Space_skips_words",
            defaultMessage: "Space jumps to next word",
          })}
          checked={settings.get(textInputProps.spaceSkipsWords)}
          onChange={(value) => {
            updateSettings(settings.set(textInputProps.spaceSkipsWords, value));
          }}
        />
      </SettingRow>
    </>
  );
}

function FontProp() {
  const { settings, updateSettings } = useSettings();
  const { language } = KeyboardOptions.from(settings);
  const fonts = Font.select(language);
  const font = Font.find(fonts, settings.get(textDisplayProps.font));
  return (
    <SettingRow
      label={
        <FormattedMessage id="settings.font.label" defaultMessage="Typeface" />
      }
      description={
        <FormattedMessage
          id="settings.font.short"
          defaultMessage="The face the practice text is set in."
        />
      }
    >
      <OptionList
        options={fonts.map((item) => ({
          value: item.id,
          name: <span style={item.cssProperties}>{item.name}</span>,
        }))}
        value={font.id}
        onSelect={(id) => {
          updateSettings(settings.set(textDisplayProps.font, Font.ALL.get(id)));
        }}
      />
    </SettingRow>
  );
}

function WhitespaceProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <SettingRow
      label={
        <FormattedMessage
          id="settings.whitespace.label"
          defaultMessage="Show spaces as"
        />
      }
      description={
        <FormattedMessage
          id="settings.whitespace.short"
          defaultMessage="Whether the gaps between words are marked."
        />
      }
    >
      <Segmented
        value={String(settings.get(textDisplayProps.whitespaceStyle))}
        onChange={(id) => {
          // Look the value back up by its own string form. The keys here must
          // be whatever `String(WhitespaceStyle.X)` produces, not names picked
          // by hand — guessing them silently made every option a no-op.
          const found = [
            WhitespaceStyle.Space,
            WhitespaceStyle.Bar,
            WhitespaceStyle.Bullet,
          ].find((value) => String(value) === id);
          if (found != null) {
            updateSettings(
              settings.set(textDisplayProps.whitespaceStyle, found),
            );
          }
        }}
        options={[
          {
            id: String(WhitespaceStyle.Space),
            label: formatMessage({
              id: "t_ws_No_whitespace",
              defaultMessage: "Hidden",
            }),
          },
          {
            id: String(WhitespaceStyle.Bar),
            label: formatMessage({
              id: "t_ws_Bar",
              defaultMessage: "As bars",
            }),
          },
          {
            id: String(WhitespaceStyle.Bullet),
            label: formatMessage({
              id: "t_ws_Bullet",
              defaultMessage: "As dots",
            }),
          },
        ]}
      />
    </SettingRow>
  );
}

function CursorShapeProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const shapes = [
    {
      value: CaretShapeStyle.Block,
      name: formatMessage({
        id: "t_cs_Block_shape",
        defaultMessage: "Solid block",
      }),
    },
    {
      value: CaretShapeStyle.Box,
      name: formatMessage({
        id: "t_cs_Box_shape",
        defaultMessage: "Outlined box",
      }),
    },
    {
      value: CaretShapeStyle.Line,
      name: formatMessage({
        id: "t_cs_Line_shape",
        defaultMessage: "Thin line",
      }),
    },
    {
      value: CaretShapeStyle.Underline,
      name: formatMessage({
        id: "t_cs_Underline_shape",
        defaultMessage: "Underline",
      }),
    },
  ];
  return (
    <SettingRow
      label={
        <FormattedMessage
          id="settings.cursorShape.label"
          defaultMessage="Cursor look"
        />
      }
      description={
        <FormattedMessage
          id="settings.cursorShape.short"
          defaultMessage="The marker showing where you are in the text."
        />
      }
    >
      <OptionList
        options={shapes.map(({ value, name }) => ({
          value: String(value),
          name,
        }))}
        value={String(settings.get(textDisplayProps.caretShapeStyle))}
        onSelect={(id) => {
          const found = shapes.find(({ value }) => String(value) === id);
          if (found != null) {
            updateSettings(
              settings.set(textDisplayProps.caretShapeStyle, found.value),
            );
          }
        }}
      />
    </SettingRow>
  );
}

function CursorMovementProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <SettingRow
      label={
        <FormattedMessage
          id="settings.cursorMovement.label"
          defaultMessage="Cursor motion"
        />
      }
      description={
        <FormattedMessage
          id="settings.cursorMovement.short"
          defaultMessage="Whether the marker jumps between letters or slides."
        />
      }
    >
      <Segmented
        value={String(settings.get(textDisplayProps.caretMovementStyle))}
        onChange={(id) => {
          updateSettings(
            settings.set(
              textDisplayProps.caretMovementStyle,
              id === String(CaretMovementStyle.Smooth)
                ? CaretMovementStyle.Smooth
                : CaretMovementStyle.Jumping,
            ),
          );
        }}
        options={[
          {
            id: String(CaretMovementStyle.Jumping),
            label: formatMessage({
              id: "t_cm_Jumping_movement",
              defaultMessage: "Snap into place",
            }),
          },
          {
            id: String(CaretMovementStyle.Smooth),
            label: formatMessage({
              id: "t_cm_Smooth_movement",
              defaultMessage: "Glide smoothly",
            }),
          },
        ]}
      />
    </SettingRow>
  );
}

function SoundsProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const choices = [
    {
      value: PlaySounds.None,
      name: formatMessage({ id: "t_No_sounds:", defaultMessage: "Sound off" }),
    },
    {
      value: PlaySounds.ErrorsOnly,
      name: formatMessage({
        id: "t_Error_sounds_only:",
        defaultMessage: "Errors only",
      }),
    },
    {
      value: PlaySounds.KeysOnly,
      name: formatMessage({
        id: "t_Key_sounds_only:",
        defaultMessage: "Keystrokes only",
      }),
    },
    {
      value: PlaySounds.All,
      name: formatMessage({
        id: "t_All_sounds:",
        defaultMessage: "Every sound",
      }),
    },
  ];
  return (
    <SettingRow
      label={
        <FormattedMessage
          id="settings.playSounds.label"
          defaultMessage="Sound effects"
        />
      }
      description={
        <FormattedMessage
          id="settings.playSounds.short"
          defaultMessage="What KeyLearn makes a noise about while you type."
        />
      }
    >
      <OptionList
        options={choices.map(({ value, name }) => ({
          value: String(value),
          name,
        }))}
        value={String(settings.get(soundProps.playSounds))}
        onSelect={(id) => {
          const found = choices.find(({ value }) => String(value) === id);
          if (found != null) {
            updateSettings(settings.set(soundProps.playSounds, found.value));
          }
        }}
      />
    </SettingRow>
  );
}

function SoundVolumeProp() {
  const { settings, updateSettings } = useSettings();
  const volume = settings.get(soundProps.soundVolume);
  return (
    <SettingRow
      label={
        <FormattedMessage
          id="settings.soundVolume.label"
          defaultMessage="Loudness"
        />
      }
      value={`${Math.round(volume * 100)}%`}
    >
      <Range
        size={10}
        min={0}
        max={100}
        step={1}
        value={Math.round(volume * 100)}
        onChange={(value) => {
          updateSettings(settings.set(soundProps.soundVolume, value / 100));
        }}
      />
    </SettingRow>
  );
}

function SoundsThemeProp() {
  const { settings, updateSettings } = useSettings();
  return (
    <SettingRow
      label={
        <FormattedMessage
          id="settings.soundTheme.label"
          defaultMessage="Sound pack"
        />
      }
      description={
        <FormattedMessage
          id="settings.soundTheme.short"
          defaultMessage="Which set of sounds to use. Press play to hear it."
        />
      }
    >
      <OptionList
        options={SoundTheme.ALL.map((item) => ({
          value: item.id,
          name: item.name,
        }))}
        value={settings.get(soundProps.soundTheme).id}
        onSelect={(id) => {
          updateSettings(
            settings.set(soundProps.soundTheme, SoundTheme.ALL.get(id)),
          );
        }}
      />
      <SoundThemePreview />
    </SettingRow>
  );
}

function SoundThemePreview() {
  const { settings } = useSettings();
  const soundVolume = settings.get(soundProps.soundVolume);
  const soundTheme = settings.get(soundProps.soundTheme);
  const player = useMemo(() => {
    if (process.env.NODE_ENV === "test") {
      // Do not load sound assets in tests.
      return () => {};
    }
    return makeSoundPlayer(
      new Settings()
        .set(soundProps.playSounds, PlaySounds.All)
        .set(soundProps.soundVolume, soundVolume)
        .set(soundProps.soundTheme, soundTheme),
    );
  }, [soundVolume, soundTheme]);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const tasks = new Tasks();
    if (playing) {
      tasks.repeated(300, () => {
        player(Feedback.Succeeded);
      });
    }
    return () => {
      tasks.cancelAll();
    };
  }, [player, playing]);
  return (
    <IconButton
      icon={
        <Icon shape={playing ? mdiStopCircleOutline : mdiPlayCircleOutline} />
      }
      onClick={() => {
        setPlaying(!playing);
      }}
    />
  );
}
