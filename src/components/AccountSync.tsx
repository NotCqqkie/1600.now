import { useUserProgress } from "@/hooks/useUserProgress";

// Mounts the user-progress sync effect at the app root so that on
// login/signup, local data is merged into the user's Firestore document
// regardless of which page they land on.
export const AccountSync = () => {
  useUserProgress();
  return null;
};
