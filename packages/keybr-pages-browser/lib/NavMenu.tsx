import { type PageInfo, Pages } from "@keybr/pages-shared";
import { Icon } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import { useIntl } from "react-intl";
import { NavLink } from "react-router";
import * as styles from "./NavMenu.module.less";
import { SubMenu } from "./SubMenu.tsx";

export function NavMenu({
  currentPath,
  onNavigate,
}: {
  readonly currentPath: string;
  readonly onNavigate?: () => void;
}) {
  return (
    <div className={styles.root}>
      <MenuItem>
        <MenuItemLink page={Pages.practice} onNavigate={onNavigate} />
      </MenuItem>

      <MenuItem>
        <MenuItemLink page={Pages.profile} onNavigate={onNavigate} />
      </MenuItem>

      <MenuItem>
        <MenuItemLink page={Pages.typingTest} onNavigate={onNavigate} />
      </MenuItem>

      <MenuItem>
        <MenuItemLink page={Pages.highScores} onNavigate={onNavigate} />
      </MenuItem>

      <MenuItem>
        <MenuItemLink page={Pages.multiplayer} onNavigate={onNavigate} />
      </MenuItem>

      <MenuItem>
        <MenuItemLink page={Pages.layouts} onNavigate={onNavigate} />
      </MenuItem>

      <MenuItem>
        <MenuItemLink page={Pages.help} onNavigate={onNavigate} />
      </MenuItem>

      <MenuItem>
        <SubMenu currentPath={currentPath} />
      </MenuItem>
    </div>
  );
}

function MenuItem({ children }: { readonly children: ReactNode }) {
  return <div className={styles.item}>{children}</div>;
}

function MenuItemLink({
  page: {
    path,
    link: { label, title, icon },
  },
  onNavigate,
}: {
  readonly page: PageInfo;
  readonly onNavigate?: () => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <NavLink
      className={({ isActive }) =>
        clsx(styles.link, isActive && styles.isActive)
      }
      to={path}
      title={title && formatMessage(title)}
      onClick={onNavigate}
    >
      <Icon className={styles.icon} shape={icon ?? ""} />
      <span className={styles.label}>{formatMessage(label)}</span>
    </NavLink>
  );
}
