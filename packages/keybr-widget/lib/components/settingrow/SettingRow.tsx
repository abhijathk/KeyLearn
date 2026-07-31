import { clsx } from "clsx";
import { type ReactNode, useId, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./SettingRow.module.less";

/**
 * A captioned group of settings, matching the account page's cards.
 */
export function SettingsCard({
  caption,
  children,
}: {
  readonly caption?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.card}>
      {caption != null && <div className={styles.caption}>{caption}</div>}
      {children}
    </div>
  );
}

/**
 * One setting: what it is, what it does, and its control.
 *
 * `description` is deliberately not optional in spirit — a row without one is
 * the thing this redesign exists to remove — but a handful of controls (a
 * lesson-source picker whose options describe themselves) genuinely need none.
 */
export function SettingRow({
  label,
  description,
  value,
  children,
}: {
  readonly label: ReactNode;
  readonly description?: ReactNode;
  /** A readout that trails the control, e.g. a slider's current value. */
  readonly value?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <div className={styles.label}>{label}</div>
        {description != null && (
          <div className={styles.description}>{description}</div>
        )}
      </div>
      <div className={styles.control}>
        {children}
        {value != null && <span className={styles.value}>{value}</span>}
      </div>
    </div>
  );
}

/** The hairline between two rows in the same card. */
export function RowSeparator(): ReactNode {
  return <div className={styles.hr} />;
}

/**
 * Settings that most people never change, folded behind one line.
 *
 * `changed` is the count of settings inside that are no longer at their
 * default. Folding without it would let someone forget a setting they had
 * deliberately turned on — the badge is what makes hiding these safe.
 */
export function Disclosure({
  label,
  changed = 0,
  summary,
  children,
}: {
  readonly label: ReactNode;
  readonly changed?: number;
  /** What is inside, shown while collapsed and nothing has been changed. */
  readonly summary?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  // Anything already changed is opened on arrival, so a non-default setting is
  // never one click further away than the person left it.
  const [open, setOpen] = useState(changed > 0);
  const id = useId();
  return (
    <>
      <button
        type="button"
        className={styles.disclosure}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <svg
          className={clsx(styles.chevron, open && styles.chevronOpen)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          aria-hidden={true}
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
        <span>{label}</span>
        <span
          className={clsx(styles.summary, changed > 0 && styles.summaryChanged)}
        >
          {changed > 0 ? (
            <FormattedMessage
              id="settings.disclosure.changed"
              defaultMessage="{count, plural, one {# changed} other {# changed}}"
              values={{ count: changed }}
            />
          ) : (
            summary
          )}
        </span>
      </button>
      {open && (
        <div id={id} className={styles.folded}>
          {children}
        </div>
      )}
    </>
  );
}

/**
 * An exclusive choice laid out as tiles rather than tabs.
 *
 * Tabs imply "the same thing, filtered". These options are different modes of
 * practice with real consequences, and each needs a sentence to distinguish it
 * — which a row of pills has nowhere to put.
 */
export function SettingTiles<T extends string | number>({
  value,
  onChange,
  options,
}: {
  readonly value: T;
  readonly onChange: (id: T) => void;
  readonly options: readonly {
    id: T;
    label: ReactNode;
    description?: ReactNode;
  }[];
}): ReactNode {
  return (
    <div className={styles.tiles} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={clsx(styles.tile, value === o.id && styles.tileOn)}
          onClick={() => {
            onChange(o.id);
          }}
        >
          <span className={styles.tileName}>{o.label}</span>
          {o.description != null && (
            <span className={styles.tileDesc}>{o.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}
