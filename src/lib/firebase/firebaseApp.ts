import { initializeApp, getApps, getApp } from "firebase/app";
import { isLocalHost } from "@/lib/firebase/firebaseHosts";

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
const isFirebaseDefaultDomain = (domain: string) =>
  domain.endsWith(".firebaseapp.com") || domain.endsWith(".web.app");
const runtimeAuthDomain =
  !import.meta.env.DEV &&
  typeof window !== "undefined" &&
  window.location.host &&
  !isLocalHost(window.location.hostname) &&
  isFirebaseDefaultDomain(prodAuthDomain)
    ? window.location.host
    : import.meta.env.DEV
      ? devAuthDomain
      : prodAuthDomain;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: runtimeAuthDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

export const app = hasFirebaseConfig
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

// Firebase App Check (guarded by env var). Once VITE_RECAPTCHA_SITE_KEY is set
// and App Check is enforced in the Firebase console, only tokens minted by the
// real app can write to Firestore — closing the unbounded report-doc / write
// abuse gap. No-op until the key is provided, so current behavior is unchanged.
const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";
if (app && appCheckSiteKey && typeof window !== "undefined") {
  void import("firebase/app-check")
    .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    })
    .catch((error) => {
      console.error("Failed to initialize Firebase App Check:", error);
    });
}

export const firebaseConfigError = hasFirebaseConfig ? null : missingConfigMessage;
