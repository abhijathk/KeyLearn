import { Icon, IconButton } from "@keybr/widget";
import { mdiMenu } from "@mdi/js";
import { type ReactNode } from "react";
import { defineMessage, useIntl } from "react-intl";
import { NavLink } from "react-router";
import { AccountMenu } from "./AccountMenu.tsx";
import * as styles from "./Header.module.less";
import { ThemeSwitcher } from "./themes/ThemeSwitcher.tsx";

export function Header({
  onOpenMenu,
}: {
  readonly onOpenMenu: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <header className={styles.header}>
      <NavLink to="/" className={styles.wordmark}>
        <span className={styles.mark}>Key</span>
        <span className={styles.markAlt}>Learn</span>
      </NavLink>
      <div className={styles.controls}>
        <ThemeSwitcher />
        <AccountMenu />
        <IconButton
          icon={<Icon shape={mdiMenu} />}
          title={formatMessage(
            defineMessage({
              id: "nav.openMenu",
              defaultMessage: "Open menu",
            }),
          )}
          onClick={onOpenMenu}
        />
      </div>
    </header>
  );
}
