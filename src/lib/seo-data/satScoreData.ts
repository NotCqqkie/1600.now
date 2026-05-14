export interface ScoreProfile {
  score: number;
  percentile: number;
  tier: string;
  tierDescription: string;
  collegeExamples: string[];
  studyFocus: string;
}

const SCORE_MIN = 400;
const SCORE_MAX = 1600;
const SCORE_STEP = 10;

export const allSatScores = (() => {
  const arr: number[] = [];
  for (let s = SCORE_MIN; s <= SCORE_MAX; s += SCORE_STEP) arr.push(s);
  return arr;
})();

const approxPercentile = (score: number): number => {
  if (score >= 1590) return 99;
  if (score >= 1550) return 99;
  if (score >= 1500) return 98;
  if (score >= 1450) return 96;
  if (score >= 1400) return 94;
  if (score >= 1350) return 91;
  if (score >= 1300) return 86;
  if (score >= 1250) return 80;
  if (score >= 1200) return 74;
  if (score >= 1150) return 66;
  if (score >= 1100) return 58;
  if (score >= 1050) return 49;
  if (score >= 1000) return 40;
  if (score >= 950) return 32;
  if (score >= 900) return 25;
  if (score >= 850) return 18;
  if (score >= 800) return 13;
  if (score >= 750) return 9;
  if (score >= 700) return 6;
  if (score >= 650) return 4;
  if (score >= 600) return 2;
  if (score >= 500) return 1;
  return 1;
};

const tierFor = (score: number): Pick<ScoreProfile, "tier" | "tierDescription" | "collegeExamples" | "studyFocus"> => {
  if (score >= 1550) {
    return {
      tier: "Elite",
      tierDescription:
        "A top-1% SAT score that is competitive for every university in the United States, including the Ivy League, Stanford, MIT, and Caltech.",
      collegeExamples: ["Harvard University", "MIT", "Stanford", "Princeton", "Yale", "Caltech"],
      studyFocus:
        "At this tier, every missed question matters. Focus on eliminating careless errors, drilling the hardest SAT math problems, and mastering difficult Words-in-Context vocabulary.",
    };
  }
  if (score >= 1450) {
    return {
      tier: "Highly Competitive",
      tierDescription:
        "A highly competitive SAT score that puts you above most admitted students at the majority of US universities.",
      collegeExamples: ["Duke", "UChicago", "Northwestern", "Johns Hopkins", "Cornell", "Brown"],
      studyFocus:
        "Target the hardest question types in both Reading & Writing and Math. Practice timed modules so you reach the harder Module 2 consistently.",
    };
  }
  if (score >= 1350) {
    return {
      tier: "Competitive",
      tierDescription:
        "A strong SAT score that is competitive at many selective universities and above average at state flagships.",
      collegeExamples: ["NYU", "Boston University", "UT Austin", "UNC Chapel Hill", "Georgia Tech"],
      studyFocus:
        "Push into the hard Module 2 every time. Focus on advanced grammar, rhetorical synthesis, and the top 25% of SAT math difficulty.",
    };
  }
  if (score >= 1250) {
    return {
      tier: "Above Average",
      tierDescription:
        "An above-average SAT score that is competitive at many good universities and gives you room to apply broadly.",
      collegeExamples: ["Penn State", "Ohio State", "Rutgers", "Syracuse", "University of Maryland"],
      studyFocus:
        "Lock down the medium-difficulty questions you are still missing and start breaking into harder content consistently.",
    };
  }
  if (score >= 1100) {
    return {
      tier: "Solid",
      tierDescription:
        "A solid SAT score around or slightly above the national average that keeps many state universities in reach.",
      collegeExamples: ["Michigan State", "University of Arizona", "Iowa State", "University of Oregon"],
      studyFocus:
        "Rebuild fundamentals in algebra and grammar. Consistency on medium-difficulty questions is worth far more than trying to solve the hardest problems.",
    };
  }
  if (score >= 950) {
    return {
      tier: "Near Average",
      tierDescription:
        "A Digital SAT score near the national average. Many open-admission and regional universities will consider you.",
      collegeExamples: ["University of Kentucky", "San Diego State", "Washington State"],
      studyFocus:
        "Focus on the easier half of each module. Getting every easy and medium question right is the fastest way to add 100+ points.",
    };
  }
  return {
    tier: "Building",
    tierDescription:
      "A starting SAT score that can be improved significantly with targeted, consistent practice.",
    collegeExamples: ["Open-admission state universities", "Community colleges with transfer paths"],
    studyFocus:
      "Build foundations. Review basic algebra, grammar rules, and high-frequency vocabulary. A structured 8-week study plan often adds 150+ points.",
  };
};

export const getScoreProfile = (score: number): ScoreProfile => ({
  score,
  percentile: approxPercentile(score),
  ...tierFor(score),
});
