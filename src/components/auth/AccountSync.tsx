import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/hooks/useUserProgress";
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

// Firestore is imported on first write so anonymous visitors never download
// the SDK; the shared promise keeps writes in dispatch order.
const importFirestoreDependencies = async () => {
  const [firebaseDb, firestore] = await Promise.all([
    import("@/lib/firebase/firebaseDb"),
    import("firebase/firestore"),
  ]);
  firebaseDb.initializeFirebaseAppCheck();
  return {
    db: firebaseDb.db,
    doc: firestore.doc,
    setDoc: firestore.setDoc,
  };
};

let firestoreDependenciesPromise: Promise<Awaited<ReturnType<typeof importFirestoreDependencies>>> | null = null;

const loadFirestoreDependencies = () => {
  firestoreDependenciesPromise ??= importFirestoreDependencies();
  return firestoreDependenciesPromise;
};

const writeUserProgressPatch = (
  patch: AccountSyncFirestorePatch,
  errorMessage: string,
) => {
  loadFirestoreDependencies()
    .then(({ db, doc, setDoc }) => {
      if (!db) return;
      const ref = doc(db, "user_progress", patch.user_id);
      return setDoc(ref, patch, { merge: true });
    })
    .catch((err) => console.error(errorMessage, err));
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
    if (!user) return;

    const push = () => {
      const prefs = getPersonalizationPreferences();
      writeUserProgressPatch(
        { user_id: user.id, personalization: prefs },
        "Failed to sync personalization to Firestore:",
      );
    };

    return subscribeToPersonalization(push);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const push = () => {
      writeUserProgressPatch(
        { user_id: user.id, questionState: getQuestionUiStateMap(user.id) },
        "Failed to sync question state to Firestore:",
      );
    };

    return subscribeToQuestionUiState(push);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      const customSets = await import("@/lib/practice/customPracticeSets");
      if (cancelled) return;

      const push = () => {
        writeUserProgressPatch(
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
