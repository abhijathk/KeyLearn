export const themeExt = ".keylearn-theme";
export const themeFileName = `custom-theme${themeExt}`;
// Accept newly-exported themes as well as any older ".keybr-theme" files — the
// upstream extension, which somebody arriving from keybr may still have on
// disk. Nothing writes it any more; it is only ever read.
export const themeAccept = `${themeExt},.keybr-theme`;
