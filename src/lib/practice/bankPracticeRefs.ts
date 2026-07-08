import type { BankSourceFilter, BankSourceId, BankSubject } from "@/data/bankTypes";
import type { QuestionBankFilters } from "@/lib/questionBankFilters";
import {
  loadFilteredQuestionMetaRows,
  type BankQuestionProgressLookup,
} from "@/data/bankQuestionMetadata";

export interface BankPracticeQuestionRef {
  stableId: string;
  subject: BankSubject;
  id: number;
  sourceId: string;
  bankType: BankSourceId;
  category: { domain: string; skill: string };
  /** Near-duplicate group within the pool; 0 = unique */
  dupGroup: number;
}

// Builds the launchable question list from the generated route index (pool
// order + ids) joined with the metadata rows (filter fields), so starting a
// practice session never fetches or normalizes the multi-MB question pools.
export const loadFilteredBankPracticeRefs = async (
  subject: BankSubject,
  bankSource: BankSourceFilter,
  filters: QuestionBankFilters,
  getProgress: BankQuestionProgressLookup,
  options: { domain?: string; skill?: string } = {},
): Promise<BankPracticeQuestionRef[]> => {
  const [{ loadBankQuestionRouteRefs }, metas] = await Promise.all([
    import("@/data/questionBank"),
    loadFilteredQuestionMetaRows(subject, bankSource, filters, getProgress, options),
  ]);
  const routeRefs = await loadBankQuestionRouteRefs(subject, bankSource);
  const metaByStableId = new Map(metas.map((meta) => [meta.stableId, meta]));

  const refs: BankPracticeQuestionRef[] = [];
  for (const routeRef of routeRefs) {
    const meta = metaByStableId.get(routeRef.stableId);
    if (!meta) continue;
    refs.push({
      stableId: meta.stableId,
      subject,
      id: routeRef.id,
      sourceId: routeRef.sourceId,
      bankType: routeRef.bankType,
      category: meta.category,
      dupGroup: routeRef.dupGroup,
    });
  }
  return refs;
};

export const bankPracticeDupFingerprint = (
  ref: Pick<BankPracticeQuestionRef, "stableId" | "subject" | "dupGroup">,
): string => (ref.dupGroup > 0 ? `dup:${ref.subject}:${ref.dupGroup}` : ref.stableId);
