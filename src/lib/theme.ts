import { flushSync } from "react-dom";

export const THEME_STORAGE_KEY = "theme";
export const THEME_EVENT = "app-theme-change";

export const isDarkThemeActive = () => {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
};

const getStoredTheme = (): "dark" | "light" | null => {
  if (typeof window === "undefined") return null;

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return savedTheme === "dark" || savedTheme === "light" ? savedTheme : null;
};

export const getPreferredDarkMode = () => {
  if (typeof window === "undefined") return false;

  const savedTheme = getStoredTheme();
  if (savedTheme) return savedTheme === "dark";

  return isDarkThemeActive();
};

const dispatchThemeChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(THEME_EVENT));
};

let themeTransitionTimeout: ReturnType<typeof setTimeout> | null = null;

const swapTheme = (isDark: boolean) => {
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";

  if (typeof window !== "undefined") {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  }
};

export const applyTheme = (isDark: boolean) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const startViewTransition = (
    document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    }
  ).startViewTransition;
  const skipViewTransition = Boolean(document.querySelector("[data-home-page='true']"));

  if (startViewTransition && !prefersReducedMotion && !skipViewTransition) {
    startViewTransition.call(document, () => {
      flushSync(() => {
        swapTheme(isDark);
        dispatchThemeChange();
      });
    });
    return;
  }
  root.classList.add("theme-transitioning");
  if (themeTransitionTimeout) clearTimeout(themeTransitionTimeout);
  themeTransitionTimeout = setTimeout(() => {
    root.classList.remove("theme-transitioning");
    themeTransitionTimeout = null;
  }, 320);

  swapTheme(isDark);
  dispatchThemeChange();
};

export const subscribeToTheme = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
};
