import type { BankSourceFilter, BankSourceId, BankSubject } from "@/data/bankTypes";

const PRACTICE_QUERY_PARAM = "practice=true";

type PracticeBankQuestionRouteArgs = Readonly<{
  subject: BankSubject;
  sourceId: string;
  bankType: BankSourceFilter;
  idx: number;
}>;

type PracticeBankQuestionLocator = Readonly<
  Pick<PracticeBankQuestionRouteArgs, "subject" | "sourceId" | "bankType" | "idx">
>;

type ModulePracticeQuestionRouteArgs = PracticeBankQuestionLocator & Readonly<{
  moduleSlug: string;
  moduleSessionId: string;
}>;

type PracticeTestQuestionRouteArgs = PracticeBankQuestionLocator & Readonly<{
  practiceSetId: string;
  practiceTestSessionId: string;
}>;

type CustomPracticeQuestionRouteArgs = PracticeBankQuestionLocator & Readonly<{
  bankType: BankSourceId;
  setId: string;
}>;

export const buildPracticeBankQuestionRoute = ({
  subject,
  sourceId,
  bankType,
  idx,
}: PracticeBankQuestionRouteArgs): string =>
  `/bank/${subject}/${sourceId}?bankType=${bankType}&${PRACTICE_QUERY_PARAM}&idx=${idx}`;

export const buildModulePracticeQuestionRoute = ({
  subject,
  sourceId,
  bankType,
  idx,
  moduleSlug,
  moduleSessionId,
}: ModulePracticeQuestionRouteArgs): string =>
  `${buildPracticeBankQuestionRoute({ subject, sourceId, bankType, idx })}&modulePractice=${moduleSlug}&moduleSession=${moduleSessionId}`;

export const buildPracticeTestQuestionRoute = ({
  subject,
  sourceId,
  bankType,
  idx,
  practiceSetId,
  practiceTestSessionId,
}: PracticeTestQuestionRouteArgs): string =>
  `${buildPracticeBankQuestionRoute({ subject, sourceId, bankType, idx })}&practiceTest=${practiceSetId}&practiceTestSession=${practiceTestSessionId}`;

export const buildCustomPracticeQuestionRoute = ({
  subject,
  sourceId,
  bankType,
  idx,
  setId,
}: CustomPracticeQuestionRouteArgs): string =>
  `${buildPracticeBankQuestionRoute({ subject, sourceId, bankType, idx })}&customPractice=${setId}`;
