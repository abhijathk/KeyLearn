/**
 * Keys the KeyLearn board draws nothing for.
 *
 * Shared rather than copied into each layer: the backlight iterates
 * `keyboard.shapes`, which still contains these, so a layer that does not know
 * about them lights empty slots — which showed up as glow either side of the
 * space bar where there are no caps at all.
 */
export const hiddenKey =
  /^(ControlLeft|ControlRight|AltLeft|AltRight|MetaLeft|MetaRight|OSLeft|OSRight|ContextMenu|Fn|FnLock|Lang[0-9]|Convert|NonConvert|KanaMode|IntlYen|IntlRo)$/;

export function isHiddenKey(id: string): boolean {
  return hiddenKey.test(id);
}
