import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const AUTH_PATHS = new Set(["/login", "/signup"]);
export const AUTH_RETURN_KEY = "authReturnTo";
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
    }
  }, [location.pathname, location.search]);

  return null;
};
