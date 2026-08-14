// The app's standard window chrome — reused by any page that opens over the
// practice screen, so they all look and behave alike.
export * from "./AccountPage.tsx";
export * from "./AuthPage.tsx";
export * from "./CompleteProfileGate.tsx";
// Lives in @keylearn/widget now, so the assessment windows can use the same
// dialog without page-account and the assessment depending on each other.
export { ConfirmDialog } from "@keylearn/widget";
// The course pieces the assessment page needs: it gathers the same evidence
// and prints the same language line, and a second copy of either would be a
// second definition of what counts.
export * from "./course/evidence.ts";
export * from "./course/language-line.ts";
// Lives in @keylearn/widget now, so the support desk can use the same
// window chrome without page-support and page-account depending on each
// other.
export * from "./Overlay.tsx";
export * from "./profiles/BrailleBadge.tsx";
export * from "./profiles/context.tsx";
export * from "./profiles/ProfileAvatar.tsx";
export * from "./profiles/ProfilePicker.tsx";
export * from "./profiles/ProfilesManager.tsx";
export * from "./profiles/store.ts";
export * from "./theme/accent-names.tsx";
export * from "./theme/ThemePicker.tsx";
export * from "./theme/ThemeWindow.tsx";
export { AnimatedHeight, FloatingShell } from "@keylearn/widget";
