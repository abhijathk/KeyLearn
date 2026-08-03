import { catchError } from "@keylearn/debug";
import { type Settings, type SettingsStorage } from "@keylearn/settings";
import { useEffect, useState } from "react";

export function useLoader(storage: SettingsStorage): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let didCancel = false;

    const load = async (): Promise<void> => {
      const settings = await storage.load();
      if (!didCancel) {
        setSettings(settings);
      }
    };
    load().catch(catchError);

    return () => {
      didCancel = true;
    };
  }, [storage]);

  return settings;
}
