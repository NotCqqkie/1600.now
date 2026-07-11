import { describe, expect, it } from "vitest";
import { shouldIgnoreQuestionShortcut } from "@/lib/questionKeyboardShortcuts";

const baseEvent = {
  defaultPrevented: false,
  altKey: false,
  metaKey: false,
  ctrlKey: false,
};

describe("shouldIgnoreQuestionShortcut", () => {
  it("allows an unmodified, unhandled key event", () => {
    expect(shouldIgnoreQuestionShortcut(baseEvent)).toBe(false);
  });

  it.each(["defaultPrevented", "altKey", "metaKey", "ctrlKey"] as const)(
    "ignores events when %s is set",
    (key) => {
      expect(shouldIgnoreQuestionShortcut({ ...baseEvent, [key]: true })).toBe(true);
    },
  );
});
