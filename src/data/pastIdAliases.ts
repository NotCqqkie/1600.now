import pastIdAliasesRaw from "./questions/past_id_aliases.json";
import type { BankSubject } from "./bankTypes";

export interface PastQuestionIdAlias {
  id: string;
  legacyId: string;
  subject: BankSubject;
  legacyTestId: string;
  legacyQuestionNumber: number | null;
}

export const PAST_QUESTION_ID_ALIASES = pastIdAliasesRaw as PastQuestionIdAlias[];

const keyFor = (subject: BankSubject, sourceId: string) => `${subject}:${sourceId}`;

const aliasByLegacyId = new Map(
  PAST_QUESTION_ID_ALIASES.map((alias) => [keyFor(alias.subject, alias.legacyId), alias]),
);

const aliasByCanonicalId = new Map(
  PAST_QUESTION_ID_ALIASES.map((alias) => [keyFor(alias.subject, alias.id), alias]),
);

export const getPastIdAliasByCanonicalId = (
  subject: BankSubject,
  sourceId: string,
): PastQuestionIdAlias | null => aliasByCanonicalId.get(keyFor(subject, sourceId)) ?? null;

export const resolvePastCanonicalSourceId = (
  subject: BankSubject,
  sourceId: string,
): string => aliasByLegacyId.get(keyFor(subject, sourceId))?.id ?? sourceId;

export const resolvePastStableId = (stableId: string): string => {
  const match = stableId.match(/^bank-past-(math|reading)-(.+)$/);
  if (!match) return stableId;
  const subject = match[1] as BankSubject;
  const canonicalId = resolvePastCanonicalSourceId(subject, match[2]);
  return canonicalId === match[2] ? stableId : `bank-past-${subject}-${canonicalId}`;
};

