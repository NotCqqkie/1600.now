import { type ReactNode, useCallback } from "react";
import {
  QuestionNavigatorSheet,
  type QuestionNavigatorItem,
} from "@/components/question/QuestionNavigatorSheet";
import { useAuth } from "@/contexts/AuthContext";
import { getQuestionUiStates } from "@/lib/practice/questionUiState";

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
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const buildNavigatorItems = useCallback(
    (): QuestionNavigatorItem[] => {
      const sourceItems =
        items && items.length > 0
          ? items
          : Array.from({ length: totalQuestions }, (_, i) => ({
              id: i + 1,
              storageId: storagePrefix ? `${storagePrefix}-${i + 1}` : "",
            }));

      const resolvedItems = sourceItems.map((item, index) => {
        const fallbackStorageId = storagePrefix ? `${storagePrefix}-${item.id}` : undefined;
        return {
          index,
          item,
          storageId: item?.storageId || fallbackStorageId,
        };
      });
      const stateByStorageId = getQuestionUiStates(
        resolvedItems
          .map(({ storageId }) => storageId)
          .filter((storageId): storageId is string => Boolean(storageId)),
        uid,
      );

      return resolvedItems.map(({ item, index, storageId }) => {
        const state = storageId ? stateByStorageId[storageId] : undefined;
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
    [currentQuestion, items, onJump, storagePrefix, totalQuestions, uid]
  );

  return (
    <QuestionNavigatorSheet
      buttonLabel={`Question ${currentQuestion}`}
      title="Question Navigator"
      subtitle={`Total: ${totalQuestions}`}
      buildItems={buildNavigatorItems}
      isSplitScreenActive={isSplitScreenActive}
      splitPosition={splitPosition}
      headerActions={headerActions}
    />
  );
};
