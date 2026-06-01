import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { app } from "@/lib/firebase/firebaseApp";

export const db = app ? getFirestore(app) : null;

const isLocalHost = (hostname: string): boolean =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

if (
  db &&
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true"
) {
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  if (!isLocalHost(host)) {
    throw new Error("Firebase emulators can only be used from localhost.");
  }
  connectFirestoreEmulator(db, host, 8089);
}
