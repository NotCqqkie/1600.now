import { describe, expect, it, vi } from "vitest";
import { createRetryableLazyLoader } from "@/lib/retryableLazyLoader";

describe("createRetryableLazyLoader", () => {
  it("drops a rejected promise and retries the next request", async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockResolvedValueOnce("loaded");
    const retryableLoad = createRetryableLazyLoader(load);

    await expect(retryableLoad()).rejects.toThrow("chunk failed");
    await expect(retryableLoad()).resolves.toBe("loaded");
    await expect(retryableLoad()).resolves.toBe("loaded");

    expect(load).toHaveBeenCalledTimes(2);
  });
});
