import { useSyncExternalStore } from "react";
import {
  getPreferredDarkMode,
  subscribeToTheme,
} from "@/lib/theme";

export const useThemeMode = () =>
  useSyncExternalStore(
    subscribeToTheme,
    getPreferredDarkMode,
    () => false,
  );
