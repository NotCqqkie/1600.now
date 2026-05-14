import { type ReactNode, useMemo } from "react";
import {
  QuestionNavigatorSheet,
  type QuestionNavigatorItem,
} from "@/components/question/QuestionNavigatorSheet";

interface ModulePracticeNavigationItem {
  key: string | number;
  label: string | number;
  status: string;
  isFlagged: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  title?: string;
}

interface ModulePracticeNavigationSheetProps {
  buttonLabel: string;
  title: string;
  subtitle: string;
  items: ModulePracticeNavigationItem[];
  isSplitScreenActive?: boolean;
  splitPosition?: number;
  statusMode?: "default" | "answered-unanswered";
  headerActions?: ReactNode;
}

export const ModulePracticeNavigationSheet = ({
  buttonLabel,
  title,
  subtitle,
  items,
  isSplitScreenActive = false,
  splitPosition = 50,
  statusMode = "answered-unanswered",
  headerActions,
}: ModulePracticeNavigationSheetProps) => {
  const navigatorItems = useMemo<QuestionNavigatorItem[]>(
    () => items.map((item) => ({ ...item })),
    [items],
  );

  return (
    <QuestionNavigatorSheet
      buttonLabel={buttonLabel}
      title={title}
      subtitle={subtitle}
      items={navigatorItems}
      isSplitScreenActive={isSplitScreenActive}
      splitPosition={splitPosition}
      statusMode={statusMode}
      headerActions={headerActions}
    />
  );
};
