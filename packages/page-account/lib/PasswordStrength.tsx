import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";
import * as styles from "./PasswordStrength.module.less";

// Defined statically so the i18n extractor picks them up (a runtime-indexed
// object literal wouldn't be extracted, and would render as a raw hash).
const strengthLabels = defineMessages({
  weak: { id: "password.strength.weak", defaultMessage: "Weak" },
  fair: { id: "password.strength.fair", defaultMessage: "Fair" },
  good: { id: "password.strength.good", defaultMessage: "Good" },
  strong: { id: "password.strength.strong", defaultMessage: "Strong" },
});
const labelByScore = [
  strengthLabels.weak,
  strengthLabels.weak,
  strengthLabels.fair,
  strengthLabels.good,
  strengthLabels.strong,
];

// A quick, dependency-free strength heuristic: length plus character variety.
// Returns 0 (empty) … 4 (strong).
function scoreOf(pw: string): number {
  if (pw.length === 0) {
    return 0;
  }
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  if (pw.length < 8) {
    return Math.min(s, 1);
  }
  return Math.min(4, s);
}

// HaveIBeenPwned "range" API with k-anonymity: only the first 5 chars of the
// SHA-1 hash ever leave the browser; the full password never does. Returns the
// breach count, or 0 if clean / unavailable.
async function pwnedCount(pw: string, signal: AbortSignal): Promise<number> {
  const bytes = new TextEncoder().encode(pw);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  const prefix = hex.slice(0, 5);
  const suffix = hex.slice(5);
  const res = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix}`,
    { signal },
  );
  const text = await res.text();
  for (const line of text.split("\n")) {
    const [suf, count] = line.trim().split(":");
    if (suf === suffix) {
      return Number(count) || 0;
    }
  }
  return 0;
}

export function PasswordStrength({
  password,
}: {
  readonly password: string;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [pwned, setPwned] = useState<number | null>(null);

  // Debounced breach check; fails silently when offline / blocked so it never
  // gets in the way of signing up.
  useEffect(() => {
    setPwned(null);
    if (password.length < 8 || typeof crypto?.subtle === "undefined") {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      pwnedCount(password, controller.signal)
        .then((count) => setPwned(count))
        .catch(() => {
          // Offline or blocked — skip the check quietly.
        });
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [password]);

  if (password.length === 0) {
    return null;
  }

  const score = scoreOf(password);
  const label = labelByScore[score];

  return (
    <div className={styles.wrap}>
      <div className={styles.bar} aria-hidden={true}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={clsx(
              styles.seg,
              i < score && styles[`s${score}` as keyof typeof styles],
            )}
          />
        ))}
      </div>
      <div className={styles.row}>
        <span className={clsx(styles.label, styles[`t${score}` as keyof typeof styles])}>
          {formatMessage(label)}
        </span>
        {pwned != null && pwned > 0 && (
          <span className={styles.breach}>
            <FormattedMessage
              id="password.breached"
              defaultMessage="Found in {count, number} data breaches — choose another."
              values={{ count: pwned }}
            />
          </span>
        )}
        {pwned === 0 && password.length >= 8 && (
          <span className={styles.ok}>
            <FormattedMessage
              id="password.notBreached"
              defaultMessage="Not found in known breaches."
            />
          </span>
        )}
      </div>
    </div>
  );
}
