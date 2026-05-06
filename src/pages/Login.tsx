
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthReturnTo } from "@/components/AuthReturnTracker";
import { useToast } from "@/hooks/use-toast";
import { describeAuthError } from "@/lib/authErrors";
import { Loader2, ArrowLeft } from "lucide-react";

// Google SVG icon
const GoogleIcon = () => (
  <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 488 512" fill="currentColor">
    <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
  </svg>
);

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const { signInWithGoogle, signInWithEmailPassword, sendPasswordReset, user, loading: authLoading, redirectError, clearRedirectError } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading || !user) return;
    if (!user.emailVerified) navigate("/verify-email", { replace: true });
    else navigate(getAuthReturnTo(), { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!redirectError) return;
    const friendly = describeAuthError(redirectError, "signin");
    toast({ variant: "destructive", title: friendly.title, description: friendly.description });
    clearRedirectError();
  }, [redirectError, toast, clearRedirectError]);

  // Both handlers leave navigation to the user-change useEffect above.
  // That effect routes verified users to the saved return path and
  // unverified users to /verify-email — navigating here would consume the
  // return path before the verified check runs.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signInWithEmailPassword(email, password);
    } catch (error: unknown) {
      const friendly = describeAuthError(error, "signin");
      toast({ variant: "destructive", title: friendly.title, description: friendly.description });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      const friendly = describeAuthError(error, "signin");
      toast({ variant: "destructive", title: friendly.title, description: friendly.description });
    }
  };

  const openResetDialog = () => {
    setResetEmail(email);
    setResetOpen(true);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = resetEmail.trim();
    if (!trimmed) return;
    setResetSubmitting(true);
    try {
      await sendPasswordReset(trimmed);
      toast({
        title: "Check your inbox",
        description: `If an account exists for ${trimmed}, we sent a reset link.`,
      });
      setResetOpen(false);
    } catch (error: unknown) {
      const friendly = describeAuthError(error, "signin");
      toast({ variant: "destructive", title: friendly.title, description: friendly.description });
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <BrandLogo variant="mark" className="h-10 w-10" />
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2
              style={{
                fontFamily: "'Geist', Georgia, serif",
                fontSize: 32,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "hsl(var(--foreground))",
                marginBottom: 6,
              }}
            >
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in to continue studying.
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

            <form onSubmit={handleLogin} className="space-y-4">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={openResetDialog}
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full cursor-pointer" disabled={isSubmitting || authLoading}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handlePasswordReset}>
            <DialogHeader>
              <DialogTitle>Reset your password</DialogTitle>
              <DialogDescription>
                Enter the email on your account and we'll send a link to set a new password.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>
            <DialogFooter className="mt-6 gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetOpen(false)}
                disabled={resetSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={resetSubmitting || !resetEmail.trim()}>
                {resetSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send reset link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
