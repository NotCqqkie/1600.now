import { useCallback } from "react";
import { QuestionNavigatorSheet } from "@/components/question/QuestionNavigatorSheet";
import { useAuth } from "@/contexts/AuthContext";
import { getQuestionUiStates } from "@/lib/practice/questionUiState";

const DEFAULT_SPLIT_POSITION = 50;
const DEFAULT_STATUS = "unanswered";
const PRACTICE_NAVIGATOR_TITLE = "Practice Set Navigator";
const PRACTICE_STORAGE_PREFIX = "bank";

type PracticeSetItem = Readonly<{
  subject: string;
  id: number;
  sourceId?: string;
  storageId?: string;
}>;

type ResolvedPracticeSetItem = Readonly<{
  item: PracticeSetItem;
  idx: number;
  storageId: string;
}>;

type PracticeNavigationSheetProps = Readonly<{
  currentIndex: number;
  practiceSet: ReadonlyArray<PracticeSetItem>;
  onJump: (index: number) => void;
  isSplitScreenActive?: boolean;
  splitPosition?: number;
}>;

const getPracticeQuestionIdentifier = (item: PracticeSetItem) =>
  item.sourceId || item.id;

const getPracticeQuestionStorageId = (item: PracticeSetItem) =>
  item.storageId || `${PRACTICE_STORAGE_PREFIX}-${item.subject}-${getPracticeQuestionIdentifier(item)}`;

const getPracticeQuestionKey = (item: PracticeSetItem, idx: number) =>
  `${item.subject}-${getPracticeQuestionIdentifier(item)}-${idx}`;

const getPracticeQuestionSubjectLabel = (item: PracticeSetItem) =>
  item.subject === "math" ? "Math" : "Reading";

const getPracticeQuestionTitle = (item: PracticeSetItem, idx: number) =>
  `${getPracticeQuestionSubjectLabel(item)} Q${idx + 1}`;

const getQuestionButtonLabel = (currentIndex: number, totalQuestions: number) =>
  `Question ${currentIndex + 1} of ${totalQuestions}`;

const getQuestionSubtitle = (totalQuestions: number) =>
  `${totalQuestions} questions in this set`;

const getUniqueStorageIds = (items: ReadonlyArray<ResolvedPracticeSetItem>) =>
  Array.from(new Set(items.map(({ storageId }) => storageId)));

export const PracticeNavigationSheet = ({
  currentIndex,
  practiceSet,
  onJump,
  isSplitScreenActive = false,
  splitPosition = DEFAULT_SPLIT_POSITION,
}: PracticeNavigationSheetProps) => {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const buildNavigatorItems = useCallback(() => {
    const resolvedItems = practiceSet.map((item, idx): ResolvedPracticeSetItem => ({
      item,
      idx,
      storageId: getPracticeQuestionStorageId(item),
    }));
    const stateByStorageId = getQuestionUiStates(
      getUniqueStorageIds(resolvedItems),
      uid,
    );

    return resolvedItems.map(({ item, idx, storageId }) => {
      const state = stateByStorageId[storageId];
      return {
        key: getPracticeQuestionKey(item, idx),
        label: idx + 1,
        status: state?.status || DEFAULT_STATUS,
        isFlagged: state?.flagged === true,
        isCurrent: idx === currentIndex,
        onSelect: () => onJump(idx),
        title: getPracticeQuestionTitle(item, idx),
      };
    });
  }, [currentIndex, onJump, practiceSet, uid]);

  return (
    <QuestionNavigatorSheet
      buttonLabel={getQuestionButtonLabel(currentIndex, practiceSet.length)}
      title={PRACTICE_NAVIGATOR_TITLE}
      subtitle={getQuestionSubtitle(practiceSet.length)}
      buildItems={buildNavigatorItems}
      isSplitScreenActive={isSplitScreenActive}
      splitPosition={splitPosition}
    />
  );
};
