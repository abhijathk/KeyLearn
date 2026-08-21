/**
 * The canonical copy lives in `@keylearn/pages-shared`: the mailer
 * resolves these markers server-side, and a browser widget is the wrong
 * package for something the server depends on. Re-exported by name — a
 * wildcard would republish that whole package through this one.
 */
export {
  DATE_MARK,
  type DateMarkOptions,
  formatDateMark,
  hasDateMark,
  resolveDateMarks,
  splitDateMarks,
} from "@keylearn/pages-shared";
