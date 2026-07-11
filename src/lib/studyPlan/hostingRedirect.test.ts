import { readFileSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";

import { describe, expect, it } from "vitest";

describe("study-plan hosting redirect", () => {
  it("redirects the retired lab route before the SPA catch-all", () => {
    const config = JSON.parse(
      readFileSync(path.join(cwd(), "firebase.json"), "utf8"),
    ) as {
      hosting?: {
        redirects?: Array<{ source?: string; destination?: string; type?: number }>;
        rewrites?: Array<{ source?: string; destination?: string }>;
      };
    };

    expect(config.hosting?.redirects).toContainEqual({
      source: "/study-plan-lab",
      destination: "/sat-study-plan-generator",
      type: 301,
    });
    expect(config.hosting?.rewrites?.some((rewrite) => rewrite.destination === "/spa-shell.html"))
      .toBe(true);
  });
});
