import { type ReactNode } from "react";
import { type SizeName } from "../../styles/index.ts";
import { type FocusProps } from "../types.ts";

export type OptionListOption = {
  readonly value: string;
  readonly name: ReactNode;
  /**
   * Heading this option sits under. Options carrying the same group are drawn
   * beneath one heading, in the order they are given.
   *
   * A list of eighteen languages with no divisions is read by scanning all
   * eighteen. Grouped, it is read by finding the right heading and then
   * scanning four.
   */
  readonly group?: string;
};

export type OptionListProps = {
  readonly options: readonly OptionListOption[];
  readonly size?: SizeName;
  readonly title?: string;
  readonly value: string;
  readonly onSelect?: (value: string) => void;
} & FocusProps;
