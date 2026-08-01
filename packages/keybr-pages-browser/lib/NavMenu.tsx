import { useProfiles } from "@keybr/page-account";
import { type PageInfo, Pages, usePageData } from "@keybr/pages-shared";
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
  [Pages.layouts.path]: "grid",
  [Pages.texts.path]: "book",
  [Pages.braille.path]: "braille",
  [Pages.highScores.path]: "trophy",
  [Pages.help.path]: "help",
};

export function NavMenu({
  onNavigate,
}: {
  readonly currentPath?: string;
  readonly onNavigate?: () => void;
}) {
  const { leaderboard } = usePageData();
  const { active } = useProfiles();
  const visionSupport = active?.visionSupport === true;
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
        <MenuItemLink page={Pages.layouts} onNavigate={onNavigate} />
      </MenuItem>

      <MenuItem>
        <MenuItemLink page={Pages.texts} onNavigate={onNavigate} />
      </MenuItem>

      {/* Only for a learner who has said they need it. Braille entry is a
          specialised mode, and putting it in everyone's list would bury the
          things they actually came for. */}
      {visionSupport && (
        <MenuItem>
          <MenuItemLink page={Pages.braille} onNavigate={onNavigate} />
        </MenuItem>
      )}

      {/* Only once there is a community to rank. Until then the link would lead
          to a board that says "not yet", which is worse than no link. */}
      {leaderboard && (
        <MenuItem>
          <MenuItemLink page={Pages.highScores} onNavigate={onNavigate} />
        </MenuItem>
      )}

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
