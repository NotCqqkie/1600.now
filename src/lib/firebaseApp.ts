import { initializeApp, getApps, getApp } from "firebase/app";

const requiredEnvKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

const missingEnvKeys = requiredEnvKeys.filter((key) => !import.meta.env[key]);

const hasFirebaseConfig = missingEnvKeys.length === 0;
const missingConfigMessage =
  `Missing Firebase env vars: ${missingEnvKeys.join(", ")}. ` +
  "Set VITE_FIREBASE_* in your hosting build environment.";

if (!hasFirebaseConfig) {
  console.error(`${missingConfigMessage} Authentication and cloud sync are disabled.`);
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
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

export const app = hasFirebaseConfig
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firebaseConfigError = hasFirebaseConfig ? null : missingConfigMessage;
