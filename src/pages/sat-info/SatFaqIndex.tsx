import { Link } from "react-router-dom";
import { PageSeo, buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/components/seo/PageSeo";
import { satFaqPages } from "@/lib/seo-data/satFaqData";

const faqActionFor = (slug: string) => {
  if (slug.includes("score") || slug.includes("percentile") || slug.includes("curved")) {
    return { href: "/score-calculator", label: "Use score calculator" };
  }
  if (slug.includes("psat")) {
    return { href: "/psat-to-sat-predictor", label: "Use PSAT predictor" };
  }
  if (slug.includes("calculator") || slug.includes("scratch-paper")) {
    return { href: "/bank/math/browse", label: "Practice SAT Math" };
  }
  if (slug.includes("test-date") || slug.includes("cancel") || slug.includes("fee-waiver")) {
    return { href: "/sat-test-countdown", label: "Open test countdown" };
  }
  if (slug.includes("required") || slug.includes("college")) {
    return { href: "/what-sat-score-do-i-need", label: "Compare college targets" };
  }
  if (slug.includes("time") || slug.includes("long") || slug.includes("questions")) {
    return { href: "/modules", label: "Take timed modules" };
  }
  return { href: "/bank", label: "Open question bank" };
};

const SatFaqIndex = () => {
  const title = "SAT FAQ: Answers to the Most Common SAT Questions";
  const description =
    "Answers to the most-searched SAT questions — test length, calculator rules, scoring, percentiles, fee waivers, and more.";

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <PageSeo
        id="sat-faq-index"
        title={title}
        description={description}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "SAT FAQ", url: "https://1600.now/sat-faq" },
          ]),
          buildFaqJsonLd(
            satFaqPages.map((faqPage) => ({ question: faqPage.question, answer: faqPage.shortAnswer })),
          ),
        ]}
      />

      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">SAT FAQ</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Quick answers to the most-searched SAT questions, with direct links to the tool or practice page that helps most.
      </p>

      <section className="mt-8 rounded-xl border border-border p-5">
        <h2 className="text-2xl font-semibold tracking-tight">
          How to use the FAQ
        </h2>
        <p className="mt-3 text-muted-foreground">
          Each answer should lead to one action: check a score, practice a skill, plan a date, or take a timed module. If a question changes nothing about your prep, it is trivia.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Scoring questions should send you to the score calculator or college target tool.</li>
          <li>Timing and format questions should send you to timed modules.</li>
          <li>Calculator and scratch-work questions should send you to Math practice.</li>
          <li>Admissions-policy questions should send you to score targets and application planning.</li>
        </ul>
      </section>

      <ul className="mt-8 space-y-3">
        {satFaqPages.map((faqPage) => {
          const action = faqActionFor(faqPage.slug);
          return (
            <li key={faqPage.slug}>
              <Link
                to={action.href}
                className="block rounded-lg border border-border bg-card p-4 transition hover:border-foreground/40"
              >
              <div className="font-semibold">{faqPage.question}</div>
              <p className="mt-1 text-sm text-muted-foreground">{faqPage.shortAnswer}</p>
                <div className="mt-3 text-sm font-semibold text-foreground">{action.label}</div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SatFaqIndex;
