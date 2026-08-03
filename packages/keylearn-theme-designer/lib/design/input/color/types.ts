import { type Color } from "@keylearn/color";

export type ColorEditorProps = {
  readonly color: Color;
  readonly onChange: (color: Color) => void;
};

export type SliderValue = {
  x: number;
  y: number;
};
