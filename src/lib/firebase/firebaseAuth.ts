import { getAuth, connectAuthEmulator } from "firebase/auth";
import { app, firebaseConfigError } from "@/lib/firebase/firebaseApp";
import { isLocalHost } from "@/lib/firebase/firebaseHosts";

export { firebaseConfigError };
export const auth = app ? getAuth(app) : null;

if (
  auth &&
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true"
) {
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  if (!isLocalHost(host)) {
    throw new Error("Firebase emulators can only be used from localhost.");
  }
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
}
