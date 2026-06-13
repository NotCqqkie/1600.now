import { Link, useParams, Navigate } from "react-router-dom";
import { PageSeo, buildFaqJsonLd, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";
import { satFaqPageBySlug } from "@/lib/seo-data/satFaqData";

const faqActionPlanFor = (slug: string) => {
  if (slug.includes("calculator") || slug.includes("desmos")) {
    return {
      heading: "What to practice after reading this",
      steps: [
        "Open a Math bank set and use Desmos only when it saves a real algebra step.",
        "Practice systems, nonlinear functions, and scatterplots with the calculator visible.",
        "For every calculator miss, write whether the error was setup, graph reading, or answer-format conversion.",
      ],
      traps: [
        "Opening Desmos for one-step arithmetic.",
        "Reading the wrong coordinate from an intersection.",
        "Using regression when the problem only asks for slope from two points.",
      ],
    };
  }

  if (slug.includes("score") || slug.includes("percentile") || slug.includes("curved")) {
    return {
      heading: "What to do with this score information",
      steps: [
        "Enter your latest section scores in the score calculator instead of estimating from memory.",
        "Compare the total score against the middle-50% range for colleges on your list.",
        "Choose the weaker section for the next drill block before taking another full module.",
      ],
      traps: [
        "Treating percentile as an admissions guarantee.",
        "Ignoring section split when the total score looks acceptable.",
        "Retesting without changing the miss pattern from the last practice test.",
      ],
    };
  }

  if (slug.includes("date") || slug.includes("registration") || slug.includes("cancel") || slug.includes("valid")) {
    return {
      heading: "What to do next",
      steps: [
        "Pick a target test date and count backward to create a weekly prep schedule.",
        "Leave room for at least one retake if your first score is below your college target.",
        "Use the final two weeks for timed modules and review, not brand-new content.",
      ],
      traps: [
        "Choosing a test date too close to application deadlines.",
        "Registering before checking school events, AP exams, or travel conflicts.",
        "Waiting until the last week to practice Bluebook pacing.",
      ],
    };
  }

  return {
    heading: "How to use this answer",
    steps: [
      "Turn the answer into one concrete prep decision: drill a skill, take a timed module, or update your score target.",
      "If the answer changes your strategy, test that strategy in the question bank before your next full module.",
      "Review the result immediately so the page becomes part of your prep loop, not just something you read.",
    ],
    traps: [
      "Reading SAT rules without changing practice behavior.",
      "Taking another full test before reviewing the last one.",
      "Practicing broad mixed sets when a narrow skill drill would fix the issue faster.",
    ],
  };
};

const SatFaqPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? satFaqPageBySlug.get(slug) : undefined;

  if (!page) return <Navigate to="/bank" replace />;

  const url = `https://1600.now/sat-faq/${page.slug}`;
  const actionPlan = faqActionPlanFor(page.slug);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <PageSeo
        id={`sat-faq-${page.slug}`}
        title={page.metaTitle}
        description={page.metaDescription}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "1600.now", url: "https://1600.now/" },
            { name: "SAT FAQ", url: "https://1600.now/sat-faq" },
            { name: page.question, url },
          ]),
          buildFaqJsonLd([{ question: page.question, answer: page.shortAnswer }]),
        ]}
      />

      <nav className="text-sm text-muted-foreground">
        <Link to="/sat-faq" className="hover:underline">SAT FAQ</Link>
        <span className="mx-2">/</span>
        <span>{page.question}</span>
      </nav>

      <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{page.question}</h1>
      <p className="mt-4 text-lg font-medium text-foreground">{page.shortAnswer}</p>

      <div className="mt-10 space-y-10">
        {page.sections.map((section, sectionIndex) => (
          <section key={sectionIndex}>
            <h2 className="text-2xl font-semibold">{section.heading}</h2>
            <div className="mt-3 space-y-3 text-foreground/90">
              {section.body.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>{paragraph}</p>
              ))}
            </div>
            {section.list && (
              <ul className="mt-3 list-disc space-y-1 pl-6 text-foreground/90">
                {section.list.map((listItem, itemIndex) => (
                  <li key={itemIndex}>{listItem}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">What this means for your prep</h2>
        <p className="mt-3 text-foreground/90">
          Do not leave this answer as background knowledge. Connect it to a practice decision: what to drill, when to test, how to pace a module, or how to interpret a score report.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-foreground/90">
          <li>If the answer is about timing or format, test it in a timed module.</li>
          <li>If the answer is about scoring, run your current numbers through the score calculator.</li>
          <li>If the answer is about tools or calculator policy, practice the relevant Math question type immediately.</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{actionPlan.heading}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-foreground/90">
          {actionPlan.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Common mistakes</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-foreground/90">
          {actionPlan.traps.map((trap) => (
            <li key={trap}>{trap}</li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Use this answer</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to="/modules" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Take timed modules
          </Link>
          <Link to="/score-calculator" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Estimate your score
          </Link>
          <Link to="/sat-test-countdown" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Check test timing
          </Link>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-border bg-card/60 p-6">
        <h2 className="text-lg font-semibold">Ready to practice?</h2>
        <p className="mt-2 text-sm text-foreground/90">
          Drill free SAT questions by skill, take timed modules, and project your 1600-scale score.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to="/bank" className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-cobalt hover:text-white">
            Question bank
          </Link>
          <Link to="/score-calculator" className="rounded-lg border border-border px-5 py-2 text-sm font-semibold text-foreground hover:bg-muted">
            Score calculator
          </Link>
        </div>
      </section>

      <section className="mt-12 text-sm text-muted-foreground">
        <Link to="/bank" className="hover:underline">Open the SAT question bank →</Link>
      </section>
    </div>
  );
};

export default SatFaqPage;
