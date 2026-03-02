import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const requiredEnvKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

const missingEnvKeys = requiredEnvKeys.filter((key) => !import.meta.env[key]);

if (missingEnvKeys.length > 0) {
  const message =
    `Missing Firebase env vars: ${missingEnvKeys.join(", ")}. ` +
    "Set VITE_FIREBASE_* in your hosting build environment.";
  if (import.meta.env.PROD) {
    throw new Error(message);
  }
  console.warn(message);
}

const prodAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "";
const devAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN_LOCAL || prodAuthDomain;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.DEV ? devAuthDomain : prodAuthDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
