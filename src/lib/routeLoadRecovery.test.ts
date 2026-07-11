import { describe, expect, it } from "vitest";

import {
  registerRouteLoadErrorReset,
  resetRouteLoadErrors,
} from "@/lib/routeLoadRecovery";

describe("route load recovery", () => {
  it("resets registered failed loaders before an error-boundary retry", () => {
    let resets = 0;
    const unregister = registerRouteLoadErrorReset(() => { resets += 1; });

    resetRouteLoadErrors();
    unregister();
    resetRouteLoadErrors();

    expect(resets).toBe(1);
  });
});
