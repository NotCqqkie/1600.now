
export interface ScoreGoalPage {
  slug: string;
  target: number | "perfect" | "good" | "average";
  metaTitle: string;
  metaDescription: string;
  headline: string;
  intro: string;
}

const howToGetTargets = [1000, 1100, 1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600];

export const scoreGoalPages: ScoreGoalPage[] = [
  ...howToGetTargets.map((n): ScoreGoalPage => ({
    slug: `how-to-get-${n}-sat`,
    target: n,
    metaTitle: `How to Get a ${n} on the SAT (2026 Guide)`,
    metaDescription: `A ${n} Digital SAT score is realistic with a focused plan. Section split, percentile, question-miss budget, and the study plan that gets you there.`,
    headline: `How to Get a ${n} on the SAT`,
    intro: `A ${n} is a specific, reachable target on the Digital SAT — but only if your prep matches the score. This guide breaks down the exact section split, the number of questions you can afford to miss, and the week-by-week plan that reliably produces a ${n}.`,
  })),
  {
    slug: "perfect-sat-score-1600",
    target: "perfect",
    metaTitle: "Perfect SAT Score (1600): How Rare It Is and How to Get One",
    metaDescription:
      "A 1600 SAT is the highest possible Digital SAT score. Percentile, how many students get it, and what it takes to land a perfect score.",
    headline: "The Perfect SAT Score (1600)",
    intro:
      "A 1600 is the highest possible Digital SAT score and places you at the 99th+ percentile. Fewer than 1 in 500 test takers score a 1600, and doing so reliably requires near-zero careless errors across the hardest Module 2 on both sections.",
  },
  {
    slug: "good-sat-score",
    target: "good",
    metaTitle: "What Is a Good SAT Score? (2026 Benchmarks)",
    metaDescription:
      "A good SAT score depends on where you're applying. National average, 75th percentile benchmarks, and score ranges for every tier of college.",
    headline: "What Is a Good SAT Score?",
    intro:
      "There is no single \"good\" SAT score — only scores that are competitive for the schools you want to apply to. This page walks through the national averages, tier cutoffs, and target scores for every major group of US colleges.",
  },
  {
    slug: "average-sat-score",
    target: "average",
    metaTitle: "What Is the Average SAT Score? (2026)",
    metaDescription:
      "The current average Digital SAT score, section breakdown, and how to use the average to set a realistic target for college admissions.",
    headline: "What Is the Average SAT Score?",
    intro:
      "The current national average Digital SAT score is approximately 1050, split roughly evenly between the Reading and Writing and Math sections. The average is useful as a benchmark, but most competitive schools expect scores well above it.",
  },
];

export const scoreGoalBySlug = new Map(scoreGoalPages.map((p) => [p.slug, p]));
