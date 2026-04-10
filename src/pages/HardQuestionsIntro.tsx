import { ArrowRight, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

const HardQuestionsIntro = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-border/70 bg-card px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/60 dark:text-sky-200">
            <Target className="h-3.5 w-3.5" />
            Hard Math Set
          </div>

          <h1
            className="max-w-3xl text-[clamp(2.4rem,5vw,4.6rem)] leading-[0.94] tracking-[-0.04em] text-foreground"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            100 Hard Math Questions
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            The 100 Hard Math Questions are based off the most challenging SAT Math questions, appearing from questions 17-22 on math modules. With full completion of all 100 questions, you can expect to confidently know around 80% of all questions appearing at the ends of both math modules, saving you significant time. All problems were hand-written by Luke, the creator of 1600.now.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="gap-2 rounded-full px-6"
              onClick={() => navigate("/hard/1")}
            >
              Open question viewer
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default HardQuestionsIntro;
