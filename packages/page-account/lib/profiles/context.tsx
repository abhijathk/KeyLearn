import { catchError } from "@keylearn/debug";
import {
  countPlaces,
  isPremiumUser,
  loadActiveProfileId,
  type PlaceCounts,
  type ProfileDetails,
  pullA11y,
  saveActiveProfileId,
  usePageData,
} from "@keylearn/pages-shared";
import { ANONYMOUS_SETTINGS_KEY } from "@keylearn/settings-loader";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  /**
   * Adds a learner, answering with their new id.
   *
   * The id is handed back because some of what a learner has is kept against
   * their id rather than on the profile record — their reading voice, for one
   * — and that cannot be written until the id exists. Without this the caller
   * would have to guess which of the returned profiles was the new one.
   */
  readonly add: (data: ProfileInput) => Promise<string | null>;
  readonly update: (id: string, patch: Partial<ProfileInput>) => Promise<void>;
  readonly remove: (id: string) => Promise<void>;
  /**
   * Set while a write is waiting on the grown-up PIN.
   *
   * Changing a learner needs the PIN once per session on an account that has
   * one. The server has always enforced that; nothing on this side ever asked
   * for it, so the write failed with a logged error and the parent saw a save
   * button that did nothing. Held here rather than in each caller because
   * every write goes through this provider, and asking three call sites to
   * each remember the gate is how one of them ends up not.
   */
  readonly pinNeeded: boolean;
  /** Proves the PIN and replays whatever was waiting on it. */
  readonly provePin: (pin: string) => Promise<boolean>;
  /** Gives up on the waiting write. */
  readonly cancelPin: () => void;
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

// A guest who practices before creating an account has their settings under
// the plain anonymous key (see keylearn-settings-loader). The moment their
// first profile exists, copy it into that profile's own slot — left
// unmarked as migrated, so the profile settings loader's own first load()
// pushes it to the server exactly like any other pre-existing local value.
// The anonymous key itself is left alone: it still serves signed-out
// browsing on this device.
function migrateAnonymousSettings(profileId: string): void {
  try {
    const anonymous = localStorage.getItem(ANONYMOUS_SETTINGS_KEY);
    if (anonymous == null) {
      return;
    }
    const profileKey = `profile-${profileId}.settings`;
    if (localStorage.getItem(profileKey) != null) {
      // Something is already there — an existing profile being switched
      // into for the first time this session, not a fresh signup. Don't
      // clobber it.
      return;
    }
    localStorage.setItem(profileKey, anonymous);
  } catch {
    // Storage may be unavailable; the new profile just starts blank.
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
  const [pinNeeded, setPinNeeded] = useState(false);
  // The write held back until the PIN is proved. A ref, not state: nothing
  // renders from it, and a re-render between the failure and the retry would
  // lose the very thing being kept.
  const pending = useRef<(() => Promise<void>) | null>(null);
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
  // A learner's accessibility settings belong to them, not to the device.
  //
  // Pulled whenever this profile becomes the active one — including on first
  // load, which is why this watches `activeId` rather than hooking
  // `setActiveId`: the initial value is set by useState and never passes
  // through it.
  //
  // Best-effort and unawaited. The device's own copy is already applied, so a
  // learner who is offline sees exactly what they saw before; a slow network
  // delays the reconciliation, never the page.
  useEffect(() => {
    if (activeId == null) {
      return;
    }
    void pullA11y(activeId);
  }, [activeId]);

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
    /**
     * Runs a write, and holds it back if the server asks for the PIN.
     *
     * A 428 with `parentPin` is not a failure to report — it is a step that
     * has not happened yet. Logging it (which is what used to happen) turns a
     * missing prompt into a save button that silently does nothing.
     */
    const gated = async <T,>(
      run: () => Promise<T>,
      fallback: T,
    ): Promise<T> => {
      try {
        return await run();
      } catch (err: any) {
        if (err?.status === 428 && err?.body?.error?.parentPin === true) {
          pending.current = async () => {
            await run();
          };
          setPinNeeded(true);
          return fallback;
        }
        catchError(err);
        return fallback;
      }
    };

    const adopt = (list: readonly ProfileDetails[]) => {
      setProfiles(list);
      if (activeId == null) {
        const fresh = list.find((p) => !profiles.some((o) => o.id === p.id));
        if (fresh != null) {
          setActiveId(fresh.id);
          migrateAnonymousSettings(fresh.id);
        }
      }
    };
    return {
      household,
      active,
      namespace: historyNamespace(active),
      places: countPlaces(profiles, premium),
      needsPick: signedIn && adults.length >= 2 && !pickDismissed,
      add: async (data) =>
        await gated(async () => {
          const before = profiles.map((p) => p.id);
          const list = await AccountService.createProfile(data);
          adopt(list);
          return list.find((p) => !before.includes(p.id))?.id ?? null;
        }, null),
      update: async (id, patch) => {
        await gated(async () => {
          setProfiles(await AccountService.updateProfile(id, patch));
        }, undefined);
      },
      remove: async (id) => {
        await gated(async () => {
          const list = await AccountService.deleteProfile(id);
          setProfiles(list);
          if (activeId === id) {
            setActiveId(list[0]?.id ?? null);
          }
        }, undefined);
      },
      pinNeeded,
      provePin: async (pin) => {
        try {
          await AccountService.verifyParentPin(pin);
        } catch {
          return false; // Wrong PIN. The prompt says so and stays open.
        }
        setPinNeeded(false);
        const held = pending.current;
        pending.current = null;
        // Replayed rather than abandoned: the parent already pressed Save, and
        // making them press it again after proving who they are is a second
        // ask for the same thing.
        await held?.();
        return true;
      },
      cancelPin: () => {
        pending.current = null;
        setPinNeeded(false);
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
    // Without this the context keeps handing out the value it computed while
    // the gate was still closed, so the prompt is asked for and never appears:
    // the save looks like it silently did nothing, which is the exact
    // behaviour this whole change exists to remove.
    pinNeeded,
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
