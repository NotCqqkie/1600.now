export const SAT_SCORE_CTR_EXPERIMENT_ID = "2026-07-score-title";

export const SAT_SCORE_CTR_TREATMENT_SCORES = [
  430, 450, 510, 520, 530, 540, 580, 590, 630, 790, 800, 810, 890, 920,
  940, 1010, 1070, 1100, 1130, 1160, 1220, 1240, 1260, 1370, 1380, 1410,
  1420, 1440, 1460, 1470, 1500, 1510, 1570, 1590,
] as const;

export const SAT_SCORE_CTR_CONTROL_SCORES = [
  470, 560, 570, 640, 650, 680, 700, 720, 770, 840, 860, 880, 930, 1000,
  1060, 1090, 1110, 1140, 1150, 1190, 1210, 1230, 1270, 1320, 1330,
  1390, 1400, 1430, 1450, 1480, 1490, 1520, 1550, 1560,
] as const;

const treatmentScores = new Set<number>(SAT_SCORE_CTR_TREATMENT_SCORES);
const controlScores = new Set<number>(SAT_SCORE_CTR_CONTROL_SCORES);

export type SatScoreCtrExperimentArm = "treatment" | "control" | "excluded";

export const getSatScoreCtrExperimentArm = (
  score: number,
): SatScoreCtrExperimentArm => {
  if (treatmentScores.has(score)) return "treatment";
  if (controlScores.has(score)) return "control";
  return "excluded";
};

export const getSatScoreControlTitle = (score: number) =>
  score === 1530
    ? "1530 SAT Score: Is It Good? Official Percentile & Section Splits"
    : score + " SAT Score: Percentile, Valid Section Splits & Next Steps";

export const getSatScoreDocumentTitle = (score: number) =>
  treatmentScores.has(score)
    ? "Is " + score + " a Good SAT Score? Percentile & College Ranges"
    : getSatScoreControlTitle(score);
