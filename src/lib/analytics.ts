const loadAnalyticsBundle = async () => {
  const { analyticsPromise } = await import("./firebase");
  return analyticsPromise;
};

export async function trackEvent(
  name: string,
  params?: Record<string, unknown>,
): Promise<void> {
  const bundle = await loadAnalyticsBundle();
  if (!bundle) return;
  bundle.logEvent(bundle.analytics, name as string, params);
}

export async function identifyUser(userId: string | null): Promise<void> {
  const bundle = await loadAnalyticsBundle();
  if (!bundle) return;
  bundle.setUserId(bundle.analytics, userId);
}

export function trackPageView(path: string): void {
  void trackEvent("page_view", {
    page_path: path,
    page_location: typeof window !== "undefined" ? window.location.href : path,
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
}

export function trackLogin(method: "password" | "google"): void {
  void trackEvent("login", { method });
}

export function trackSignUp(method: "password" | "google"): void {
  void trackEvent("sign_up", { method });
}
