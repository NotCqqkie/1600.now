
import React, { createContext, useContext, useEffect, useState } from "react";
import type { Auth, User as FirebaseUser } from "firebase/auth";

export interface AppUser {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  raw: FirebaseUser;
}

interface AuthContextType {
  session: AppUser | null;
  user: AppUser | null;
  loading: boolean;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signInWithEmailPassword: async () => {},
  signUpWithEmailPassword: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
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
      import("@/lib/firebase"),
    ]).then(([authModule, firebaseModule]) => ({
      auth: firebaseModule.auth,
      firebaseConfigError: firebaseModule.firebaseConfigError,
      authModule,
    }));
  }

  return authDependenciesPromise;
};

const toAppUser = (firebaseUser: FirebaseUser | null): AppUser | null => {
  if (!firebaseUser) return null;
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
    raw: firebaseUser,
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<AppUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

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

      // Process any pending redirect result (from signInWithRedirect flow).
      // onAuthStateChanged will fire afterward with the signed-in user.
      authModule.getRedirectResult(auth).catch(() => {
        // No redirect pending — ignore.
      });

      unsubscribe = authModule.onAuthStateChanged(auth, (firebaseUser) => {
        if (cancelled) return;

        const appUser = toAppUser(firebaseUser);
        setSession(appUser);
        setUser(appUser);
        setLoading(false);
      });
    };

    const idleCallback =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(() => {
            void initializeAuth();
          })
        : window.setTimeout(() => {
            void initializeAuth();
          }, 1);

    return () => {
      cancelled = true;
      unsubscribe?.();

      if ("cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallback as number);
      } else {
        window.clearTimeout(idleCallback as number);
      }
    };
  }, []);

  const signInWithEmailPassword = async (email: string, password: string) => {
    const { auth, firebaseConfigError, authModule } = await loadAuthDependencies();
    if (!auth) throw getAuthUnavailableError(firebaseConfigError);
    await authModule.signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmailPassword = async (email: string, password: string) => {
    const { auth, firebaseConfigError, authModule } = await loadAuthDependencies();
    if (!auth) throw getAuthUnavailableError(firebaseConfigError);
    await authModule.createUserWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    const { auth, firebaseConfigError, authModule } = await loadAuthDependencies();
    if (!auth) throw getAuthUnavailableError(firebaseConfigError);

    const provider = new authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await authModule.signInWithPopup(auth, provider);
    } catch (error: any) {
      const code = error?.code;
      if (
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        await authModule.signInWithRedirect(auth, provider);
        return;
      }

      throw error;
    }
  };

  const signOut = async () => {
    const { auth, firebaseConfigError, authModule } = await loadAuthDependencies();
    if (!auth) throw getAuthUnavailableError(firebaseConfigError);
    await authModule.signOut(auth);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
