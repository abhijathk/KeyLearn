import { CompleteProfileGate, useProfiles } from "@keylearn/page-account";
import { AdBanner, adSenseClientId } from "@keylearn/thirdparties";
import { PortalContainer, Toaster } from "@keylearn/widget";
import { type ReactNode, useState } from "react";
import { showAds } from "./ads.ts";
import { Header } from "./Header.tsx";
import { MenuDrawer } from "./MenuDrawer.tsx";
import * as styles from "./Template.module.less";

// The household's remembered grown-ups/kids preference. Absent for most of
// them — it is only written when somebody uses the drawer's switch — which is
// exactly why it cannot be the only thing the ad gate consults (see ads.ts).
function storedMode(): string | null {
  try {
    return localStorage.getItem("keylearn.mode");
  } catch {
    // Storage unavailable (private mode, an embedded webview). Unknown, which
    // showAds() already treats as a reason for caution rather than a green
    // light.
    return null;
  }
}

// The drawer's open state survives the subtree remount that a learner
// switch triggers, so flipping profiles doesn't slam the panel shut.
function loadMenuOpen(): boolean {
  try {
    return sessionStorage.getItem("keylearn.drawer") === "open";
  } catch {
    return false;
  }
}

function saveMenuOpen(open: boolean): void {
  try {
    sessionStorage.setItem("keylearn.drawer", open ? "open" : "closed");
  } catch {
    // Storage may be unavailable.
  }
}

export function Template({
  path,
  children,
}: {
  readonly path: string;
  readonly children: ReactNode;
}) {
  const [menuOpen, setMenuOpenState] = useState(loadMenuOpen);
  const setMenuOpen = (open: boolean) => {
    saveMenuOpen(open);
    setMenuOpenState(open);
  };
  const { active } = useProfiles();
  const ads = showAds({
    adNetworkConfigured: adSenseClientId !== "0",
    path,
    activeProfileKind: active?.kind ?? null,
    storedMode: storedMode(),
  });
  return (
    <div className={styles.body}>
      <Header
        onOpenMenu={() => setMenuOpen(true)}
        showFocus={path === "/"}
        showBack={path !== "/"}
        kids={path === "/kids"}
        practice={path === "/"}
      />
      <main className={styles.main}>
        {children}
        <PortalContainer />
        <Toaster />
      </main>
      {ads && (
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
      <CompleteProfileGate />
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
