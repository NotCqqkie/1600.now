import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";
import { isLocalHost } from "@/lib/firebase/firebaseHosts";

export const FIREBASE_ANALYTICS_MEASUREMENT_ID = "G-B5Q82GMJ2L";

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

const configuredMeasurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "";
export const firebaseAnalyticsConfigError = !configuredMeasurementId
  ? "Missing Firebase Analytics measurement ID."
  : configuredMeasurementId !== FIREBASE_ANALYTICS_MEASUREMENT_ID
    ? `Unexpected Firebase Analytics measurement ID: ${configuredMeasurementId}.`
    : null;

if (import.meta.env.PROD && firebaseAnalyticsConfigError) {
  console.error(`${firebaseAnalyticsConfigError} Analytics is disabled.`);
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
  measurementId: configuredMeasurementId || undefined,
};

export const app = hasFirebaseConfig
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";
export let appCheck: AppCheck | null = null;

export const initializeFirebaseAppCheck = (): AppCheck | null => {
  if (
    appCheck
    || !app
    || !appCheckSiteKey
    || typeof window === "undefined"
    || typeof document === "undefined"
  ) return appCheck;
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    return appCheck;
  } catch (error) {
    console.error("Failed to initialize Firebase App Check:", error);
    return null;
  }
};

export const firebaseConfigError = hasFirebaseConfig ? null : missingConfigMessage;
