import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { storeAuthReturnTo } from "@/components/auth/authReturnPath";

export const AuthReturnTracker = () => {
  const location = useLocation();

  useEffect(() => {
    storeAuthReturnTo(location.pathname, location.search);
  }, [location.pathname, location.search]);

  return null;
};
