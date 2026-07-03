import type { BankQuestion } from "@/data/questionBank";
import type { BankSubject } from "@/data/bankTypes";
import {
  BANK_PRACTICE_SET_REFS,
  BANK_PRACTICE_SUMMARY,
  GENERATED_PRACTICE_SET_LOADERS,
  type BankPracticeMappingMethod,
} from "@/lib/generated/bankPracticeIndex.generated";

type ModuleSubjectLabel = "Math" | "English";
type ReplacementOrigin = "borrowed";

export interface ModuleReplacement {
  slot: number;
  expectedSkill: string;
  expectedDomain: string;
  expectedType: BankQuestion["type"];
  profileConfidence: number;
  sourceId: string;
  sourceTestName: string;
  sourceQuestionNumber: number | string;
  origin: ReplacementOrigin;
  note: string;
}

export type PracticeQuestionRef = Pick<
  BankQuestion,
  "id" | "stableId" | "bankType" | "subject" | "sourceId" | "type"
>;

export interface PracticeModuleQuestion {
  slot: number;
  bankQuestion: PracticeQuestionRef;
  isReplacement: boolean;
  replacement?: ModuleReplacement;
  mappingMethod?: BankPracticeMappingMethod;
  originalSourceId?: string;
}

export interface PracticeModule {
  id: string;
  slug: string;
  testName: string;
  sourceIndex: number;
  subject: BankSubject;
  subjectLabel: ModuleSubjectLabel;
  moduleNumber: 1 | 2;
  targetCount: number;
  originalCount: number;
  questionCount: number;
  missingQuestionNumbers: number[];
  repairedSlots: number;
  questions: PracticeModuleQuestion[];
  replacements: ModuleReplacement[];
  setNumber: number;
  publicTitle: string;
  publicSubtitle: string;
}

export interface ModulePracticeBankSummary {
  totalPracticeSets: number;
  removedModules: number;
  totalPracticeModules: number;
  totalPracticeQuestions: number;
}

export interface PracticeSet {
  id: string;
  setNumber: number;
  modules: PracticeModule[];
}

export interface LoadedPracticeModuleQuestion extends PracticeModuleQuestion {
  bankQuestion: BankQuestion;
}

export interface LoadedPracticeModule extends PracticeModule {
  questions: LoadedPracticeModuleQuestion[];
}

export interface LoadedPracticeSet extends PracticeSet {
  modules: LoadedPracticeModule[];
}

export interface PracticeTestQuestionItem {
  id: number;
  subject: BankSubject;
  bankType: "past" | "unofficial";
  sourceId: string;
  storageId: string;
  practiceSetId: string;
  practiceSetNumber: number;
  moduleSlug: string;
  moduleNumber: 1 | 2;
  moduleTitle: string;
  moduleQuestionNumber: number;
  globalQuestionNumber: number;
}

export const practiceSets: PracticeSet[] = BANK_PRACTICE_SET_REFS;

const practiceModules = practiceSets.flatMap((practiceSet) => practiceSet.modules);

export const modulePracticeBankSummary: ModulePracticeBankSummary = {
  totalPracticeSets: BANK_PRACTICE_SUMMARY.totalPracticeSets,
  removedModules: 0,
  totalPracticeModules: BANK_PRACTICE_SUMMARY.totalPracticeModules,
  totalPracticeQuestions: BANK_PRACTICE_SUMMARY.totalPracticeQuestions,
};

export const getPracticeSets = (): PracticeSet[] => practiceSets;

export const getPracticeSet = (setIdOrNumber: string | number): PracticeSet | null => {
  const normalized =
    typeof setIdOrNumber === "number"
      ? setIdOrNumber
      : Number.parseInt(String(setIdOrNumber).replace(/^practice-(?:set|test)-/, ""), 10);

  return practiceSets.find((practiceSet) =>
    practiceSet.id === String(setIdOrNumber) || practiceSet.setNumber === normalized,
  ) ?? null;
};

export const getPracticeModules = (): PracticeModule[] => practiceModules;

export const getPracticeModule = (moduleIdOrSlug: string): PracticeModule | null =>
  practiceModules.find((module) => module.id === moduleIdOrSlug || module.slug === moduleIdOrSlug) ?? null;

export const buildModulePracticeSet = (moduleIdOrSlug: string) => {
  const module = getPracticeModule(moduleIdOrSlug);
  if (!module) return null;

  return module.questions.map((entry, index) => ({
    subject: module.subject,
    id: entry.bankQuestion.id,
    sourceId: entry.bankQuestion.sourceId,
    bankType: entry.bankQuestion.bankType,
    storageId: entry.bankQuestion.stableId,
    index,
  }));
};

export const buildPracticeTestQuestionSet = (
  setIdOrNumber: string | number,
): PracticeTestQuestionItem[] | null => {
  const practiceSet = getPracticeSet(setIdOrNumber);
  if (!practiceSet) return null;

  let globalQuestionNumber = 0;

  return practiceSet.modules.flatMap((module) =>
    module.questions.map((entry) => {
      globalQuestionNumber += 1;

      return {
        subject: module.subject,
        id: entry.bankQuestion.id,
        sourceId: entry.bankQuestion.sourceId,
        bankType: entry.bankQuestion.bankType,
        storageId: entry.bankQuestion.stableId,
        practiceSetId: practiceSet.id,
        practiceSetNumber: practiceSet.setNumber,
        moduleSlug: module.slug,
        moduleNumber: module.moduleNumber,
        moduleTitle: module.publicTitle,
        moduleQuestionNumber: entry.slot,
        globalQuestionNumber,
      };
    }),
  );
};

const loadedPracticeSetsBySetNumber = new Map<number, LoadedPracticeSet>();
const practiceSetLoadPromises = new Map<number, Promise<LoadedPracticeSet | null>>();

const loadedPracticeQuestionBySubjectAndSourceId: Record<BankSubject, Map<string, BankQuestion>> = {
  math: new Map(),
  reading: new Map(),
};

const registerLoadedPracticeSet = (loadedSet: LoadedPracticeSet) => {
  loadedPracticeSetsBySetNumber.set(loadedSet.setNumber, loadedSet);
  for (const module of loadedSet.modules) {
    for (const entry of module.questions) {
      loadedPracticeQuestionBySubjectAndSourceId[module.subject].set(
        `${entry.bankQuestion.bankType}:${entry.bankQuestion.sourceId}`,
        entry.bankQuestion,
      );
    }
  }
};

const loadPracticeSetBySetNumber = (setNumber: number): Promise<LoadedPracticeSet | null> => {
  const loader = GENERATED_PRACTICE_SET_LOADERS[setNumber];
  if (!loader) return Promise.resolve(null);

  let promise = practiceSetLoadPromises.get(setNumber);
  if (!promise) {
    promise = loader().then(
      (mod) => {
        const loadedSet: LoadedPracticeSet = mod.GENERATED_PRACTICE_SET;
        registerLoadedPracticeSet(loadedSet);
        return loadedSet;
      },
      (error: unknown) => {
        practiceSetLoadPromises.delete(setNumber);
        throw error;
      },
    );
    practiceSetLoadPromises.set(setNumber, promise);
  }
  return promise;
};

export const loadPracticeSet = (setIdOrNumber: string | number): Promise<LoadedPracticeSet | null> => {
  const practiceSet = getPracticeSet(setIdOrNumber);
  return practiceSet ? loadPracticeSetBySetNumber(practiceSet.setNumber) : Promise.resolve(null);
};

export const getLoadedPracticeSet = (setIdOrNumber: string | number): LoadedPracticeSet | null => {
  const practiceSet = getPracticeSet(setIdOrNumber);
  return practiceSet ? loadedPracticeSetsBySetNumber.get(practiceSet.setNumber) ?? null : null;
};

export const loadPracticeModule = (moduleIdOrSlug: string): Promise<LoadedPracticeModule | null> => {
  const module = getPracticeModule(moduleIdOrSlug);
  if (!module) return Promise.resolve(null);
  return loadPracticeSetBySetNumber(module.setNumber).then(
    (loadedSet) => loadedSet?.modules.find((loadedModule) => loadedModule.slug === module.slug) ?? null,
  );
};

export const getLoadedPracticeModule = (moduleIdOrSlug: string): LoadedPracticeModule | null => {
  const module = getPracticeModule(moduleIdOrSlug);
  if (!module) return null;
  const loadedSet = loadedPracticeSetsBySetNumber.get(module.setNumber);
  return loadedSet?.modules.find((loadedModule) => loadedModule.slug === module.slug) ?? null;
};

const resolvePracticeTargetSetNumber = (target: string): number | null =>
  getPracticeSet(target)?.setNumber ?? getPracticeModule(target)?.setNumber ?? null;

export const ensurePracticeDataLoaded = (target: string): Promise<void> => {
  const setNumber = resolvePracticeTargetSetNumber(target);
  return setNumber === null
    ? Promise.resolve()
    : loadPracticeSetBySetNumber(setNumber).then(() => undefined);
};

export const isPracticeDataLoaded = (target: string): boolean => {
  const setNumber = resolvePracticeTargetSetNumber(target);
  return setNumber === null || loadedPracticeSetsBySetNumber.has(setNumber);
};

export const getSynthesizedPracticeQuestion = (
  subject: BankSubject,
  sourceId: string,
  bankType: "past" | "unofficial" = "past",
): BankQuestion | null => loadedPracticeQuestionBySubjectAndSourceId[subject].get(`${bankType}:${sourceId}`) ?? null;

export const activePastQuestionSourceIds = new Set(
  practiceModules.flatMap((module) =>
    module.questions
      .filter((entry) => entry.bankQuestion.bankType === "past")
      .map((entry) => entry.bankQuestion.sourceId),
  ),
);

export const activePracticeBankQuestionKeys = new Set(
  practiceModules.flatMap((module) =>
    module.questions.map((entry) =>
      `${entry.bankQuestion.bankType}:${entry.bankQuestion.subject}:${entry.bankQuestion.sourceId}`,
    ),
  ),
);
