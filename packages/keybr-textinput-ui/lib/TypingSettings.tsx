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
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
  FieldSet,
  Icon,
  IconButton,
  OptionList,
  RadioBox,
  Range,
} from "@keybr/widget";
import { mdiPlayCircleOutline, mdiStopCircleOutline } from "@mdi/js";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { AnimatedText } from "./AnimatedText.tsx";
import * as styles from "./TypingSettings.module.less";

export function TypingSettings() {
  const { formatMessage } = useIntl();
  return (
    <>
      <FieldSet
        legend={formatMessage({
          id: "t_Typing_options",
          defaultMessage: "Typing helpers",
        })}
      >
        <Explainer>
          <Description>
            <FormattedMessage
              id="settings.typingAssists.description"
              defaultMessage="These typing assists help you stay in the flow by automatically smoothing over your mistakes."
            />
          </Description>
        </Explainer>
        <StopOnErrorProp />
        <ForgiveErrorsProp />
        <SpaceSkipsWordsProp />
      </FieldSet>
      <FieldSet
        legend={formatMessage({
          id: "t_Text_appearance",
          defaultMessage: "Display settings",
        })}
      >
        <ExampleText />
        <FontProp />
        <WhitespaceProp />
        <CursorShapeProp />
        <CursorMovementProp />
        <SoundsProp />
        <SoundsThemeProp />
      </FieldSet>
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
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Stop_cursor_on_error",
              defaultMessage: "Pause cursor on mistakes",
            })}
            checked={settings.get(textInputProps.stopOnError)}
            onChange={(value) => {
              updateSettings(settings.set(textInputProps.stopOnError, value));
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.stopCursorOnError.description"
            defaultMessage="When turned on, the cursor won't move forward until you type the correct key. When turned off, mistakes pile up in the text and you'll need to delete them yourself."
          />
        </Description>
      </Explainer>
    </>
  );
}

function ForgiveErrorsProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Forgive_errors:",
              defaultMessage: "Auto-correct mistakes",
            })}
            checked={settings.get(textInputProps.forgiveErrors)}
            onChange={(value) => {
              updateSettings(settings.set(textInputProps.forgiveErrors, value));
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.forgiveErrors.description"
            defaultMessage="When turned on, common slip-ups like a wrong or skipped character are corrected for you automatically."
          />
        </Description>
      </Explainer>
    </>
  );
}

function SpaceSkipsWordsProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "t_Space_skips_words",
              defaultMessage: "Space jumps to next word",
            })}
            checked={settings.get(textInputProps.spaceSkipsWords)}
            onChange={(value) => {
              updateSettings(
                settings.set(textInputProps.spaceSkipsWords, value),
              );
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.spaceSkipsWords.description"
            defaultMessage="When turned on, pressing space mid-word jumps straight to the start of the next word, skipping whatever's left."
          />
        </Description>
      </Explainer>
    </>
  );
}

function FontProp() {
  const { settings, updateSettings } = useSettings();
  const { language } = KeyboardOptions.from(settings);
  const fonts = Font.select(language);
  const font = Font.find(fonts, settings.get(textDisplayProps.font));
  return (
    <FieldList>
      <Field size={10}>
        <FormattedMessage id="t_Font:" defaultMessage="Typeface:" />
      </Field>
      <Field>
        <OptionList
          options={fonts.map((item) => ({
            value: item.id,
            name: <span style={item.cssProperties}>{item.name}</span>,
          }))}
          value={font.id}
          onSelect={(id) => {
            updateSettings(
              settings.set(textDisplayProps.font, Font.ALL.get(id)),
            );
          }}
        />
      </Field>
    </FieldList>
  );
}

function WhitespaceProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <FieldList>
      <Field size={10}>
        <FormattedMessage id="t_Whitespace:" defaultMessage="Show spaces as:" />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_ws_No_whitespace",
            defaultMessage: "Hidden",
          })}
          name="whitespace-style"
          checked={
            settings.get(textDisplayProps.whitespaceStyle) ===
            WhitespaceStyle.Space
          }
          onSelect={() => {
            updateSettings(
              settings.set(
                textDisplayProps.whitespaceStyle,
                WhitespaceStyle.Space,
              ),
            );
          }}
        />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_ws_Bar_whitespace",
            defaultMessage: "As bars",
          })}
          name="whitespace-style"
          checked={
            settings.get(textDisplayProps.whitespaceStyle) ===
            WhitespaceStyle.Bar
          }
          onSelect={() => {
            updateSettings(
              settings.set(
                textDisplayProps.whitespaceStyle,
                WhitespaceStyle.Bar,
              ),
            );
          }}
        />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_ws_Bullet_whitespace",
            defaultMessage: "As dots",
          })}
          name="whitespace-style"
          checked={
            settings.get(textDisplayProps.whitespaceStyle) ===
            WhitespaceStyle.Bullet
          }
          onSelect={() => {
            updateSettings(
              settings.set(
                textDisplayProps.whitespaceStyle,
                WhitespaceStyle.Bullet,
              ),
            );
          }}
        />
      </Field>
    </FieldList>
  );
}

function CursorShapeProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <FieldList>
      <Field size={10}>
        <FormattedMessage id="t_Cursor_shape:" defaultMessage="Cursor look:" />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_cur_Block_cursor",
            defaultMessage: "Solid block",
          })}
          name="cursor-shape-style"
          checked={
            settings.get(textDisplayProps.caretShapeStyle) ===
            CaretShapeStyle.Block
          }
          onSelect={() => {
            updateSettings(
              settings.set(
                textDisplayProps.caretShapeStyle,
                CaretShapeStyle.Block,
              ),
            );
          }}
        />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_cur_Box_cursor",
            defaultMessage: "Outlined box",
          })}
          name="cursor-shape-style"
          checked={
            settings.get(textDisplayProps.caretShapeStyle) ===
            CaretShapeStyle.Box
          }
          onSelect={() => {
            updateSettings(
              settings.set(
                textDisplayProps.caretShapeStyle,
                CaretShapeStyle.Box,
              ),
            );
          }}
        />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_cur_Line_cursor",
            defaultMessage: "Thin line",
          })}
          name="cursor-shape-style"
          checked={
            settings.get(textDisplayProps.caretShapeStyle) ===
            CaretShapeStyle.Line
          }
          onSelect={() => {
            updateSettings(
              settings.set(
                textDisplayProps.caretShapeStyle,
                CaretShapeStyle.Line,
              ),
            );
          }}
        />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_cur_Underline_cursor",
            defaultMessage: "Underline",
          })}
          name="cursor-shape-style"
          checked={
            settings.get(textDisplayProps.caretShapeStyle) ===
            CaretShapeStyle.Underline
          }
          onSelect={() => {
            updateSettings(
              settings.set(
                textDisplayProps.caretShapeStyle,
                CaretShapeStyle.Underline,
              ),
            );
          }}
        />
      </Field>
    </FieldList>
  );
}

function CursorMovementProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <FieldList>
      <Field size={10}>
        <FormattedMessage
          id="t_Cursor_movement:"
          defaultMessage="Cursor motion:"
        />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_cur_Jumping_cursor",
            defaultMessage: "Snap into place",
          })}
          name="cursor-movement-style"
          checked={
            settings.get(textDisplayProps.caretMovementStyle) ===
            CaretMovementStyle.Jumping
          }
          onSelect={() => {
            updateSettings(
              settings.set(
                textDisplayProps.caretMovementStyle,
                CaretMovementStyle.Jumping,
              ),
            );
          }}
        />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_cur_Smooth_cursor",
            defaultMessage: "Glide smoothly",
          })}
          name="cursor-movement-style"
          checked={
            settings.get(textDisplayProps.caretMovementStyle) ===
            CaretMovementStyle.Smooth
          }
          onChange={() => {
            updateSettings(
              settings.set(
                textDisplayProps.caretMovementStyle,
                CaretMovementStyle.Smooth,
              ),
            );
          }}
        />
      </Field>
    </FieldList>
  );
}

function SoundsProp() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <FieldList>
      <Field size={10}>
        <FormattedMessage id="t_Play_sounds:" defaultMessage="Sound effects:" />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_No_sounds:",
            defaultMessage: "Sound off",
          })}
          name="play-sounds"
          checked={settings.get(soundProps.playSounds) === PlaySounds.None}
          onSelect={() => {
            updateSettings(
              settings.set(soundProps.playSounds, PlaySounds.None),
            );
          }}
        />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_Error_sounds_only:",
            defaultMessage: "Errors only",
          })}
          name="play-sounds"
          checked={
            settings.get(soundProps.playSounds) === PlaySounds.ErrorsOnly
          }
          onChange={() => {
            updateSettings(
              settings.set(soundProps.playSounds, PlaySounds.ErrorsOnly),
            );
          }}
        />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_Key_sounds_only:",
            defaultMessage: "Keystrokes only",
          })}
          name="play-sounds"
          checked={settings.get(soundProps.playSounds) === PlaySounds.KeysOnly}
          onChange={() => {
            updateSettings(
              settings.set(soundProps.playSounds, PlaySounds.KeysOnly),
            );
          }}
        />
      </Field>
      <Field>
        <RadioBox
          label={formatMessage({
            id: "t_All_sounds:",
            defaultMessage: "Every sound",
          })}
          name="play-sounds"
          checked={settings.get(soundProps.playSounds) === PlaySounds.All}
          onChange={() => {
            updateSettings(settings.set(soundProps.playSounds, PlaySounds.All));
          }}
        />
      </Field>
      <Field>
        <FormattedMessage id="t_Sound_volume:" defaultMessage="Loudness:" />
      </Field>
      <Field>
        <Range
          min={0}
          max={100}
          step={1}
          value={Math.round(settings.get(soundProps.soundVolume) * 100)}
          onChange={(value) => {
            updateSettings(settings.set(soundProps.soundVolume, value / 100));
          }}
        />
      </Field>
    </FieldList>
  );
}

function SoundsThemeProp() {
  const { settings, updateSettings } = useSettings();
  return (
    <FieldList>
      <Field size={10}>
        <FormattedMessage id="t_Sound_theme:" defaultMessage="Sound pack:" />
      </Field>
      <Field>
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
      </Field>
      <Field>
        <SoundThemePreview />
      </Field>
    </FieldList>
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
