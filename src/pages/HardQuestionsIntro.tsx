import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

const HardQuestionsIntro = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-20 pb-10 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-border/70 bg-card px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:px-8">
          <h1
            className="max-w-3xl text-[clamp(2.4rem,5vw,4.6rem)] leading-[0.94] tracking-[-0.04em] text-foreground"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            100 Hard Math Questions
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            These 100 questions are based on the most challenging SAT Math content — the types that appear in positions 17–22 of each math module. Master all 100 and you can expect to confidently handle around 80% of the hardest questions on both modules, saving you significant time on test day. Every problem was hand-written by the creator of 1600.now.
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
