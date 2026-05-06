import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

const HardQuestionsIntro = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-20 pb-10 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[32px] border border-border/70 bg-card shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/8 blur-3xl"
          />

          <div className="relative px-6 pb-10 pt-10 sm:px-10 sm:pt-12">
            <h1
              className="max-w-3xl text-[clamp(2.4rem,5vw,4.6rem)] leading-[0.94] tracking-[-0.04em] text-foreground"
              style={{ fontFamily: "'Geist', Georgia, serif" }}
            >
              100 Hard Math
              <br />
              Questions
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              These questions mirror the hardest problems on the real SAT — the ones appearing from 17-22 on math modules. Master them and you'll be able to handle any question with confidence.
            </p>

            <div className="mt-8">
              <Button
                size="lg"
                className="gap-2 rounded-full px-6"
                onClick={() => navigate("/hard/1")}
              >
                Start questions
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default HardQuestionsIntro;
