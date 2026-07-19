import { Icon, IconButton } from "@keybr/widget";
import { mdiClose } from "@mdi/js";
import { clsx } from "clsx";
import { type ReactNode, useEffect } from "react";
import { defineMessage, useIntl } from "react-intl";
import * as styles from "./MenuDrawer.module.less";
import { NavMenu } from "./NavMenu.tsx";

export function MenuDrawer({
  open,
  onClose,
  path,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly path: string;
}): ReactNode {
  const { formatMessage } = useIntl();
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);
  return (
    <>
      <div
        className={clsx(styles.scrim, open && styles.open)}
        onClick={onClose}
      />
      <aside
        className={clsx(styles.panel, open && styles.open)}
        aria-hidden={!open}
      >
        <div className={styles.head}>
          <span className={styles.title}>KeyLearn</span>
          <IconButton
            icon={<Icon shape={mdiClose} />}
            title={formatMessage(
              defineMessage({
                id: "nav.closeMenu",
                defaultMessage: "Close menu",
              }),
            )}
            onClick={onClose}
          />
        </div>
        {open && <NavMenu currentPath={path} onNavigate={onClose} />}
      </aside>
    </>
  );
}
