import { useEffect, useLayoutEffect } from "react";

const useBrowserLayoutEffect =
  typeof document === "undefined" ? useEffect : useLayoutEffect;

const PRACTICE_RESULT_SPLIT_CSS_VARIABLE = "--sat-split-pct";

export const usePracticeResultSplitCssVariable = (
  enabled: boolean,
  splitPosition: number,
): void => {
  useBrowserLayoutEffect(() => {
    if (!enabled) {
      document.documentElement.style.removeProperty(PRACTICE_RESULT_SPLIT_CSS_VARIABLE);
      return;
    }
    document.documentElement.style.setProperty(PRACTICE_RESULT_SPLIT_CSS_VARIABLE, `${splitPosition}%`);
    return () => {
      document.documentElement.style.removeProperty(PRACTICE_RESULT_SPLIT_CSS_VARIABLE);
    };
  }, [splitPosition, enabled]);
};
