
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
import { ArrowUpRight, BookOpenCheck, Calculator, Loader2, Target, TrendingUp } from "lucide-react";

const GoogleIcon = () => (
  <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 488 512" fill="currentColor">
    <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
  </svg>
);

const skillQueue = [
  { label: "Linear equations", count: "12 q" },
  { label: "Words in Context", count: "8 q" },
  { label: "Command of Evidence", count: "6 q" },
];

const moduleProgress = [
  { label: "Reading & Writing", value: "41 / 54", percent: "76%", icon: BookOpenCheck },
  { label: "Math", value: "35 / 44", percent: "80%", icon: Calculator },
];

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const getEmailIssue = (value: string) => {
  if (!value.trim()) return "Enter your email.";
  if (!isValidEmail(value)) return "Enter a valid email address.";
  return "";
};

const getPasswordIssue = (value: string) => {
  if (!value) return "Enter a password.";
  const missing: string[] = [];
  if (value.length < 8) missing.push("at least 8 characters");
  if (!/\d/.test(value)) missing.push("a number");
  if (!missing.length) return "";
  return `Password needs ${missing.join(" and ")}.`;
};

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [authFieldErrors, setAuthFieldErrors] = useState<Partial<Record<"email" | "password", string>>>({});
  const { signInWithGoogle, signUpWithEmailPassword, user, loading: authLoading, redirectError, clearRedirectError } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const emailIssue = getEmailIssue(email);
  const passwordIssue = getPasswordIssue(password);
  const shownEmailIssue = (hasSubmitted || touched.email) ? emailIssue || authFieldErrors.email || "" : "";
  const shownPasswordIssue = (hasSubmitted || touched.password) ? passwordIssue || authFieldErrors.password || "" : "";

  useEffect(() => {
    if (authLoading || !user) return;
    if (!user.emailVerified) navigate("/verify-email", { replace: true });
    else {
      sessionStorage.setItem("onboarding-pending", "1");
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
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    setTouched({ email: true, password: true });
    setAuthFieldErrors({});
    const currentEmailIssue = getEmailIssue(email);
    const currentPasswordIssue = getPasswordIssue(password);
    if (currentEmailIssue || currentPasswordIssue) return;
    setIsSubmitting(true);
    try {
      await signUpWithEmailPassword(email.trim(), password);
    } catch (error: unknown) {
      const friendly = describeAuthError(error, "signup");
      if (friendly.field) {
        setAuthFieldErrors({ [friendly.field]: friendly.description });
      } else {
        toast({ variant: "destructive", title: friendly.title, description: friendly.description });
      }
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
      <div className="hidden lg:flex lg:h-screen lg:w-[46%] relative overflow-hidden border-r border-line bg-card dark:bg-[hsl(220,28%,18%)]">
        <div
          className="absolute inset-0 pointer-events-none opacity-80"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgb(var(--ds-line-soft) / 0.045) 1px, transparent 1px), linear-gradient(rgb(var(--ds-line-soft) / 0.045) 1px, transparent 1px)",
            backgroundSize: "84px 84px",
            maskImage: "linear-gradient(90deg, black 0%, black 64%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(90deg, black 0%, black 64%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-40 pointer-events-none"
          style={{ background: "linear-gradient(180deg, rgb(var(--ds-accent) / 0.16), transparent)" }}
        />
        <svg
          aria-hidden="true"
          className="absolute bottom-[-18px] left-0 h-[220px] w-full text-cobalt/20"
          viewBox="0 0 720 220"
          preserveAspectRatio="none"
        >
          <path d="M0 160 C120 116 168 196 286 126 C376 72 434 134 520 82 C604 32 650 60 720 24" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M0 204 C128 164 208 182 300 146 C426 96 494 122 602 72 C652 50 686 44 720 38" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 10" />
        </svg>

        <div className="relative flex h-full w-full flex-col px-8 py-7 xl:px-12 xl:py-9">
          <BrandLogo variant="full" className="h-10 w-[165px]" />

          <div className="flex flex-1 flex-col justify-center gap-6">
            <div className="max-w-[470px]">
              <p className="ds-caption mb-4">Digital SAT workspace</p>
              <h1 className="font-display text-[38px] font-semibold leading-[0.98] text-ink xl:text-[46px]">
                Every past-test question tied to a score plan.
              </h1>
              <p className="mt-4 max-w-[410px] font-sans text-[14px] leading-[1.5] text-ink-mid">
                Save your answers, review missed skills, and pick up the exact module or question bank set you need next.
              </p>
            </div>

            <div className="w-full max-w-[500px] space-y-3">
              <div className="rounded-[8px] border border-line bg-card/90 p-4 shadow-[0_24px_60px_-42px_rgba(14,33,56,0.55)] dark:bg-white/[0.045]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[12px] font-semibold uppercase text-ink-muted">
                      <Target className="h-3.5 w-3.5 text-cobalt" />
                      Target score
                    </div>
                    <div className="mt-2 flex items-end gap-3">
                      <span className="font-num text-[46px] font-semibold leading-none text-ink">
                        1520
                      </span>
                      <span className="mb-1 inline-flex h-7 items-center gap-1 rounded-full border border-ds-good/20 bg-ds-good/10 px-2.5 text-[12px] font-semibold text-ds-good">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        +140
                      </span>
                    </div>
                  </div>
                  <div className="pt-1 text-right">
                    <div className="text-[11px] font-medium uppercase text-ink-muted">Today</div>
                    <div className="mt-1 font-num text-[22px] font-semibold leading-none text-ink">38</div>
                    <div className="mt-1 text-[11px] text-ink-muted">questions</div>
                  </div>
                </div>

                <div className="mt-4 h-[82px]">
                  <svg aria-hidden="true" className="h-full w-full overflow-visible" viewBox="0 0 360 112" preserveAspectRatio="none">
                    <path d="M4 86 H356" stroke="rgb(var(--ds-line-soft) / 0.1)" strokeWidth="1" />
                    <path d="M4 58 H356" stroke="rgb(var(--ds-line-soft) / 0.1)" strokeWidth="1" />
                    <path d="M4 30 H356" stroke="rgb(var(--ds-line-soft) / 0.1)" strokeWidth="1" />
                    <path d="M8 84 C58 76 78 68 112 70 C158 74 164 44 204 46 C256 48 272 24 350 18 L350 104 L8 104 Z" fill="rgb(var(--ds-accent) / 0.14)" />
                    <path d="M8 84 C58 76 78 68 112 70 C158 74 164 44 204 46 C256 48 272 24 350 18" fill="none" stroke="rgb(var(--cobalt))" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="112" cy="70" r="4" fill="rgb(var(--cobalt-deep))" />
                    <circle cx="204" cy="46" r="4" fill="rgb(var(--cobalt-deep))" />
                    <circle cx="350" cy="18" r="5" fill="rgb(var(--secondary))" />
                  </svg>
                </div>

                <div className="mt-1 flex items-center justify-between text-[11px] font-medium text-ink-muted">
                  <span>Baseline</span>
                  <span>Module review</span>
                  <span>Target range</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {moduleProgress.map(({ label, value, percent, icon: Icon }) => (
                  <div key={label} className="rounded-[8px] border border-line bg-card/75 p-3 shadow-[0_18px_42px_-34px_rgba(14,33,56,0.45)] dark:bg-white/[0.04]">
                    <div className="flex items-center justify-between gap-2">
                      <Icon className="h-4 w-4 text-cobalt" />
                      <span className="font-num text-[13px] font-semibold text-ink">{value}</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ds-line">
                      <div className="h-full rounded-full bg-cobalt" style={{ width: percent }} />
                    </div>
                    <div className="mt-2 text-[12px] font-medium leading-[1.25] text-ink-mid">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full text-[12px] font-semibold uppercase text-ink-muted">
                  <TrendingUp className="h-3.5 w-3.5 text-cobalt" />
                  Next skills
                </span>
                {skillQueue.map(({ label, count }) => (
                  <div key={label} className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-background/70 px-3 text-[12px] dark:bg-white/[0.035]">
                    <span className="font-medium text-ink">{label}</span>
                    <span className="font-num font-semibold text-ink-muted">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
            <span>Free forever.</span>
            <span>Built from real Digital SAT practice.</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
              Create account
            </h2>
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

            <form onSubmit={handleSignup} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setAuthFieldErrors((current) => ({ ...current, email: undefined }));
                  }}
                  onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                  aria-invalid={Boolean(shownEmailIssue)}
                  aria-describedby={shownEmailIssue ? "signup-email-error" : undefined}
                  className={shownEmailIssue ? "border-destructive focus-visible:ring-destructive" : undefined}
                  required
                />
                {shownEmailIssue && (
                  <p id="signup-email-error" role="alert" className="text-[12px] leading-[1.4] text-destructive">
                    {shownEmailIssue}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Choose a password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setAuthFieldErrors((current) => ({ ...current, password: undefined }));
                  }}
                  onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                  aria-invalid={Boolean(shownPasswordIssue)}
                  aria-describedby={shownPasswordIssue ? "signup-password-error" : undefined}
                  className={shownPasswordIssue ? "border-destructive focus-visible:ring-destructive" : undefined}
                  required
                />
                {shownPasswordIssue && (
                  <p id="signup-password-error" role="alert" className="text-[12px] leading-[1.4] text-destructive">
                    {shownPasswordIssue}
                  </p>
                )}
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
          <p className="mt-6 text-center font-sans text-[12px] leading-[1.5] text-ink-muted">
            By signing up, you agree to our terms.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
