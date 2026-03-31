import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress, QuestionProgress } from "@/hooks/useUserProgress";
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "@/components/ui/tooltip";
import { intervalToDuration } from "date-fns";
import {
  ArrowLeft, AlertCircle,
  Settings, LogOut, ChartBar, Activity, BookOpen,
  Palette, TrendingUp, Clock, Target, Zap
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getBankPool } from "@/data/questionBank";

// Build a live category map from the question bank (keyed by the same
// "bank-{subject}-{id}" format that BankQuestion.tsx uses when saving progress).
type CategoryMapItem = { subject: string; domain: string; skill: string };
const buildLiveCategoryMap = (): Record<string, CategoryMapItem> => {
  const map: Record<string, CategoryMapItem> = {};
  for (const q of getBankPool("math")) {
    map[`bank-math-${q.id}`] = { subject: "Math", domain: q.category.domain, skill: q.category.skill };
  }
  for (const q of getBankPool("reading")) {
    map[`bank-reading-${q.id}`] = { subject: "English", domain: q.category.domain, skill: q.category.skill };
  }
  return map;
};
const liveCategoryMap = buildLiveCategoryMap();

const Profile = () => {
  const { user, signOut } = useAuth();
  const { progress, resetProgress } = useUserProgress();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"settings" | "statistics">("statistics");

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleResetProgress = () => {
    resetProgress();
  };
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header with Navigation and box-like wrapper starts here */}
        <div className="flex items-center justify-between gap-4 mb-4">
           <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">Profile</h1>
           </div>
           
           <div className="flex items-center gap-4">
             <div className="text-sm text-muted-foreground mr-2">
                {user?.email}
             </div>
             <Button variant="outline" size="sm" onClick={handleSignOut} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
             </Button>
           </div>
        </div>

        {/* Main Content Wrapper Box */}
        <div className="border rounded-xl p-6 bg-card shadow-sm">
           {/* Tab Navigation */}
           <div className="flex gap-2 mb-6 border-b pb-0">
               <button
                 onClick={() => setActiveTab("statistics")}
                 className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === "statistics" 
                    ? "border-primary text-primary" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                 }`}
               >
                 <div className="flex items-center gap-2">
                    <ChartBar className="w-4 h-4" />
                    Statistics
                 </div>
               </button>
               <button
                 onClick={() => setActiveTab("settings")}
                 className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === "settings" 
                    ? "border-primary text-primary" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                 }`}
               >
                 <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Settings
                 </div>
               </button>
           </div>

           {activeTab === "settings" && (
             <SettingsView user={user} handleResetProgress={handleResetProgress} />
           )}
           {activeTab === "statistics" && (
             <StatisticsView progress={progress} />
           )}
        </div>
      </div>
    </div>
  );
};

// Sub-components

const SettingsView = ({ user, handleResetProgress }: { user: any, handleResetProgress: () => void }) => {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Account Settings
        </h2>
        <p className="text-muted-foreground">Manage your account information and data.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <div className="text-lg">{user?.email || "Not logged in"}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">User ID</label>
            <div className="text-xs font-mono text-muted-foreground break-all">
              {user?.id || "-"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <Palette className="w-5 h-5" />
             Appearance
          </CardTitle>
          <CardDescription>Customize your interface experience</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Theme Mode</div>
              <div className="text-sm text-muted-foreground">Toggle between light and dark visual themes.</div>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-900/50 bg-red-50/10">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Actions that cannot be undone</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Reset All Progress</div>
              <div className="text-sm text-muted-foreground">Clears all question history, attempts, and time tracking.</div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Reset Progress</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    question history and reset your progress tracking to zero.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetProgress} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

const StatisticsView = ({ progress }: { progress: Record<string, QuestionProgress> }) => {
    const stats = useMemo(() => {
        const allProgress = Object.values(progress);

        const overall = { totalAttempted: 0, correct: 0, incorrect: 0, totalTime: 0, correctFirstTry: 0 };

        // Build domain/skill structure from the live category map so counts are always in sync.
        const structure: Record<string, { domains: Record<string, { skills: Record<string, any> }> }> = {
            "Math": { domains: {} },
            "English": { domains: {} }
        };

        Object.values(liveCategoryMap).forEach((meta) => {
            const subject = meta.subject === "Math" ? "Math" : "English";
            if (!structure[subject].domains[meta.domain]) {
                structure[subject].domains[meta.domain] = { skills: {} };
            }
            if (!structure[subject].domains[meta.domain].skills[meta.skill]) {
                structure[subject].domains[meta.domain].skills[meta.skill] = {
                    total: 0, attempted: 0, correctFirstTry: 0, correctEventually: 0, incorrect: 0
                };
            }
            structure[subject].domains[meta.domain].skills[meta.skill].total++;
        });

        const bySubjectStats = {
            "Math": { totalAttempted: 0, correct: 0, incorrect: 0, totalTime: 0 },
            "English": { totalAttempted: 0, correct: 0, incorrect: 0, totalTime: 0 }
        };

        allProgress.forEach(p => {
            if (p.attempts.length === 0) return;
            const meta = liveCategoryMap[p.questionId];
            if (!meta) return;

            const subject = meta.subject === "Math" ? "Math" : "English";
            const { domain, skill } = meta;

            overall.totalAttempted++;
            overall.totalTime += p.totalTimeSpentSeconds;
            bySubjectStats[subject].totalAttempted++;
            bySubjectStats[subject].totalTime += p.totalTimeSpentSeconds;

            const skillStats = structure[subject]?.domains[domain]?.skills[skill];
            if (skillStats) {
                skillStats.attempted++;
                const isSolved = p.attempts.some(a => a.result === 'correct');
                const isFirstTryCorrect = p.attempts[0]?.result === 'correct';

                if (isSolved) {
                    overall.correct++;
                    bySubjectStats[subject].correct++;
                    if (isFirstTryCorrect) { overall.correctFirstTry++; skillStats.correctFirstTry++; }
                    else skillStats.correctEventually++;
                } else {
                    overall.incorrect++;
                    bySubjectStats[subject].incorrect++;
                    skillStats.incorrect++;
                }
            }
        });

        return { overall, structure, bySubjectStats };
    }, [progress]);

    const formatTime = (seconds: number) => {
        if (!seconds) return "0s";
        const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
        if (duration.hours) return `${duration.hours}h ${duration.minutes}m`;
        if (duration.minutes) return `${duration.minutes}m ${duration.seconds || 0}s`;
        return `${duration.seconds}s`;
    };

    const accuracy = stats.overall.totalAttempted > 0
        ? Math.round((stats.overall.correct / stats.overall.totalAttempted) * 100)
        : 0;
    const firstTryRate = stats.overall.totalAttempted > 0
        ? Math.round((stats.overall.correctFirstTry / stats.overall.totalAttempted) * 100)
        : 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="mb-2">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Activity className="w-6 h-6" />
                    Performance Statistics
                </h2>
                <p className="text-muted-foreground">Your progress across Math and English question bank.</p>
            </div>

            {stats.overall.totalAttempted === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <Target className="w-10 h-10 text-muted-foreground/40" />
                    <p className="text-lg font-medium text-muted-foreground">No questions attempted yet</p>
                    <p className="text-sm text-muted-foreground/70">Head to the Question Bank and start practicing to see your stats here.</p>
                </div>
            ) : (
                <>
                    {/* Overall Stats Grid */}
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Attempted</p>
                                        <p className="text-3xl font-bold mt-1">{stats.overall.totalAttempted}</p>
                                    </div>
                                    <TrendingUp className="w-5 h-5 text-muted-foreground/50 mt-1" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Accuracy</p>
                                        <p className={`text-3xl font-bold mt-1 ${accuracy >= 70 ? "text-green-600" : accuracy >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                                            {accuracy}%
                                        </p>
                                        <p className="text-xs text-muted-foreground">{stats.overall.correct} / {stats.overall.totalAttempted}</p>
                                    </div>
                                    <Target className="w-5 h-5 text-muted-foreground/50 mt-1" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">First Try</p>
                                        <p className={`text-3xl font-bold mt-1 ${firstTryRate >= 70 ? "text-green-600" : firstTryRate >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                                            {firstTryRate}%
                                        </p>
                                        <p className="text-xs text-muted-foreground">{stats.overall.correctFirstTry} correct first try</p>
                                    </div>
                                    <Zap className="w-5 h-5 text-muted-foreground/50 mt-1" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Time Spent</p>
                                        <p className="text-3xl font-bold mt-1">{formatTime(stats.overall.totalTime)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {stats.overall.totalAttempted > 0
                                                ? `~${formatTime(Math.round(stats.overall.totalTime / stats.overall.totalAttempted))} / q`
                                                : "—"}
                                        </p>
                                    </div>
                                    <Clock className="w-5 h-5 text-muted-foreground/50 mt-1" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Side by Side Breakdown */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <SubjectBreakdown
                            subject="Math"
                            stats={stats.bySubjectStats["Math"]}
                            domains={stats.structure["Math"].domains}
                            formatTime={formatTime}
                        />
                        <SubjectBreakdown
                            subject="English"
                            stats={stats.bySubjectStats["English"]}
                            domains={stats.structure["English"].domains}
                            formatTime={formatTime}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

const SubjectBreakdown = ({ subject, stats, domains, formatTime }: any) => {
    const accuracy = stats.totalAttempted > 0
        ? Math.round((stats.correct / stats.totalAttempted) * 100)
        : 0;
    const isMath = subject === "Math";

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="pb-4 border-b bg-muted/20">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isMath ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"}`}>
                        {isMath ? <CalculatorIcon className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                        <CardTitle>{subject}</CardTitle>
                        <CardDescription>
                            {stats.totalAttempted > 0
                                ? `${accuracy}% accuracy · ${stats.totalAttempted} attempted`
                                : "No questions attempted yet"}
                        </CardDescription>
                    </div>
                </div>
                {stats.totalAttempted > 0 && (
                    <div className="mt-3">
                        {/* Accuracy bar */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{stats.correct} correct</span>
                            <span>{stats.incorrect} incorrect</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                            <div
                                className="h-full bg-green-500 transition-all"
                                style={{ width: `${(stats.correct / stats.totalAttempted) * 100}%` }}
                            />
                            <div
                                className="h-full bg-red-400"
                                style={{ width: `${(stats.incorrect / stats.totalAttempted) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </CardHeader>
            <CardContent className="flex-1 pt-5 space-y-5">
                {Object.entries(domains).map(([domainName, rawData]: [string, any]) => {
                    const skills = rawData.skills || {};
                    const domainAttempted = Object.values(skills).reduce((s: number, sk: any) => s + sk.attempted, 0) as number;
                    const domainCorrect = Object.values(skills).reduce((s: number, sk: any) => s + sk.correctFirstTry + sk.correctEventually, 0) as number;
                    const domainTotal = Object.values(skills).reduce((s: number, sk: any) => s + sk.total, 0) as number;
                    const domainAccuracy = domainAttempted > 0 ? Math.round((domainCorrect / domainAttempted) * 100) : null;

                    return (
                        <div key={domainName} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">{domainName}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{domainAttempted} / {domainTotal}</span>
                                    {domainAccuracy !== null && (
                                        <span className={`font-medium ${domainAccuracy >= 70 ? "text-green-600" : domainAccuracy >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                                            {domainAccuracy}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1.5 pl-2">
                                {Object.entries(skills).map(([skillName, skillStats]: [string, any]) => {
                                    const correct = skillStats.correctFirstTry + skillStats.correctEventually;
                                    const skillAccuracy = skillStats.attempted > 0
                                        ? Math.round((correct / skillStats.attempted) * 100)
                                        : null;
                                    const completionPct = skillStats.total > 0
                                        ? Math.round((skillStats.attempted / skillStats.total) * 100)
                                        : 0;

                                    return (
                                        <TooltipProvider key={skillName}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="group cursor-default">
                                                        <div className="flex items-center justify-between text-xs mb-0.5">
                                                            <span className="text-muted-foreground truncate max-w-[180px]">{skillName}</span>
                                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                                <span className="text-muted-foreground/70">{skillStats.attempted}/{skillStats.total}</span>
                                                                {skillAccuracy !== null && (
                                                                    <span className={`font-medium ${skillAccuracy >= 70 ? "text-green-600" : skillAccuracy >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                                                                        {skillAccuracy}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {/* Stacked bar: green correct / red incorrect / grey remaining */}
                                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
                                                            {skillStats.total > 0 && (
                                                                <>
                                                                    <div
                                                                        className="h-full bg-green-500"
                                                                        style={{ width: `${(correct / skillStats.total) * 100}%` }}
                                                                    />
                                                                    <div
                                                                        className="h-full bg-red-400"
                                                                        style={{ width: `${(skillStats.incorrect / skillStats.total) * 100}%` }}
                                                                    />
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <div className="font-semibold mb-1 max-w-[200px] text-wrap">{skillName}</div>
                                                    <div className="text-xs space-y-0.5">
                                                        <div>Attempted: {skillStats.attempted} / {skillStats.total} ({completionPct}%)</div>
                                                        <div>Correct: {correct}</div>
                                                        <div>Incorrect: {skillStats.incorrect}</div>
                                                        {skillAccuracy !== null && <div>Accuracy: {skillAccuracy}%</div>}
                                                        {skillStats.correctFirstTry > 0 && (
                                                            <div>First try: {skillStats.correctFirstTry}</div>
                                                        )}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};

// Simple Icons

const CalculatorIcon = ({ className }: { className?: string }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="16" x2="16" y1="14" y2="18" />
      <path d="M16 10h.01" />
      <path d="M12 10h.01" />
      <path d="M8 10h.01" />
      <path d="M12 14h.01" />
      <path d="M8 14h.01" />
      <path d="M12 18h.01" />
      <path d="M8 18h.01" />
    </svg>
);

export default Profile;
