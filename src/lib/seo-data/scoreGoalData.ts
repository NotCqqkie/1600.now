export interface ScoreGoalPage {
  slug: string;
  target: number | "perfect" | "good" | "average";
  metaTitle: string;
  metaDescription: string;
  headline: string;
  intro: string;
}

export const howToGetTargets = [1000, 1100, 1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600] as const;

export const scoreGoalPages: ScoreGoalPage[] = [
  ...howToGetTargets.map((targetScore): ScoreGoalPage => ({
    slug: `how-to-get-${targetScore}-sat`,
    target: targetScore,
    metaTitle: `How to Get a ${targetScore} on the SAT (2026 Guide)`,
    metaDescription: targetScore === 1350
      ? "How to reach a 1350 SAT with a valid 670/680 section target, a medium-question accuracy plan, timed modules, and focused review."
      : targetScore === 1550
        ? "How to reach a 1550 SAT with a valid 770/780 section target, hard-module practice, error analysis, and a near-ceiling retake plan."
        : `Plan for a ${targetScore} Digital SAT score with valid section targets, official percentile context, timed modules, and a focused study plan.`,
    headline: `How to Get a ${targetScore} on the SAT`,
    intro: targetScore === 1350
      ? "A 1350 target is mainly an accuracy problem: protect easy and medium questions, reach the harder second module consistently, and use your section split to decide where the next 20–40 points should come from."
      : targetScore === 1550
        ? "A 1550 target is a near-ceiling consistency problem. The plan is to preserve every routine point, diagnose the few hard-question misses that remain, and make your timed results repeatable across full tests."
        : `A ${targetScore} is a specific Digital SAT target. This guide uses valid 10-point section splits, official percentile context, and a week-by-week practice plan without pretending there is one fixed missed-question allowance.`,
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
    metaTitle: "Average SAT Score: 1029 for the Class of 2025",
    metaDescription:
      "College Board reports a 1029 mean SAT score for the class of 2025: 521 Reading and Writing and 508 Math. See how to use that benchmark.",
    headline: "What Is the Average SAT Score?",
    intro:
      "College Board reports a mean SAT score of 1029 for the class of 2025, split into 521 Reading and Writing and 508 Math. Use that dated national benchmark for context, then use each college's current range for admissions planning.",
  },
];

export const scoreGoalBySlug = new Map(scoreGoalPages.map((scoreGoalPage) => [scoreGoalPage.slug, scoreGoalPage]));
