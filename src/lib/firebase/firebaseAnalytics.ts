import { app } from "@/lib/firebase/firebaseApp";
import { getAnalyticsConsent } from "@/lib/analytics";

type AnalyticsBundle = {
  analytics: import("firebase/analytics").Analytics;
  logEvent: typeof import("firebase/analytics").logEvent;
  setAnalyticsCollectionEnabled: typeof import("firebase/analytics").setAnalyticsCollectionEnabled;
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
      if (getAnalyticsConsent() !== "granted") return null;
      if (!(await mod.isSupported())) return null;
      if (getAnalyticsConsent() !== "granted") return null;
      const analytics = mod.getAnalytics(app);
      mod.setAnalyticsCollectionEnabled(analytics, true);
      return {
        analytics,
        logEvent: mod.logEvent,
        setAnalyticsCollectionEnabled: mod.setAnalyticsCollectionEnabled,
        setUserId: mod.setUserId,
      };
    } catch {
      return null;
    }
  })();
  const pending = analyticsPromise;
  return pending.then((bundle) => {
    if (!bundle && analyticsPromise === pending) analyticsPromise = null;
    if (bundle && getAnalyticsConsent() === "granted") {
      bundle.setAnalyticsCollectionEnabled(bundle.analytics, true);
    }
    return bundle;
  });
}

export function disableAnalyticsCollectionIfInitialized(): void {
  if (!analyticsPromise) return;
  void analyticsPromise.then((bundle) => {
    if (bundle) bundle.setAnalyticsCollectionEnabled(bundle.analytics, false);
  });
}
