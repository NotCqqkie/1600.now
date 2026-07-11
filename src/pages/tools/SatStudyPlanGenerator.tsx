import { satToolBySlug } from "@/lib/seo-data/satTools";

import { SatToolPageScaffold } from "./SatToolPageScaffold";
import { StudyPlanLab } from "./StudyPlanLab";

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
  {
    question: "Can I upload my SAT score report?",
    answer:
      "Yes. The planner can read supported SAT score-report PDFs, JPEGs, and PNGs on your device, show you what it detected, and wait for your approval before changing the plan.",
  },
  {
    question: "Does my score report leave my device?",
    answer:
      "No. The original file, filename, extracted text, and personal fields are not synced. Only the sanitized scores, domain bands, settings, assignments, and progress can be saved.",
  },
  {
    question: "How does the planner choose assignments?",
    answer:
      "It weighs your selected weak domains, available weekdays, daily time cap, score-report priorities, and test date. Completed and historical work stays locked when future work is rebalanced.",
  },
  {
    question: "Are the assignments timed?",
    answer:
      "Timed sets use an enforced countdown. Standard Math modules use 35 minutes, while Reading and Writing practice uses custom sets that exclude Words in Context.",
  },
  {
    question: "Can I use the planner without an account?",
    answer:
      "Yes. Anonymous plans are stored locally. If you later sign in, the planner can migrate the local plan and retain an older conflicting snapshot as a recoverable backup.",
  },
];

const SatStudyPlanGenerator = () => {
  const meta = satToolBySlug.get("sat-study-plan-generator")!;
  return (
    <SatToolPageScaffold meta={meta} faqs={faqs} wide>
      <div className="mt-8">
        <StudyPlanLab embedded />
      </div>
    </SatToolPageScaffold>
  );
};

export default SatStudyPlanGenerator;
