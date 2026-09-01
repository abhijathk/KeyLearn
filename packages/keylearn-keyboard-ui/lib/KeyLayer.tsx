import {
  type Keyboard,
  type KeyId,
  type KeyShape,
  useKeyboard,
} from "@keylearn/keyboard";
import { useSettings } from "@keylearn/settings";
import {
  cloneElement,
  type ComponentType,
  memo,
  type ReactElement,
  useMemo,
  useRef,
} from "react";
import { type KeyProps, makeKeyComponent } from "./Key.tsx";
import { useSkin } from "./lighting.ts";
import { Surface } from "./shapes.tsx";
import { makeSkinnedKeyComponent } from "./SkinnedKey.tsx";
import { type Skin } from "./skins.ts";

export const KeyLayer = memo(function KeyLayer({
  depressedKeys = [],
  toggledKeys = [],
  showColors = false,
  cuedKey = null,
  cuedRing = false,
  onKeyHoverIn,
  onKeyHoverOut,
  onKeyClick,
}: {
  readonly depressedKeys?: readonly KeyId[];
  readonly toggledKeys?: readonly KeyId[];
  readonly showColors?: boolean;
  /** The key the learner should press next, if any. */
  readonly cuedKey?: KeyId | null;
  /** Ring the cued key, for a board with no light to carry the cue. */
  readonly cuedRing?: boolean;
  readonly onKeyHoverIn?: (key: KeyId, elem: Element) => void;
  readonly onKeyHoverOut?: (key: KeyId, elem: Element) => void;
  readonly onKeyClick?: (key: KeyId, elem: Element) => void;
}) {
  const keyboard = useKeyboard();
  const svgRef = useRef<SVGSVGElement>(null);
  // Which keyset draws the caps. Threaded into the memo key so switching
  // style rebuilds the components — they are built once per key and cached,
  // so a stale cache would leave the old board on screen.
  const { settings } = useSettings();
  const skin = useSkin(settings);
  const children = useMemo(
    () => getKeyElements(keyboard, skin),
    [keyboard, skin],
  );
  return (
    <Surface
      ref={svgRef}
      onMouseOver={(event) => {
        relayEvent(svgRef.current!, event, onKeyHoverIn);
      }}
      onMouseOut={(event) => {
        relayEvent(svgRef.current!, event, onKeyHoverOut);
      }}
      onClick={(event) => {
        relayEvent(svgRef.current!, event, onKeyClick);
      }}
    >
      {children.map((child) =>
        child.select(
          depressedKeys,
          toggledKeys,
          showColors,
          cuedKey ?? null,
          cuedRing,
        ),
      )}
    </Surface>
  );
});

function relayEvent(
  root: Element,
  { target }: { readonly target: any },
  handler?: (key: KeyId, elem: Element) => void,
) {
  while (
    handler != null &&
    target instanceof Element &&
    root.contains(target)
  ) {
    const key = (target as SVGElement).dataset["key"];
    if (key) {
      handler(key, target);
      return;
    }
    target = target.parentElement;
  }
}

function getKeyElements(
  keyboard: Keyboard,
  skin: Skin | null,
): MemoizedKeyElements[] {
  return [...keyboard.shapes.values()].map(
    (shape) => new MemoizedKeyElements(keyboard, shape, skin),
  );
}

class MemoizedKeyElements {
  readonly component: ComponentType<KeyProps>;
  readonly state0: ReactElement<KeyProps>;
  readonly state1: ReactElement<KeyProps>;
  readonly state2: ReactElement<KeyProps>;
  readonly state3: ReactElement<KeyProps>;
  readonly state4: ReactElement<KeyProps>;
  readonly state5: ReactElement<KeyProps>;
  readonly state6: ReactElement<KeyProps>;
  readonly state7: ReactElement<KeyProps>;

  constructor(
    readonly keyboard: Keyboard,
    readonly shape: KeyShape,
    skin: Skin | null,
  ) {
    const Component =
      skin != null
        ? makeSkinnedKeyComponent(keyboard.layout.language, shape, skin)
        : makeKeyComponent(keyboard.layout.language, shape);
    this.component = Component;
    this.state0 = (
      <Component
        key={shape.id}
        depressed={false}
        toggled={false}
        showColors={false}
      />
    );
    this.state1 = (
      <Component
        key={shape.id}
        depressed={true}
        toggled={false}
        showColors={false}
      />
    );
    this.state2 = (
      <Component
        key={shape.id}
        depressed={false}
        toggled={true}
        showColors={false}
      />
    );
    this.state3 = (
      <Component
        key={shape.id}
        depressed={true}
        toggled={true}
        showColors={false}
      />
    );
    this.state4 = (
      <Component
        key={shape.id}
        depressed={false}
        toggled={false}
        showColors={true}
      />
    );
    this.state5 = (
      <Component
        key={shape.id}
        depressed={true}
        toggled={false}
        showColors={true}
      />
    );
    this.state6 = (
      <Component
        key={shape.id}
        depressed={false}
        toggled={true}
        showColors={true}
      />
    );
    this.state7 = (
      <Component
        key={shape.id}
        depressed={true}
        toggled={true}
        showColors={true}
      />
    );
  }

  select(
    depressedKeys: readonly KeyId[],
    toggledKeys: readonly KeyId[],
    showColors: boolean,
    cuedKey: KeyId | null = null,
    cuedRing = false,
  ): ReactElement<KeyProps> {
    const chosen = this.pick(depressedKeys, toggledKeys, showColors);
    // The next key wears the cue colour and breathes with the light. Cloning
    // keeps the eight memoised states intact — the cued key changes on every
    // keystroke, so baking it in would rebuild every key each time.
    return cuedKey != null && cuedKey === this.shape.id
      ? // No cast: KeyProps declares these now, so a component that stops
        // accepting them turns this into a type error instead of a DOM leak.
        cloneElement(chosen, { cued: true, cuedRing })
      : chosen;
  }

  private pick(
    depressedKeys: readonly KeyId[],
    toggledKeys: readonly KeyId[],
    showColors: boolean,
  ): ReactElement<KeyProps> {
    const { shape } = this;
    const depressed = depressedKeys.includes(shape.id);
    const toggled = toggledKeys.includes(shape.id);
    if (!showColors) {
      if (!toggled) {
        if (!depressed) {
          return this.state0;
        } else {
          return this.state1;
        }
      } else {
        if (!depressed) {
          return this.state2;
        } else {
          return this.state3;
        }
      }
    } else {
      if (!toggled) {
        if (!depressed) {
          return this.state4;
        } else {
          return this.state5;
        }
      } else {
        if (!depressed) {
          return this.state6;
        } else {
          return this.state7;
        }
      }
    }
  }
}
