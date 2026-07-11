import { beforeEach, describe, expect, it, vi } from "vitest";

const sdkMocks = vi.hoisted(() => ({
  analytics: {},
  initializeAnalytics: vi.fn(),
  isSupported: vi.fn(async () => true),
  logEvent: vi.fn(),
  setAnalyticsCollectionEnabled: vi.fn(),
  setConsent: vi.fn(),
  setUserId: vi.fn(),
}));

vi.mock("@/lib/firebase/firebaseApp", () => ({
  app: {},
  firebaseAnalyticsConfigError: null,
}));

vi.mock("@/lib/firebase/firebaseHosts", () => ({
  isLocalHost: () => false,
}));

vi.mock("firebase/analytics", () => sdkMocks);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sdkMocks.initializeAnalytics.mockReturnValue(sdkMocks.analytics);
  vi.stubGlobal("window", { location: { hostname: "1600.now" } });
  vi.stubGlobal("navigator", { webdriver: false });
});

describe("Firebase Analytics transport", () => {
  it("initializes once without an automatic page view or advertising signals", async () => {
    const { getAnalyticsPromise } = await import("@/lib/firebase/firebaseAnalytics");

    const bundle = await getAnalyticsPromise("denied");

    expect(bundle?.analytics).toBe(sdkMocks.analytics);
    expect(sdkMocks.initializeAnalytics).toHaveBeenCalledTimes(1);
    expect(sdkMocks.initializeAnalytics).toHaveBeenCalledWith({}, {
      config: {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      },
    });
    expect(sdkMocks.setConsent).toHaveBeenCalledWith({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      personalization_storage: "denied",
      functionality_storage: "granted",
      security_storage: "granted",
    });
    expect(sdkMocks.setConsent.mock.invocationCallOrder[0]).toBeLessThan(
      sdkMocks.initializeAnalytics.mock.invocationCallOrder[0],
    );
    expect(sdkMocks.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(
      sdkMocks.analytics,
      true,
    );
    expect(sdkMocks.setUserId).toHaveBeenLastCalledWith(sdkMocks.analytics, null);

    await getAnalyticsPromise("granted");
    expect(sdkMocks.initializeAnalytics).toHaveBeenCalledTimes(1);
    expect(sdkMocks.setConsent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      }),
    );
  });

  it("clears user identity and disables collection on explicit opt-out", async () => {
    const {
      disableAnalyticsCollectionIfInitialized,
      getAnalyticsPromise,
    } = await import("@/lib/firebase/firebaseAnalytics");
    await getAnalyticsPromise("granted");
    sdkMocks.setAnalyticsCollectionEnabled.mockClear();
    sdkMocks.setConsent.mockClear();
    sdkMocks.setUserId.mockClear();

    disableAnalyticsCollectionIfInitialized();

    await vi.waitFor(() => {
      expect(sdkMocks.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(
        sdkMocks.analytics,
        false,
      );
    });
    expect(sdkMocks.setConsent).toHaveBeenLastCalledWith(
      expect.objectContaining({ analytics_storage: "denied" }),
    );
    expect(sdkMocks.setUserId).toHaveBeenLastCalledWith(sdkMocks.analytics, null);
  });

  it("does not contaminate analytics from automated browsers", async () => {
    vi.stubGlobal("navigator", { webdriver: true });
    const { getAnalyticsPromise } = await import("@/lib/firebase/firebaseAnalytics");

    expect(await getAnalyticsPromise("denied")).toBeNull();
    expect(sdkMocks.initializeAnalytics).not.toHaveBeenCalled();
  });
});
