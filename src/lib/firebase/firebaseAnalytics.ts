import {
  app,
  firebaseAnalyticsConfigError,
} from "@/lib/firebase/firebaseApp";
import { isLocalHost } from "@/lib/firebase/firebaseHosts";

export type AnalyticsStorageConsent = "granted" | "denied";

type AnalyticsBundle = {
  analytics: import("firebase/analytics").Analytics;
  logEvent: typeof import("firebase/analytics").logEvent;
  setAnalyticsCollectionEnabled: typeof import("firebase/analytics").setAnalyticsCollectionEnabled;
  setConsent: typeof import("firebase/analytics").setConsent;
  setUserId: typeof import("firebase/analytics").setUserId;
};

let analyticsPromise: Promise<AnalyticsBundle | null> | null = null;
let requestedCollectionEnabled = true;
let requestedStorageConsent: AnalyticsStorageConsent = "denied";

const consentSettings = (analyticsStorage: AnalyticsStorageConsent) => ({
  ad_storage: "denied" as const,
  ad_user_data: "denied" as const,
  ad_personalization: "denied" as const,
  analytics_storage: analyticsStorage,
  personalization_storage: "denied" as const,
  functionality_storage: "granted" as const,
  security_storage: "granted" as const,
});

const applyRequestedState = (bundle: AnalyticsBundle) => {
  bundle.setConsent(consentSettings(requestedStorageConsent));
  if (!requestedCollectionEnabled || requestedStorageConsent !== "granted") {
    bundle.setUserId(bundle.analytics, null);
  }
  bundle.setAnalyticsCollectionEnabled(bundle.analytics, requestedCollectionEnabled);
};

export function getAnalyticsPromise(
  analyticsStorage: AnalyticsStorageConsent,
): Promise<AnalyticsBundle | null> {
  requestedCollectionEnabled = true;
  requestedStorageConsent = analyticsStorage;
  analyticsPromise ??= (async () => {
    if (!app || firebaseAnalyticsConfigError) return null;
    if (typeof window === "undefined" || typeof navigator === "undefined") return null;
    if (navigator.webdriver || isLocalHost(window.location.hostname)) return null;
    try {
      const mod = await import("firebase/analytics");
      if (!(await mod.isSupported())) return null;
      mod.setConsent(consentSettings(requestedStorageConsent));
      const analytics = mod.initializeAnalytics(app, {
        config: {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        },
      });
      const bundle = {
        analytics,
        logEvent: mod.logEvent,
        setAnalyticsCollectionEnabled: mod.setAnalyticsCollectionEnabled,
        setConsent: mod.setConsent,
        setUserId: mod.setUserId,
      };
      applyRequestedState(bundle);
      return bundle;
    } catch {
      return null;
    }
  })();
  const pending = analyticsPromise;
  return pending.then((bundle) => {
    if (!bundle && analyticsPromise === pending) analyticsPromise = null;
    if (bundle) applyRequestedState(bundle);
    return bundle;
  });
}

export function disableAnalyticsCollectionIfInitialized(): void {
  requestedCollectionEnabled = false;
  requestedStorageConsent = "denied";
  if (!analyticsPromise) return;
  void analyticsPromise.then((bundle) => {
    if (bundle) applyRequestedState(bundle);
  });
}
