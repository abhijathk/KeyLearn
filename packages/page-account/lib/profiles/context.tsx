import { isPremiumUser, usePageData } from "@keybr/pages-shared";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  activeProfile,
  addProfile,
  adultProfiles,
  historyNamespace,
  type Household,
  loadHousehold,
  maxProfiles,
  type Profile,
  removeProfile,
  saveHousehold,
  setActive,
  updateProfile,
} from "./store.ts";

type ProfilesContextValue = {
  readonly household: Household;
  readonly active: Profile | null;
  /** Local result-history namespace for the active profile, or null. */
  readonly namespace: string | null;
  /** How many profiles this account may hold (8 with premium, else 4). */
  readonly maxProfiles: number;
  /**
   * When true, the account has several grown-ups and none is chosen yet — the
   * app should ask who is practising with the profile picker.
   */
  readonly needsPick: boolean;
  readonly add: (data: Omit<Profile, "id">) => void;
  readonly update: (id: string, patch: Partial<Omit<Profile, "id">>) => void;
  readonly remove: (id: string) => void;
  readonly select: (id: string | null) => void;
  /** Dismiss the profile picker, staying on the admin account for now. */
  readonly dismissPick: () => void;
};

const ProfilesContext = createContext<ProfilesContextValue | null>(null);

// The "who's practising?" prompt is shown once per browser session.
const PICK_KEY = "keylearn.pickDismissed";

function pickDismissedInSession(): boolean {
  try {
    return sessionStorage.getItem(PICK_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberPickDismissed(): void {
  try {
    sessionStorage.setItem(PICK_KEY, "1");
  } catch {
    // Storage may be unavailable.
  }
}

function forgetPickDismissed(): void {
  try {
    sessionStorage.removeItem(PICK_KEY);
  } catch {
    // Storage may be unavailable.
  }
}

export function ProfilesProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { publicUser } = usePageData();
  const signedIn = publicUser.id != null;
  const cap = maxProfiles(isPremiumUser(publicUser));
  const [household, setHousehold] = useState<Household>(loadHousehold);
  // "Who's practising?" is offered once per browser session for accounts with
  // several grown-ups; the flag persists across reloads and is cleared on
  // logout so the next sign-in asks again.
  const [pickDismissed, setPickDismissed] = useState(pickDismissedInSession);

  const commit = useCallback((next: Household) => {
    saveHousehold(next);
    setHousehold(next);
  }, []);
  const markPicked = useCallback(() => {
    rememberPickDismissed();
    setPickDismissed(true);
  }, []);

  // Profiles belong to the signed-in account. After a logout the household
  // data stays on the device, but no profile may remain selected — the app
  // falls back to the anonymous experience until someone logs back in.
  useEffect(() => {
    if (!signedIn) {
      forgetPickDismissed();
      setPickDismissed(false);
      if (household.activeId != null) {
        commit(setActive(household, null));
      }
    }
  }, [signedIn, household, commit]);

  // On sign-in the default learner is always a grown-up, never a kid: with a
  // single grown-up profile it is selected automatically; with none, the app
  // stays on the admin account (and nudges to create profiles). Several
  // grown-ups are ambiguous, so the picker below asks who is practising.
  useEffect(() => {
    if (signedIn && household.activeId == null) {
      const adults = adultProfiles(household);
      if (adults.length === 1) {
        commit(setActive(household, adults[0].id));
      }
    }
  }, [signedIn, household, commit]);

  const value = useMemo<ProfilesContextValue>(() => {
    const active = signedIn ? activeProfile(household) : null;
    const adults = adultProfiles(household);
    return {
      // Signed out, the household presents as empty — no tiles, no switcher.
      household: signedIn ? household : { profiles: [], activeId: null },
      active,
      namespace: historyNamespace(active),
      maxProfiles: cap,
      // Ask even when a grown-up is already active from a previous session —
      // several grown-ups share one account, so confirm who is here now.
      needsPick: signedIn && adults.length >= 2 && !pickDismissed,
      add: (data) => commit(addProfile(household, data, cap)),
      update: (id, patch) => commit(updateProfile(household, id, patch)),
      remove: (id) => commit(removeProfile(household, id)),
      select: (id) => {
        markPicked();
        commit(setActive(household, id));
      },
      dismissPick: markPicked,
    };
  }, [signedIn, household, commit, cap, pickDismissed, markPicked]);

  return (
    <ProfilesContext.Provider value={value}>
      {children}
    </ProfilesContext.Provider>
  );
}

export function useProfiles(): ProfilesContextValue {
  const value = useContext(ProfilesContext);
  if (value == null) {
    throw new Error("ProfilesContext is missing");
  }
  return value;
}
