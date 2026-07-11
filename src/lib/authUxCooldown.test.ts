import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_UX_COOLDOWN_MS,
  assertAuthUxCooldownElapsed,
  clearAuthUxCooldown,
  startAuthUxCooldown,
  validatePasswordInput,
} from "@/lib/authUxCooldown";
import { describeAuthError } from "@/lib/firebase/authErrors";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    },
  };
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("auth UX cooldowns", () => {
  it("uses short action-scoped cooldowns without storing account identifiers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    const { storage, values } = createStorage();
    values.set("1600now:auth-attempts:signin:student@example.com", "{}");
    vi.stubGlobal("window", { localStorage: storage });

    startAuthUxCooldown("passwordReset");

    expect([...values.keys()]).toEqual(["1600now:auth-ux-cooldown:passwordReset"]);
    expect(() => assertAuthUxCooldownElapsed("passwordReset")).toThrow(
      "Please wait 30 seconds before trying again.",
    );
    vi.advanceTimersByTime(AUTH_UX_COOLDOWN_MS.passwordReset);
    expect(() => assertAuthUxCooldownElapsed("passwordReset")).not.toThrow();
  });

  it("never blocks authentication when local storage is unavailable", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    });

    expect(() => assertAuthUxCooldownElapsed("signin")).not.toThrow();
    expect(() => startAuthUxCooldown("signin")).not.toThrow();
    expect(() => clearAuthUxCooldown("signin")).not.toThrow();
  });

  it("keeps client cooldown messaging separate from Firebase server quotas", () => {
    expect(describeAuthError(
      { code: "auth/client-cooldown", message: "Please wait 2 seconds before trying again." },
      "signin",
    )).toEqual({
      title: "Please wait",
      description: "Please wait 2 seconds before trying again.",
    });
    expect(describeAuthError({ code: "auth/too-many-requests" }, "signin").title).toBe(
      "Too many requests",
    );
  });
});

describe("password input validation", () => {
  it("provides immediate feedback without presenting it as server enforcement", () => {
    expect(() => validatePasswordInput("short1")).toThrow(
      "Use at least 8 characters and 1 number.",
    );
    expect(() => validatePasswordInput("long-enough-1")).not.toThrow();
  });
});
