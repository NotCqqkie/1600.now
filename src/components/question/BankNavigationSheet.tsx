import { type ReactNode, useMemo } from "react";
import {
  QuestionNavigatorSheet,
  type QuestionNavigatorItem,
} from "@/components/question/QuestionNavigatorSheet";

interface BankNavigationSheetProps {
  currentQuestion: number;
  totalQuestions: number;
  onJump: (questionNumber: number) => void;
  isSplitScreenActive?: boolean;
  splitPosition?: number;
  items?: Array<{ id: number; storageId: string }>;
  storagePrefix?: string;
  headerActions?: ReactNode;
}

const getQuestionStatus = (storageId: string): string => {
  const status = localStorage.getItem(`${storageId}-status`);
  return status || "unanswered";
};

const isQuestionFlagged = (storageId: string): boolean => {
  return localStorage.getItem(`${storageId}-flagged`) === "true";
};

export const BankNavigationSheet = ({
  currentQuestion,
  totalQuestions,
  onJump,
  isSplitScreenActive = false,
  splitPosition = 50,
  items,
  storagePrefix,
  headerActions,
}: BankNavigationSheetProps) => {
  const navigatorItems = useMemo<QuestionNavigatorItem[]>(
    () => {
      const sourceItems =
        items && items.length > 0
          ? items
          : Array.from({ length: totalQuestions }, (_, i) => ({
              id: i + 1,
              storageId: storagePrefix ? `${storagePrefix}-${i + 1}` : "",
            }));

      return sourceItems.map((item, index) => {
        const fallbackStorageId = storagePrefix ? `${storagePrefix}-${item.id}` : undefined;
        const storageId = item?.storageId || fallbackStorageId;

        return {
          key: item.id,
          label: item.id,
          status: storageId ? getQuestionStatus(storageId) : "unanswered",
          isFlagged: storageId ? isQuestionFlagged(storageId) : false,
          isCurrent: item.id === currentQuestion,
          onSelect: () => onJump(item.id),
          title: `Question ${index + 1}`,
        };
      });
    },
    [currentQuestion, items, onJump, storagePrefix, totalQuestions]
  );

  return (
    <QuestionNavigatorSheet
      buttonLabel={`Question ${currentQuestion}`}
      title="Question Navigator"
      subtitle={`Total: ${totalQuestions}`}
      items={navigatorItems}
      isSplitScreenActive={isSplitScreenActive}
      splitPosition={splitPosition}
      headerActions={headerActions}
    />
  );
};
