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

export function ProfilesProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { publicUser } = usePageData();
  const signedIn = publicUser.id != null;
  const cap = maxProfiles(isPremiumUser(publicUser));
  const [household, setHousehold] = useState<Household>(loadHousehold);
  // The picker is offered once per page load; dismissing keeps the admin.
  const [pickDismissed, setPickDismissed] = useState(false);

  const commit = useCallback((next: Household) => {
    saveHousehold(next);
    setHousehold(next);
  }, []);

  // Profiles belong to the signed-in account. After a logout the household
  // data stays on the device, but no profile may remain selected — the app
  // falls back to the anonymous experience until someone logs back in.
  useEffect(() => {
    if (!signedIn && household.activeId != null) {
      commit(setActive(household, null));
    }
  }, [signedIn, household, commit]);

  // On sign-in the default learner is always a grown-up, never a kid: with a
  // single grown-up profile it is selected automatically; with none, the app
  // stays on the admin account (and nudges to create profiles). Several
  // grown-ups are ambiguous, so the picker asks who is practising.
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
      needsPick:
        signedIn && active == null && adults.length >= 2 && !pickDismissed,
      add: (data) => commit(addProfile(household, data, cap)),
      update: (id, patch) => commit(updateProfile(household, id, patch)),
      remove: (id) => commit(removeProfile(household, id)),
      select: (id) => {
        setPickDismissed(true);
        commit(setActive(household, id));
      },
      dismissPick: () => setPickDismissed(true),
    };
  }, [signedIn, household, commit, cap, pickDismissed]);

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
