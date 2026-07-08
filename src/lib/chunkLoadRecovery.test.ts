import { describe, expect, it } from "vitest";

import { isChunkLoadError } from "@/lib/chunkLoadRecovery";

describe("isChunkLoadError", () => {
  it("matches dynamic import failures", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
  });

  it("matches HTML responses served to module scripts", () => {
    expect(
      isChunkLoadError(
        new Error(
          'Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec.',
        ),
      ),
    ).toBe(true);
  });

  it("matches the Firefox stale React dispatcher error", () => {
    expect(isChunkLoadError(new TypeError('can\'t access property "useContext", dispatcher is null'))).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isChunkLoadError(new Error("Regular application error"))).toBe(false);
  });
});
