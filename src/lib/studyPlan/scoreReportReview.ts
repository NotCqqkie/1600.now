import {
  studyPlanFocusById,
  type StudyPlanFocusId,
} from "@/lib/studyPlan/studyPlanEngine";
import type {
  ParsedScoreReport,
  ScoreReportDomainResult,
  ScoreReportFocusId,
} from "@/lib/studyPlan/scoreReportParser";

export interface ScoreReportReviewDomain {
  id: ScoreReportFocusId;
  label: string;
  section: "Math" | "Reading & Writing";
  metrics: string[];
}

export interface ScoreReportReviewFocusChange {
  current: StudyPlanFocusId[];
  next: StudyPlanFocusId[];
  additions: StudyPlanFocusId[];
  removals: StudyPlanFocusId[];
  retained: StudyPlanFocusId[];
  selectionUnchanged: boolean;
}

export interface ScoreReportReview {
  hasReliableDomainEvidence: boolean;
  usesRecommendedFocus: boolean;
  weakDomains: ScoreReportReviewDomain[];
  focusChange: ScoreReportReviewFocusChange;
}

const hasDomainMetric = (domain: ScoreReportDomainResult) =>
  typeof domain.proficiency === "number" || typeof domain.performanceMidpoint === "number";

const uniqueKnownFocus = (focus: readonly StudyPlanFocusId[]) =>
  Array.from(new Set(focus.filter((item) => studyPlanFocusById.has(item))));

const safePerformanceRange = (value: string | undefined) => {
  const match = value?.match(/^\s*(\d{3})\s*-\s*(\d{3})\s*$/);
  if (!match) return null;
  const lower = Number(match[1]);
  const upper = Number(match[2]);
  return lower >= 200 && upper <= 800 && lower <= upper ? `${lower}-${upper}` : null;
};

const safeQuestionRange = (value: string | undefined) => {
  const match = value?.match(/^\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*$/);
  if (!match) return null;
  const lower = Number(match[1]);
  const upper = Number(match[2] ?? match[1]);
  if (lower < 1 || upper < lower) return null;
  return match[2] ? `${lower}-${upper}` : String(lower);
};

const metricStrings = (domain: ScoreReportDomainResult | undefined) => {
  if (!domain) return [];
  const metrics: string[] = [];
  if (Number.isInteger(domain.proficiency) && domain.proficiency! >= 1 && domain.proficiency! <= 7) {
    metrics.push(`Band ${domain.proficiency} of 7`);
  }
  const performanceRange = safePerformanceRange(domain.performanceRange);
  if (performanceRange) metrics.push(`Performance range ${performanceRange}`);
  if (Number.isInteger(domain.percent) && domain.percent! >= 0 && domain.percent! <= 100) {
    metrics.push(`${domain.percent}%`);
  }
  const questionRange = safeQuestionRange(domain.questionRange);
  if (questionRange) metrics.push(`${questionRange} questions`);
  return metrics;
};

export const buildScoreReportReview = (
  report: ParsedScoreReport,
  currentFocus: readonly StudyPlanFocusId[],
): ScoreReportReview => {
  const current = uniqueKnownFocus(currentFocus);
  const recommended = Array.from(new Set(
    report.recommendedFocus.filter((focus) => studyPlanFocusById.has(focus)),
  ));
  const hasReliableDomainEvidence = report.domains.filter(hasDomainMetric).length >= 2;
  const usesRecommendedFocus = recommended.length > 0 && hasReliableDomainEvidence;
  const next = usesRecommendedFocus
    ? Array.from(new Set<StudyPlanFocusId>([...recommended, "Pacing"]))
    : current;
  const currentSet = new Set(current);
  const nextSet = new Set(next);
  const domainsById = new Map(report.domains.map((domain) => [domain.id, domain]));
  const weakDomains = recommended.flatMap((id): ScoreReportReviewDomain[] => {
    const area = studyPlanFocusById.get(id);
    if (!area || area.section === "Strategy") return [];
    return [{
      id,
      label: area.label,
      section: area.section,
      metrics: metricStrings(domainsById.get(id)),
    }];
  });
  const additions = next.filter((focus) => !currentSet.has(focus));
  const removals = current.filter((focus) => !nextSet.has(focus));

  return {
    hasReliableDomainEvidence,
    usesRecommendedFocus,
    weakDomains,
    focusChange: {
      current,
      next,
      additions,
      removals,
      retained: current.filter((focus) => nextSet.has(focus)),
      selectionUnchanged: additions.length === 0 && removals.length === 0,
    },
  };
};
