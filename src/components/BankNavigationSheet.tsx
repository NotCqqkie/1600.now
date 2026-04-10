import { useMemo } from "react";
import {
  QuestionNavigatorSheet,
  type QuestionNavigatorItem,
} from "@/components/QuestionNavigatorSheet";

interface BankNavigationSheetProps {
  currentQuestion: number;
  totalQuestions: number;
  onJump: (questionNumber: number) => void;
  isSplitScreenActive?: boolean;
  splitPosition?: number;
  items?: Array<{ id: number; storageId: string }>;
  storagePrefix?: string;
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
}: BankNavigationSheetProps) => {
  const navigatorItems = useMemo<QuestionNavigatorItem[]>(
    () =>
      Array.from({ length: totalQuestions }, (_, i) => i + 1).map((num) => {
        const item = items?.[num - 1];
        const fallbackStorageId = storagePrefix ? `${storagePrefix}-${num}` : undefined;
        const storageId = item?.storageId || fallbackStorageId;

        return {
          key: num,
          label: num,
          status: storageId ? getQuestionStatus(storageId) : "unanswered",
          isFlagged: storageId ? isQuestionFlagged(storageId) : false,
          isCurrent: num === currentQuestion,
          onSelect: () => onJump(num),
        };
      }),
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
    />
  );
};
