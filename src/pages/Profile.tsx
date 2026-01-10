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
  ArrowLeft, CheckCircle2, XCircle, AlertCircle, Clock, 
  User, Settings, LogOut, ChartBar, ChevronDown, Activity, BookOpen
} from "lucide-react";
import categoryMapDataRaw from "@/data/category_map.json";

// Type definition for category map
type CategoryMapItem = {
  subject: string;
  domain: string;
  skill: string;
  confidence: string;
};

const categoryMap = categoryMapDataRaw as Record<string, CategoryMapItem>;

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
    // 1. Calculate Statistics
    const stats = useMemo(() => {
        const allProgress = Object.values(progress);
        
        const overall = {
            totalAttempted: 0,
            correct: 0,
            incorrect: 0,
            totalTime: 0,
            correctFirstTry: 0
        };

        // Structure: Subject -> Domain -> Skills[]
        const structure: Record<string, { domains: Record<string, { skills: Record<string, any> }> }> = {
            "Math": { domains: {} },
            "English": { domains: {} }
        };

        // Initialize domains and skills
        Object.entries(categoryMap).forEach(([id, meta]) => {
           const subject = meta.subject === "Math" ? "Math" : "English"; 
           
           if (!structure[subject].domains[meta.domain]) {
               structure[subject].domains[meta.domain] = { skills: {} };
           }
           
           if (!structure[subject].domains[meta.domain].skills[meta.skill]) {
               structure[subject].domains[meta.domain].skills[meta.skill] = {
                   total: 0,
                   attempted: 0,
                   correctFirstTry: 0,
                   correctEventually: 0,
                   incorrect: 0
               };
           }
           structure[subject].domains[meta.domain].skills[meta.skill].total++;
        });

        const bySubjectStats = {
            "Math": { totalAttempted: 0, correct: 0, incorrect: 0, totalTime: 0 },
            "English": { totalAttempted: 0, correct: 0, incorrect: 0, totalTime: 0 }
        };

        // Process User Progress
        allProgress.forEach(p => {
            if (p.attempts.length === 0) return;
            
            const meta = categoryMap[p.questionId];
            if (!meta) return;

            const subject = meta.subject === "Math" ? "Math" : "English";
            const domain = meta.domain; // e.g. "Algebra"
            const skill = meta.skill; // e.g. "Linear equations"

            // Overall Stats
            overall.totalAttempted++;
            overall.totalTime += p.totalTimeSpentSeconds;

            // Subject Stats
            bySubjectStats[subject].totalAttempted++;
            bySubjectStats[subject].totalTime += p.totalTimeSpentSeconds;

            // Skill Stats (which rolls up to Domain implicitly by structure)
            if (structure[subject]?.domains[domain]?.skills[skill]) {
                const skillStats = structure[subject].domains[domain].skills[skill];
                skillStats.attempted++;

                const isSolved = p.attempts.some(a => a.result === 'correct');
                const isFirstTryCorrect = p.attempts.length > 0 && p.attempts[0].result === 'correct';

                if (isSolved) {
                    overall.correct++;
                    bySubjectStats[subject].correct++;
                    if (isFirstTryCorrect) {
                        overall.correctFirstTry++;
                        skillStats.correctFirstTry++;
                    } else {
                        skillStats.correctEventually++;
                    }
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

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
             <div className="mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Activity className="w-6 h-6" />
                    Performance Statistics
                </h2>
                 <p className="text-muted-foreground">Detailed breakdown of your progress across Math and English.</p>
            </div>

            {/* Overall Stats Grid */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Questions Attempted</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overall.totalAttempted}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Global Accuracy</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.overall.totalAttempted > 0 
                                ? Math.round((stats.overall.correct / stats.overall.totalAttempted) * 100) 
                                : 0}%
                        </div>
                         <p className="text-xs text-muted-foreground">
                            {stats.overall.correct} correct / {stats.overall.totalAttempted} total
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                         <CardTitle className="text-sm font-medium">Total Time Spent</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatTime(stats.overall.totalTime)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                         <CardTitle className="text-sm font-medium">Avg Time / Question</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                             {stats.overall.totalAttempted > 0 
                                ? formatTime(Math.round(stats.overall.totalTime / stats.overall.totalAttempted)) 
                                : "0s"}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 p-4 bg-muted/40 rounded-lg border text-sm">
                <div className="flex items-center gap-2">
                    <SkillStatusIcon status="unseen" size="sm" />
                    <span>Unseen</span>
                </div>
                <div className="flex items-center gap-2">
                    <SkillStatusIcon status="learning" size="sm" />
                    <span>Learning</span>
                </div>
                <div className="flex items-center gap-2">
                    <SkillStatusIcon status="familiar" size="sm" />
                    <span>Familiar</span>
                </div>
                <div className="flex items-center gap-2">
                    <SkillStatusIcon status="proficient" size="sm" />
                    <span>Proficient</span>
                </div>
            </div>

            {/* Side by Side Breakdown */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                 {/* Math Section */}
                 <SubjectBreakdown 
                    subject="Math" 
                    stats={stats.bySubjectStats["Math"]}
                    domains={stats.structure["Math"].domains}
                    formatTime={formatTime} 
                 />

                 {/* English Section */}
                 <SubjectBreakdown 
                    subject="English" 
                    stats={stats.bySubjectStats["English"]}
                    domains={stats.structure["English"].domains}
                    formatTime={formatTime} 
                 />
            </div>

        </div>
    );
};

const SubjectBreakdown = ({ subject, stats, domains, formatTime }: any) => {
    const accuracy = stats.totalAttempted > 0 
        ? Math.round((stats.correct / stats.totalAttempted) * 100) 
        : 0;

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="pb-4 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${subject === "Math" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                             {subject === "Math" ? <CalculatorIcon className="w-5 h-5"/> : <BookOpen className="w-5 h-5"/>}
                        </div>
                        <div>
                             <CardTitle>{subject}</CardTitle>
                             <CardDescription>Overall Accuracy: {accuracy}%</CardDescription>
                        </div>
                    </div>
                </div>
                {/* Mini Stats for Subject */}
                 <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="bg-background rounded p-2 border">
                        <div className="text-xs text-muted-foreground">Time Spent</div>
                        <div className="font-semibold">{formatTime(stats.totalTime)}</div>
                    </div>
                     <div className="bg-background rounded p-2 border">
                        <div className="text-xs text-muted-foreground">Correct</div>
                        <div className="font-semibold text-green-600">{stats.correct}</div>
                    </div>
                     <div className="bg-background rounded p-2 border">
                        <div className="text-xs text-muted-foreground">Incorrect</div>
                        <div className="font-semibold text-red-600">{stats.incorrect}</div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 pt-6 space-y-6">
                {Object.entries(domains).map(([domainName, rawData]: [string, any]) => {
                    const skills = rawData.skills || {};
                    return (
                        <div key={domainName} className="flex gap-4 items-center justify-between">
                             <div className="min-w-[120px] font-medium text-sm">{domainName}</div>
                             <div className="flex-1 flex flex-wrap gap-2 justify-end">
                                {Object.entries(skills).map(([skillName, skillStats]: [string, any]) => {
                                    // Determine Status
                                    let status: "unseen" | "learning" | "familiar" | "proficient" = "unseen";
                                    
                                    if (skillStats.attempted > 0) {
                                        const totalCorrect = skillStats.correctFirstTry + skillStats.correctEventually;
                                        const accuracy = totalCorrect / skillStats.attempted;
                                        
                                        if (accuracy >= 0.85) status = "proficient";
                                        else if (accuracy >= 0.50) status = "familiar";
                                        else status = "learning";
                                    }

                                    return (
                                        <TooltipProvider key={skillName}>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <SkillStatusIcon status={status} />
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs">
                                                    <div className="font-bold mb-1">{skillName}</div>
                                                    <div className="text-xs space-y-1">
                                                        <div>Status: <span className="capitalize font-medium">{status}</span></div>
                                                        <div>attempts: {skillStats.attempted}</div>
                                                        <div>correct: {skillStats.correctFirstTry + skillStats.correctEventually}</div>
                                                        <div>accuracy: {skillStats.attempted > 0 ? Math.round(((skillStats.correctFirstTry + skillStats.correctEventually) / skillStats.attempted) * 100) : 0}%</div>
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

// Icon Components

const SkillStatusIcon = ({ status, size = "md" }: { status: "unseen" | "learning" | "familiar" | "proficient", size?: "sm" | "md" }) => {
    const boxSize = size === "sm" ? "w-4 h-4 rounded" : "w-6 h-6 rounded-md"; // Slightly larger rounded for visual clarity
    
    if (status === "unseen") {
        return (
            <div className={`${boxSize} border-2 border-muted-foreground/30 bg-transparent`} />
        );
    }
    
    if (status === "learning") {
         // Orange half-filled or similar representation
        return (
            <div className={`${boxSize} bg-orange-500/20 border-2 border-orange-500 relative overflow-hidden`}>
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-orange-500" />
            </div>
        );
    }

    if (status === "familiar") {
         // Lime green, maybe top-heavy or just solid lime? Image looked like a lime container.
         // Let's do a lime border with a lime gradient or fill
         return (
             <div className={`${boxSize} bg-lime-400 border-2 border-lime-500 lg:bg-lime-400/80`}>
                 <div className="w-full h-full bg-lime-400/50" />
             </div>
         );
    }
    
    if (status === "proficient") {
        // Green Checkbox style
        return (
            <div className={`${boxSize} bg-green-500 border-2 border-green-600 flex items-center justify-center text-white`}>
                <CheckIcon className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
            </div>
        );
    }
    return null;
};

// Simple Icons
const CheckIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
);

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
