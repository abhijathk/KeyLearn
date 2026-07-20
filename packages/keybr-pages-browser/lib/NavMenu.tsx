import { type PageInfo, Pages } from "@keybr/pages-shared";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import { useIntl } from "react-intl";
import { NavLink } from "react-router";
import { StrokeIcon, type StrokeIconName } from "./icons/index.ts";
import * as styles from "./NavMenu.module.less";

const pageIcons: Record<string, StrokeIconName> = {
  [Pages.practice.path]: "keyboard",
  [Pages.profile.path]: "chart",
  [Pages.typingTest.path]: "gauge",
  [Pages.highScores.path]: "crown",
  [Pages.layouts.path]: "grid",
  [Pages.help.path]: "help",
};

export function NavMenu({
  onNavigate,
}: {
  readonly currentPath?: string;
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
        <MenuItemLink page={Pages.layouts} onNavigate={onNavigate} />
      </MenuItem>

      <MenuItem>
        <MenuItemLink page={Pages.help} onNavigate={onNavigate} />
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
    link: { label, title },
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
      <StrokeIcon className={styles.icon} name={pageIcons[path] ?? "help"} />
      <span className={styles.label}>{formatMessage(label)}</span>
    </NavLink>
  );
}
