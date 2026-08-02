import { catchError } from "@keybr/debug";
import {
  countPlaces,
  isPremiumUser,
  loadActiveProfileId,
  type PlaceCounts,
  type ProfileDetails,
  saveActiveProfileId,
  usePageData,
} from "@keybr/pages-shared";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AccountService, type ProfileInput } from "../service.ts";
import {
  activeProfile,
  adultProfiles,
  historyNamespace,
  type Household,
  type Profile,
} from "./store.ts";

type ProfilesContextValue = {
  readonly household: Household;
  readonly active: Profile | null;
  /** Result-history namespace for the active profile, or null. */
  readonly namespace: string | null;
  /**
   * How the household's two allowances stand: ordinary learner places, and the
   * separate places for learners on braille and audio.
   */
  readonly places: PlaceCounts;
  /**
   * When true, the account has several grown-ups and none is chosen yet — the
   * app should ask who is practising with the profile picker.
   */
  readonly needsPick: boolean;
  readonly add: (data: ProfileInput) => Promise<void>;
  readonly update: (id: string, patch: Partial<ProfileInput>) => Promise<void>;
  readonly remove: (id: string) => Promise<void>;
  readonly select: (id: string | null) => void;
  /** Move a profile one place up (-1) or down (+1) in the display order. */
  readonly reorder: (id: string, dir: -1 | 1) => void;
  /** Dismiss the profile picker, staying on the admin account for now. */
  readonly dismissPick: () => void;
};

const ProfilesContext = createContext<ProfilesContextValue | null>(null);

// The learner display order is a per-device preference, saved as an array of
// profile ids. It is applied here in the context so every consumer (the
// account list, the "who's practising?" picker, …) shows the same order.
const ORDER_KEY = "keylearn.profileOrder";

function loadOrder(): readonly string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    const parsed = raw != null ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function saveOrder(ids: readonly string[]): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
  } catch {
    // Storage may be unavailable.
  }
}

function applyOrder(
  profiles: readonly Profile[],
  order: readonly string[],
): readonly Profile[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const known = order
    .map((id) => byId.get(id))
    .filter((p): p is Profile => p != null);
  const knownIds = new Set(known.map((p) => p.id));
  const rest = profiles.filter((p) => !knownIds.has(p.id));
  return [...known, ...rest];
}

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
  const pageData = usePageData();
  const { publicUser } = pageData;
  const signedIn = publicUser.id != null;
  const premium = isPremiumUser(publicUser);

  // Profiles come from the server: seeded from page data on first render, then
  // replaced by the full list every mutation returns.
  const [profiles, setProfiles] = useState<readonly Profile[]>(() =>
    signedIn ? [...(pageData.profiles ?? [])] : [],
  );
  // Which learner is active is a per-device preference (localStorage).
  const [activeId, setActiveIdState] = useState<string | null>(() =>
    signedIn ? loadActiveProfileId() : null,
  );
  const [pickDismissed, setPickDismissed] = useState(pickDismissedInSession);
  const [order, setOrder] = useState<readonly string[]>(loadOrder);

  const setActiveId = useCallback((id: string | null) => {
    saveActiveProfileId(id);
    setActiveIdState(id);
  }, []);
  const markPicked = useCallback(() => {
    rememberPickDismissed();
    setPickDismissed(true);
  }, []);

  // After a logout no profile may remain selected — the app falls back to the
  // anonymous experience until someone logs back in.
  useEffect(() => {
    if (!signedIn) {
      forgetPickDismissed();
      setPickDismissed(false);
      setProfiles([]);
      if (activeId != null) {
        setActiveId(null);
      }
    }
  }, [signedIn, activeId, setActiveId]);

  // On sign-in the default learner is always a grown-up, never a kid: with a
  // single grown-up profile it is selected automatically; with none, the app
  // stays on the admin account. Several grown-ups are ambiguous, so the picker
  // asks who is practising.
  useEffect(() => {
    if (signedIn && activeId == null) {
      const adults = profiles.filter((p) => p.kind === "adult");
      if (adults.length === 1) {
        setActiveId(adults[0].id);
      }
    }
  }, [signedIn, activeId, profiles, setActiveId]);

  const value = useMemo<ProfilesContextValue>(() => {
    const household: Household = {
      profiles: signedIn ? applyOrder(profiles, order) : [],
      activeId: signedIn ? activeId : null,
    };
    const active = signedIn ? activeProfile(household) : null;
    const adults = adultProfiles(household);
    // Adopt the server's returned list; auto-select the newly-created profile
    // (the one whose id we didn't have before) when none is active yet.
    const adopt = (list: readonly ProfileDetails[]) => {
      setProfiles(list);
      if (activeId == null) {
        const fresh = list.find((p) => !profiles.some((o) => o.id === p.id));
        if (fresh != null) {
          setActiveId(fresh.id);
        }
      }
    };
    return {
      household,
      active,
      namespace: historyNamespace(active),
      places: countPlaces(profiles, premium),
      needsPick: signedIn && adults.length >= 2 && !pickDismissed,
      add: async (data) => {
        try {
          adopt(await AccountService.createProfile(data));
        } catch (err) {
          catchError(err);
        }
      },
      update: async (id, patch) => {
        try {
          setProfiles(await AccountService.updateProfile(id, patch));
        } catch (err) {
          catchError(err);
        }
      },
      remove: async (id) => {
        try {
          const list = await AccountService.deleteProfile(id);
          setProfiles(list);
          if (activeId === id) {
            setActiveId(list[0]?.id ?? null);
          }
        } catch (err) {
          catchError(err);
        }
      },
      select: (id) => {
        markPicked();
        setActiveId(id);
      },
      reorder: (id, dir) => {
        const ids = household.profiles.map((p) => p.id);
        const i = ids.indexOf(id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= ids.length) {
          return;
        }
        [ids[i], ids[j]] = [ids[j], ids[i]];
        saveOrder(ids);
        setOrder(ids);
      },
      dismissPick: markPicked,
    };
  }, [
    signedIn,
    profiles,
    activeId,
    order,
    premium,
    pickDismissed,
    markPicked,
    setActiveId,
  ]);

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
