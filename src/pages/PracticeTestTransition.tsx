import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildPracticeTestQuestionSet, getPracticeSet } from "@/data/modulePracticeBank";
import { getPracticeTestSession, savePracticeTestSession } from "@/lib/practice/practiceTestSession";

const formatClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const MODULE_TRANSITION_MS = 1400;

const PracticeTestTransition = () => {
  const { setId } = useParams<{ setId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const practiceSet = useMemo(() => (setId ? getPracticeSet(setId) : null), [setId]);
  const kind = searchParams.get("kind");
  const sessionId = searchParams.get("session");
  const [session, setSession] = useState(
    () => (practiceSet ? getPracticeTestSession(practiceSet.id) : null),
  );
  const nextModule = session ? session.modules[session.activeModuleIndex] : null;

  useEffect(() => {
    setSession(practiceSet ? getPracticeTestSession(practiceSet.id) : null);
  }, [practiceSet, sessionId]);

  const continueToNextQuestion = (activeSession = session) => {
    if (!practiceSet || !activeSession) return;
    const questionSet = buildPracticeTestQuestionSet(practiceSet.id);
    const targetQuestion = questionSet?.[activeSession.currentIndex];
    if (!targetQuestion) return;

    sessionStorage.setItem("practiceExitTo", `/practice-tests/${practiceSet.id}/start`);
    sessionStorage.setItem("practiceSet", JSON.stringify(questionSet));

    navigate(
      `/bank/${targetQuestion.subject}/${targetQuestion.sourceId}?bankType=past&practice=true&idx=${activeSession.currentIndex + 1}&practiceTest=${practiceSet.id}&practiceTestSession=${activeSession.sessionId}`,
    );
  };

  const skipBreak = () => {
    if (!practiceSet || !sessionId) return;
    const latestSession = getPracticeTestSession(practiceSet.id);
    if (!latestSession || latestSession.sessionId !== sessionId) return;

    const nextSession = {
      ...latestSession,
      breakStatus: "skipped" as const,
    };

    setSession(nextSession);
    savePracticeTestSession(nextSession);
    continueToNextQuestion(nextSession);
  };

  useEffect(() => {
    if (!practiceSet || !session || !sessionId || session.sessionId !== sessionId) return;

    if (kind === "break") {
      if (session.breakStatus !== "active") return;

      const timerId = window.setInterval(() => {
        const latestSession = getPracticeTestSession(practiceSet.id);
        if (!latestSession || latestSession.sessionId !== sessionId || latestSession.breakStatus !== "active") {
          window.clearInterval(timerId);
          return;
        }

        const nextSession = {
          ...latestSession,
          breakElapsedSeconds: latestSession.breakElapsedSeconds + 1,
          breakRemainingSeconds: Math.max(0, latestSession.breakRemainingSeconds - 1),
          breakStatus:
            latestSession.breakRemainingSeconds <= 1
              ? ("completed" as const)
              : latestSession.breakStatus,
        };

        setSession(nextSession);
        savePracticeTestSession(nextSession);

        if (nextSession.breakRemainingSeconds === 0) {
          window.clearInterval(timerId);
          continueToNextQuestion(nextSession);
        }
      }, 1000);

      return () => window.clearInterval(timerId);
    }

    const timeoutId = window.setTimeout(() => {
      continueToNextQuestion();
    }, MODULE_TRANSITION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [kind, practiceSet, session, sessionId]);

  if (!practiceSet || !session || !sessionId || session.sessionId !== sessionId || !nextModule) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Session not found</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (kind === "break") {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-4 py-12 sm:px-6">
        <Card className="border-border/70">
          <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
            <h1
              style={{
                fontFamily: "'Geist', Georgia, serif",
                fontSize: "clamp(36px, 5vw, 62px)",
                fontWeight: 400,
                letterSpacing: "-0.05em",
                lineHeight: 0.96,
              }}
          >
            Break
          </h1>
          <div className="text-6xl font-semibold tracking-[-0.06em] tabular-nums text-foreground">
            {formatClock(session.breakRemainingSeconds)}
          </div>
          <Button variant="outline" onClick={skipBreak}>
            Skip break
          </Button>
        </CardContent>
      </Card>
    </div>
  );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-4 py-12 sm:px-6">
      <Card className="border-border/70">
        <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div>
            <h1
              style={{
                fontFamily: "'Geist', Georgia, serif",
                fontSize: "clamp(34px, 4.5vw, 56px)",
                fontWeight: 400,
                letterSpacing: "-0.05em",
                lineHeight: 0.96,
              }}
            >
              Loading Next Module
            </h1>
            <div className="mt-2 text-sm text-muted-foreground">{nextModule.moduleTitle}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PracticeTestTransition;
