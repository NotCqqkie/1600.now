import { useEffect, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/hooks/useUserProgress";
import { db } from "@/lib/firebase/firebaseDb";
import {
  getPersonalizationPreferences,
  resetPersonalizationPreferences,
  subscribeToPersonalization,
  type PersonalizationPreferences,
} from "@/lib/personalization";
import {
  getQuestionUiStateMap,
  subscribeToQuestionUiState,
  type QuestionUiStateMap,
} from "@/lib/practice/questionUiState";
import type { CustomPracticeSet } from "@/lib/practice/customPracticeSets";

type AccountSyncFirestorePatch = {
  user_id: string;
  personalization?: PersonalizationPreferences;
  questionState?: QuestionUiStateMap;
  customPracticeSets?: CustomPracticeSet[];
};

const writeUserProgressPatch = (
  database: NonNullable<typeof db>,
  patch: AccountSyncFirestorePatch,
  errorMessage: string,
) => {
  const ref = doc(database, "user_progress", patch.user_id);
  setDoc(ref, patch, { merge: true }).catch((err) =>
    console.error(errorMessage, err),
  );
};

export const AccountSync = () => {
  useUserProgress();

  const { user } = useAuth();
  const previousUidRef = useRef<string | null>(null);
  useEffect(() => {
    const prevUid = previousUidRef.current;
    const currentUid = user?.id ?? null;
    if (prevUid !== null && currentUid === null) {
      resetPersonalizationPreferences();
    }
    previousUidRef.current = currentUid;
  }, [user?.id]);

  useEffect(() => {
    if (!user || !db) return;

    const push = () => {
      const prefs = getPersonalizationPreferences();
      writeUserProgressPatch(
        db,
        { user_id: user.id, personalization: prefs },
        "Failed to sync personalization to Firestore:",
      );
    };

    return subscribeToPersonalization(push);
  }, [user]);

  useEffect(() => {
    if (!user || !db) return;

    const push = () => {
      writeUserProgressPatch(
        db,
        { user_id: user.id, questionState: getQuestionUiStateMap(user.id) },
        "Failed to sync question state to Firestore:",
      );
    };

    return subscribeToQuestionUiState(push);
  }, [user]);

  useEffect(() => {
    if (!user || !db) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      const customSets = await import("@/lib/practice/customPracticeSets");
      if (cancelled) return;

      const push = () => {
        writeUserProgressPatch(
          db,
          {
            user_id: user.id,
            customPracticeSets: customSets.getCustomPracticeSets(user.id),
          },
          "Failed to sync custom practice sets to Firestore:",
        );
      };

      unsubscribe = customSets.subscribeToCustomPracticeSets(push);
    };

    void setup();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  return null;
};
