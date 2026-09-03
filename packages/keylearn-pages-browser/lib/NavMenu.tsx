import { useProfiles } from "@keylearn/page-account";
import {
  type PageInfo,
  Pages,
  usePageData,
  usePageLive,
} from "@keylearn/pages-shared";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import { useIntl } from "react-intl";
import { NavLink } from "react-router";
import { StrokeIcon, type StrokeIconName } from "./icons/index.ts";
import * as styles from "./NavMenu.module.less";

const pageIcons: Record<string, StrokeIconName> = {
  [Pages.practice.path]: "keyboard",
  [Pages.kids.path]: "keyboard",
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
  const { leaderboard } = usePageData();
  // Control-centre page states: a switched-off page gets no link.
  const live = usePageLive();
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

  if (active?.kind === "kid") {
    // A kid practises on the kids page and nowhere else — the adult drills
    // are guarded off anyway, so listing them here would only offer links
    // that bounce. Progress and help still belong to everyone.
    return (
      <div className={styles.root}>
        <MenuItemLink page={Pages.kids} onNavigate={onNavigate} />
        <MenuItemLink page={Pages.profile} onNavigate={onNavigate} />
        <MenuItemLink page={Pages.help} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <MenuItemLink page={Pages.practice} onNavigate={onNavigate} />

      <MenuItemLink page={Pages.profile} onNavigate={onNavigate} />

      {live("typingTest") && (
        <MenuItemLink page={Pages.typingTest} onNavigate={onNavigate} />
      )}

      {/* Off until live practice is finished: a link into a half-built room is
          worse than no link. */}
      {live("multiplayer") && (
        <MenuItemLink page={Pages.multiplayer} onNavigate={onNavigate} />
      )}

      {live("layouts") && (
        <MenuItemLink page={Pages.layouts} onNavigate={onNavigate} />
      )}

      {live("texts") && (
        <MenuItemLink page={Pages.texts} onNavigate={onNavigate} />
      )}

      {/* Only for a learner who has said they need it. Braille entry is a
          specialised mode, and putting it in everyone's list would bury the
          things they actually came for. */}
      {visionSupport && live("braille") && (
        <MenuItemLink page={Pages.braille} onNavigate={onNavigate} />
      )}

      {/* Only once there is a community to rank. Until then the link would lead
          to a board that says "not yet", which is worse than no link. */}
      {leaderboard && live("highScores") && (
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
