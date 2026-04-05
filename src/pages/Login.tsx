
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BookOpen, Target, BarChart3 } from "lucide-react";

// Google SVG icon
const GoogleIcon = () => (
  <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 488 512" fill="currentColor">
    <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
  </svg>
);

const features = [
  { icon: BookOpen, text: "5,000+ real SAT questions" },
  { icon: Target, text: "100 curated hard math questions" },
  { icon: BarChart3, text: "Per-skill progress tracking" },
];

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signInWithGoogle, signInWithEmailPassword, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user) navigate("/");
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signInWithEmailPassword(email, password);
      navigate("/");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error logging in", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      navigate("/");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error logging in with Google", description: error.message });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:flex-col lg:w-[46%] relative overflow-hidden"
        style={{
          background: "linear-gradient(155deg, hsl(226,42%,7%) 0%, hsl(220,38%,10%) 55%, hsl(214,34%,13%) 100%)",
        }}
      >
        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />
        {/* Glow blob */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-10%", left: "30%", transform: "translateX(-50%)",
            width: 600, height: 400, borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(125,211,252,0.12) 0%, transparent 68%)",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: "10%", right: "-10%",
            width: 300, height: 300, borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(251,191,36,0.06) 0%, transparent 68%)",
          }}
        />

        {/* Content */}
        <div className="relative flex flex-col h-full px-12 py-10">
          <BrandLogo variant="mark" className="h-10 w-10" />

          <div className="flex-1 flex flex-col justify-center">
            <h1
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(40px, 3.8vw, 56px)",
                lineHeight: 0.96,
                color: "hsl(210,40%,98%)",
                marginBottom: 20,
                letterSpacing: "-0.025em",
              }}
            >
              Reach your
              <br />
              <em style={{ fontStyle: "italic", color: "hsl(201,100%,80%)" }}>
                best score.
              </em>
            </h1>
            <p
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.46)",
                lineHeight: 1.65,
                fontWeight: 300,
                marginBottom: 40,
                maxWidth: 320,
              }}
            >
              Accurate SAT practice built from real past tests. No fluff. No paywalls.
            </p>

            <div className="space-y-4">
              {features.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-lg shrink-0"
                    style={{
                      width: 34, height: 34,
                      background: "rgba(125,211,252,0.1)",
                      border: "1px solid rgba(125,211,252,0.18)",
                    }}
                  >
                    <Icon className="h-4 w-4" style={{ color: "hsl(201,100%,80%)" }} />
                  </div>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.68)", fontWeight: 400 }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
            © 2026 1600.now
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <BrandLogo variant="mark" className="h-10 w-10" />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
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
              Sign in to continue your prep.
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
                <Label htmlFor="password">Password</Label>
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
    </div>
  );
};

export default Login;
