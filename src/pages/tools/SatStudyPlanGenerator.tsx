import { useMemo, useState } from "react";

import { satToolBySlug } from "@/lib/seo-data/satTools";

import {
  SatToolPageScaffold,
  TOOL_INPUT_CLASS,
  TOOL_SECTION_HEADING_CLASS,
} from "./SatToolPageScaffold";

interface WeekPlan {
  week: number;
  phase: "diagnostic" | "content" | "drill" | "mock" | "taper";
  headline: string;
  tasks: string[];
}

const generatePlan = (
  baseline: number,
  weeks: number,
): WeekPlan[] => {
  const needsFoundation = baseline < 1200;
  const plan: WeekPlan[] = [];

  if (weeks < 2) return plan;

  plan.push({
    week: 1,
    phase: "diagnostic",
    headline: "Baseline diagnostic",
    tasks: [
      "Take a full-length Digital SAT in Bluebook.",
      "Tally misses by skill — which domains ate the most points?",
      "Review every missed question with a written explanation.",
    ],
  });

  const contentWeeks = Math.max(
    1,
    Math.min(4, Math.floor(weeks * (needsFoundation ? 0.4 : 0.25))),
  );
  for (let i = 0; i < contentWeeks; i++) {
    plan.push({
      week: plan.length + 1,
      phase: "content",
      headline:
        i === 0
          ? "Content review: weakest skills"
          : `Content review: next weakest skills (phase ${i + 1})`,
      tasks: [
        `Drill 40 questions per day in the ${needsFoundation ? "easy-to-medium" : "medium-to-hard"} range of your weakest skills.`,
        "Review every miss. Write a one-sentence reason for each wrong answer.",
        "End the week with a 2-module RW or Math set to measure progress.",
      ],
    });
  }

  const drillWeeks = Math.max(
    1,
    Math.floor(weeks * 0.4),
  );
  for (let i = 0; i < drillWeeks; i++) {
    plan.push({
      week: plan.length + 1,
      phase: "drill",
      headline: `Mixed skill drills (phase ${i + 1})`,
      tasks: [
        "Alternate timed modules with targeted skill drills.",
        "Use the Digital SAT question bank to build a 50-question daily mix.",
        "Track which skills still miss at >30% and return to content review if needed.",
      ],
    });
  }

  const mockWeeks = Math.max(
    1,
    Math.min(4, Math.floor(weeks * 0.25)),
  );
  for (let i = 0; i < mockWeeks; i++) {
    plan.push({
      week: plan.length + 1,
      phase: "mock",
      headline: `Full-length mock ${i + 1}`,
      tasks: [
        "Take a full Bluebook practice test on the weekend.",
        "Score it using the Digital SAT score calculator.",
        "Review every wrong answer before the next week starts.",
      ],
    });
  }

  if (weeks >= 4) {
    plan.push({
      week: plan.length + 1,
      phase: "taper",
      headline: "Taper week — stay sharp",
      tasks: [
        "Light review only. Do not attempt new hard content the week before.",
        "One half-module per day to maintain pacing.",
        "Sleep schedule: adjust to wake rested on test morning.",
      ],
    });
  }

  return plan.slice(0, weeks);
};

const SatStudyPlanGenerator = () => {
  const meta = satToolBySlug.get("sat-study-plan-generator")!;
  const [baseline, setBaseline] = useState("1100");
  const [target, setTarget] = useState("1400");
  const [weeks, setWeeks] = useState("10");

  const plan = useMemo(() => {
    const baselineScore = Number(baseline);
    const targetScore = Number(target);
    const weekCount = Number(weeks);
    if (!Number.isFinite(baselineScore) || !Number.isFinite(targetScore) || !Number.isFinite(weekCount)) {
      return null;
    }
    return generatePlan(baselineScore, Math.min(24, Math.max(2, weekCount)));
  }, [baseline, target, weeks]);

  const gap = Number(target) - Number(baseline);
  const aggressive = gap > (Number(weeks) || 1) * 20;

  const faqs = [
    {
      question: "How many points can I gain per week?",
      answer:
        "A realistic pace is 10–20 points per week with consistent prep (5–10 hours weekly). Faster gains are possible at lower baselines; above a 1400 baseline, growth slows significantly.",
    },
    {
      question: "Is 8 weeks enough time to prep for the SAT?",
      answer:
        "Yes, for a 100–150 point gain. Plans shorter than 6 weeks work best for polishing — not for building foundational skills from scratch.",
    },
    {
      question: "Should I use full-length tests every week?",
      answer:
        "Once a week at most. Full tests are diagnostic, not training. Most of your time should go to targeted drills and thorough review of misses.",
    },
    {
      question: "Where do I practice Digital SAT questions?",
      answer:
        "Use official Bluebook practice tests for full-length runs and the 1600.now question bank for targeted skill drills.",
    },
  ];

  return (
    <SatToolPageScaffold meta={meta} faqs={faqs}>
      <div className="mt-8 grid gap-4 rounded-xl border border-border p-6 md:grid-cols-3">
        <div>
          <label className="text-sm font-semibold">Baseline SAT</label>
          <input
            type="number"
            min={400}
            max={1600}
            step={10}
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
            className={TOOL_INPUT_CLASS}
          />
        </div>
        <div>
          <label className="text-sm font-semibold">Target SAT</label>
          <input
            type="number"
            min={400}
            max={1600}
            step={10}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={TOOL_INPUT_CLASS}
          />
        </div>
        <div>
          <label className="text-sm font-semibold">Weeks available</label>
          <input
            type="number"
            min={2}
            max={24}
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
            className={TOOL_INPUT_CLASS}
          />
        </div>
      </div>

      {aggressive && (
        <div className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          That's an aggressive gain. Most students gain 10–20 points per week
          with consistent prep. Consider either adding weeks or lowering the
          target.
        </div>
      )}

      {plan && plan.length > 0 && (
        <section className="mt-10">
          <h2 className={TOOL_SECTION_HEADING_CLASS}>
            Your {plan.length}-week Digital SAT plan
          </h2>
          <ol className="mt-4 space-y-4">
            {plan.map((week) => (
              <li
                key={week.week}
                className="rounded-xl border border-border p-5"
              >
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Week {week.week} · {week.phase}
                </div>
                <div className="mt-1 text-lg font-semibold">{week.headline}</div>
                <ul className="mt-2 list-disc space-y-1 pl-6 text-muted-foreground">
                  {week.tasks.map((task, taskIndex) => (
                    <li key={taskIndex}>{task}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </SatToolPageScaffold>
  );
};

export default SatStudyPlanGenerator;
