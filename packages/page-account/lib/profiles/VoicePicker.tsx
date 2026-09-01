import { say } from "@keylearn/speech";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./Profiles.module.less";

/**
 * The voice this learner is read to in, chosen while setting them up.
 *
 * A customer reported that the voice their child heard was "very rough and not
 * kids friendly" — the device's own engine, or espeak-ng behind it. These were
 * listened to first.
 *
 * On the learner's own profile rather than in accessibility settings, because
 * that is what it is: part of making a learner, alongside their name and their
 * year, decided once by whoever sets them up. It also means it is chosen at the
 * moment somebody is already thinking about who this learner is — a five-year-
 * old who cannot read yet, or an adult using the braille drill — rather than
 * found later in a pane they had no reason to open.
 *
 * ## The preview is the control
 *
 * Not decoration on it. Nobody can choose a voice for a child from a word in a
 * dropdown: "Child" and "Woman" are labels, and the only question that matters
 * is whether this particular child will sit and listen to this particular
 * voice. So the button speaks a real sentence, through the same path the app
 * will actually use, rather than describing it.
 */
/**
 * The voice a learner starts with, before anyone chooses one.
 *
 * Chosen rather than left blank because "this device’s own voice" is the
 * rough one the customer complained about, and a default nobody sets is the
 * default almost everybody keeps. A five-year-old should not have to wait for
 * a parent to find this control before being read to in a voice made for them.
 *
 * The bands are guidance, not a rule: whatever is picked here is only a
 * starting point, and the control sits right beside it.
 *
 * `adultPick` is passed in rather than rolled here so it stays put while the
 * form is open. Rolling it inside would hand the learner a different voice on
 * every keystroke in the year field.
 */
export function defaultVoiceFor(
  kind: "adult" | "kid",
  birthYear: number | null,
  adultPick: "lady" | "man",
): "kid" | "tween" | "lady" | "man" {
  if (kind === "adult") {
    return adultPick;
  }
  if (birthYear == null) {
    // A kid profile with no year given. The kids world is built for the
    // youngest band, so that is the safer guess — being read to in too young
    // a voice is a smaller injury than not following the words at all.
    return "kid";
  }
  const age = new Date().getFullYear() - birthYear;
  if (age <= 8) {
    return "kid";
  }
  if (age <= 13) {
    return "tween";
  }
  // Older than the child voices are for. They are on a kid profile, but they
  // are not a child to be read to like one.
  return adultPick;
}

export function VoicePicker({
  value,
  onChange,
}: {
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [offered, setOffered] = useState<readonly string[] | null>(null);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    // Asked rather than assumed: the voices exist only where the deployment
    // can speak them, and offering one that silently falls back to something
    // else is how a parent concludes the setting does not work.
    let live = true;
    void (async () => {
      try {
        const response = await fetch("/_/speech/voices");
        const body = response.ok ? await response.json() : null;
        if (live) {
          setOffered(Array.isArray(body?.voices) ? body.voices : []);
        }
      } catch {
        if (live) {
          setOffered([]);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  // Nothing to choose from: this deployment cannot speak, and the browser's own
  // engine is all there is. An empty picker would promise otherwise.
  if (offered != null && offered.length === 0) {
    return null;
  }
  /**
   * Named, not described.
   *
   * "Child (5–8)" names a category; a parent choosing for one particular child
   * is choosing them a companion. A name also survives the band being wrong —
   * a small nine-year-old who wants the younger voice picks Pip without being
   * told they are a five-to-eight.
   *
   * The band stays as a suffix, because somebody who has never heard Pip
   * cannot choose from a name alone. The Listen button does the real work.
   *
   * Not translated. A name is a name, and these were picked to be sayable
   * across the locales this ships in rather than to mean anything in English.
   */
  const LABELS: Record<string, string> = {
    kid: formatMessage({
      id: "profiles.voice.kid",
      defaultMessage: "Pip (5–8)",
    }),
    tween: formatMessage({
      id: "profiles.voice.tween",
      defaultMessage: "Robin (9–13)",
    }),
    lady: formatMessage({
      id: "profiles.voice.lady",
      defaultMessage: "Maya",
    }),
    man: formatMessage({
      id: "profiles.voice.man",
      defaultMessage: "Theo",
    }),
  };
  return (
    <div className={styles.field2}>
      <p className={styles.editorLbl}>
        <FormattedMessage id="profiles.voice" defaultMessage="Reading voice" />
      </p>
      <div className={styles.voiceControls}>
        <select
          className={styles.voiceSelect}
          value={value ?? ""}
          onChange={(ev) => {
            onChange(ev.target.value || null);
          }}
        >
          {(offered ?? []).map((id) => (
            <option key={id} value={id}>
              {LABELS[id] ?? id}
            </option>
          ))}
          {/* Last, not first.
              Kept rather than dropped, and for one specific reason: a learner
              who uses a screen reader has a system voice they know, often at a
              speed nobody else could follow, and replacing it with one of ours
              would be a downgrade dressed as an improvement. The braille page's
              own voice picker also only does anything while this is chosen, so
              removing it here would quietly strand that setting.
              It is no longer anybody's default, which is what actually caused
              the complaint. */}
          <option value="">
            {formatMessage({
              id: "profiles.voice.device",
              defaultMessage: "Your device’s own voice",
            })}
          </option>
        </select>
        <button
          type="button"
          className={styles.voiceButton}
          disabled={speaking}
          onClick={() => {
            setSpeaking(true);
            say(
              formatMessage({
                id: "profiles.voice.sample",
                defaultMessage:
                  "Hello! I am the voice that will read your lessons. Ready when you are.",
              }),
              { rate: 1, enabled: true, clip: value },
              () => setSpeaking(false),
            );
          }}
        >
          {speaking ? (
            <FormattedMessage
              id="profiles.voice.speaking"
              defaultMessage="Speaking…"
            />
          ) : (
            <FormattedMessage
              id="profiles.voice.preview"
              defaultMessage="Listen"
            />
          )}
        </button>
      </div>
    </div>
  );
}
