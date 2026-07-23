import { hashCode, LCG } from "@keybr/rand";
import { type ClassName, type MouseProps } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import { palettes } from "./colors.ts";
import { initials } from "./util.ts";

const size = 100;

/**
 * A deterministic avatar generated from the user name: soft translucent
 * washes over a pastel ground, in palettes sampled from famous paintings,
 * with the user's initials inked on top.
 */
export function Identicon({
  className,
  name,
  ...props
}: {
  readonly className?: ClassName;
  readonly name: string;
} & MouseProps): ReactNode {
  const random = LCG(hashCode(name));
  const palette = palettes[(random() * palettes.length) | 0];
  const text = initials(name);
  const washes = [];
  for (let i = 0; i < 4; i++) {
    const cx = 15 + random() * 70;
    const cy = 15 + random() * 70;
    const rx = 22 + random() * 20;
    const ry = 16 + random() * 18;
    const angle = ((random() * 180) | 0) - 90;
    washes.push(
      <ellipse
        key={i}
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={palette.wash[i % palette.wash.length]}
        fillOpacity={0.5 + random() * 0.25}
        transform={`rotate(${angle} ${cx} ${cy})`}
      />,
    );
  }
  return (
    <svg {...props} className={clsx(className)} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill={palette.ground} />
      {washes}
      <circle cx={50} cy={50} r={38} fill={palette.ground} opacity={0.55} />
      <text
        x={50}
        y={50}
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={text.length === 1 ? 72 : text.length === 2 ? 52 : 36}
        fontFamily="Georgia, 'Times New Roman', serif"
        fill={palette.ink}
      >
        {text}
      </text>
    </svg>
  );
}
