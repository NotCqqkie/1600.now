import { useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/hooks/useUserProgress";
import { db } from "@/lib/firebaseDb";
import {
  getPersonalizationPreferences,
  subscribeToPersonalization,
} from "@/lib/personalization";

// Mounts the user-progress sync effect at the app root so that on
// login/signup, local data is merged into the user's Firestore document
// regardless of which page they land on. Also pushes personalization
// preference changes to Firestore so they sync across devices.
export const AccountSync = () => {
  useUserProgress();

  const { user } = useAuth();

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

  return null;
};
