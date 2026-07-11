import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const firebaseAnalyticsMocks = vi.hoisted(() => ({
  disableAnalyticsCollectionIfInitialized: vi.fn(),
  getAnalyticsPromise: vi.fn(async () => null),
}));

vi.mock("@/lib/firebase/firebaseAnalytics", () => firebaseAnalyticsMocks);

import {
  getAnalyticsConsent,
  initAnalytics,
  setAnalyticsConsent,
} from "@/lib/analytics";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analytics consent", () => {
  it("does not load analytics until consent is granted and disables it on revocation", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    firebaseAnalyticsMocks.getAnalyticsPromise.mockClear();
    firebaseAnalyticsMocks.disableAnalyticsCollectionIfInitialized.mockClear();

    expect(getAnalyticsConsent()).toBe("unset");
    await initAnalytics();
    expect(firebaseAnalyticsMocks.getAnalyticsPromise).not.toHaveBeenCalled();

    setAnalyticsConsent("granted");
    await initAnalytics();
    expect(firebaseAnalyticsMocks.getAnalyticsPromise).toHaveBeenCalled();

    setAnalyticsConsent("denied");
    await vi.waitFor(() => {
      expect(firebaseAnalyticsMocks.disableAnalyticsCollectionIfInitialized).toHaveBeenCalled();
    });
    expect(getAnalyticsConsent()).toBe("denied");
  });

  it("has no executable inline scripts or unconditional analytics in the HTML shell", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    const executableScripts = scripts.filter(([, attributes]) =>
      !/\btype=["']application\/ld\+json["']/i.test(attributes),
    );

    expect(executableScripts.length).toBeGreaterThan(0);
    for (const [, attributes, body] of executableScripts) {
      expect(attributes).toMatch(/\bsrc=["'][^"']+["']/i);
      expect(body.trim()).toBe("");
    }
    expect(html).not.toContain("googletagmanager.com");
    expect(html).not.toContain("gtag('config'");
    expect(html).not.toContain("window.dataLayer");
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it("keeps Firebase hosting CSP compatible with App Check without inline script execution", () => {
    const firebaseConfig = JSON.parse(
      readFileSync(new URL("../../firebase.json", import.meta.url), "utf8"),
    ) as {
      hosting: {
        headers: Array<{ headers: Array<{ key: string; value: string }> }>;
      };
    };
    const csp = firebaseConfig.hosting.headers
      .flatMap((entry) => entry.headers)
      .find((header) => header.key === "Content-Security-Policy")?.value;
    expect(csp).toBeTruthy();

    const directives = new Map(
      csp?.split(";").map((directive) => {
        const [name, ...values] = directive.trim().split(/\s+/);
        return [name, values] as const;
      }),
    );
    expect(directives.get("script-src")).not.toContain("'unsafe-inline'");
    expect(directives.get("script-src")).toEqual(expect.arrayContaining([
      "https://www.google.com/recaptcha/",
      "https://www.gstatic.com/recaptcha/",
    ]));
    expect(directives.get("connect-src")).toContain("https://www.google.com/recaptcha/");
    expect(directives.get("frame-src")).toEqual(expect.arrayContaining([
      "https://www.google.com/recaptcha/",
      "https://recaptcha.google.com/recaptcha/",
    ]));
  });
});
