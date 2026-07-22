import { Pages } from "@keybr/pages-shared";
import { IconButton, StrokeIcon } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink } from "react-router";
import { LanguagePanel } from "./LanguagePanel.tsx";
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
          <StrokeIcon className={styles.headIcon} name="keyboard" />
          <span className={styles.title}>KeyLearn</span>
          <IconButton
            icon={<StrokeIcon name="close" />}
            title={formatMessage(
              defineMessage({
                id: "nav.closeMenu",
                defaultMessage: "Close navigation",
              }),
            )}
            onClick={onClose}
          />
        </div>
        {open && (
          <>
            <div className={styles.label}>
              <FormattedMessage
                id="drawer.who"
                defaultMessage="Who's practicing"
              />
            </div>
            <div className={styles.seg}>
              <button className={clsx(styles.segBtn, styles.segOn)}>
                <FormattedMessage
                  id="drawer.grownUps"
                  defaultMessage="Grown-ups"
                />
              </button>
              <button
                className={styles.segBtn}
                disabled={true}
                title={formatMessage(
                  defineMessage({
                    id: "drawer.kidsSoon",
                    defaultMessage: "Kids mode is coming soon.",
                  }),
                )}
              >
                <FormattedMessage id="drawer.kids" defaultMessage="Kids" />
              </button>
            </div>
            <div className={styles.label}>
              <FormattedMessage id="drawer.goTo" defaultMessage="Go to" />
            </div>
            <NavMenu currentPath={path} onNavigate={onClose} />
            <div className={styles.label}>
              <FormattedMessage
                id="drawer.fingerColors"
                defaultMessage="Finger colour zones on the keyboard"
              />
            </div>
            <ZonesToggle />
            <div className={styles.label}>
              <FormattedMessage
                id="drawer.language"
                defaultMessage="Language"
              />
            </div>
            <LanguagePanel currentPath={path} />
            <div className={styles.label}>
              <FormattedMessage id="drawer.more" defaultMessage="More" />
            </div>
            <div className={styles.util}>
              <a
                href="https://github.com/abhijathk/keylearn"
                target="_blank"
                rel="noreferrer"
              >
                <StrokeIcon className={styles.utilIcon} name="code" />
                <FormattedMessage
                  id="drawer.source"
                  defaultMessage="View source on GitHub"
                />
              </a>
              <RouterLink to={Pages.termsOfService.path} onClick={onClose}>
                <StrokeIcon className={styles.utilIcon} name="doc" />
                {formatMessage(Pages.termsOfService.link.label)}
              </RouterLink>
              <RouterLink to={Pages.privacyPolicy.path} onClick={onClose}>
                <StrokeIcon className={styles.utilIcon} name="shield" />
                {formatMessage(Pages.privacyPolicy.link.label)}
              </RouterLink>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/** Finger-zone colours on/off; applied by the practice page via an event. */
function ZonesToggle(): ReactNode {
  const [on, setOn] = useState(true);
  const set = (value: boolean) => {
    setOn(value);
    window.dispatchEvent(
      new window.CustomEvent("keylearn:zones", { detail: value }),
    );
  };
  return (
    <div className={styles.seg}>
      <button
        className={clsx(styles.segBtn, on && styles.segOn)}
        onClick={() => {
          set(true);
        }}
      >
        <span className={styles.dots}>
          <i style={{ background: "var(--pinky-zone-color)" }} />
          <i style={{ background: "var(--ring-zone-color)" }} />
          <i style={{ background: "var(--middle-zone-color)" }} />
          <i style={{ background: "var(--left-index-zone-color)" }} />
          <i style={{ background: "var(--right-index-zone-color)" }} />
        </span>
        <FormattedMessage id="drawer.zonesOn" defaultMessage="On" />
      </button>
      <button
        className={clsx(styles.segBtn, on || styles.segOn)}
        onClick={() => {
          set(false);
        }}
      >
        <FormattedMessage id="drawer.zonesOff" defaultMessage="Off" />
      </button>
    </div>
  );
}
