/**
 * The canonical copy lives in `@keylearn/intl`, the lowest package both
 * the widget and this one depend on: kept here it made the widget depend
 * on pages-shared, which depends on the widget — a cycle that stopped
 * `lage` building anything. Re-exported by name so the server's import
 * from this package is unchanged.
 */
export {
  DATE_MARK,
  type DateMarkOptions,
  formatDateMark,
  hasDateMark,
  resolveDateMarks,
  splitDateMarks,
} from "@keylearn/intl";
