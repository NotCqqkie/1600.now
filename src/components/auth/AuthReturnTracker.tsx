import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AUTH_RETURN_KEY, isAuthPath } from "@/components/auth/authReturnPath";

export const AuthReturnTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (isAuthPath(location.pathname)) return;
    try {
      sessionStorage.setItem(
        AUTH_RETURN_KEY,
        location.pathname + location.search,
      );
    } catch {
      return;
    }
  }, [location.pathname, location.search]);

  return null;
};
