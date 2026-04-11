import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { buildModulePracticeSet, getPracticeModule } from "@/data/modulePracticeBank";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, ArrowRight, BookOpen, Calculator, Play } from "lucide-react";

const ModuleView = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();

  const module = useMemo(() => (moduleId ? getPracticeModule(moduleId) : null), [moduleId]);

  const startModule = () => {
    if (!module) return;

    const practiceSet = buildModulePracticeSet(module.slug);
    if (!practiceSet || practiceSet.length === 0) return;

    sessionStorage.setItem("practiceExitTo", "/modules");
    sessionStorage.setItem("practiceSet", JSON.stringify(practiceSet));
    const first = practiceSet[0];
    navigate(`/bank/${first.subject}/${first.id}?bankType=past&practice=true&idx=0`);
  };

  if (!module) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Button variant="ghost" asChild className="w-fit gap-2">
          <Link to="/modules">
            <ArrowLeft className="h-4 w-4" />
            Back to modules
          </Link>
        </Button>

        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Practice set not found</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isMath = module.subject === "math";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" asChild className="w-fit gap-2 px-0">
        <Link to="/modules">
          <ArrowLeft className="h-4 w-4" />
          Back to SAT Module Practice
        </Link>
      </Button>

      <Card className="border-border/70">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isMath ? "default" : "secondary"} className="gap-1.5">
              {isMath ? <Calculator className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
              {module.subjectLabel}
            </Badge>
            <Badge variant="outline">Module {module.moduleNumber}</Badge>
          </div>

          <div>
            <h1
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(32px, 4vw, 46px)",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                color: "hsl(var(--foreground))",
              }}
            >
              SAT Module Practice
            </h1>
            <CardTitle className="mt-4 text-2xl">{module.publicSubtitle}</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6">
              {module.publicTitle} with {module.questionCount} questions.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Question count</div>
              <div className="mt-2 text-3xl font-semibold">{module.questionCount}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Set</div>
              <div className="mt-2 text-3xl font-semibold">{module.setNumber}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
            This practice set opens directly in the SAT question flow and keeps the questions in module order.
          </div>

          <Button size="lg" className="w-full justify-between" onClick={startModule}>
            Start practice
            <span className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModuleView;
