import { type LineList, type TextDisplaySettings } from "@keylearn/textinput";
import { type ReactNode } from "react";
import { TextLines, type TextLineSize } from "./TextLines.tsx";

export function StaticText({
  settings,
  lines,
  wrap,
  size,
  cursor = false,
  focus = true,
  lineNumbers = false,
}: {
  readonly settings?: TextDisplaySettings;
  readonly lines: LineList;
  readonly wrap?: boolean;
  readonly size?: TextLineSize;
  readonly cursor?: boolean;
  readonly focus?: boolean;
  readonly lineNumbers?: boolean;
}): ReactNode {
  return (
    <TextLines
      settings={settings}
      lines={lines}
      wrap={wrap}
      size={size}
      cursor={cursor}
      focus={focus}
      lineNumbers={lineNumbers}
    />
  );
}
