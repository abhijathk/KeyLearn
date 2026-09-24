import { useFormatter } from "@keylearn/lesson-ui";
import { type Result } from "@keylearn/result";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useKidsPractice } from "./kids-flavour.ts";
import {
  IconBolt,
  IconStar,
  IconTarget,
  KidsTile,
  KidsWindow,
  kidsWindowStyles as kw,
} from "./KidsWindow.tsx";
import * as styles from "./UnlockCeremony.module.less";

/**
 * The unlock ceremony: shown when the engine introduces a new key. The
 * emotional peak of the practice loop — a glowing key tile, the lesson's
 * numbers, and a nudge to keep going while the momentum is there.
 */
export function UnlockCeremony({
  label,
  result,
  prev,
  unlocked = null,
  total = null,
  nextLabel = null,
  onContinue,
  onClose,
}: {
  readonly label: string;
  readonly result: Result;
  readonly prev: Result | null;
  /** Keys in play now, the new one included. Kids window only. */
  readonly unlocked?: number | null;
  /** Keys in the whole lesson alphabet. Kids window only. */
  readonly total?: number | null;
  /** The next key still to earn, if any. Kids window only. */
  readonly nextLabel?: string | null;
  readonly onContinue: () => void;
  readonly onClose: () => void;
}): ReactNode {
  const kids = useKidsPractice();
  const { formatSpeed } = useFormatter();
  if (kids) {
    return (
      <KidsUnlock
        label={label}
        result={result}
        unlocked={unlocked}
        total={total}
        nextLabel={nextLabel}
        onContinue={onContinue}
        onClose={onClose}
      />
    );
  }
  const accuracy = (v: Result) => v.accuracy * 100;
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>
          <FormattedMessage
            id="ceremony.lessonComplete"
            defaultMessage="Lesson done"
          />
        </div>
        <div className={styles.keyTile}>{label}</div>
        <div className={styles.title}>
          <FormattedMessage
            id="ceremony.title"
            defaultMessage="You’ve unlocked a new key!"
          />
        </div>
        <div className={styles.subtitle}>
          <FormattedMessage
            id="ceremony.subtitle"
            defaultMessage="{label} is now part of your set — everything you had reached the target speed"
            values={{ label: <b>{label}</b> }}
          />
        </div>
        <div className={styles.stats}>
          <Stat
            label={<FormattedMessage id="t_Speed" defaultMessage="Speed" />}
            value={formatSpeed(result.speed)}
            delta={prev != null ? result.speed - prev.speed : null}
            format={(v) => formatSpeed(Math.abs(v))}
          />
          <Stat
            label={
              <FormattedMessage id="t_Accuracy" defaultMessage="Accuracy" />
            }
            value={`${accuracy(result).toFixed(1)}%`}
            delta={prev != null ? accuracy(result) - accuracy(prev) : null}
            format={(v) => `${Math.abs(v).toFixed(1)}%`}
          />
          <Stat
            label={<FormattedMessage id="t_Score" defaultMessage="Score" />}
            value={String(Math.round(result.score))}
            delta={prev != null ? result.score - prev.score : null}
            format={(v) => String(Math.round(Math.abs(v)))}
          />
        </div>
        <button className={styles.cta} onClick={onContinue}>
          <FormattedMessage
            id="ceremony.keepGoing"
            defaultMessage="Onward — {label} is up next"
            values={{ label: <b>{label}</b> }}
          />
          <svg className={styles.arrow} viewBox="0 0 24 24">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <button className={styles.ghost} onClick={onClose}>
          <FormattedMessage
            id="ceremony.takeBreak"
            defaultMessage="Pause for now"
          />
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  delta,
  format,
}: {
  readonly label: ReactNode;
  readonly value: string;
  readonly delta: number | null;
  readonly format: (v: number) => string;
}): ReactNode {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statRow}>
        <span className={styles.statValue}>{value}</span>
        {delta != null && delta !== 0 && (
          <span className={delta > 0 ? styles.deltaUp : styles.deltaDown}>
            {delta > 0 ? "▲ " : "▼ "}
            {format(delta)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The kids Classic "Key unlocked" window: the new key as a glowing keycap on
 * a bright band, how far along the alphabet they are, the lesson's three
 * numbers and a big button onward.
 */
function KidsUnlock({
  label,
  result,
  unlocked,
  total,
  nextLabel,
  onContinue,
  onClose,
}: {
  readonly label: string;
  readonly result: Result;
  readonly unlocked: number | null;
  readonly total: number | null;
  readonly nextLabel: string | null;
  readonly onContinue: () => void;
  readonly onClose: () => void;
}): ReactNode {
  const { formatSpeed, speedUnit } = useFormatter();
  const { formatNumber } = useIntl();
  const upper = label.toUpperCase();
  return (
    <KidsWindow
      tone="unlock"
      width={26.25}
      headHeight={168}
      head={
        <div className={kw.headBody}>
          <span className={`${kw.pill} ${kw.pillOnHead}`}>
            <FormattedMessage
              id="kidsWindow.unlock.pill"
              defaultMessage="Key unlocked"
            />
          </span>
          <span className={kw.keycap} aria-hidden="true">
            {label}
          </span>
        </div>
      }
    >
      <div className={`${kw.body} ${kw.bodyCentered}`}>
        <div className={kw.heading}>
          <h2 className={kw.title}>
            <FormattedMessage
              id="kidsWindow.unlock.title"
              defaultMessage="{label} is yours."
              values={{ label: upper }}
            />
          </h2>
          <p className={kw.lead}>
            <FormattedMessage
              id="kidsWindow.unlock.lead"
              defaultMessage="Every key hit your target speed, so you earned the next one."
            />
          </p>
        </div>
        {unlocked != null && total != null && total > 0 && (
          <div className={kw.section}>
            <div className={kw.meterHead}>
              <span className={kw.caption}>
                <FormattedMessage
                  id="report.sheet.stat.keys"
                  defaultMessage="keys unlocked"
                />
              </span>
              <span className={kw.meterCount}>
                {formatNumber(unlocked)}{" "}
                <span className={kw.meterTotal}>/ {formatNumber(total)}</span>
              </span>
            </div>
            <div
              className={kw.meter}
              role="meter"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={unlocked}
            >
              {Array.from({ length: total }, (_, i) => (
                <span
                  key={i}
                  className={kw.seg}
                  data-state={
                    i < unlocked - 1 ? "on" : i === unlocked - 1 ? "new" : "off"
                  }
                />
              ))}
            </div>
          </div>
        )}
        <div className={kw.tiles}>
          <KidsTile
            tint="blue"
            icon={<IconBolt />}
            label={<FormattedMessage id="t_Speed" defaultMessage="Speed" />}
            value={formatSpeed(result.speed, { unit: false })}
            unit={speedUnit.id}
          />
          <KidsTile
            tint="green"
            icon={<IconTarget />}
            label={
              <FormattedMessage id="t_Accuracy" defaultMessage="Accuracy" />
            }
            value={formatNumber(Math.round(result.accuracy * 100))}
            unit="%"
          />
          <KidsTile
            tint="orange"
            icon={<IconStar />}
            label={<FormattedMessage id="t_Score" defaultMessage="Score" />}
            value={formatNumber(Math.round(result.score))}
          />
        </div>
        <div className={kw.actions}>
          <button type="button" className={kw.primary} onClick={onContinue}>
            {nextLabel != null ? (
              <FormattedMessage
                id="kidsWindow.unlock.continue"
                defaultMessage="Continue · next key: {label}"
                values={{ label: nextLabel.toUpperCase() }}
              />
            ) : (
              <FormattedMessage id="t_Next" defaultMessage="Continue" />
            )}
          </button>
          <button type="button" className={kw.text} onClick={onClose}>
            <FormattedMessage
              id="kidsWindow.unlock.break"
              defaultMessage="Take a break"
            />
          </button>
        </div>
      </div>
    </KidsWindow>
  );
}
