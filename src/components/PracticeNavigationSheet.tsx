import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  QuestionNavigatorSheet,
  type QuestionNavigatorItem,
} from "@/components/QuestionNavigatorSheet";

interface PracticeSetItem {
  subject: string;
  id: number;
  sourceId?: string;
  index: number;
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

const getQuestionStatus = (storageId: string): string => {
  const status = localStorage.getItem(`${storageId}-status`);
  return status || "unanswered";
};

const isQuestionFlagged = (storageId: string): boolean => {
  return localStorage.getItem(`${storageId}-flagged`) === "true";
};

export const PracticeNavigationSheet = ({
  currentIndex,
  practiceSet,
  onJump,
  isSplitScreenActive = false,
  splitPosition = 50,
  exitTo = "/bank",
}: PracticeNavigationSheetProps) => {
  const navigate = useNavigate();

  const handleExitPractice = () => {
    sessionStorage.removeItem('practiceSet');
    sessionStorage.removeItem('practiceSetTotal');
    sessionStorage.removeItem('practiceExitTo');
    navigate(exitTo);
  };

  const navigatorItems = useMemo<QuestionNavigatorItem[]>(
    () =>
      practiceSet.map((item, idx) => {
        const storageId = item.storageId || `bank-${item.subject}-${item.sourceId || item.id}`;

        return {
          key: `${item.subject}-${item.id}`,
          label: idx + 1,
          status: getQuestionStatus(storageId),
          isFlagged: isQuestionFlagged(storageId),
          isCurrent: idx === currentIndex,
          onSelect: () => onJump(idx),
          title: `${item.subject === "math" ? "Math" : "Reading"} Q${item.id}`,
        };
      }),
    [currentIndex, onJump, practiceSet]
  );

  return (
    <QuestionNavigatorSheet
      buttonLabel={`Question ${currentIndex + 1} of ${practiceSet.length}`}
      title="Practice Set Navigator"
      subtitle={`${practiceSet.length} questions in this set`}
      items={navigatorItems}
      isSplitScreenActive={isSplitScreenActive}
      splitPosition={splitPosition}
      headerActions={(
        <Button variant="outline" size="sm" onClick={handleExitPractice} className="gap-1">
          <Home className="h-4 w-4" />
          Exit Practice
        </Button>
      )}
    />
  );
};
