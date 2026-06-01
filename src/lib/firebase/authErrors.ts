// Maps Firebase auth error codes to user-friendly messages.
// Returns { title, description, field? } so forms can surface errors inline
// or as a toast.

export interface FriendlyAuthError {
  title: string;
  description: string;
  field?: "email" | "password";
}

export function describeAuthError(error: unknown, mode: "signin" | "signup"): FriendlyAuthError {
  const code = (error as { code?: string } | null)?.code ?? "";
  const fallbackMsg = (error as { message?: string } | null)?.message ?? "Something went wrong. Please try again.";
  const genericSignIn = {
    title: "Email or password is incorrect",
    description: "Check your details and try again.",
  };
  const genericSignUp = {
    title: "Couldn't create account",
    description: "Check your email and password and try again.",
  };

  switch (code) {
    case "auth/invalid-email":
      return { title: "Invalid email", description: "That email address doesn't look right. Double-check the format.", field: "email" };
    case "auth/missing-email":
      return { title: "Email required", description: "Please enter your email address.", field: "email" };
    case "auth/missing-password":
      return { title: "Password required", description: "Please enter your password.", field: "password" };
    case "auth/local-weak-password":
    case "auth/weak-password":
      return { title: "Password too weak", description: "Use at least 8 characters and 1 number.", field: "password" };
    case "auth/email-already-in-use":
      return genericSignUp;
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return mode === "signin" ? genericSignIn : genericSignUp;
    case "auth/client-rate-limited":
    case "auth/too-many-requests":
      return { title: "Too many attempts", description: "We've temporarily paused sign-in attempts on this account. Try again in a few minutes or reset your password." };
    case "auth/network-request-failed":
      return { title: "Network error", description: "Check your internet connection and try again." };
    case "auth/user-disabled":
      return { title: "Account disabled", description: "This account has been disabled. Contact support if this is unexpected." };
    case "auth/popup-closed-by-user":
      return { title: "Sign-in cancelled", description: "The Google sign-in window was closed before finishing." };
    case "auth/account-exists-with-different-credential":
      return { title: "Use a different sign-in method", description: "An account with this email exists with a different sign-in method (e.g., Google). Try that instead." };
    case "auth/operation-not-allowed":
      return { title: "Sign-in method disabled", description: "This sign-in method isn't enabled for this app." };
    case "auth/unauthorized-domain":
      return { title: "Domain not authorized", description: "Open the app on localhost or the production domain configured in Firebase Authentication." };
    case "auth/missing-initial-state":
      return { title: "Google sign-in couldn't finish", description: "The OAuth return state was blocked by the browser. Try again on the app's main domain." };
    case "auth/requires-recent-login":
      return { title: "Please sign in again", description: "For security, sign in again before continuing." };
    default:
      return { title: mode === "signup" ? "Couldn't create account" : "Couldn't sign in", description: fallbackMsg.replace(/^Firebase:\s*/i, "") };
  }
}
