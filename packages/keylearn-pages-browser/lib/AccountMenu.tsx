import { artKindOf, ArtMotif } from "@keylearn/identicon";
import {
  accountProps,
  BrailleAvatar,
  useProfiles,
} from "@keylearn/page-account";
import {
  accessibilityActive,
  Avatar,
  logout,
  Pages,
  usePageData,
} from "@keylearn/pages-shared";
import { useSettings } from "@keylearn/settings";
import { ConfirmDialog, StrokeIcon } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { NavLink } from "react-router";
import * as styles from "./AccountMenu.module.less";

/**
 * The header identity chip — a passive indicator of who is practising.
 * With an active learner it shows their avatar and first name; otherwise just
 * the admin or anonymous avatar. Account, Log out and the learner switcher all
 * live in the menu drawer.
 *
 * The only badge left is a B for a learner on braille and audio. Kid and
 * grown-up carried K / G bubbles here, but the profile list now sorts them and
 * gives each their own colour chip, so repeating it in the header was noise on
 * every page. Vision support changes how the app behaves, not just who is
 * using it, so it stays visible.
 *
 * On the kids page the header speaks a different, playful visual language
 * (pastel rounded chips), so `kids` swaps in matching styles for both the
 * signed-out log-in chip and the signed-in identity.
 */
export function AccountMenu({
  kids = false,
}: {
  readonly kids?: boolean;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  const { active } = useProfiles();
  const { settings } = useSettings();
  const signedIn = publicUser.id != null;

  // Signed out: a shortcut to log in, drawn to match the other header control
  // chips exactly (same rounded square, same glyph size) — no oversized avatar.
  // On the kids page it takes the pastel kid-chip look instead.
  if (!signedIn) {
    return (
      <NavLink
        to={Pages.login.path}
        className={kids ? styles.kidsLoginChip : styles.loginChip}
        title={formatMessage(
          defineMessage({
            id: "t_Log_In",
            defaultMessage: "Log In",
          }),
        )}
      >
        <StrokeIcon name="user" />
      </NavLink>
    );
  }

  // Signed in, but the learner has asked not to be announced in the header.
  // Nothing is lost: this chip never was a control — Account, Log out and the
  // learner switcher all live in the menu drawer. Checked AFTER the signed-out
  // branch above so a visitor keeps their log-in shortcut either way.
  if (!settings.get(accountProps.showHeaderIdentity)) {
    return null;
  }

  /* Whether this learner takes the sideways chip. Computed once because both
     the contents and the surface around them depend on it: the chip only
     becomes a chip when there is a painting to fill one end of it. */
  const band =
    active?.avatar?.type === "art" &&
    !active.visionSupport &&
    !accessibilityActive(active.id);

  const identity =
    active != null ? (
      <>
        {/* The learner chip from the drawer, laid on its side: the painting
            fills one end of the chip and the name sits beside it, rather than
            a round avatar floating next to loose text. Same rule as the
            drawer — only plain generated art takes the band; a braille or
            accessibility learner keeps the round avatar, because their badge
            is pinned to a circular face. */}
        {band && active.avatar?.type === "art" ? (
          <span className={styles.faceStrip}>
            <ArtMotif
              className={styles.faceArt}
              family={active.avatar.family}
              seed={active.avatar.seed}
              kind={
                artKindOf(active.avatar.family) ??
                (active.kind === "kid" ? "kid" : "adult")
              }
              letter={
                active.avatar.letter === true
                  ? (active.firstName.trim()[0] ?? null)
                  : null
              }
              letterSize={30}
            />
          </span>
        ) : (
          <span className={clsx(styles.avatarWrap, kids && styles.kidsAvatar)}>
            <BrailleAvatar
              avatar={active.avatar}
              name={active.firstName}
              size={29}
              braille={active.visionSupport}
              accessible={accessibilityActive(active.id)}
            />
          </span>
        )}
        <span className={clsx(styles.name, kids && styles.kidsName)}>
          {active.firstName}
        </span>
      </>
    ) : (
      <span className={clsx(styles.avatarWrap, kids && styles.kidsAvatar)}>
        <Avatar user={publicUser} size="normal" />
      </span>
    );

  return (
    <span
      className={clsx(
        styles.anchor,
        band && !kids && styles.anchorChip,
        kids && styles.kidsIdentity,
      )}
      title={formatMessage(
        defineMessage({
          id: "nav.account",
          defaultMessage: "Your account",
        }),
      )}
    >
      {identity}
    </span>
  );
}
