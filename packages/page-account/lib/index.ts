// The app's standard window chrome — reused by any page that opens over the
// practice screen, so they all look and behave alike.
export * from "./AccountPage.tsx";
export * from "./AuthPage.tsx";
export * from "./CompleteProfileGate.tsx";
export * from "./ConfirmDialog.tsx";
// The course pieces the assessment page needs: it gathers the same evidence
// and prints the same language line, and a second copy of either would be a
// second definition of what counts.
export * from "./course/evidence.ts";
export * from "./course/language-line.ts";
export * from "./FloatingShell.tsx";
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
