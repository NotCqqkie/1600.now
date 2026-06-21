const loadAnalyticsBundle = async () => {
  const { analyticsPromise } = await import("./firebase/firebaseAnalytics");
  return analyticsPromise;
};

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
