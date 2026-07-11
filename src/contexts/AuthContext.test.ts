import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authContextSource = readFileSync(new URL("./AuthContext.tsx", import.meta.url), "utf8");

describe("authentication recovery", () => {
  it("retries initialization after a dependency failure and clears user state after sign-out", () => {
    expect(authContextSource).toMatch(/authInitializationFailedRef\.current = true/);
    expect(authContextSource).toMatch(/retryAuthInitializationIfNeeded\(\)/);
    expect(authContextSource).toMatch(
      /const signOut = async[\s\S]*await authModule\.signOut\(auth\);\s*applyAppUser\(null\);/,
    );
  });
});
