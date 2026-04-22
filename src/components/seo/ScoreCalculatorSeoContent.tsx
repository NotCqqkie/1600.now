import { Link } from "react-router-dom";

import { PageSeo, buildFaqJsonLd, type FaqItem } from "@/components/seo/PageSeo";

const faqs: FaqItem[] = [
  {
    question: "How is the Digital SAT scored?",
    answer:
      "The Digital SAT is scored on a 400–1600 scale. The Reading and Writing section and the Math section are each scored from 200 to 800, and the two section scores are added together to produce your total score.",
  },
  {
    question: "Does the Digital SAT have a curve?",
    answer:
      "The Digital SAT uses statistical equating and adaptive module routing instead of a traditional curve. Scores are adjusted so that a given scaled score represents the same level of ability across different test forms.",
  },
  {
    question: "Is this Digital SAT score calculator accurate?",
    answer:
      "This calculator provides a strong estimate of your Digital SAT score using adaptive scoring logic based on released College Board scoring tables. Official scores may vary slightly based on the difficulty of the test form you take.",
  },
  {
    question: "What is considered a good Digital SAT score?",
    answer:
      "A 1000–1100 is around the national average, 1200–1300 is competitive at many universities, 1400+ is strong for selective colleges, and 1500+ is highly competitive, including at Ivy League and other elite universities.",
  },
  {
    question: "How does adaptive testing affect my SAT score?",
    answer:
      "The Digital SAT routes you to an easier or harder second module based on your Module 1 performance. Stronger Module 1 performance unlocks a harder Module 2, which raises your scoring ceiling and is generally required to reach the highest scaled scores.",
  },
  {
    question: "How many questions are on the Digital SAT?",
    answer:
      "The Digital SAT has 98 scored questions in total: 54 Reading and Writing questions split into two 27-question modules, and 44 Math questions split into two 22-question modules.",
  },
  {
    question: "How long is the Digital SAT?",
    answer:
      "The Digital SAT is about 2 hours and 14 minutes, including a 10-minute break between sections. Reading and Writing is 64 minutes total and Math is 70 minutes total.",
  },
  {
    question: "What raw score do I need for a 1500 SAT?",
    answer:
      "Most students who score a 1500 answer roughly 48–52 of 54 Reading and Writing questions correctly and 40–43 of 44 Math questions correctly, assuming they reach the harder Module 2 in both sections.",
  },
];

export const ScoreCalculatorSeoContent = () => {
  return (
    <>
      <PageSeo
        id="score-calculator-faq"
        jsonLd={[
          buildFaqJsonLd(faqs),
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Digital SAT Score Calculator",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            url: "https://1600.now/score-calculator",
            description:
              "Free Digital SAT score calculator that converts raw section scores into a 400–1600 scaled SAT score.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
        ]}
      />

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Digital SAT Score Calculator: Estimate Your 400–1600 Score
          </h1>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            A free, accurate Digital SAT score calculator built on released
            College Board scoring tables. Enter your raw scores for each module
            and instantly see your estimated Reading and Writing score, Math
            score, and total 400–1600 SAT score.
          </p>
        </header>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">
          How the Digital SAT Score Calculator Works
        </h2>
        <p className="mt-3 text-muted-foreground">
          The Digital SAT score calculator estimates your total SAT score using
          performance across adaptive modules in both the Reading and Writing
          section and the Math section. Each section contributes a scaled score
          from 200 to 800, and your total score is the sum of the two — for a
          maximum of 1600.
        </p>
        <p className="mt-3 text-muted-foreground">
          Stronger performance in Module 1 usually routes you to a harder
          Module 2, which raises your scoring ceiling. That is why the same
          number of correct answers can result in different scaled scores
          depending on which Module 2 you are routed to.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-6 text-muted-foreground">
          <li>Reading and Writing Module 1 (27 questions)</li>
          <li>Reading and Writing Module 2 (27 questions)</li>
          <li>Math Module 1 (22 questions)</li>
          <li>Math Module 2 (22 questions)</li>
        </ul>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">
          What Is a Good Digital SAT Score?
        </h2>
        <p className="mt-3 text-muted-foreground">
          Understanding your projected SAT score range helps you set practical
          score goals and prioritize the sections that need the most work. Use
          the Digital SAT score calculator above to see how changes in each
          module translate into a different total score.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-6 text-muted-foreground">
          <li>
            <strong>1000–1100:</strong> around the national average
          </li>
          <li>
            <strong>1200–1300:</strong> competitive for many universities
          </li>
          <li>
            <strong>1400+:</strong> strong for selective colleges
          </li>
          <li>
            <strong>1500+:</strong> highly competitive, including Ivy League
          </li>
          <li>
            <strong>1550+:</strong> top 1% of SAT test takers
          </li>
        </ul>
        <p className="mt-3 text-muted-foreground">
          Want to see what each score level means in detail? Browse our{" "}
          <Link className="underline" to="/sat-score/1600">
            SAT score breakdowns
          </Link>{" "}
          for individual scores from 400 to 1600.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">
          How To Use This SAT Score Calculator
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-muted-foreground">
          <li>
            Adjust the slider for each Digital SAT module to match the number
            of questions you answered correctly.
          </li>
          <li>
            Watch your Reading and Writing scaled score, Math scaled score, and
            total 1600 score update in real time as you change inputs.
          </li>
          <li>
            Use the projected score to set a goal score and decide which
            modules to prioritize in your next practice session.
          </li>
        </ol>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">
          Digital SAT Calculator FAQs
        </h2>
        <div className="mt-4 space-y-5">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-base font-semibold">{faq.question}</h3>
              <p className="mt-1 text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-semibold tracking-tight">
          Related SAT Prep Resources
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Link
            to="/modules"
            className="rounded-xl border border-border p-5 transition hover:bg-muted"
          >
            <div className="font-semibold">Digital SAT Practice Tests</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Take full-length adaptive SAT practice modules with realistic
              pacing and predicted score ranges.
            </p>
          </Link>
          <Link
            to="/sat-vocabulary"
            className="rounded-xl border border-border p-5 transition hover:bg-muted"
          >
            <div className="font-semibold">Digital SAT Vocabulary</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Build Words-in-Context mastery with hundreds of high-utility
              academic SAT vocabulary words.
            </p>
          </Link>
          <Link
            to="/bank"
            className="rounded-xl border border-border p-5 transition hover:bg-muted"
          >
            <div className="font-semibold">SAT Question Bank</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Filter thousands of Digital SAT practice questions by subject,
              skill, and difficulty.
            </p>
          </Link>
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          SAT® is a trademark registered by the College Board, which is not
          affiliated with, and does not endorse, this product or site.
        </p>
      </section>
    </>
  );
};
