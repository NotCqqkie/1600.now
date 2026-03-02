import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const prodAuthDomain =
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "placeholder.firebaseapp.com";
const devAuthDomain =
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN_LOCAL || prodAuthDomain;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "placeholder-api-key",
  authDomain: import.meta.env.DEV ? devAuthDomain : prodAuthDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "placeholder-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "placeholder.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:placeholder",
};

const hasFirebaseEnv =
  !!import.meta.env.VITE_FIREBASE_API_KEY &&
  !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
  !!import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  !!import.meta.env.VITE_FIREBASE_APP_ID;

if (!hasFirebaseEnv) {
  console.warn("Firebase config missing. Add VITE_FIREBASE_* values in .env.");
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
