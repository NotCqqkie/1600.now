import { describe, expect, it, vi } from "vitest";
import { createAbortableRequestGuard } from "@/lib/abortableRequestGuard";

describe("createAbortableRequestGuard", () => {
  it("blocks commits and aborts the signal after cancellation", () => {
    const guard = createAbortableRequestGuard();

    expect(guard.canCommit()).toBe(true);
    expect(guard.signal.aborted).toBe(false);

    guard.abort();

    expect(guard.canCommit()).toBe(false);
    expect(guard.signal.aborted).toBe(true);
  });

  it("rejects a stale async commit after cancellation", async () => {
    const guard = createAbortableRequestGuard();
    const commit = vi.fn();
    const pendingCommit = Promise.resolve().then(() => {
      if (guard.canCommit()) commit();
    });

    guard.abort();
    await pendingCommit;

    expect(commit).not.toHaveBeenCalled();
  });
});
