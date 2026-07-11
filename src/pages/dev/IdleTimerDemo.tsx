import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildModulePracticeSet, getPracticeModules } from "@/data/modulePracticeBank";
import {
  clearModulePracticeSession,
  createModulePracticeSession,
} from "@/lib/practice/modulePracticeSession";
import { buildModulePracticeQuestionRoute } from "@/lib/practice/practiceBankRoutes";
import { writePracticeLaunchStorage } from "@/lib/practice/practiceRunStorage";

const DEMO_IDLE_TIMER_MS = 5000;

const IdleTimerDemo = () => {
  const navigate = useNavigate();
  const module = useMemo(
    () => getPracticeModules().find((practiceModule) => practiceModule.questions.length > 0) ?? null,
    [],
  );

  const startDemo = () => {
    if (!module) return;

    const practiceSet = buildModulePracticeSet(module.slug);
    const firstQuestion = practiceSet?.[0];
    if (!practiceSet || !firstQuestion) return;

    clearModulePracticeSession(module.slug, null);
    const session = createModulePracticeSession(module, {
      timed: false,
      timeLimitSeconds: null,
      allowCheckingAnswers: true,
    }, null);
    writePracticeLaunchStorage(practiceSet, "/dev/idle-timer-demo");

    navigate(
      `${buildModulePracticeQuestionRoute({
        subject: firstQuestion.subject,
        sourceId: firstQuestion.sourceId,
        bankType: firstQuestion.bankType,
        idx: 1,
        moduleSlug: module.slug,
        moduleSessionId: session.sessionId,
      })}&idleTimerMs=${DEMO_IDLE_TIMER_MS}`,
    );
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-10">
      <Card className="border-border/70">
        <CardHeader>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
            <TimerReset className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle>Idle Timer Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Starts an untimed module question with the idle pause set to 5 seconds.
          </p>
          <Button className="w-full" onClick={startDemo} disabled={!module}>
            Start demo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default IdleTimerDemo;
