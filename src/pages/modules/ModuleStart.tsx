import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock3, PlayCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { getPracticeModule } from "@/data/modulePracticeBank";
import {
  clearModulePracticeSession,
  getModulePracticeDefaultTimeMinutes,
  getModulePracticeMaximumTimeMinutes,
  getModulePracticeSession,
  type ModulePracticeSessionMeta,
  type ModulePracticeSettings,
} from "@/lib/practice/modulePracticeSession";
import { launchModulePractice } from "@/lib/practice/modulePracticeNavigation";

const MODULES_PATH = "/modules";
const FALLBACK_DEFAULT_MINUTES = 35;
const FALLBACK_MAX_MINUTES = 70;
const MIN_TIME_MINUTES = 1;
const BACK_BUTTON_CLASS = "-ml-3 w-fit gap-2 px-3";
const OPTION_SECTION_CLASS = "rounded-2xl border border-border/60 bg-muted/30 p-5";
const OPTION_SECTION_HEADER_CLASS = "flex items-start justify-between gap-4";
const START_FRESH_CONFIRM_MESSAGE =
  "Starting fresh will discard your saved progress for this module. Continue?";

const getInitialTimeMinutes = (
  savedSession: ModulePracticeSessionMeta | null,
  defaultMinutes: number,
): number =>
  savedSession?.settings.timeLimitSeconds
    ? Math.round(savedSession.settings.timeLimitSeconds / 60)
    : defaultMinutes;

const formatSavedRemainingMinutes = (remainingSeconds: number | null | undefined): string =>
  `${Math.max(0, Math.floor((remainingSeconds ?? 0) / 60))} minutes remaining`;

const buildModulePracticeSettings = (
  timed: boolean,
  timeMinutes: number,
  allowCheckingAnswers: boolean,
): ModulePracticeSettings => ({
  timed,
  timeLimitSeconds: timed ? timeMinutes * 60 : null,
  allowCheckingAnswers,
});

const ModuleStart = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const module = useMemo(
    () => (moduleId ? getPracticeModule(moduleId) : null),
    [moduleId],
  );
  const [, setSessionRefreshKey] = useState(0);
  const savedSession = module ? getModulePracticeSession(module.slug) : null;
  const defaultMinutes = module
    ? getModulePracticeDefaultTimeMinutes(module.subject)
    : FALLBACK_DEFAULT_MINUTES;
  const maxMinutes = module
    ? getModulePracticeMaximumTimeMinutes(module.subject)
    : FALLBACK_MAX_MINUTES;
  const [timed, setTimed] = useState(
    savedSession?.settings.timed ?? true,
  );
  const [allowCheckingAnswers, setAllowCheckingAnswers] = useState(
    savedSession?.settings.allowCheckingAnswers ?? false,
  );
  const [timeMinutes, setTimeMinutes] = useState(
    getInitialTimeMinutes(savedSession, defaultMinutes),
  );

  if (!module) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Button variant="ghost" asChild className={BACK_BUTTON_CLASS}>
          <Link to={MODULES_PATH}>
            <ArrowLeft className="h-4 w-4" />
            Back to modules
          </Link>
        </Button>
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Module not found</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasActiveSavedSession = savedSession !== null && savedSession.status !== "submitted";
  const settings = buildModulePracticeSettings(timed, timeMinutes, allowCheckingAnswers);

  const launchSession = (resumeExisting: boolean) => {
    if (
      !resumeExisting &&
      hasActiveSavedSession &&
      !window.confirm(START_FRESH_CONFIRM_MESSAGE)
    ) {
      return;
    }
    launchModulePractice({
      module,
      navigate,
      resumeExisting,
      savedSession,
      settings,
    });
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" asChild className={BACK_BUTTON_CLASS}>
        <Link to={MODULES_PATH}>
          <ArrowLeft className="h-4 w-4" />
          Back to modules
        </Link>
      </Button>

      <div className="space-y-3">
        <h1
          style={{
            fontFamily: "'Geist', Georgia, serif",
            fontSize: "clamp(32px, 4vw, 50px)",
            fontWeight: 400,
            letterSpacing: "-0.04em",
            lineHeight: 1.02,
          }}
        >
          Start Module Practice
        </h1>
      </div>

      {hasActiveSavedSession && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Saved session found</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Question {savedSession.currentIndex + 1} of {savedSession.questionCount}
              </p>
              <p>
                {savedSession.settings.timed
                  ? formatSavedRemainingMinutes(savedSession.remainingSeconds)
                  : "Untimed session"}
                {" · "}
                {savedSession.settings.allowCheckingAnswers
                  ? "Checking answers enabled"
                  : "Checking answers disabled"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => launchSession(true)}>
                <PlayCircle className="mr-2 h-4 w-4" />
                Continue session
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  clearModulePracticeSession(module.slug);
                  setSessionRefreshKey((key) => key + 1);
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Discard saved session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Practice options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={OPTION_SECTION_CLASS}>
            <div className={OPTION_SECTION_HEADER_CLASS}>
              <div>
                <div className="text-base font-semibold">Timed module</div>
              </div>
              <Switch checked={timed} onCheckedChange={setTimed} />
            </div>

            {timed && (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Time limit</div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1 text-sm font-medium">
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                    {timeMinutes} min
                  </div>
                </div>
                <Slider
                  min={MIN_TIME_MINUTES}
                  max={maxMinutes}
                  step={1}
                  value={[timeMinutes]}
                  onValueChange={(value) => setTimeMinutes(Math.max(MIN_TIME_MINUTES, value[0] ?? defaultMinutes))}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 min</span>
                  <span>{defaultMinutes} min</span>
                  <span>{maxMinutes} min</span>
                </div>
              </div>
            )}
          </div>

          <div className={OPTION_SECTION_CLASS}>
            <div className={OPTION_SECTION_HEADER_CLASS}>
              <div>
                <div className="text-base font-semibold">Enable checking answers</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Instantly check individual questions, no need to submit and review at the end.
                </p>
              </div>
              <Switch
                checked={allowCheckingAnswers}
                onCheckedChange={setAllowCheckingAnswers}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" asChild>
              <Link to="/modules">Cancel</Link>
            </Button>
            <Button onClick={() => launchSession(false)}>
              Start module
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModuleStart;
