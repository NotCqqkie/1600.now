import { describe, expect, it } from "vitest";

import { answersEquivalent } from "@/lib/text/answerEquivalence";

describe("answersEquivalent", () => {
  it("accepts an exact match", () => {
    expect(answersEquivalent("A", "A")).toBe(true);
  });

  it("rejects a mismatch", () => {
    expect(answersEquivalent("B", "A")).toBe(false);
  });

  it("returns false when either side is blank", () => {
    expect(answersEquivalent("", "A")).toBe(false);
    expect(answersEquivalent("A", "")).toBe(false);
    expect(answersEquivalent(null, "A")).toBe(false);
    expect(answersEquivalent("A", undefined)).toBe(false);
  });

  it("normalizes whitespace and case", () => {
    expect(answersEquivalent("  Hello ", "hello")).toBe(true);
    expect(answersEquivalent("a b c", "abc")).toBe(true);
  });

  describe("comma-separated accepted forms", () => {
    const accepted = "1/2,0.5,.5";

    it("accepts each listed form", () => {
      expect(answersEquivalent("0.5", accepted)).toBe(true);
      expect(answersEquivalent("1/2", accepted)).toBe(true);
      expect(answersEquivalent(".5", accepted)).toBe(true);
    });

    it("rejects a value not equivalent to any listed form", () => {
      expect(answersEquivalent("0.6", accepted)).toBe(false);
    });
  });

  describe("fraction / decimal equivalence", () => {
    it("treats an equivalent fraction and decimal as equal", () => {
      expect(answersEquivalent("0.5", "1/2")).toBe(true);
      expect(answersEquivalent("1/2", "0.5")).toBe(true);
    });

    it("accepts a decimal that rounds to the fraction at the user's precision", () => {
      expect(answersEquivalent("0.33", "1/3")).toBe(true);
      expect(answersEquivalent("0.333", "1/3")).toBe(true);
    });

    it("handles signed fractions", () => {
      expect(answersEquivalent("-0.5", "-1/2")).toBe(true);
    });
  });

  describe("thousands-separator regression (data-side fix required)", () => {
    // A plain integer answer is graded correctly.
    it("grades a single unformatted value correct", () => {
      expect(answersEquivalent("3540", "3540")).toBe(true);
    });

    // A correct answer authored with a thousands separator (e.g. "3,540")
    // is split on the comma into ["3", "540"], so neither part matches the
    // user's "3540". This documents CURRENT (buggy) behavior: the data must
    // NOT contain thousands separators. If this ever starts returning true,
    // the splitting contract changed and this comment should be revisited.
    it("mis-splits a thousands-formatted correct answer", () => {
      expect(answersEquivalent("3540", "3,540")).toBe(false);
    });

    // Likewise a user typing a thousands separator does not match, because
    // "3,540" is not a recognized rational and does not normalize to "3540".
    it("does not match a user-entered thousands separator", () => {
      expect(answersEquivalent("3,540", "3540")).toBe(false);
    });
  });
});
