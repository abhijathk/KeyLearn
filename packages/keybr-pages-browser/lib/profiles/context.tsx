import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
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
  const [household, setHousehold] = useState<Household>(loadHousehold);

  const commit = useCallback((next: Household) => {
    saveHousehold(next);
    setHousehold(next);
  }, []);

  const value = useMemo<ProfilesContextValue>(() => {
    const active = activeProfile(household);
    return {
      household,
      active,
      namespace: historyNamespace(active),
      add: (data) => commit(addProfile(household, data)),
      update: (id, patch) => commit(updateProfile(household, id, patch)),
      remove: (id) => commit(removeProfile(household, id)),
      select: (id) => commit(setActive(household, id)),
    };
  }, [household, commit]);

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
