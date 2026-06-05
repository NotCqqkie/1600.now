import { useEffect, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/hooks/useUserProgress";
import { db } from "@/lib/firebase/firebaseDb";
import {
  getPersonalizationPreferences,
  resetPersonalizationPreferences,
  subscribeToPersonalization,
} from "@/lib/personalization";
import {
  getQuestionUiStateMap,
  subscribeToQuestionUiState,
} from "@/lib/practice/questionUiState";

// Mounts the user-progress sync effect at the app root so that on
// login/signup, local data is merged into the user's Firestore document
// regardless of which page they land on. Also pushes personalization
// preference changes to Firestore so they sync across devices.
export const AccountSync = () => {
  useUserProgress();

  const { user } = useAuth();
  const previousUidRef = useRef<string | null>(null);

  // On sign-out, wipe personalization so the signed-out session reverts to
  // defaults instead of inheriting the previous user's font/size choices.
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
      const ref = doc(db, "user_progress", user.id);
      setDoc(
        ref,
        { user_id: user.id, personalization: prefs },
        { merge: true },
      ).catch((err) =>
        console.error("Failed to sync personalization to Firestore:", err),
      );
    };

    return subscribeToPersonalization(push);
  }, [user]);

  useEffect(() => {
    if (!user || !db) return;

    const push = () => {
      const ref = doc(db, "user_progress", user.id);
      setDoc(
        ref,
        { user_id: user.id, questionState: getQuestionUiStateMap(user.id) },
        { merge: true },
      ).catch((err) =>
        console.error("Failed to sync question state to Firestore:", err),
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
        const ref = doc(db, "user_progress", user.id);
        setDoc(
          ref,
          {
            user_id: user.id,
            customPracticeSets: customSets.getCustomPracticeSets(user.id),
          },
          { merge: true },
        ).catch((err) =>
          console.error("Failed to sync custom practice sets to Firestore:", err),
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
