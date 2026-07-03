import { trackAppError } from "@/lib/analytics";

// Lightweight crash reporter. Lives in its own module (rather than main.tsx) so
// ErrorBoundary and main.tsx can both import it without creating an import cycle.
export const reportError = (
  error: unknown,
  context?: Record<string, unknown>,
): void => {
  console.error("Reported error:", error, context);
  // Forwarded to Firebase Analytics only when the user has granted consent
  // (trackAppError no-ops otherwise).
  const message = error instanceof Error ? error.message : String(error);
  trackAppError(message, context);
};
