import { AdBanner, adSenseClientId } from "@keybr/thirdparties";
import { PortalContainer, Toaster } from "@keybr/widget";
import { type ReactNode, useState } from "react";
import { Header } from "./Header.tsx";
import { MenuDrawer } from "./MenuDrawer.tsx";
import * as styles from "./Template.module.less";

// Ads only ever appear in grown-ups mode; kids mode (and any unconfigured
// build) stays completely ad-free.
function showAds(): boolean {
  if (adSenseClientId === "0") {
    return false;
  }
  try {
    return localStorage.getItem("keylearn.mode") !== "kids";
  } catch {
    return true;
  }
}

export function Template({
  path,
  children,
}: {
  readonly path: string;
  readonly children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={styles.body}>
      <Header
        onOpenMenu={() => setMenuOpen(true)}
        showFocus={path === "/"}
        showBack={path !== "/"}
      />
      <main className={styles.main}>
        {children}
        <PortalContainer />
        <Toaster />
      </main>
      {showAds() && (
        <div className={styles.adSlot}>
          <div className={styles.adLabel}>Advertisement</div>
          <AdBanner />
        </div>
      )}
      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        path={path}
      />
      <EnvName />
    </div>
  );
}

function EnvName() {
  return process.env.NODE_ENV === "production" ? null : (
    <div
      style={{
        position: "fixed",
        zIndex: "1",
        insetInlineEnd: "0px",
        insetBlockEnd: "0px",
        padding: "5px",
        margin: "5px",
        border: "1px solid red",
        color: "red",
      }}
    >
      {`process.env.NODE_ENV=${process.env.NODE_ENV}`}
    </div>
  );
}
