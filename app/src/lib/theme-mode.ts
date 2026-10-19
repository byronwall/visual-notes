import { createSignal } from "solid-js";
import { isServer } from "solid-js/web";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "vn-theme";

/**
 * Runs inline in <head> before first paint: applies the saved preference
 * (or the OS preference) as `.dark` on <html> so SSR pages never flash
 * light, and follows OS changes while the preference is "system".
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY
)};var m=window.matchMedia("(prefers-color-scheme: dark)");var a=function(){var p=null;try{p=localStorage.getItem(k)}catch(e){}var d=p==="dark"||(p!=="light"&&m.matches);document.documentElement.classList.toggle("dark",d);document.documentElement.dataset.theme=d?"dark":"light"};a();m.addEventListener("change",a);window.__vnApplyTheme=a}catch(e){}})();`;

const readPreference = (): ThemePreference => {
  if (isServer) return "system";
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
};

const [preference, setPreferenceSignal] =
  createSignal<ThemePreference>("system");

/** Current preference. SSR and the first client render report "system". */
export const themePreference = preference;

/**
 * Call from onMount: syncs the signal with storage after hydration so the
 * server and first client render agree (the boot script already applied it).
 */
export const syncThemePreference = () => {
  setPreferenceSignal(readPreference());
};

export const setThemePreference = (next: ThemePreference) => {
  setPreferenceSignal(next);
  if (isServer) return;
  try {
    if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage blocked: still apply for this page view.
  }
  const apply = (window as unknown as { __vnApplyTheme?: () => void })
    .__vnApplyTheme;
  if (apply) {
    apply();
    return;
  }
  const dark =
    next === "dark" ||
    (next === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
};

const ORDER: ThemePreference[] = ["system", "light", "dark"];

export const cycleThemePreference = () => {
  const current = themePreference();
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  setThemePreference(next);
  return next;
};

export const themePreferenceLabel = (value: ThemePreference) =>
  value === "system" ? "System theme" : value === "light" ? "Light theme" : "Dark theme";
