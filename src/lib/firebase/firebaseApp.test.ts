import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const firebaseAppSource = readFileSync(new URL("./firebaseApp.ts", import.meta.url), "utf8");

describe("Firebase App Check bootstrap", () => {
  it("uses a synchronous App Check import and initialization", () => {
    expect(firebaseAppSource).toMatch(
      /import \{ initializeAppCheck, ReCaptchaV3Provider \} from "firebase\/app-check"/,
    );
    expect(firebaseAppSource).not.toContain('import("firebase/app-check")');
    expect(firebaseAppSource.indexOf("initializeAppCheck(app")).toBeGreaterThan(
      firebaseAppSource.indexOf("export const app"),
    );
  });

  it("does nothing without an app, site key, or browser", () => {
    expect(firebaseAppSource).toContain("export const appCheck");
    expect(firebaseAppSource).toContain('typeof window === "undefined"');
    expect(firebaseAppSource).toContain('typeof document === "undefined"');
    expect(firebaseAppSource).toMatch(/try \{\s+return initializeAppCheck\(app,/);
  });
});
