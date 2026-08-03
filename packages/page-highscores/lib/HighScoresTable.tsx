import { useIntlNumbers } from "@keylearn/intl";
import { useFormattedNames } from "@keylearn/keyboard";
import { Pages, UserName } from "@keylearn/pages-shared";
import { SpeedUnit } from "@keylearn/result";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./HighScoresTable.module.less";
import { type Entry, type Standing } from "./types.ts";

export type Unit = "wpm" | "cpm";

/**
 * One board: the top twenty, then the viewer's own position beneath a divider.
 *
 * Every column takes a fixed width from one shared definition, because each row
 * is its own grid — leave the tracks to size themselves and a long language name
 * or a three-digit speed pushes that row's columns out of line with its
 * neighbours.
 */
export function HighScoresTable({
  entries,
  you,
  unit,
  onUnitChange,
}: {
  readonly entries: readonly Entry[];
  readonly you: Standing | null;
  readonly unit: Unit;
  readonly onUnitChange: (unit: Unit) => void;
}): ReactNode {
  return (
    <div className={styles.board}>
      <div className={styles.head}>
        <span className={styles.hPos}>#</span>
        <span>
          <FormattedMessage id="highScores.learner" defaultMessage="Learner" />
        </span>
        <span className={styles.hLang}>
          <FormattedMessage
            id="highScores.language"
            defaultMessage="Language"
          />
        </span>
        <UnitToggle unit={unit} onChange={onUnitChange} />
        <span className={styles.hScore}>
          <FormattedMessage id="t_Score" defaultMessage="Score" />
        </span>
      </div>

      {entries.map((entry, index) => (
        <Row key={index} entry={entry} position={index + 1} unit={unit} />
      ))}

      {you != null && (
        <div className={styles.youBlock}>
          <div className={styles.sect}>
            <FormattedMessage
              id="highScores.yourPosition"
              defaultMessage="Your position"
            />
          </div>
          <Row entry={you.entry} position={you.rank} unit={unit} mine={true} />
          {you.gapToTop > 0 && (
            <p className={styles.gap}>
              <FormattedMessage
                id="highScores.gapToTop"
                defaultMessage="{gap} from the top 20"
                values={{ gap: <Speed value={you.gapToTop} unit={unit} /> }}
              />
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  entry,
  position,
  unit,
  mine = false,
}: {
  readonly entry: Entry;
  readonly position: number;
  readonly unit: Unit;
  readonly mine?: boolean;
}): ReactNode {
  const { formatNumber } = useIntlNumbers();
  const { formatLanguageName } = useFormattedNames();
  const { user, layout, speed, score } = entry;
  return (
    <div className={mine ? styles.mine : styles.row}>
      <span className={styles.pos}>{position}</span>
      <span className={styles.who}>
        <UserName user={user} path={Pages.profileOf(user)} />
      </span>
      <span className={styles.lang}>{formatLanguageName(layout.language)}</span>
      <span className={styles.speed}>
        <Speed value={speed} unit={unit} />
      </span>
      <span className={styles.score}>{formatNumber(score, 0)}</span>
    </div>
  );
}

function Speed({
  value,
  unit,
}: {
  readonly value: number;
  readonly unit: Unit;
}): ReactNode {
  const { formatNumber } = useIntlNumbers();
  const { WPM, CPM } = SpeedUnit;
  const measured = unit === "cpm" ? CPM.measure(value) : WPM.measure(value);
  return `${formatNumber(measured, 0)} ${unit}`;
}

/**
 * The speed heading IS the unit control — label and switch are one object, so
 * the column says both what it is and how to change it.
 */
function UnitToggle({
  unit,
  onChange,
}: {
  readonly unit: Unit;
  readonly onChange: (unit: Unit) => void;
}): ReactNode {
  return (
    <span className={styles.unit} role="group">
      {(["wpm", "cpm"] as const).map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={unit === u}
          onClick={() => onChange(u)}
        >
          {u.toUpperCase()}
        </button>
      ))}
    </span>
  );
}
