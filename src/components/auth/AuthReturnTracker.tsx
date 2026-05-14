import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const AUTH_PATHS = new Set(["/login", "/signup"]);
export const AUTH_RETURN_KEY = "authReturnTo";

// Only accept same-origin absolute paths. Rejects "//evil.com",
// "javascript:...", "data:...", and anything else that could navigate off-site
// or execute script when passed to router navigate().
const isSafeReturnPath = (value: string): boolean =>
  value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");

const normalizeReturnPath = (value: string): string => {
  const path = value.split("?")[0];
  if (path === "/bank" || path.startsWith("/bank/")) return "/bank";
  if (path === "/hard" || path.startsWith("/hard/")) return "/bank";
  return value;
};

export const getAuthReturnTo = (): string => {
  try {
    const stored = sessionStorage.getItem(AUTH_RETURN_KEY);
    sessionStorage.removeItem(AUTH_RETURN_KEY);
    if (
      stored &&
      isSafeReturnPath(stored) &&
      !AUTH_PATHS.has(stored.split("?")[0])
    ) {
      return normalizeReturnPath(stored);
    }
  } catch {
    // sessionStorage unavailable
  }
  return "/";
};

export const AuthReturnTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (AUTH_PATHS.has(location.pathname)) return;
    try {
      sessionStorage.setItem(
        AUTH_RETURN_KEY,
        location.pathname + location.search,
      );
    } catch {
      // sessionStorage unavailable
    }
  }, [location.pathname, location.search]);

  return null;
};
