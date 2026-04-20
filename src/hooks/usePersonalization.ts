import { useSyncExternalStore } from "react";
import {
  DEFAULT_PERSONALIZATION,
  getPersonalizationPreferences,
  subscribeToPersonalization,
} from "@/lib/personalization";

export const usePersonalization = () =>
  useSyncExternalStore(
    subscribeToPersonalization,
    getPersonalizationPreferences,
    () => DEFAULT_PERSONALIZATION,
  );
