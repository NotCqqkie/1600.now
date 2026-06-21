import { type ReactNode, useCallback } from "react";
import { QuestionNavigatorSheet } from "@/components/question/QuestionNavigatorSheet";
import { useAuth } from "@/contexts/AuthContext";
import { getQuestionUiStates } from "@/lib/practice/questionUiState";

interface BankNavigationSheetProps {
  currentQuestion: number;
  totalQuestions: number;
  onJump: (questionNumber: number) => void;
  isSplitScreenActive?: boolean;
  splitPosition?: number;
  items?: Array<{ id: number; storageId: string }>;
  headerActions?: ReactNode;
}

export const BankNavigationSheet = ({
  currentQuestion,
  totalQuestions,
  onJump,
  isSplitScreenActive,
  splitPosition,
  items,
  headerActions,
}: BankNavigationSheetProps) => {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const buildNavigatorItems = useCallback(
    () => {
      const sourceItems =
        items && items.length > 0
          ? items
          : Array.from({ length: totalQuestions }, (_, i) => ({
              id: i + 1,
              storageId: "",
            }));

      const storageIds = sourceItems
        .map(({ storageId }) => storageId)
        .filter((storageId): storageId is string => Boolean(storageId));
      const stateByStorageId = storageIds.length
        ? getQuestionUiStates(storageIds, uid)
        : {};

      return sourceItems.map((item, index) => {
        const state = item.storageId ? stateByStorageId[item.storageId] : undefined;
        return {
          key: item.id,
          label: item.id,
          status: state?.status || "unanswered",
          isFlagged: state?.flagged === true,
          isCurrent: item.id === currentQuestion,
          onSelect: () => onJump(item.id),
          title: `Question ${index + 1}`,
        };
      });
    },
    [currentQuestion, items, onJump, totalQuestions, uid]
  );

  return (
    <QuestionNavigatorSheet
      buttonLabel={`Question ${currentQuestion}`}
      subtitle={`Total: ${totalQuestions}`}
      buildItems={buildNavigatorItems}
      isSplitScreenActive={isSplitScreenActive}
      splitPosition={splitPosition}
      headerActions={headerActions}
    />
  );
};
