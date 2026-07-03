import { describe, expect, it } from "vitest";

import { calculatePracticeTestScores } from "@/lib/practice/practiceTestScoring";

type Subject = "reading" | "math";

const makeQuestions = (
  count: number,
  correct: number,
  answered: number,
  difficulty: "Easy" | "Medium" | "Hard",
) =>
  Array.from({ length: count }, (_, index) => ({
    isAnswered: index < answered,
    isCorrect: index < correct,
    difficulty,
  }));

const module = (
  moduleSlug: string,
  subject: Subject,
  moduleNumber: 1 | 2,
  count: number,
  correct: number,
  answered: number,
  difficulty: "Easy" | "Medium" | "Hard",
) => ({ moduleSlug, subject, moduleNumber, questions: makeQuestions(count, correct, answered, difficulty) });

describe("calculatePracticeTestScores", () => {
  it("maps perfect accuracy to the top of the scale", () => {
    const result = calculatePracticeTestScores([
      module("r1", "reading", 1, 27, 27, 27, "Medium"),
      module("r2", "reading", 2, 27, 27, 27, "Hard"),
      module("m1", "math", 1, 22, 22, 22, "Medium"),
      module("m2", "math", 2, 22, 22, 22, "Hard"),
    ]);

    expect(result.readingWritingScore).toBe(800);
    expect(result.mathScore).toBe(800);
    expect(result.totalScore).toBe(1600);
  });

  it("maps an all-unanswered test to near the floor", () => {
    const result = calculatePracticeTestScores([
      module("r1", "reading", 1, 27, 0, 0, "Medium"),
      module("r2", "reading", 2, 27, 0, 0, "Medium"),
      module("m1", "math", 1, 22, 0, 0, "Medium"),
      module("m2", "math", 2, 22, 0, 0, "Medium"),
    ]);

    expect(result.readingWritingScore).toBe(220);
    expect(result.mathScore).toBe(220);
    expect(result.totalScore).toBe(440);
  });

  it("floors at 200 per section when no modules are supplied", () => {
    const result = calculatePracticeTestScores([]);

    expect(result.readingWritingScore).toBe(200);
    expect(result.mathScore).toBe(200);
    expect(result.totalScore).toBe(400);
    expect(result.moduleScores).toEqual({});
  });

  it("keeps totalScore equal to the sum of the section scores", () => {
    const result = calculatePracticeTestScores([
      module("r1", "reading", 1, 27, 20, 27, "Medium"),
      module("r2", "reading", 2, 27, 18, 27, "Hard"),
      module("m1", "math", 1, 22, 16, 22, "Medium"),
      module("m2", "math", 2, 22, 12, 22, "Hard"),
    ]);

    expect(result.totalScore).toBe(result.readingWritingScore + result.mathScore);
  });

  it("makes module scores sum to their section score", () => {
    const result = calculatePracticeTestScores([
      module("read-m1", "reading", 1, 27, 20, 27, "Medium"),
      module("read-m2", "reading", 2, 27, 18, 27, "Hard"),
      module("math-m1", "math", 1, 22, 16, 22, "Medium"),
      module("math-m2", "math", 2, 22, 12, 22, "Hard"),
    ]);

    const readingSum = result.moduleScores["read-m1"] + result.moduleScores["read-m2"];
    const mathSum = result.moduleScores["math-m1"] + result.moduleScores["math-m2"];
    expect(readingSum).toBe(result.readingWritingScore);
    expect(mathSum).toBe(result.mathScore);
  });

  // Golden snapshot pinned to the CURRENT computed output so any change to the
  // scoring model is caught. Recompute intentionally if the algorithm changes.
  it("pins a known mixed input to the current output", () => {
    const result = calculatePracticeTestScores([
      module("read-m1", "reading", 1, 27, 20, 27, "Medium"),
      module("read-m2", "reading", 2, 27, 18, 27, "Hard"),
      module("math-m1", "math", 1, 22, 16, 22, "Medium"),
      module("math-m2", "math", 2, 22, 12, 22, "Hard"),
    ]);

    expect(result).toEqual({
      readingWritingScore: 660,
      mathScore: 600,
      totalScore: 1260,
      moduleScores: {
        "read-m1": 340,
        "read-m2": 320,
        "math-m1": 330,
        "math-m2": 270,
      },
    });
  });

  it("assigns the full section score to a lone module", () => {
    const result = calculatePracticeTestScores([
      module("r1", "reading", 1, 27, 20, 27, "Medium"),
    ]);

    expect(result.moduleScores).toEqual({ r1: result.readingWritingScore });
  });
});
