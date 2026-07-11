import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const firebaseAppSource = readFileSync(new URL("./firebaseApp.ts", import.meta.url), "utf8");
const firebaseDbSource = readFileSync(new URL("./firebaseDb.ts", import.meta.url), "utf8");
const questionReportsSource = readFileSync(new URL("../questionReports.ts", import.meta.url), "utf8");

describe("Firebase App Check bootstrap", () => {
  it("initializes App Check only when a Firestore operation begins", () => {
    expect(firebaseAppSource).toContain('from "firebase/app-check"');
    expect(firebaseAppSource).not.toContain('import("firebase/app-check")');
    expect(firebaseAppSource).toContain("export const initializeFirebaseAppCheck");
    expect(firebaseDbSource).not.toContain("initializeFirebaseAppCheck();");
    expect(questionReportsSource).toContain("initializeFirebaseAppCheck()");
  });

  it("does nothing without an app, site key, or browser", () => {
    expect(firebaseAppSource).toContain("export let appCheck");
    expect(firebaseAppSource).toContain('typeof window === "undefined"');
    expect(firebaseAppSource).toContain('typeof document === "undefined"');
    expect(firebaseAppSource).toMatch(/try \{\s+appCheck = initializeAppCheck\(app,/);
  });
});

describe("Firebase Analytics configuration", () => {
  it("pins the production GA4 property and exposes a runtime mismatch assertion", () => {
    expect(firebaseAppSource).toContain(
      'FIREBASE_ANALYTICS_MEASUREMENT_ID = "G-B5Q82GMJ2L"',
    );
    expect(firebaseAppSource).toContain("firebaseAnalyticsConfigError");
    expect(firebaseAppSource).toContain(
      "configuredMeasurementId !== FIREBASE_ANALYTICS_MEASUREMENT_ID",
    );
  });

  it("requires the same property in every production build path", () => {
    const envExample = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
    const workflow = readFileSync(
      new URL("../../../.github/workflows/firebase-hosting-merge.yml", import.meta.url),
      "utf8",
    );
    const dockerCompose = readFileSync(
      new URL("../../../docker-compose.yml", import.meta.url),
      "utf8",
    );
    const viteConfig = readFileSync(new URL("../../../vite.config.ts", import.meta.url), "utf8");

    expect(envExample).toContain("VITE_FIREBASE_MEASUREMENT_ID=G-B5Q82GMJ2L");
    expect(workflow).toContain('FIREBASE_MEASUREMENT_ID" != "G-B5Q82GMJ2L"');
    expect(dockerCompose).toContain(
      "VITE_FIREBASE_MEASUREMENT_ID:?Set VITE_FIREBASE_MEASUREMENT_ID in .env",
    );
    expect(viteConfig).toContain('FIREBASE_ANALYTICS_MEASUREMENT_ID = "G-B5Q82GMJ2L"');
  });
});
