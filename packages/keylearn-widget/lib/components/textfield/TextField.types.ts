import { type CSSProperties, type RefObject } from "react";
import { type SizeName } from "../../styles/index.ts";
import {
  type Focusable,
  type FocusProps,
  type KeyboardProps,
  type MouseProps,
  type Selectable,
} from "../types.ts";

export type TextFieldType =
  | "text"
  | "textarea"
  | "email"
  | "url"
  | "password"
  | "date"
  | "number";

export type TextFieldProps = {
  /**
   * The field's accessible name, for a field whose visible label is not a
   * <label> it could be tied to (the date-of-birth field's heading was read
   * out as nothing at all).
   */
  readonly "aria-label"?: string;
  readonly "autoComplete"?: string;
  readonly "autoFocus"?: boolean;
  readonly "error"?: string | null;
  readonly "maxLength"?: number;
  readonly "name"?: string;
  readonly "style"?: CSSProperties;
  readonly "placeholder"?: string;
  readonly "readOnly"?: boolean;
  readonly "ref"?: RefObject<TextFieldRef | null>;
  readonly "rows"?: number;
  readonly "size"?: SizeName;
  readonly "title"?: string;
  readonly "type"?: TextFieldType;
  readonly "value"?: string;
  readonly "onChange"?: (value: string) => void;
  readonly "onInput"?: (event: InputEvent) => void;
} & FocusProps &
  MouseProps &
  KeyboardProps;

export type TextFieldRef = Focusable & Selectable;
