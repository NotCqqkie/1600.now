import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Pages a signed-in-but-unverified user is still allowed to reach. Anything
// else redirects to /verify-email until they confirm their email.
const ALLOWED_UNVERIFIED_PATHS = new Set<string>([
  "/verify-email",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
]);

export const EmailVerificationGuard = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    if (user.emailVerified) return;
    if (ALLOWED_UNVERIFIED_PATHS.has(location.pathname)) return;
    navigate("/verify-email", { replace: true });
  }, [user, loading, location.pathname, navigate]);

  return null;
};
