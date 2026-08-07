export * from "./ConfirmDialog.tsx";
/**
 * The dialog's own styles, re-exported.
 *
 * The security card builds two bespoke confirmations from this kit rather
 * than from the component, and they have to keep looking like every other
 * confirmation in the app. Exporting it beats reaching into this package's
 * file tree from outside, and beats a second copy that drifts.
 */
export * as confirmStyles from "./ConfirmDialog.module.less";
