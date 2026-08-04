import { useProfiles } from "@keylearn/page-account";
import { type PageInfo, Pages, usePageData } from "@keylearn/pages-shared";
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
  [Pages.multiplayer.path]: "people",
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
  const { leaderboard, multiplayer } = usePageData();
  const { active } = useProfiles();
  const visionSupport = active?.visionSupport === true;
  if (visionSupport) {
    // Everything else on this list is a sighted surface — charts, layouts,
    // leaderboards. Offering them to somebody who came to practise braille
    // buries the one page that is for them.
    return (
      <div className={styles.root}>
        <MenuItemLink page={Pages.braille} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <MenuItemLink page={Pages.practice} onNavigate={onNavigate} />

      <MenuItemLink page={Pages.profile} onNavigate={onNavigate} />

      <MenuItemLink page={Pages.typingTest} onNavigate={onNavigate} />

      {/* Off until live practice is finished: a link into a half-built room is
          worse than no link. */}
      {multiplayer && (
        <MenuItemLink page={Pages.multiplayer} onNavigate={onNavigate} />
      )}

      <MenuItemLink page={Pages.layouts} onNavigate={onNavigate} />

      <MenuItemLink page={Pages.texts} onNavigate={onNavigate} />

      {/* Only for a learner who has said they need it. Braille entry is a
          specialised mode, and putting it in everyone's list would bury the
          things they actually came for. */}
      {visionSupport && (
        <MenuItemLink page={Pages.braille} onNavigate={onNavigate} />
      )}

      {/* Only once there is a community to rank. Until then the link would lead
          to a board that says "not yet", which is worse than no link. */}
      {leaderboard && (
        <MenuItemLink page={Pages.highScores} onNavigate={onNavigate} />
      )}

      <MenuItemLink page={Pages.help} onNavigate={onNavigate} />
    </div>
  );
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
