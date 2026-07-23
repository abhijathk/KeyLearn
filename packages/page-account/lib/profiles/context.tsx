import { usePageData } from "@keybr/pages-shared";
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
  historyNamespace,
  type Household,
  loadHousehold,
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
  readonly add: (data: Omit<Profile, "id">) => void;
  readonly update: (id: string, patch: Partial<Omit<Profile, "id">>) => void;
  readonly remove: (id: string) => void;
  readonly select: (id: string | null) => void;
};

const ProfilesContext = createContext<ProfilesContextValue | null>(null);

export function ProfilesProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { publicUser } = usePageData();
  const signedIn = publicUser.id != null;
  const [household, setHousehold] = useState<Household>(loadHousehold);

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

  const value = useMemo<ProfilesContextValue>(() => {
    const active = signedIn ? activeProfile(household) : null;
    return {
      // Signed out, the household presents as empty — no tiles, no switcher.
      household: signedIn ? household : { profiles: [], activeId: null },
      active,
      namespace: historyNamespace(active),
      add: (data) => commit(addProfile(household, data)),
      update: (id, patch) => commit(updateProfile(household, id, patch)),
      remove: (id) => commit(removeProfile(household, id)),
      select: (id) => commit(setActive(household, id)),
    };
  }, [signedIn, household, commit]);

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
