export type AuthUxCooldownScope =
  | "signin"
  | "signup"
  | "passwordReset"
  | "emailVerification";

export const AUTH_UX_COOLDOWN_MS: Record<AuthUxCooldownScope, number> = {
  signin: 1_500,
  signup: 5_000,
  passwordReset: 30_000,
  emailVerification: 30_000,
};

type AuthUxCooldownError = Error & {
  code?: string;
  retryAfterMs?: number;
};

const AUTH_PASSWORD_DESCRIPTION = "Use at least 8 characters and 1 number.";
const LEGACY_AUTH_ATTEMPT_PREFIX = "1600now:auth-attempts:";
let legacyAuthAttemptsCleared = false;

export const validatePasswordInput = (password: string): void => {
  if (password.length >= 8 && /\d/.test(password)) return;
  const error = new Error(AUTH_PASSWORD_DESCRIPTION) as Error & { code?: string };
  error.code = "auth/local-weak-password";
  throw error;
};

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    if (!legacyAuthAttemptsCleared) {
      legacyAuthAttemptsCleared = true;
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith(LEGACY_AUTH_ATTEMPT_PREFIX)) storage.removeItem(key);
      }
    }
    return storage;
  } catch {
    return null;
  }
};

const getCooldownKey = (scope: AuthUxCooldownScope): string =>
  `1600now:auth-ux-cooldown:${scope}`;

const readCooldownUntil = (scope: AuthUxCooldownScope): number => {
  const storage = getStorage();
  if (!storage) return 0;
  try {
    const value = Number(storage.getItem(getCooldownKey(scope)));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

export const assertAuthUxCooldownElapsed = (scope: AuthUxCooldownScope): void => {
  const retryAfterMs = readCooldownUntil(scope) - Date.now();
  if (retryAfterMs <= 0) return;
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  const error = new Error(
    `Please wait ${seconds} ${seconds === 1 ? "second" : "seconds"} before trying again.`,
  ) as AuthUxCooldownError;
  error.code = "auth/client-cooldown";
  error.retryAfterMs = retryAfterMs;
  throw error;
};

export const startAuthUxCooldown = (scope: AuthUxCooldownScope): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      getCooldownKey(scope),
      String(Date.now() + AUTH_UX_COOLDOWN_MS[scope]),
    );
  } catch {
    return;
  }
};

export const clearAuthUxCooldown = (scope: AuthUxCooldownScope): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(getCooldownKey(scope));
  } catch {
    return;
  }
};
