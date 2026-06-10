type AuthAttemptScope = "signin" | "signup" | "passwordReset" | "emailVerification";

type AttemptRule = {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
};

type AttemptState = {
  attempts: number[];
  lockedUntil?: number;
};

const attemptRules: Record<AuthAttemptScope, AttemptRule> = {
  signin: { maxAttempts: 5, windowMs: 15 * 60 * 1000, lockoutMs: 15 * 60 * 1000 },
  signup: { maxAttempts: 5, windowMs: 30 * 60 * 1000, lockoutMs: 30 * 60 * 1000 },
  passwordReset: { maxAttempts: 3, windowMs: 60 * 60 * 1000, lockoutMs: 60 * 60 * 1000 },
  emailVerification: { maxAttempts: 3, windowMs: 10 * 60 * 1000, lockoutMs: 10 * 60 * 1000 },
};

export const AUTH_PASSWORD_DESCRIPTION = "Use at least 8 characters and 1 number.";

export const isPasswordPolicyCompliant = (password: string): boolean =>
  password.length >= 8 && /\d/.test(password);

export const validatePasswordPolicy = (password: string): void => {
  if (isPasswordPolicyCompliant(password)) return;
  const error = new Error(AUTH_PASSWORD_DESCRIPTION) as Error & { code?: string };
  error.code = "auth/local-weak-password";
  throw error;
};

export const normalizeAuthIdentifier = (value: string | null | undefined): string =>
  (value || "anonymous").trim().toLowerCase();

const getAttemptError = (lockedUntil: number) => {
  const error = new Error("Too many attempts. Try again later.") as Error & {
    code?: string;
    lockedUntil?: number;
  };
  error.code = "auth/client-rate-limited";
  error.lockedUntil = lockedUntil;
  return error;
};

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const getAttemptKey = (scope: AuthAttemptScope, identifier: string): string =>
  `1600now:auth-attempts:${scope}:${identifier}`;

const readAttemptState = (key: string): AttemptState => {
  const storage = getStorage();
  if (!storage) return { attempts: [] };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { attempts: [] };
    const parsed = JSON.parse(raw) as Partial<AttemptState>;
    return {
      attempts: Array.isArray(parsed.attempts)
        ? parsed.attempts.filter((attemptTimestamp) => Number.isFinite(attemptTimestamp))
        : [],
      lockedUntil: Number.isFinite(parsed.lockedUntil) ? parsed.lockedUntil : undefined,
    };
  } catch {
    return { attempts: [] };
  }
};

const writeAttemptState = (key: string, state: AttemptState): void => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(state));
};

export const assertAuthAttemptAllowed = (
  scope: AuthAttemptScope,
  identifier: string,
): void => {
  const rule = attemptRules[scope];
  const key = getAttemptKey(scope, identifier);
  const now = Date.now();
  const state = readAttemptState(key);
  if (state.lockedUntil && state.lockedUntil > now) {
    throw getAttemptError(state.lockedUntil);
  }
  const attempts = state.attempts.filter((ts) => now - ts <= rule.windowMs);
  if (attempts.length >= rule.maxAttempts) {
    const lockedUntil = now + rule.lockoutMs;
    writeAttemptState(key, { attempts, lockedUntil });
    throw getAttemptError(lockedUntil);
  }
  writeAttemptState(key, { attempts });
};

export const recordAuthAttempt = (
  scope: AuthAttemptScope,
  identifier: string,
): void => {
  const rule = attemptRules[scope];
  const key = getAttemptKey(scope, identifier);
  const now = Date.now();
  const state = readAttemptState(key);
  const attempts = [...state.attempts.filter((ts) => now - ts <= rule.windowMs), now];
  const lockedUntil =
    attempts.length >= rule.maxAttempts ? now + rule.lockoutMs : state.lockedUntil;
  writeAttemptState(key, { attempts, lockedUntil });
};

export const clearAuthAttempts = (
  scope: AuthAttemptScope,
  identifier: string,
): void => {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(getAttemptKey(scope, identifier));
};
