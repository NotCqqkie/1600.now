import { useMemo } from "react";
import {
  QuestionNavigatorSheet,
  type QuestionNavigatorItem,
} from "@/components/question/QuestionNavigatorSheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  getQuestionStatus,
  isQuestionFlagged,
} from "@/lib/practice/questionUiState";

interface PracticeSetItem {
  subject: string;
  id: number;
  sourceId?: string;
  index?: number;
  bankType?: string;
  storageId?: string;
}

interface PracticeNavigationSheetProps {
  currentIndex: number;
  practiceSet: PracticeSetItem[];
  onJump: (index: number) => void;
  isSplitScreenActive?: boolean;
  splitPosition?: number;
  exitTo?: string;
}

export const PracticeNavigationSheet = ({
  currentIndex,
  practiceSet,
  onJump,
  isSplitScreenActive = false,
  splitPosition = 50,
}: PracticeNavigationSheetProps) => {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const navigatorItems = useMemo<QuestionNavigatorItem[]>(
    () =>
      practiceSet.map((item, idx) => {
        const storageId = item.storageId || `bank-${item.subject}-${item.sourceId || item.id}`;

        return {
          key: `${item.subject}-${item.sourceId || item.id}-${idx}`,
          label: idx + 1,
          status: getQuestionStatus(storageId, uid),
          isFlagged: isQuestionFlagged(storageId, uid),
          isCurrent: idx === currentIndex,
          onSelect: () => onJump(idx),
          title: `${item.subject === "math" ? "Math" : "Reading"} Q${idx + 1}`,
        };
      }),
    [currentIndex, onJump, practiceSet, uid]
  );

  return (
    <QuestionNavigatorSheet
      buttonLabel={`Question ${currentIndex + 1} of ${practiceSet.length}`}
      title="Practice Set Navigator"
      subtitle={`${practiceSet.length} questions in this set`}
      items={navigatorItems}
      isSplitScreenActive={isSplitScreenActive}
      splitPosition={splitPosition}
    />
  );
};
