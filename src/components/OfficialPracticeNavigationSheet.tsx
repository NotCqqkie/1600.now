import { useMemo } from "react";
import {
  QuestionNavigatorSheet,
  type QuestionNavigatorItem,
} from "@/components/QuestionNavigatorSheet";

interface PracticeSetItem {
  subject: string;
  id: number;
  sourceId: string;
  index: number;
}

interface PracticeNavigationSheetProps {
  currentIndex: number;
  practiceSet: PracticeSetItem[];
  onJump: (index: number) => void;
  isSplitScreenActive?: boolean;
  splitPosition?: number;
  storagePrefix: string;
}

const getQuestionStatus = (prefix: string, questionId: number): string => {
  const status = localStorage.getItem(`${prefix}-${questionId}-status`);
  return status || "unanswered";
};

const isQuestionFlagged = (prefix: string, questionId: number): boolean => {
  return localStorage.getItem(`${prefix}-${questionId}-flagged`) === "true";
};

export const OfficialPracticeNavigationSheet = ({
  currentIndex,
  practiceSet,
  onJump,
  isSplitScreenActive = false,
  splitPosition = 50,
  storagePrefix,
}: PracticeNavigationSheetProps) => {
  const navigatorItems = useMemo<QuestionNavigatorItem[]>(
    () =>
      practiceSet.map((item, idx) => {
        const prefix = `${storagePrefix}`;

        return {
          key: `${item.subject}-${item.id}`,
          label: idx + 1,
          status: getQuestionStatus(prefix, item.id),
          isFlagged: isQuestionFlagged(prefix, item.id),
          isCurrent: idx === currentIndex,
          onSelect: () => onJump(idx),
          title: `${item.subject === "math" ? "Math" : "Reading"} Q${item.id}`,
        };
      }),
    [currentIndex, onJump, practiceSet, storagePrefix]
  );

  return (
    <QuestionNavigatorSheet
      buttonLabel={`Question ${currentIndex + 1} of ${practiceSet.length}`}
      title="Official Practice Set Navigator"
      subtitle={`${practiceSet.length} questions in this set`}
      items={navigatorItems}
      isSplitScreenActive={isSplitScreenActive}
      splitPosition={splitPosition}
    />
  );
};
