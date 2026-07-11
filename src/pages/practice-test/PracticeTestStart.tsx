import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, PlayCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { getPracticeSet, type PracticeSet } from "@/data/modulePracticeBank";
import { trackPracticeStart } from "@/lib/analytics";
import {
  buildPracticeTestDefaultTiming,
  clearPracticeTestSession,
  getPracticeTestSession,
  getPracticeTestDefaultTimeLimitSeconds,
  type PracticeTestSettings,
} from "@/lib/practice/practiceTestSession";
import { launchPracticeTest } from "@/lib/practice/practiceTestNavigation";

type TimedPreset = "normal" | "1.5x" | "2x" | "advanced";
type PracticeTestModule = PracticeSet["modules"][number];

const TIMED_PRESETS: Array<{ key: TimedPreset; label: string; multiplier: number | null }> = [
  { key: "normal", label: "Normal", multiplier: 1 },
  { key: "1.5x", label: "1.5x", multiplier: 1.5 },
  { key: "2x", label: "2x", multiplier: 2 },
  { key: "advanced", label: "Advanced", multiplier: null },
];

const MODULES_PATH = "/modules";
const MIN_MODULE_MINUTES = 1;
const BACK_BUTTON_CLASS = "-ml-3 w-fit gap-2 px-3";
const OPTION_SECTION_CLASS = "rounded-2xl border border-border/60 bg-muted/30 p-5";
const OPTION_SECTION_HEADER_CLASS = "flex items-start justify-between gap-4";
const MODULE_TIME_CARD_CLASS = "rounded-xl border border-border/60 bg-background px-4 py-3";
const START_NEW_ATTEMPT_CONFIRM_MESSAGE =
  "Starting a new attempt will discard your saved progress for this practice test. Continue?";

const roundSecondsToMinutes = (seconds: number): number => Math.round(seconds / 60);

const getDefaultModuleSeconds = (module: PracticeTestModule): number =>
  getPracticeTestDefaultTimeLimitSeconds(module.subject, module.moduleNumber);

const buildPresetModuleMinutes = (
  practiceSet: PracticeSet,
  multiplier: number,
): Record<string, number> =>
  Object.fromEntries(
    practiceSet.modules.map((module) => [
      module.slug,
      roundSecondsToMinutes(getDefaultModuleSeconds(module) * multiplier),
    ]),
  );

const formatMinutes = (seconds: number | null): string =>
  seconds === null ? "Untimed" : `${roundSecondsToMinutes(seconds)} min`;

const PracticeTestStart = () => {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const practiceSet = useMemo(() => (setId ? getPracticeSet(setId) : null), [setId]);
  const [, setSessionRefreshKey] = useState(0);
  const savedSession = practiceSet ? getPracticeTestSession(practiceSet.id) : null;

  const defaultTiming = useMemo(
    () => (practiceSet ? buildPracticeTestDefaultTiming(practiceSet) : {}),
    [practiceSet],
  );

  const [timed, setTimed] = useState(savedSession?.settings.timed ?? true);
  const [allowCheckingAnswers, setAllowCheckingAnswers] = useState(
    savedSession?.settings.allowCheckingAnswers ?? false,
  );

  const initialPreset = useMemo<TimedPreset>(() => {
    if (!practiceSet || !savedSession?.settings.timed) return "normal";

    for (const preset of TIMED_PRESETS) {
      if (preset.multiplier === null) continue;

      const matches = practiceSet.modules.every((module) => {
        const expected = Math.round(getDefaultModuleSeconds(module) * preset.multiplier);
        return savedSession.settings.moduleTimeLimitSeconds[module.slug] === expected;
      });
      if (matches) {
        return preset.key;
      }
    }

    return "advanced";
  }, [practiceSet, savedSession]);

  const [timedPreset, setTimedPreset] = useState<TimedPreset>(initialPreset);
  const [moduleMinutes, setModuleMinutes] = useState<Record<string, number>>(() => {
    if (!practiceSet) return {};

    return Object.fromEntries(
      practiceSet.modules.map((module) => {
        const savedSeconds = savedSession?.settings.moduleTimeLimitSeconds[module.slug];
        const defaultSeconds = defaultTiming[module.slug];
        return [module.slug, roundSecondsToMinutes(savedSeconds ?? defaultSeconds)];
      }),
    );
  });

  if (!practiceSet) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Button variant="ghost" asChild className={BACK_BUTTON_CLASS}>
          <Link to={MODULES_PATH}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Practice test not found</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  const setPresetTiming = (preset: TimedPreset) => {
    setTimedPreset(preset);
    if (preset === "advanced") return;

    const multiplier = TIMED_PRESETS.find((entry) => entry.key === preset)?.multiplier ?? 1;
    setModuleMinutes(buildPresetModuleMinutes(practiceSet, multiplier));
  };

  const settings: PracticeTestSettings = {
    timed,
    allowCheckingAnswers,
    moduleTimeLimitSeconds: Object.fromEntries(
      practiceSet.modules.map((module) => [
        module.slug,
        timed ? Math.max(MIN_MODULE_MINUTES, moduleMinutes[module.slug] ?? MIN_MODULE_MINUTES) * 60 : null,
      ]),
    ),
  };

  const launchSession = (resumeExisting: boolean) => {
    if (
      !resumeExisting &&
      savedSession &&
      savedSession.status !== "submitted" &&
      !window.confirm(START_NEW_ATTEMPT_CONFIRM_MESSAGE)
    ) {
      return;
    }
    launchPracticeTest({
      practiceSet,
      navigate,
      resumeExisting,
      savedSession,
      settings,
    });
    if (!resumeExisting) {
      trackPracticeStart({
        practiceType: "practice_test",
        subject: "mixed",
        entryPoint: "modules",
      });
    }
  };

  const activeModule = savedSession
    ? savedSession.modules[savedSession.activeModuleIndex]
    : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" asChild className={BACK_BUTTON_CLASS}>
        <Link to={MODULES_PATH}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </Button>

      <div className="space-y-2">
        <h1
          style={{
            fontFamily: "'Geist', Georgia, serif",
            fontSize: "clamp(32px, 4vw, 50px)",
            fontWeight: 400,
            letterSpacing: "-0.04em",
            lineHeight: 1.02,
          }}
        >
          Full Test Browser
        </h1>
      </div>

      {savedSession && savedSession.status !== "submitted" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Saved session</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                {activeModule
                  ? `Question ${Math.min(savedSession.currentIndex - activeModule.startIndex + 1, activeModule.questionCount)} of ${activeModule.questionCount}`
                  : `Question ${savedSession.currentIndex + 1} of ${practiceSet.modules.reduce((sum, module) => sum + module.questionCount, 0)}`}
              </p>
              <p>
                {savedSession.phase === "review"
                  ? "Review screen"
                  : activeModule
                    ? `${activeModule.moduleTitle} · ${formatMinutes(activeModule.remainingSeconds)}`
                    : "Saved session"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => launchSession(true)}>
                <PlayCircle className="mr-2 h-4 w-4" />
                Continue
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  clearPracticeTestSession(practiceSet.id);
                  setSessionRefreshKey((key) => key + 1);
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={OPTION_SECTION_CLASS}>
            <div className={OPTION_SECTION_HEADER_CLASS}>
              <div>
                <div className="text-base font-semibold">Timed</div>
              </div>
              <Switch checked={timed} onCheckedChange={setTimed} />
            </div>

            {timed && (
              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TIMED_PRESETS.map((preset) => (
                    <Button
                      key={preset.key}
                      type="button"
                      variant={timedPreset === preset.key ? "default" : "outline"}
                      onClick={() => setPresetTiming(preset.key)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>

                <p className="text-sm text-muted-foreground">
                  Timed full tests auto-submit each module when the timer reaches 0.
                </p>

                {timedPreset === "advanced" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {practiceSet.modules.map((module) => (
                      <div
                        key={module.slug}
                        className={MODULE_TIME_CARD_CLASS}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">{module.publicTitle}</div>
                          <div className="inline-flex items-center rounded-full border border-border/70 bg-background px-3 py-1 text-sm font-medium">
                            {moduleMinutes[module.slug] ?? MIN_MODULE_MINUTES} min
                          </div>
                        </div>
                        <div className="mt-4">
                          <Slider
                            min={MIN_MODULE_MINUTES}
                            max={roundSecondsToMinutes(getDefaultModuleSeconds(module) * 2)}
                            step={1}
                            value={[moduleMinutes[module.slug] ?? MIN_MODULE_MINUTES]}
                            onValueChange={(value) =>
                              setModuleMinutes((previous) => ({
                                ...previous,
                                [module.slug]: Math.max(MIN_MODULE_MINUTES, value[0] ?? MIN_MODULE_MINUTES),
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

          <div className={OPTION_SECTION_CLASS}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {practiceSet.modules.map((module) => (
                <div key={module.slug} className={MODULE_TIME_CARD_CLASS}>
                  <div className="text-sm font-medium">{module.publicTitle}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {timed ? formatMinutes(settings.moduleTimeLimitSeconds[module.slug]) : "Untimed"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" asChild>
              <Link to={MODULES_PATH}>Cancel</Link>
            </Button>
            <Button onClick={() => launchSession(false)}>
              Start
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PracticeTestStart;
