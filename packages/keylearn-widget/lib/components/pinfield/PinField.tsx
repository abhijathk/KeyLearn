import { type ReactNode, useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import * as styles from "./PinField.module.less";

/**
 * Whether the browser can mask a plain text field with CSS.
 *
 * This decides how the digits are hidden, and the reason it matters is
 * the password manager: Chrome and Safari offer to save (and later to
 * update) the value of any `type="password"` field, and a grown-up PIN
 * ending up in the browser's password store — on the family tablet the
 * PIN exists to protect — is the opposite of the point. `autocomplete`
 * does not turn that prompt off; not being a password field does.
 *
 * Where the CSS masking is unavailable the field stays `type="password"`,
 * because a visible PIN on a shared screen is the worse of the two.
 * Evaluated once, lazily, since it cannot change.
 */
export const MIN_PIN = 4;
export const MAX_PIN = 6;

let cssMasking: boolean | null = null;

function canMaskWithCss(): boolean {
  if (cssMasking == null) {
    cssMasking =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      (CSS.supports("-webkit-text-security", "disc") ||
        CSS.supports("text-security", "disc"));
  }
  return cssMasking;
}

/**
 * The grown-up PIN, one box per digit.
 *
 * `length` is how many digits this household's PIN actually has — the
 * server records it when the PIN is set, because a hash cannot be asked.
 * When it is null the PIN predates that record, and the row grows from
 * four boxes to six as it is filled rather than guessing — four outright
 * would stop a six-digit household finishing their own PIN. The length is
 * recorded on the next successful entry, so this only happens once. See
 * `User.setParentPin`.
 *
 * Boxes rather than one field because a PIN is not a password: it is
 * short, it is entered often, and on a tablet the segmented form tells
 * somebody how many digits are wanted before they start rather than after
 * they get it wrong.
 */
export function PinField({
  value,
  length,
  onChange,
  onComplete,
  autoFocus = true,
  disabled = false,
  reveal = false,
}: {
  readonly value: string;
  /** Digits in this account's PIN, or null when it isn't known. */
  readonly length: number | null;
  readonly onChange: (value: string) => void;
  /** Fired when the last box is filled — usually submits. */
  readonly onComplete?: (value: string) => void;
  readonly autoFocus?: boolean;
  readonly disabled?: boolean;
  /**
   * Show the digits as typed. For a code that arrived by email rather
   * than a PIN somebody keeps: masking a number they are copying off the
   * screen next to them only makes it harder to check, and there is
   * nobody to hide it from.
   */
  readonly reveal?: boolean;
}): ReactNode {
  const { formatMessage } = useIntl();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  /**
   * How many boxes to draw.
   *
   * A known length gets exactly that many. An unknown one — a PIN set
   * before the length was recorded — grows from the minimum instead of
   * falling back to a plain field: four boxes to start, and one more as
   * each of the last is filled, up to the six-digit cap. Guessing four
   * outright would stop a six-digit household from finishing their own
   * PIN; a single text box loses the shape entirely.
   */
  const size =
    length != null
      ? Math.min(MAX_PIN, Math.max(MIN_PIN, length))
      : Math.min(MAX_PIN, Math.max(MIN_PIN, value.length + 1));
  const masked = !reveal && canMaskWithCss();
  // "one-time-code" on top of not being a password field: it tells the
  // browser this is a short numeric secret to be typed, not stored.
  const secret = {
    "type": masked ? "text" : reveal ? "text" : "password",
    "inputMode": "numeric" as const,
    "autoComplete": "one-time-code",
    // Keeps a mobile keyboard from capitalising or correcting digits.
    "autoCorrect": "off",
    "autoCapitalize": "off",
    "spellCheck": false,
    "data-lpignore": "true",
    "data-1p-ignore": "true",
  };

  useEffect(() => {
    if (!autoFocus) {
      return;
    }
    // On appearing, and again whenever the row is emptied — which is what
    // a wrong PIN does. `size` is deliberately not a dependency: it grows
    // as an unknown-length PIN is typed, and re-focusing the first box
    // mid-entry would throw the caret back to the start.
    if (value === "") {
      refs.current[0]?.focus();
      refs.current[0]?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, value === ""]);

  /** Writing one box, so the caller never sees a half-applied value. */
  const put = (i: number, digits: string) => {
    const chars = value.padEnd(size, " ").split("");
    for (let k = 0; k < digits.length && i + k < size; k++) {
      chars[i + k] = digits[k]!;
    }
    const next = chars.join("").replace(/ /g, "").slice(0, size);
    onChange(next);
    const landed = Math.min(i + digits.length, size - 1);
    refs.current[landed]?.focus();
    if (next.length === size) {
      onComplete?.(next);
    }
  };

  return (
    <div className={styles.pin}>
      {Array.from({ length: size }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          {...secret}
          className={`${styles.box} ${masked ? styles.masked : ""}`}
          disabled={disabled}
          // Not maxLength={1}: a password manager or an autofilled SMS
          // code arrives as the whole PIN in the first box, and capping
          // the field throws away everything after the first digit.
          aria-label={formatMessage(
            { id: "pin.digit", defaultMessage: "PIN digit {n} of {total}" },
            { n: i + 1, total: size },
          )}
          value={value[i] ?? ""}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            if (digits === "") {
              put(i, "");
              return;
            }
            // One box holds one digit, so a two-character value means the
            // person typed over an existing one: take the new character.
            put(
              i,
              digits.length > 1 && value[i] != null ? digits.slice(-1) : digits,
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && (value[i] ?? "") === "") {
              e.preventDefault();
              const chars = value.split("");
              chars[i - 1] = "";
              onChange(chars.join("").replace(/\s/g, ""));
              refs.current[i - 1]?.focus();
            }
            if (e.key === "ArrowLeft") {
              refs.current[i - 1]?.focus();
            }
            if (e.key === "ArrowRight") {
              refs.current[i + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            // Pasting the whole PIN is how anyone with it written down
            // enters it; without this it lands entirely in one box.
            e.preventDefault();
            put(i, e.clipboardData.getData("text").replace(/\D/g, ""));
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
