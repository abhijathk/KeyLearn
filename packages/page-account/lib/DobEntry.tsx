import { TextField } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./AuthPage.module.less";

// COPPA: an account owner must be at least this old (whole years).
export const MIN_AGE = 13;

// Whole-years age from the current input, or null if not a usable value yet.
// Mirrors the server-side gate.
export function enteredAge(
  mode: "dob" | "age",
  dob: string,
  age: string,
): number | null {
  if (mode === "age") {
    const a = Math.floor(Number(age));
    return Number.isFinite(a) && a > 0 && a < 120 ? a : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return null;
  }
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date();
  let years = now.getFullYear() - y;
  const months = now.getMonth() + 1 - m;
  if (months < 0 || (months === 0 && now.getDate() < d)) {
    years -= 1;
  }
  return years >= 0 && years < 120 ? years : null;
}

// The ISO date to store: the exact DOB, or an approximate 1 Jan of the birth
// year when the user gave a plain age.
export function birthDateISO(
  mode: "dob" | "age",
  dob: string,
  age: string,
): string | null {
  if (mode === "age") {
    const a = enteredAge("age", dob, age);
    return a == null ? null : `${new Date().getFullYear() - a}-01-01`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null;
}

export type DobResult = {
  readonly dateOfBirth: string | null;
  readonly tooYoung: boolean;
};

// A date-of-birth entry that toggles to a plain age field, reporting the
// derived ISO date and whether the person is under 13. The caller decides what
// to render for the under-age case.
export function DobEntry({
  onResult,
}: {
  readonly onResult: (result: DobResult) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [mode, setMode] = useState<"dob" | "age">("dob");
  const [dob, setDob] = useState("");
  const [age, setAge] = useState("");

  const years = enteredAge(mode, dob, age);
  const tooYoung = years != null && years < MIN_AGE;
  const dateOfBirth = birthDateISO(mode, dob, age);

  useEffect(() => {
    onResult({ dateOfBirth, tooYoung });
  }, [dateOfBirth, tooYoung, onResult]);

  return (
    <div className={styles.dobField}>
      <div className={styles.fieldLab}>
        {mode === "dob"
          ? formatMessage({
              id: "auth.dob.label",
              defaultMessage: "Your date of birth",
            })
          : formatMessage({ id: "auth.age.label", defaultMessage: "Your age" })}
      </div>
      {mode === "dob" ? (
        <TextField
          size="full"
          type="date"
          autoComplete="bday"
          value={dob}
          onChange={setDob}
        />
      ) : (
        <TextField
          size="full"
          type="number"
          placeholder={formatMessage({
            id: "auth.age.placeholder",
            defaultMessage: "e.g. 34",
          })}
          value={age}
          onChange={setAge}
        />
      )}
      <button
        type="button"
        className={styles.link}
        onClick={() => {
          setMode((m) => (m === "dob" ? "age" : "dob"));
        }}
      >
        {mode === "dob" ? (
          <FormattedMessage
            id="auth.dob.useAge"
            defaultMessage="Enter age instead"
          />
        ) : (
          <FormattedMessage
            id="auth.dob.useDob"
            defaultMessage="Enter date of birth instead"
          />
        )}
      </button>
    </div>
  );
}

// The shared "get a grown-up" notice shown when the entered age is under 13.
export function GrownUpGate(): ReactNode {
  return (
    <div className={styles.gate}>
      <div className={styles.gateTitle}>
        <FormattedMessage
          id="auth.under13.title"
          defaultMessage="You need a grown-up"
        />
      </div>
      <p className={styles.gateText}>
        <FormattedMessage
          id="auth.under13.text"
          defaultMessage="Ask a parent or guardian to create the account — then they can add you as a learner."
        />
      </p>
    </div>
  );
}
