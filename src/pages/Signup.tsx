
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthReturnTo } from "@/components/auth/AuthReturnTracker";
import { useToast } from "@/hooks/use-toast";
import { describeAuthError } from "@/lib/firebase/authErrors";
import { Loader2, CheckCircle } from "lucide-react";

const GoogleIcon = () => (
  <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 488 512" fill="currentColor">
    <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
  </svg>
);

const perks = [
  "Track your progress across every skill",
  "Take timed practice tests by skill",
  "See accuracy trends over time",
  "No paid features — ever",
];

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signInWithGoogle, signUpWithEmailPassword, user, loading: authLoading, redirectError, clearRedirectError } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading || !user) return;
    if (!user.emailVerified) navigate("/verify-email", { replace: true });
    else {
      sessionStorage.setItem("onboarding-pending", "1");
      // Fresh signups land on /bank so the onboarding tour's splash sits over
      // the Question Bank — step 1 already targets /bank, no page swap needed.
      // Only fall back to a stored return path if it's something other than "/".
      const stored = getAuthReturnTo();
      navigate(stored === "/" ? "/bank" : stored, { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!redirectError) return;
    const friendly = describeAuthError(redirectError, "signup");
    toast({ variant: "destructive", title: friendly.title, description: friendly.description });
    clearRedirectError();
  }, [redirectError, toast, clearRedirectError]);

  // Both handlers defer navigation to the user-change useEffect above.
  // The effect handles the verified/unverified split and the onboarding
  // flag; navigating here would race the auth state and consume the
  // return path before the verified check runs.
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signUpWithEmailPassword(email, password);
    } catch (error: unknown) {
      const friendly = describeAuthError(error, "signup");
      toast({ variant: "destructive", title: friendly.title, description: friendly.description });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      const friendly = describeAuthError(error, "signup");
      toast({ variant: "destructive", title: friendly.title, description: friendly.description });
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left brand panel (theme-aware) ── */}
      <div className="hidden lg:flex lg:flex-col lg:w-[44%] relative overflow-hidden border-r border-border bg-muted/30 dark:bg-[hsl(226,42%,7%)]">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-60 dark:opacity-100"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border) / 0.55) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.55) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 30% 30%, black 40%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 30%, black 40%, transparent 75%)",
          }}
        />
        {/* Accent glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-8%", left: "20%",
            width: 520, height: 380, borderRadius: "50%",
            background: "radial-gradient(ellipse, hsl(var(--primary) / 0.18) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex flex-col h-full px-10 py-9">
          <BrandLogo variant="mark" className="h-9 w-9" />

          <div className="flex-1 flex flex-col justify-center max-w-md">
            {/* Left-panel headline — Inter Tight 600, similar to display-md but smaller. */}
            <h1
              style={{
                fontFamily: "'Inter Tight', sans-serif",
                fontSize: "clamp(36px, 3.4vw, 50px)",
                fontWeight: 600,
                lineHeight: 1.0,
                marginBottom: 16,
                letterSpacing: "-0.025em",
                color: "rgb(var(--ink))",
              }}
            >
              Start your{" "}
              <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "rgb(var(--ds-accent-deep))" }}>
                free account.
              </span>
            </h1>
            <p className="font-sans text-[14px] leading-[1.5] text-ink-mid mb-7 max-w-sm">
              Unlock progress tracking, question history, vocab review, and full-length practice tests — all free.
            </p>

            <div className="space-y-2.5">
              {perks.map((perk) => (
                <div key={perk} className="flex items-start gap-2.5">
                  <CheckCircle className="shrink-0 mt-0.5 h-4 w-4 text-primary" />
                  <span className="text-[13.5px] text-foreground/75">{perk}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/70">© 2026 1600.now</p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            {/* Auth title — Inter Tight 600, 30px. */}
            <h2 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
              Create account
            </h2>
            <p className="mt-2 font-sans text-[14px] leading-[1.5] text-ink-mid">
              Free, no card required.
            </p>
          </div>

          <div className="space-y-4">
            <Button variant="outline" className="w-full gap-2 cursor-pointer" onClick={handleGoogleLogin}>
              <GoogleIcon />
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full cursor-pointer" disabled={isSubmitting || authLoading}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center font-sans text-[13px] text-ink-mid">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-accent-deep hover:opacity-80">
              Log in
            </Link>
          </p>
          {/* Legal footer — JetBrains Mono 500, 11px, muted-dim. Mono signals "system / legal". */}
          <p className="mt-6 text-center font-mono text-[11px] font-medium tracking-[0.02em] text-ink-muted-dim">
            By signing up, you agree to our terms.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
