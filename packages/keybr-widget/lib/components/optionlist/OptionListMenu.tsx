import { clsx } from "clsx";
import {
  Fragment,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ensureVisible } from "../../utils/index.ts";
import * as iconStyles from "../icon/Icon.module.less";
import { Portal, PortalContainer } from "../portal/index.ts";
import { type OptionListOption } from "./OptionList.types.ts";
import * as styles from "./OptionListMenu.module.less";

export function OptionListMenu({
  anchor,
  options,
  selectedOption,
  onSelect,
}: {
  /** The button this menu belongs to, used to place it. */
  readonly anchor: HTMLElement | null;
  readonly options: readonly OptionListOption[];
  readonly selectedOption: OptionListOption;
  readonly onSelect: (value: OptionListOption) => void;
}): ReactNode {
  const list = useRef<HTMLUListElement>(null);
  const item = useRef(null);
  // Portalled out of the button, so it has to be told where the button is and
  // how much room is left. Absolutely positioned inside a settings panel it
  // was painted under the controls below it and ran past the panel's edge; no
  // z-index fixes that, because the panel is its own stacking context.
  const [place, setPlace] = useState<Placement | null>(null);
  useLayoutEffect(() => {
    if (anchor == null) {
      return;
    }
    const measure = () => setPlace(placeBelow(anchor));
    measure();
    // Only scrolling that actually moves the button matters. The menu's own
    // scrolling must be ignored: re-measuring on it re-renders the list, and
    // the effect below would then drag the view back to the selected option
    // every time the learner tried to scroll away from it.
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && list.current?.contains(target)) {
        return;
      }
      measure();
    };
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor]);

  // Once, when the menu appears. Re-running it on every render would fight
  // the learner for control of the scrollbar.
  const settled = place != null;
  useEffect(() => {
    if (settled) {
      ensureVisible(list.current, item.current);
    }
  }, [settled]);
  if (place == null) {
    return null;
  }
  const menu = (
    <ul
      ref={list}
      role="menu"
      className={styles.root}
      // Portalled, the menu is no longer inside the button, so pressing on it
      // would blur the button and unmount the menu before the click could
      // land. Refusing the focus change keeps the button focused and the
      // menu alive long enough to be clicked.
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      style={{
        insetInlineStart: place.left,
        insetBlockStart: place.top,
        inlineSize: place.width,
        maxBlockSize: place.maxHeight,
      }}
    >
      {options.map((option, index) => (
        <Fragment key={index}>
          {option.group != null &&
            option.group !== options[index - 1]?.group && (
              // presentation, not menuitem: a heading is not something the
              // arrow keys should be able to land on.
              <li role="presentation" className={styles.group}>
                {option.group}
              </li>
            )}
          <li
            ref={option === selectedOption ? item : null}
            role="menuitem"
            className={clsx(
              styles.item,
              iconStyles.altIcon,
              option === selectedOption && styles.item_selected,
            )}
            onClick={(event) => {
              event.preventDefault();
              onSelect(option);
            }}
          >
            {option.name}
          </li>
        </Fragment>
      ))}
    </ul>
  );
  // The portal needs a container on the page. Tests and any host that does not
  // render one still get a working menu, just without the escape from an
  // ancestor's stacking context.
  return hasPortal() ? <Portal>{menu}</Portal> : menu;
}

function hasPortal(): boolean {
  return (
    typeof document !== "undefined" &&
    document.getElementById(PortalContainer.id) != null
  );
}

type Placement = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly maxHeight: number;
};

/**
 * Below the button when there is room, above it when there is not, and never
 * taller than the space it has.
 */
function placeBelow(anchor: HTMLElement): Placement {
  const rect = anchor.getBoundingClientRect();
  const margin = 8;
  const below = window.innerHeight - rect.bottom - margin;
  const above = rect.top - margin;
  // Simply whichever side has more room. A control near the foot of a panel
  // has little space beneath it, and dropping down there means the learner
  // scrolls to see options that would have fitted above.
  const dropDown = below >= above;
  const maxHeight = Math.max(120, Math.min(320, dropDown ? below : above));
  return {
    left: rect.left,
    top: dropDown ? rect.bottom + 4 : rect.top - maxHeight - 4,
    width: rect.width,
    maxHeight,
  };
}
