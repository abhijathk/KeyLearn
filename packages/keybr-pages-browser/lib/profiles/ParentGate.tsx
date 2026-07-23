import { Button, Field, FieldList, TextField } from "@keybr/widget";
import { type ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./Profiles.module.less";

// A light "grown-ups only" gate for managing profiles — a two-number
// multiplication a young child can't casually solve. Not real security,
// just a speed bump, which is exactly what this needs to be.
export function ParentGate({
  a,
  b,
  onPass,
  onCancel,
}: {
  readonly a: number;
  readonly b: number;
  readonly onPass: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);

  const check = () => {
    if (Number(value) === a * b) {
      onPass();
    } else {
      setWrong(true);
    }
  };

  return (
    <div className={styles.gate}>
      <div className={styles.gateCard}>
        <h2 className={styles.gateTitle}>
          <FormattedMessage
            id="profiles.gate.title"
            defaultMessage="Grown-ups only"
          />
        </h2>
        <p className={styles.gateQ}>
          <FormattedMessage
            id="profiles.gate.question"
            defaultMessage="What is {a} × {b}?"
            values={{ a, b }}
          />
        </p>
        <FieldList>
          <Field>
            <TextField
              size={10}
              type="text"
              value={value}
              onChange={(v) => {
                setValue(v);
                setWrong(false);
              }}
            />
          </Field>
        </FieldList>
        {wrong && (
          <p className={styles.gateWrong}>
            <FormattedMessage
              id="profiles.gate.wrong"
              defaultMessage="Not quite — try again."
            />
          </p>
        )}
        <div className={styles.gateActions}>
          <Button
            size={16}
            label={formatMessage({ id: "t_Cancel", defaultMessage: "Cancel" })}
            onClick={onCancel}
          />
          <Button
            size={16}
            label={formatMessage({
              id: "profiles.gate.enter",
              defaultMessage: "Enter",
            })}
            onClick={check}
          />
        </div>
      </div>
    </div>
  );
}
