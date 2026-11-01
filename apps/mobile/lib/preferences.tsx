import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAppTheme } from "./app-theme";
import { STRINGS, type Lang, type StringKey } from "./messages";

type ThemePref = "light" | "dark" | "system";

interface Preferences {
  lang: Lang;
  biometricUnlock: boolean;
  theme: ThemePref;
}

interface PreferencesContext extends Preferences {
  loaded: boolean;
  setLang: (lang: Lang) => void;
  setBiometricUnlock: (on: boolean) => void;
  setTheme: (theme: ThemePref) => void;
  /** Translated UI string. */
  t: (key: StringKey) => string;
}

const KEY = "bhw.preferences";
const DEFAULTS: Preferences = { lang: "en", biometricUnlock: false, theme: "system" };
const Ctx = createContext<PreferencesContext | null>(null);

/** Language, biometric unlock and theme, persisted on the phone (Profile & Settings screen). */
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const { setScheme } = useAppTheme();

  useEffect(() => {
    void SecureStore.getItemAsync(KEY)
      .then((raw) => {
        if (!raw) return;
        const stored = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) };
        setPrefs(stored);
        setScheme(stored.theme);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [setScheme]);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<PreferencesContext>(
    () => ({
      ...prefs,
      loaded,
      setLang: (lang) => update({ lang }),
      setBiometricUnlock: (biometricUnlock) => update({ biometricUnlock }),
      setTheme: (theme) => {
        setScheme(theme);
        update({ theme });
      },
      t: (key) => STRINGS[prefs.lang][key],
    }),
    [prefs, loaded, update, setScheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreferences(): PreferencesContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}
