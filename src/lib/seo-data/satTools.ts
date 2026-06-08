
export interface SatToolMeta {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
}

export const satTools: SatToolMeta[] = [
  {
    slug: "sat-to-act-converter",
    name: "SAT to ACT Converter",
    metaTitle: "SAT to ACT Converter (2026 Official Concordance Tables)",
    metaDescription:
      "Convert your SAT score to an ACT composite score using the current College Board and ACT concordance tables. Works both directions.",
    intro:
      "Use the official 2018 College Board × ACT concordance tables to convert between SAT total scores and ACT composite scores. The tables remain the concordance of record for the Digital SAT in 2026.",
  },
  {
    slug: "sat-percentile-calculator",
    name: "SAT Percentile Calculator",
    metaTitle: "SAT Percentile Calculator: What Percentile Is My SAT Score?",
    metaDescription:
      "Find the percentile rank of any Digital SAT score. Compare your score against the national test-taker population.",
    intro:
      "Enter any Digital SAT total score to see its approximate national percentile rank based on the most recent released College Board data.",
  },
  {
    slug: "psat-to-sat-predictor",
    name: "PSAT to SAT Score Predictor",
    metaTitle: "PSAT to SAT Score Predictor (2026)",
    metaDescription:
      "Predict your future SAT score from your PSAT 10 or PSAT/NMSQT score with the official College Board score concordance.",
    intro:
      "The PSAT and SAT share a single vertical scale, so your PSAT score is a direct prediction of your current SAT ability. This tool projects a likely SAT range based on your PSAT result and typical score growth.",
  },
  {
    slug: "sat-study-plan-generator",
    name: "SAT Study Plan Generator",
    metaTitle: "Free SAT Study Plan Generator (2026 Personalized)",
    metaDescription:
      "Generate a personalized week-by-week SAT study plan based on your baseline score, target score, and test date.",
    intro:
      "Tell us your current score, target score, and test date. We produce a week-by-week Digital SAT study plan — balancing diagnostic, skill drills, timed modules, and full-length practice — that matches the time you actually have.",
  },
  {
    slug: "what-sat-score-do-i-need",
    name: "What SAT Score Do I Need?",
    metaTitle: "What SAT Score Do I Need? (2026 College Admissions Targets)",
    metaDescription:
      "Enter a target college to see the SAT score range you need to be competitive, based on the latest admitted-student data.",
    intro:
      "Every college has a different SAT admissions profile. Enter a school and see the SAT score range that makes you competitive, plus the 25th and 75th percentile of admitted students.",
  },
  {
    slug: "sat-test-countdown",
    name: "SAT Test Countdown",
    metaTitle: "SAT Test Countdown: Days Until Your Next SAT Test Date",
    metaDescription:
      "Count the days until the next Digital SAT test date, plus a full list of upcoming 2026 SAT dates.",
    intro:
      "Count down to the next Digital SAT administration. Pick your target test date and see the days remaining, with the full 2026–2027 test schedule below.",
  },
];

export const satToolBySlug = new Map(satTools.map((t) => [t.slug, t]));
