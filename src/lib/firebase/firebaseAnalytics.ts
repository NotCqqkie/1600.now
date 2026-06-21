import { app } from "@/lib/firebase/firebaseApp";

type AnalyticsBundle = {
  analytics: import("firebase/analytics").Analytics;
  logEvent: typeof import("firebase/analytics").logEvent;
  setUserId: typeof import("firebase/analytics").setUserId;
};

export const analyticsPromise: Promise<AnalyticsBundle | null> = (async () => {
  if (!app) return null;
  if (typeof window === "undefined") return null;
  if (navigator.webdriver) return null;
  if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return null;
  try {
    const mod = await import("firebase/analytics");
    if (!(await mod.isSupported())) return null;
    return {
      analytics: mod.getAnalytics(app),
      logEvent: mod.logEvent,
      setUserId: mod.setUserId,
    };
  } catch {
    return null;
  }
})();
