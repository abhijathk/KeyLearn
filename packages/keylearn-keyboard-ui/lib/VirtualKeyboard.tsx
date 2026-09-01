import {
  type Keyboard,
  KeyboardContext,
  keyboardProps,
  KeyboardStyle,
} from "@keylearn/keyboard";
import { useSettings } from "@keylearn/settings";
import { type ZoomableProps } from "@keylearn/widget";
import { type CSSProperties, memo, type ReactNode } from "react";
import { BacklightLayer } from "./BacklightLayer.tsx";
import { useBacklightOn, useDarkTheme, useSkin } from "./lighting.ts";
import { getFrameSize } from "./shapes.tsx";
import { SkinDefs } from "./SkinDefs.tsx";
import { ROUND_GLOW } from "./skins.ts";
import * as styles from "./VirtualKeyboard.module.less";

export const VirtualKeyboard = memo(function VirtualKeyboard({
  children,
  keyboard,
  width,
  height,
  moving,
  cuedKey = null,
  depressedKeys,
  ...props
}: {
  readonly children?: ReactNode;
  readonly keyboard: Keyboard;
  readonly width?: string;
  readonly height?: string;
  readonly moving?: boolean;
  /** Passed to the backlight so the cued key is tinted and the pressed one flares. */
  readonly cuedKey?: string | null;
  readonly depressedKeys?: readonly string[];
} & ZoomableProps): ReactNode {
  const { settings } = useSettings();
  const size = getFrameSize(keyboard);
  const style = settings.get(keyboardProps.style);
  const intensity = settings.get(keyboardProps.backlightIntensity);
  const dark = useDarkTheme();

  // Silver and Midnight Grey are two listed styles now, so the face is the
  // style rather than a reading of the theme.
  const face = style === KeyboardStyle.FLAT_SILVER ? "silver" : "midnight";
  const lit = useBacklightOn(settings);
  const skin = useSkin(settings);

  return (
    <svg
      {...props}
      className={styles.keyboard}
      viewBox={`0 0 ${size.width} ${size.height}`}
      style={
        {
          aspectRatio: `${size.width}/${size.height}`,
          // Where the resting hands lie on the board, they take their ink
          // from the BOARD rather than the page. A hand filled from
          // `--secondary` is near-black on a light page, which is invisible
          // on a dark keyset — and every dark keyset can be worn on a light
          // page. `skin.ink` is the colour that board already prints its
          // legends in, so it is guaranteed to read against those caps.
          // Off the board the page colour takes over again; ZonesLayer does
          // that hand-over. Unskinned boards leave this unset and the
          // stylesheet falls back to the page colour throughout, as before.
          ...(skin != null ? { "--hand-ink": skin.ink } : null),
        } as CSSProperties
      }
      width={width}
      height={height}
      data-kbd-style={style.id}
      data-kbd-face={style.lowProfile ? face : undefined}
      data-kbd-lit={lit ? "" : undefined}
    >
      {/* The KeyLearn board keeps its frame; the two new styles are keys on
          the page with no chassis behind them, as the boards they imitate are
          usually photographed. */}
      {style === KeyboardStyle.KEYLEARN && (
        <rect
          className={styles.frame}
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          rx={10}
          ry={10}
        />
      )}
      {/* Gradients and the grain filter the skinned caps reference. Without
          these every cap resolves its fill to nothing and the board renders
          blank, so they must be inside the same <svg> as the keys. */}
      {skin != null && <SkinDefs skin={skin} />}
      <KeyboardContext.Provider value={keyboard}>
        {lit && (
          <BacklightLayer
            keyboard={keyboard}
            intensity={intensity}
            /* Round gets the plain light, not Mechanical's per-key sweep: a
               backlight is an LED under the cap, the same light whatever
               colour the plastic above it is. */
            flat={style.lowProfile || style === KeyboardStyle.ROUND}
            warm={style === KeyboardStyle.ROUND ? ROUND_GLOW : undefined}
            round={style === KeyboardStyle.ROUND}
            cuedKey={cuedKey}
            depressedKeys={depressedKeys}
            cue={skin?.cue}
          />
        )}
        {children}
        {/* No grain overlay, and no backing panel — for the round board
            either. A board-sized rect of noise is a back plate however
            faintly it is drawn: it sits above the backlight layer and cuts
            the glow off at the board's edge, which is exactly what it looked
            like. The mock could afford one because its glow was drawn inside
            the same box; here the light spills past the keys on purpose.
            Cap texture comes from the gradients alone. */}
      </KeyboardContext.Provider>
    </svg>
  );
});
