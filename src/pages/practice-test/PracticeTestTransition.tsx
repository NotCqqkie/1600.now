import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildPracticeTestQuestionSet, getPracticeSet } from "@/data/modulePracticeBank";
import { buildPracticeTestQuestionRoute } from "@/lib/practice/practiceBankRoutes";
import {
  getPracticeTestSession,
  savePracticeTestSession,
  type PracticeTestSessionMeta,
} from "@/lib/practice/practiceTestSession";
import {
  PRACTICE_MODULES_EXIT_PATH,
  writePracticeLaunchStorage,
} from "@/lib/practice/practiceRunStorage";
import { formatPracticeClock } from "@/lib/practice/practiceTime";

const MODULE_TRANSITION_MS = 1400;
const BREAK_KIND = "break";
const NOT_FOUND_SHELL_CLASS = "mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6";
const TRANSITION_SHELL_CLASS = "mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-4 py-12 sm:px-6";
const TRANSITION_CARD_CLASS = "border-border/70";
const TRANSITION_CARD_CONTENT_CLASS = "flex flex-col items-center gap-6 py-12 text-center";
const BREAK_CLOCK_CLASS = "text-6xl font-semibold tracking-[-0.06em] tabular-nums text-foreground";
const SPINNER_CLASS = "h-14 w-14 animate-spin rounded-full border-4 border-primary border-t-transparent";
const HEADING_STYLE_BASE = {
  fontFamily: "'Geist', Georgia, serif",
  fontWeight: 400,
  letterSpacing: "-0.05em",
  lineHeight: 0.96,
} as const;
const BREAK_HEADING_STYLE = {
  ...HEADING_STYLE_BASE,
  fontSize: "clamp(36px, 5vw, 62px)",
} as const;
const LOADING_HEADING_STYLE = {
  ...HEADING_STYLE_BASE,
  fontSize: "clamp(34px, 4.5vw, 56px)",
} as const;

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
  const nextModule = session?.modules[session.activeModuleIndex] ?? null;

  useEffect(() => {
    setSession(practiceSet ? getPracticeTestSession(practiceSet.id) : null);
  }, [practiceSet, sessionId]);

  const continueToNextQuestion = useCallback((activeSession: PracticeTestSessionMeta) => {
    if (!practiceSet) return;
    const questionSet = buildPracticeTestQuestionSet(practiceSet.id);
    const targetQuestion = questionSet?.[activeSession.currentIndex];
    if (!targetQuestion) return;

    writePracticeLaunchStorage(questionSet, PRACTICE_MODULES_EXIT_PATH);

    navigate(buildPracticeTestQuestionRoute({
      subject: targetQuestion.subject,
      sourceId: targetQuestion.sourceId,
      bankType: targetQuestion.bankType,
      idx: activeSession.currentIndex + 1,
      practiceSetId: practiceSet.id,
      practiceTestSessionId: activeSession.sessionId,
    }));
  }, [navigate, practiceSet]);

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

    if (kind === BREAK_KIND) {
      if (session.breakStatus !== "active") return;

      const timerId = window.setInterval(() => {
        const latestSession = getPracticeTestSession(practiceSet.id);
        if (!latestSession || latestSession.sessionId !== sessionId || latestSession.breakStatus !== "active") {
          window.clearInterval(timerId);
          return;
        }

        const nextRemainingSeconds = Math.max(0, latestSession.breakRemainingSeconds - 1);
        const nextSession = {
          ...latestSession,
          breakElapsedSeconds: latestSession.breakElapsedSeconds + 1,
          breakRemainingSeconds: nextRemainingSeconds,
          breakStatus: nextRemainingSeconds === 0 ? ("completed" as const) : latestSession.breakStatus,
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
      continueToNextQuestion(session);
    }, MODULE_TRANSITION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [continueToNextQuestion, kind, practiceSet, session, sessionId]);

  if (!practiceSet || !session || !sessionId || session.sessionId !== sessionId || !nextModule) {
    return (
      <div className={NOT_FOUND_SHELL_CLASS}>
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Session not found</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (kind === BREAK_KIND) {
    return (
      <div className={TRANSITION_SHELL_CLASS}>
        <Card className={TRANSITION_CARD_CLASS}>
          <CardContent className={TRANSITION_CARD_CONTENT_CLASS}>
            <h1 style={BREAK_HEADING_STYLE}>
              Break
            </h1>
            <div className={BREAK_CLOCK_CLASS}>
              {formatPracticeClock(session.breakRemainingSeconds)}
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
    <div className={TRANSITION_SHELL_CLASS}>
      <Card className={TRANSITION_CARD_CLASS}>
        <CardContent className={TRANSITION_CARD_CONTENT_CLASS}>
          <div className={SPINNER_CLASS} />
          <div>
            <h1 style={LOADING_HEADING_STYLE}>
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
