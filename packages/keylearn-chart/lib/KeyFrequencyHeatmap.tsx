import { type Keyboard } from "@keylearn/keyboard";
import {
  flatten,
  HeatmapLayer,
  KeyLayer,
  VirtualKeyboard,
} from "@keylearn/keyboard-ui";
import { type KeyStatsMap } from "@keylearn/result";
import { type ReactNode } from "react";
import { keyUsage } from "./keyusage.ts";

export function KeyFrequencyHeatmap({
  keyStatsMap,
  keyboard,
}: {
  readonly keyStatsMap: KeyStatsMap;
  readonly keyboard: Keyboard;
}): ReactNode {
  const { hit, miss } = keyUsage(keyStatsMap);
  return (
    <VirtualKeyboard keyboard={keyboard}>
      <KeyLayer />
      <HeatmapLayer histogram={flatten(miss)} modifier="m" />
      <HeatmapLayer histogram={flatten(hit)} modifier="h" />
    </VirtualKeyboard>
  );
}
