import { app } from "@/lib/firebase/firebaseApp";
import { getAnalyticsConsent } from "@/lib/analytics";

type AnalyticsBundle = {
  analytics: import("firebase/analytics").Analytics;
  logEvent: typeof import("firebase/analytics").logEvent;
  setUserId: typeof import("firebase/analytics").setUserId;
};

let analyticsPromise: Promise<AnalyticsBundle | null> | null = null;

export function getAnalyticsPromise(): Promise<AnalyticsBundle | null> {
  if (getAnalyticsConsent() !== "granted") return Promise.resolve(null);
  analyticsPromise ??= (async () => {
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
  return analyticsPromise;
}
