import { brailleCells } from "@keylearn/certificate";
import {
  CELL,
  cellInk,
  type Face,
  type Field,
  SHEETS,
} from "@keylearn/certificate";
import { type PrintedCertificate } from "@keylearn/certificate";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import sheetAdult from "./assets/sheet-adult.jpg";
import sheetChild from "./assets/sheet-child.jpg";
import sheetYoung from "./assets/sheet-young.jpg";
import * as styles from "./CertificateSheet.module.less";

const ART = {
  adult: sheetAdult,
  young: sheetYoung,
  child: sheetChild,
} as const;

/**
 * A certificate, at any size.
 *
 * Every position comes from `SHEETS` and every unit is relative — `cqw` against
 * the sheet's own container — so the same component is a thumbnail in a list, a
 * full sheet in a dialog, and the thing the exporters photograph. There is no
 * second layout for a bigger one.
 */
export function CertificateSheet({
  printed,
  className,
}: {
  readonly printed: PrintedCertificate;
  readonly className?: string;
}): ReactNode {
  const layout = SHEETS[printed.sheet];
  const braille = printed.kind === "braille";
  const name = braille ? layout.braille.name : layout.name;
  const language = braille ? layout.braille.language : layout.language;

  return (
    <div className={clsx(styles.sheet, className)}>
      <img className={styles.art} src={ART[printed.sheet]} alt="" />
      <span style={style(name)}>{printed.name}</span>
      {braille && (
        <BrailleLine
          text={printed.name}
          top={layout.braille.cells.top}
          left={layout.braille.cells.left}
          ink={cellInk(printed.sheet)}
        />
      )}
      <span style={style(language)}>{printed.languageLine}</span>
      {layout.fields.map((field, i) => (
        <span key={i} style={style(field)}>
          {printed.values[i] ?? ""}
        </span>
      ))}
    </div>
  );
}

const FACE: Readonly<Record<Face, string>> = {
  serif: `"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`,
  round: `"SF Pro Rounded",Nunito,system-ui,-apple-system,"Segoe UI",sans-serif`,
  mono: `ui-monospace,"SF Mono",Menlo,Consolas,monospace`,
};

/**
 * A field's box, in the sheet's own units.
 *
 * Written as inline style rather than as classes because there are three
 * sheets times two kinds times four fields, and a stylesheet holding every one
 * of those is a second copy of `SHEETS` that can disagree with the first.
 */
function style(field: Field): React.CSSProperties {
  const sized: React.CSSProperties =
    field.width > 0
      ? {
          left: `${field.left}%`,
          width: `${field.width}%`,
          textAlign: "center",
        }
      : // Shrink to fit: the grown-up sheet prints its labels to the left of
        // each rule, so those fields start where the label ends rather than
        // centring in a column.
        { left: `${field.left}%`, whiteSpace: "nowrap" };
  return {
    position: "absolute",
    top: `${field.top}%`,
    ...sized,
    fontFamily: FACE[field.face],
    fontWeight: field.face === "round" ? 800 : 400,
    fontSize: `${field.size}cqw`,
    letterSpacing: field.tracking === 0 ? undefined : `${field.tracking}em`,
    textTransform: field.upper ? "uppercase" : undefined,
    lineHeight: 1.05,
    color: field.colour,
  };
}

/**
 * The name again, in grade 1, at true embossing pitch for the printed width.
 *
 * A cell shows only its raised dots — drawing the flat positions makes it read
 * as a different letter — but an unraised dot keeps its slot in the grid, or
 * the dots that are there shift out of place.
 */
function BrailleLine({
  text,
  top,
  left,
  ink,
}: {
  readonly text: string;
  readonly top: number;
  readonly left: number;
  readonly ink: string;
}): ReactNode {
  return (
    <span
      className={styles.braille}
      style={{ top: `${top}%`, left: `${left}%`, right: `${left}%` }}
    >
      {brailleCells(text).map((dots, i) => (
        <span
          key={i}
          className={styles.cell}
          style={{
            gridTemplateColumns: `repeat(2,${CELL.dot}cqw)`,
            gridAutoRows: `${CELL.dot}cqw`,
            gap: `${CELL.gap}cqw`,
            marginInlineEnd: `${CELL.advance}cqw`,
          }}
        >
          {/* Reading order down the left column then down the right, which is
              how a cell is numbered. */}
          {[1, 4, 2, 5, 3, 6].map((dot) => (
            <i
              key={dot}
              style={{
                inlineSize: `${CELL.dot}cqw`,
                blockSize: `${CELL.dot}cqw`,
                background: ink,
                visibility: dots.includes(dot) ? undefined : "hidden",
              }}
            />
          ))}
        </span>
      ))}
    </span>
  );
}
