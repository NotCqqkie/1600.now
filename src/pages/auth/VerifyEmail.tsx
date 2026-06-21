import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getPostAuthReturnTo } from "@/components/auth/authReturnPath";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MailCheck, RefreshCw } from "lucide-react";

const VerifyEmail = () => {
  const { user, loading, resendVerificationEmail, reloadUser, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const pollRef = useRef<number | null>(null);
  const postAuthReturnToRef = useRef<string | null>(null);
  const getVerifiedDestination = useCallback(() => {
    postAuthReturnToRef.current ??= getPostAuthReturnTo();
    return postAuthReturnToRef.current;
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/login", { replace: true });
    else if (user.emailVerified) {
      sessionStorage.setItem("onboarding-pending", "1");
      navigate(getVerifiedDestination(), { replace: true });
    }
  }, [user, loading, navigate, getVerifiedDestination]);
  useEffect(() => {
    pollRef.current = window.setInterval(async () => {
      const verified = await reloadUser();
      if (verified) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        sessionStorage.setItem("onboarding-pending", "1");
        navigate(getVerifiedDestination(), { replace: true });
      }
    }, 4000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [reloadUser, navigate, getVerifiedDestination]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timerId = window.setTimeout(() => setCooldown((currentCooldown) => currentCooldown - 1), 1000);
    return () => window.clearTimeout(timerId);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendVerificationEmail();
      toast({ title: "Verification email sent", description: `We sent a new link to ${user?.email}.` });
      setCooldown(30);
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't send email", description: (err as { message?: string })?.message ?? "Try again in a minute." });
    } finally {
      setResending(false);
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const verified = await reloadUser();
      if (verified) {
        sessionStorage.setItem("onboarding-pending", "1");
        navigate(getVerifiedDestination(), { replace: true });
      } else {
        toast({ title: "Not verified yet", description: "Click the link in your email, then try again." });
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <BrandLogo variant="mark" />
        <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/login"))}>
          Sign out
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="h-8 w-8" />
          </div>
          <h1
            style={{
              fontFamily: "'Geist', Georgia, serif",
              fontSize: 32,
              letterSpacing: "-0.02em",
            }}
            className="text-foreground mb-3"
          >
            Verify your email
          </h1>
          <p className="text-sm text-muted-foreground mb-1">
            We sent a verification link to
          </p>
          <p className="text-base font-medium text-foreground mb-6 break-all">
            {user?.email ?? "your inbox"}
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Click the link in that email to activate your account. This page will refresh automatically once you've verified.
          </p>

          <div className="flex flex-col gap-3">
            <Button onClick={handleCheckNow} disabled={checking} className="w-full">
              {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              I've verified — check now
            </Button>
            <Button variant="outline" onClick={handleResend} disabled={resending || cooldown > 0} className="w-full">
              {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            Can't find it? Check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
