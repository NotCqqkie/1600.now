import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, ChevronRight, LogOut, Settings, Type, User } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useThemeMode } from "@/hooks/useThemeMode";
import { useUserProgress } from "@/hooks/useUserProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Profile = () => {
  const { user, signOut } = useAuth();
  const { resetProgress } = useUserProgress();
  const navigate = useNavigate();
  const isDarkMode = useThemeMode();
  const headingColor = isDarkMode ? "#f8fafc" : "#0f172a";
  const mutedColor = isDarkMode ? "rgba(226,232,240,0.72)" : "#64748b";

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div
      className="min-h-screen p-6"
      style={{ backgroundColor: isDarkMode ? "hsl(var(--background))" : "#ffffff" }}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1
            style={{
              fontFamily: "'Geist', Georgia, serif",
              fontSize: "clamp(24px, 3vw, 32px)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: headingColor,
              margin: 0,
            }}
          >
            Settings
          </h1>

          {user ? (
            <div className="flex items-center gap-3">
              {user.email && (
                <span className="hidden text-sm sm:block" style={{ color: mutedColor }}>{user.email}</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          ) : null}
        </div>

        {user ? (
          <SettingsView
            user={user}
            handleResetProgress={resetProgress}
            isDarkMode={isDarkMode}
            onOpenPersonalization={() => navigate("/profile/personalization")}
          />
        ) : (
          <SettingsSignInPrompt mutedColor={mutedColor} />
        )}
      </div>
    </div>
  );
};

const SettingsSignInPrompt = ({ mutedColor }: { mutedColor: string }) => {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: "center", padding: "72px 0" }}>
      <User
        size={48}
        style={{
          margin: "0 auto 20px",
          display: "block",
          opacity: 0.2,
          color: "hsl(var(--foreground))",
        }}
      />
      <p
        style={{
          fontSize: 20,
          fontFamily: "'Geist', serif",
          fontWeight: 400,
          color: "hsl(var(--foreground))",
          marginBottom: 10,
        }}
      >
        Sign in to manage settings
      </p>
      <p
        style={{
          fontSize: 14,
          color: mutedColor,
          marginBottom: 32,
        }}
      >
        Your preferences are saved to your account across all devices.
      </p>
      <Button onClick={() => navigate("/login")} className="gap-2">
        Sign in
        <ArrowRight size={14} />
      </Button>
    </div>
  );
};

const SettingsView = ({
  user,
  handleResetProgress,
  isDarkMode,
  onOpenPersonalization,
}: {
  user: { email?: string | null; id?: string | null } | null;
  handleResetProgress: () => void;
  isDarkMode: boolean;
  onOpenPersonalization: () => void;
}) => {
  const headingColor = isDarkMode ? "#f8fafc" : "#0f172a";
  const mutedColor = isDarkMode ? "rgba(226,232,240,0.72)" : "#64748b";
  const cardStyle = {
    backgroundColor: isDarkMode ? "rgba(15,23,42,0.84)" : "#ffffff",
    borderColor: isDarkMode ? "rgba(148,163,184,0.16)" : "rgba(15, 23, 42, 0.08)",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold" style={{ color: headingColor }}>
          <Settings className="h-6 w-6" />
          Account Settings
        </h2>
        <p style={{ color: mutedColor }}>Manage your account information and app preferences.</p>
      </div>

      <Card style={cardStyle}>
        <CardHeader>
          <CardTitle style={{ color: headingColor }}>Account Details</CardTitle>
          <CardDescription style={{ color: mutedColor }}>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium" style={{ color: mutedColor }}>Email</label>
            <div className="text-lg" style={{ color: headingColor }}>{user?.email || "Not logged in"}</div>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: mutedColor }}>User ID</label>
            <div className="break-all font-mono text-xs" style={{ color: mutedColor }}>{user?.id || "-"}</div>
          </div>
        </CardContent>
      </Card>

      <Card style={cardStyle}>
        <CardHeader>
          <CardTitle style={{ color: headingColor }}>Preferences</CardTitle>
          <CardDescription style={{ color: mutedColor }}>Customize how the app looks and feels.</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={onOpenPersonalization}
            className="flex w-full items-center justify-between gap-4 rounded-lg border-2 border-border p-4 text-left transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">
              <Type className="h-5 w-5" style={{ color: headingColor }} />
              <div>
                <div className="font-medium" style={{ color: headingColor }}>Personalization</div>
                <div className="text-sm" style={{ color: mutedColor }}>Question font and text size</div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5" style={{ color: mutedColor }} />
          </button>
        </CardContent>
      </Card>

      <Card
        style={{
          backgroundColor: isDarkMode ? "rgba(15,23,42,0.84)" : "#ffffff",
          borderColor: isDarkMode ? "rgba(248,113,113,0.28)" : "rgba(248, 113, 113, 0.38)",
        }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription style={{ color: mutedColor }}>Actions that cannot be undone</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium" style={{ color: headingColor }}>Reset All Progress</div>
              <div className="text-sm" style={{ color: mutedColor }}>Clears all question history, attempts, and time tracking.</div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Reset Progress</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your question history and reset your progress tracking to zero.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetProgress}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, delete my progress
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
