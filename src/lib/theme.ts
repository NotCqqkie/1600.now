export const THEME_STORAGE_KEY = "theme";
export const THEME_EVENT = "app-theme-change";

const getStoredTheme = (): "dark" | "light" | null => {
  if (typeof window === "undefined") return null;

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return savedTheme === "dark" || savedTheme === "light" ? savedTheme : null;
};

export const getPreferredDarkMode = () => {
  if (typeof window === "undefined") return false;

  const savedTheme = getStoredTheme();
  if (savedTheme) return savedTheme === "dark";

  return document.documentElement.classList.contains("dark");
};

export const applyTheme = (isDark: boolean) => {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle("dark", isDark);

  if (typeof window !== "undefined") {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  }
};
