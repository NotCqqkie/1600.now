
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Auth, IdTokenResult, User as FirebaseUser } from "firebase/auth";
import { identifyUser, trackLogin, trackSignUp } from "@/lib/analytics";
import {
  assertAuthAttemptAllowed,
  clearAuthAttempts,
  normalizeAuthIdentifier,
  recordAuthAttempt,
  validatePasswordPolicy,
} from "@/lib/authSecurity";

export interface AppUser {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  raw: FirebaseUser;
}

interface AuthContextType {
  session: AppUser | null;
  user: AppUser | null;
  loading: boolean;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<{ requiresVerification: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  redirectError: unknown;
  clearRedirectError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signInWithEmailPassword: async () => {},
  signUpWithEmailPassword: async () => ({ requiresVerification: false }),
  signInWithGoogle: async () => {},
  signOut: async () => {},
  resendVerificationEmail: async () => {},
  reloadUser: async () => false,
  sendPasswordReset: async () => {},
  redirectError: null,
  clearRedirectError: () => {},
});

export const useAuth = () => useContext(AuthContext);

const getAuthUnavailableError = (firebaseConfigError?: string | null) =>
  new Error(
    firebaseConfigError ||
      "Firebase authentication is not configured. Set VITE_FIREBASE_* variables.",
  );

let authDependenciesPromise:
  | Promise<{
      auth: Auth | null;
      firebaseConfigError: string | null;
      authModule: typeof import("firebase/auth");
    }>
  | null = null;

const loadAuthDependencies = async () => {
  if (!authDependenciesPromise) {
    authDependenciesPromise = Promise.all([
      import("firebase/auth"),
      import("@/lib/firebase/firebaseAuth"),
    ]).then(([authModule, firebaseModule]) => ({
      auth: firebaseModule.auth,
      firebaseConfigError: firebaseModule.firebaseConfigError,
      authModule,
    }));
  }

  return authDependenciesPromise;
};

const toAppUser = (
  firebaseUser: FirebaseUser | null,
  tokenResult?: IdTokenResult,
): AppUser | null => {
  if (!firebaseUser) return null;
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
    isAdmin: tokenResult?.claims.admin === true,
    raw: firebaseUser,
  };
};

const GOOGLE_SIGN_IN_PENDING_PARAM = "googleSignIn";
const ONBOARDING_PENDING_KEY = "onboarding-pending";

const getLocalhostAuthUrl = (): string | null => {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  if (window.location.hostname !== "127.0.0.1") return null;
  const url = new URL(window.location.href);
  url.hostname = "localhost";
  url.searchParams.set(GOOGLE_SIGN_IN_PENDING_PARAM, "1");
  return url.toString();
};

const consumePendingGoogleSignIn = (): boolean => {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get(GOOGLE_SIGN_IN_PENDING_PARAM) !== "1") return false;
  url.searchParams.delete(GOOGLE_SIGN_IN_PENDING_PARAM);
  window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
  return true;
};

const createGoogleProvider = (authModule: typeof import("firebase/auth")) => {
  const provider = new authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<AppUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<unknown>(null);
  const clearRedirectError = useCallback(() => setRedirectError(null), []);
  const applyFirebaseUser = useCallback(async (firebaseUser: FirebaseUser | null) => {
    const tokenResult = firebaseUser ? await firebaseUser.getIdTokenResult() : undefined;
    const appUser = toAppUser(firebaseUser, tokenResult);
    setSession(appUser);
    setUser(appUser);
    setLoading(false);
    void identifyUser(appUser?.uid ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      const { auth, authModule } = await loadAuthDependencies();

      if (cancelled) return;

      if (!auth) {
        setLoading(false);
        return;
      }

      if (consumePendingGoogleSignIn()) {
        try {
          await authModule.signInWithRedirect(auth, createGoogleProvider(authModule));
          return;
        } catch (error: unknown) {
          setRedirectError(error);
        }
      }
      authModule
        .getRedirectResult(auth)
        .then((result) => {
          if (!result) return;
          const info = authModule.getAdditionalUserInfo(result);
          if (info?.isNewUser) {
            sessionStorage.setItem(ONBOARDING_PENDING_KEY, "1");
            trackSignUp("google");
          } else {
            trackLogin("google");
          }
        })
        .catch((error: unknown) => {
          const code = (error as { code?: string } | null)?.code;
          if (code === "auth/no-auth-event") return;
          console.error("Redirect sign-in failed:", error);
          setRedirectError(error);
        });

      unsubscribe = authModule.onAuthStateChanged(auth, (firebaseUser) => {
        if (cancelled) return;
        void applyFirebaseUser(firebaseUser);
      });
    };

    void initializeAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [applyFirebaseUser]);

  const signInWithEmailPassword = async (email: string, password: string) => {
    const { auth, firebaseConfigError, authModule } = await loadAuthDependencies();
    if (!auth) throw getAuthUnavailableError(firebaseConfigError);
    const identifier = normalizeAuthIdentifier(email);
    assertAuthAttemptAllowed("signin", identifier);
    let result;
    try {
      result = await authModule.signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      recordAuthAttempt("signin", identifier);
      throw error;
    }
    clearAuthAttempts("signin", identifier);
    await applyFirebaseUser(result.user);
    trackLogin("password");
  };

  const signUpWithEmailPassword = async (email: string, password: string) => {
    const { auth, firebaseConfigError, authModule } = await loadAuthDependencies();
    if (!auth) throw getAuthUnavailableError(firebaseConfigError);
    validatePasswordPolicy(password);
    const identifier = normalizeAuthIdentifier(email);
    assertAuthAttemptAllowed("signup", identifier);
    recordAuthAttempt("signup", identifier);
    const result = await authModule.createUserWithEmailAndPassword(auth, email, password);
    await applyFirebaseUser(result.user);
    trackSignUp("password");
    try {
      await authModule.sendEmailVerification(result.user);
    } catch {
      return { requiresVerification: !result.user.emailVerified };
    }
    return { requiresVerification: !result.user.emailVerified };
  };

  const resendVerificationEmail = async () => {
    const { auth, firebaseConfigError, authModule } = await loadAuthDependencies();
    if (!auth) throw getAuthUnavailableError(firebaseConfigError);
    if (!auth.currentUser) throw new Error("You must be signed in to resend the verification email.");
    const identifier = normalizeAuthIdentifier(auth.currentUser.email || auth.currentUser.uid);
    assertAuthAttemptAllowed("emailVerification", identifier);
    recordAuthAttempt("emailVerification", identifier);
    await authModule.sendEmailVerification(auth.currentUser);
  };

  const reloadUser = async () => {
    const { auth } = await loadAuthDependencies();
    if (!auth?.currentUser) return false;
    await auth.currentUser.reload();
    const tokenResult = await auth.currentUser.getIdTokenResult(true);
    const refreshed = toAppUser(auth.currentUser, tokenResult);
    setUser(refreshed);
    setSession(refreshed);
    return !!auth.currentUser.emailVerified;
  };

  const signInWithGoogle = async () => {
    const { auth, firebaseConfigError, authModule } = await loadAuthDependencies();
    if (!auth) throw getAuthUnavailableError(firebaseConfigError);

    const localhostAuthUrl = getLocalhostAuthUrl();
    if (localhostAuthUrl) {
      window.location.assign(localhostAuthUrl);
      return;
    }
    await authModule.signInWithRedirect(auth, createGoogleProvider(authModule));
  };

  const signOut = async () => {
    const { auth, firebaseConfigError, authModule } = await loadAuthDependencies();
    if (!auth) throw getAuthUnavailableError(firebaseConfigError);
    await authModule.signOut(auth);
  };

  const sendPasswordReset = async (email: string) => {
    const { auth, firebaseConfigError, authModule } = await loadAuthDependencies();
    if (!auth) throw getAuthUnavailableError(firebaseConfigError);
    const identifier = normalizeAuthIdentifier(email);
    assertAuthAttemptAllowed("passwordReset", identifier);
    recordAuthAttempt("passwordReset", identifier);
    try {
      await authModule.sendPasswordResetEmail(auth, email);
    } catch (error: unknown) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "auth/user-not-found") return;
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signInWithEmailPassword,
        signUpWithEmailPassword,
        signInWithGoogle,
        signOut,
        resendVerificationEmail,
        reloadUser,
        sendPasswordReset,
        redirectError,
        clearRedirectError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
