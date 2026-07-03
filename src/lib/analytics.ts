export type AnalyticsConsent = "granted" | "denied" | "unset";

const CONSENT_STORAGE_KEY = "analytics-consent";

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return "unset";
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored === "granted" || stored === "denied") return stored;
  } catch {
    // localStorage may be unavailable (private mode, blocked cookies)
  }
  return "unset";
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, "unset">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);
  } catch {
    // ignore persistence failures
  }
  if (consent === "granted") void initAnalytics();
}

const loadAnalyticsBundle = async () => {
  if (getAnalyticsConsent() !== "granted") return null;
  const { getAnalyticsPromise } = await import("./firebase/firebaseAnalytics");
  return getAnalyticsPromise();
};

export async function initAnalytics(): Promise<void> {
  await loadAnalyticsBundle();
}

async function trackEvent(
  name: string,
  params?: Record<string, unknown>,
): Promise<void> {
  const bundle = await loadAnalyticsBundle();
  if (!bundle) return;
  bundle.logEvent(bundle.analytics, name, params);
}

export async function identifyUser(userId: string | null): Promise<void> {
  const bundle = await loadAnalyticsBundle();
  if (!bundle) return;
  bundle.setUserId(bundle.analytics, userId);
}

export function trackPageView(pagePath: string): void {
  void trackEvent("page_view", {
    page_path: pagePath,
    page_location: typeof window !== "undefined" ? window.location.href : pagePath,
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
}

export function trackLogin(method: "password" | "google"): void {
  void trackEvent("login", { method });
}

export function trackSignUp(method: "password" | "google"): void {
  void trackEvent("sign_up", { method });
}

export function trackAppError(message: string, params?: Record<string, unknown>): void {
  void trackEvent("app_error", { message: message.slice(0, 500), ...params });
}
