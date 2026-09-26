/**
 * The canonical copy lives in `@keylearn/intl`: the mailer resolves these
 * markers server-side, and a browser widget is the wrong package for
 * something the server depends on. (It was in `@keylearn/pages-shared`,
 * but that package depends on this one, and the cycle broke the build.)
 * Re-exported by name — a wildcard would republish that whole package
 * through this one.
 */
export {
  DATE_MARK,
  type DateMarkOptions,
  formatDateMark,
  hasDateMark,
  resolveDateMarks,
  splitDateMarks,
} from "@keylearn/intl";
