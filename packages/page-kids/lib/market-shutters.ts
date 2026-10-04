import type { Object3D } from "three";

export type MarketShutters = {
  readonly shopCount: number;
  setClosed(closed: boolean): void;
  setNight(isNight: boolean): void;
  setShopClosed(shop: number, closed: boolean): void;
}

/** Switch static shutter states instantly; never interpolate or run an animation. */
export function createMarketShutters(root: Object3D): MarketShutters | null {
  const pairs = new Map<number, Map<string, Object3D>>();
  root.traverse((node) => {
    const match = /^Market_Shop_(\d\d)_Shutters_(OPEN|CLOSED)$/.exec(node.name);
    if (!match) return;
    const id = Number(match[1]);
    let pair = pairs.get(id);
    if (!pair) {
      pair = new Map();
      pairs.set(id, pair);
    }
    pair.set(match[2]!.toLowerCase(), node);
  });
  if (!pairs.size) return null;
  if (
    pairs.size !== 7 ||
    [...pairs].some(
      ([id, p]) => id < 1 || id > 7 || !p.has("open") || !p.has("closed"),
    )
  ) {
    throw new Error("Market requires both shutter states for all 7 shops");
  }
  const states = new Map<number, boolean>();
  function setShopClosed(id: number, closed: boolean): void {
    const pair = pairs.get(id);
    if (typeof closed !== "boolean" || !pair) {
      throw new Error("Expected shop 1–7 and boolean closed");
    }
    if (states.get(id) === closed) return;
    for (const [state, node] of pair) {
      const shown = (state === "closed") === closed;
      node.visible = shown;
      node.scale.setScalar(shown ? 1 : 0);
      node.updateMatrix();
    }
    states.set(id, closed);
  }
  function setClosed(closed: boolean): void {
    if (typeof closed !== "boolean") throw new Error("Expected boolean closed");
    for (const id of pairs.keys()) setShopClosed(id, closed);
  }
  setClosed(false);
  return { shopCount: 7, setClosed, setNight: setClosed, setShopClosed };
}
