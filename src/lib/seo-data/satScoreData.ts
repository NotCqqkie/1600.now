interface ScoreProfile {
  score: number;
  percentile: number;
  percentileLabel: string;
  tier: string;
  tierDescription: string;
  collegeExamples: string[];
  studyFocus: string;
}

const SCORE_MIN = 400;
const SCORE_MAX = 1600;
const SCORE_STEP = 10;
type TierProfile = Pick<ScoreProfile, "tier" | "tierDescription" | "collegeExamples" | "studyFocus">;

export const COLLEGE_BOARD_SAT_PERCENTILES_URL =
  "https://research.collegeboard.org/reports/sat-suite/understanding-scores/sat";

const USER_PERCENTILE_BY_SCORE = new Map<number, string>([
  [1600, "99+"], [1590, "99+"], [1580, "99+"], [1570, "99+"], [1560, "99+"],
  [1550, "99"], [1540, "99"], [1530, "99"], [1520, "98"], [1510, "98"],
  [1500, "98"], [1490, "97"], [1480, "97"], [1470, "97"], [1460, "96"],
  [1450, "96"], [1440, "95"], [1430, "95"], [1420, "94"], [1410, "94"],
  [1400, "93"], [1390, "93"], [1380, "92"], [1370, "91"], [1360, "91"],
  [1350, "90"], [1340, "89"], [1330, "89"], [1320, "88"], [1310, "87"],
  [1300, "86"], [1290, "85"], [1280, "84"], [1270, "84"], [1260, "83"],
  [1250, "82"], [1240, "81"], [1230, "80"], [1220, "79"], [1210, "77"],
  [1200, "76"], [1190, "75"], [1180, "74"], [1170, "73"], [1160, "71"],
  [1150, "70"], [1140, "69"], [1130, "68"], [1120, "66"], [1110, "65"],
  [1100, "63"], [1090, "62"], [1080, "60"], [1070, "59"], [1060, "57"],
  [1050, "56"], [1040, "54"], [1030, "53"], [1020, "51"], [1010, "50"],
  [1000, "48"], [990, "47"], [980, "45"], [970, "44"], [960, "42"],
  [950, "41"], [940, "39"], [930, "37"], [920, "36"], [910, "34"],
  [900, "33"], [890, "31"], [880, "30"], [870, "28"], [860, "27"],
  [850, "25"], [840, "24"], [830, "22"], [820, "21"], [810, "19"],
  [800, "18"], [790, "16"], [780, "15"], [770, "13"], [760, "12"],
  [750, "11"], [740, "9"], [730, "8"], [720, "7"], [710, "6"],
  [700, "5"], [690, "5"], [680, "4"], [670, "3"], [660, "3"],
  [650, "3"], [640, "2"], [630, "2"], [620, "2"], [610, "2"],
  [600, "1"], [590, "1"], [580, "1"], [570, "1"], [560, "1"],
  [550, "1"], [540, "1"], [530, "1"], [520, "1-"], [510, "1-"],
  [500, "1-"], [490, "1-"], [480, "1-"], [470, "1-"], [460, "1-"],
  [450, "1-"], [440, "1-"], [430, "1-"], [420, "1-"], [410, "1-"],
  [400, "1-"],
]);

export const allSatScores = (() => {
  const arr: number[] = [];
  for (let s = SCORE_MIN; s <= SCORE_MAX; s += SCORE_STEP) arr.push(s);
  return arr;
})();

export const formatOrdinal = (value: number): string => {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
};

const percentileFor = (score: number) => {
  const raw = USER_PERCENTILE_BY_SCORE.get(score) ?? "1-";
  const percentile = Number.parseInt(raw, 10);
  const percentileLabel = raw === "99+"
    ? "99th+"
    : raw === "1-"
      ? "below 1st"
      : formatOrdinal(percentile);
  return { percentile, percentileLabel };
};

export const getBalancedSectionSplit = (score: number) => {
  const lowerSection = Math.floor(score / 20) * 10;
  return { rw: lowerSection, math: score - lowerSection };
};

const tierFor = (score: number): TierProfile => {
  if (score >= 1550) {
    return {
      tier: "Elite",
      tierDescription:
        "A top-percentile SAT score nationally. It falls within the reported ranges at many highly selective universities, but it does not predict admission.",
      collegeExamples: ["Harvard University", "MIT", "Stanford", "Princeton", "Yale", "Caltech"],
      studyFocus:
        "At this tier, every missed question matters. Focus on eliminating careless errors, drilling the hardest SAT math problems, and mastering difficult Words-in-Context vocabulary.",
    };
  }
  if (score >= 1450) {
    return {
      tier: "Highly Competitive",
      tierDescription:
        "A high national SAT score that may fall within the reported range at many selective universities. Compare it with each institution's current data.",
      collegeExamples: ["Duke", "UChicago", "Northwestern", "Johns Hopkins", "Cornell", "Brown"],
      studyFocus:
        "Target the hardest question types in both Reading & Writing and Math. Practice timed modules so you reach the harder Module 2 consistently.",
    };
  }
  if (score >= 1350) {
    return {
      tier: "Competitive",
      tierDescription:
        "A strong national SAT score. Whether it helps an application depends on each institution's current middle-50% range and testing policy.",
      collegeExamples: ["NYU", "Boston University", "UT Austin", "UNC Chapel Hill", "Georgia Tech"],
      studyFocus:
        "Push into the hard Module 2 every time. Focus on advanced grammar, rhetorical synthesis, and the top 25% of SAT math difficulty.",
    };
  }
  if (score >= 1250) {
    return {
      tier: "Above Average",
      tierDescription:
        "An above-average SAT score that can fit the reported ranges at many four-year universities.",
      collegeExamples: ["Penn State", "Ohio State", "Rutgers", "Syracuse", "University of Maryland"],
      studyFocus:
        "Lock down the medium-difficulty questions you are still missing and start breaking into harder content consistently.",
    };
  }
  if (score >= 1100) {
    return {
      tier: "Solid",
      tierDescription:
        "A score around or above the SAT-user median. Compare it with current ranges for the colleges on your list.",
      collegeExamples: ["Michigan State", "University of Arizona", "Iowa State", "University of Oregon"],
      studyFocus:
        "Rebuild fundamentals in algebra and grammar. Consistency on medium-difficulty questions is worth far more than trying to solve the hardest problems.",
    };
  }
  if (score >= 950) {
    return {
      tier: "Near Average",
      tierDescription:
        "A score near the middle of the SAT-user distribution. Admissions context varies substantially by institution.",
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
  ...percentileFor(score),
  ...tierFor(score),
});
