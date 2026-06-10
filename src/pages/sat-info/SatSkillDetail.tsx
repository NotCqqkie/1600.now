import { Link, useParams } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildQuizJsonLd,
} from "@/components/seo/PageSeo";
import { satSkillBySlug, satSkills } from "@/lib/seo-data/satSkillsData";
import { skillSampleQuestions } from "@/lib/generated/skillSampleQuestions.generated";
import { renderMixedContent } from "@/lib/text/mathRendering";

const SatSkillDetail = () => {
  const { slug = "" } = useParams();
  const skill = satSkillBySlug.get(slug);

  if (!skill) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold">Skill not found</h1>
        <p className="mt-3 text-muted-foreground">
          Browse{" "}
          <Link className="underline" to="/sat-skill">
            all SAT skills
          </Link>
          .
        </p>
      </div>
    );
  }

  const url = `https://1600.now/sat-skill/${skill.slug}`;
  const title = `${skill.name} on the Digital SAT: Tips, Examples & Practice`;
  const description = `${skill.shortDescription} Learn how to master ${skill.name.toLowerCase()} on the Digital SAT ${skill.section} section with focused tips and practice.`;

  const faqs = [
    {
      question: `What is ${skill.name} on the Digital SAT?`,
      answer: skill.description,
    },
    {
      question: `How hard are ${skill.name.toLowerCase()} questions?`,
      answer: `${skill.name} questions appear at every difficulty level on the Digital SAT ${skill.section} section. The hardest versions gate access to the top scaled scores in the hard Module 2.`,
    },
    {
      question: `How do I practice ${skill.name.toLowerCase()}?`,
      answer: `Use the 1600.now question bank to filter for ${skill.name.toLowerCase()} questions, solve at least 20 in a row, and review every miss with the written explanation.`,
    },
  ];

  const related = satSkills
    .filter((candidateSkill) => candidateSkill.section === skill.section && candidateSkill.slug !== skill.slug)
    .slice(0, 6);

  const samples = skillSampleQuestions[skill.slug] ?? [];

  const quizJsonLd = samples.length
    ? buildQuizJsonLd({
        name: `${skill.name} Practice Questions`,
        description: `Digital SAT ${skill.name} practice problems`,
        url,
        questions: samples.map((sampleQuestion) => ({
          questionName: `${skill.name} sample — ${sampleQuestion.difficulty}`,
          questionText: sampleQuestion.text,
          choices: sampleQuestion.choices,
          correctAnswerId: sampleQuestion.correctAnswer,
        })),
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id={`skill-${skill.slug}`}
        title={title}
        description={description}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "SAT Skills", url: "https://1600.now/sat-skill" },
            { name: skill.name, url },
          ]),
          buildFaqJsonLd(faqs),
          {
            "@context": "https://schema.org",
            "@type": "LearningResource",
            name: skill.name,
            educationalLevel: "High School",
            learningResourceType: "Tutorial",
            url,
            description: skill.description,
          },
          ...(quizJsonLd ? [quizJsonLd] : []),
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        ›{" "}
        <Link className="hover:underline" to="/sat-skill">
          SAT Skills
        </Link>{" "}
        › <span className="text-foreground">{skill.name}</span>
      </nav>

      <header className="mb-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {skill.section} · {skill.domain}
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
          {skill.name}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {skill.shortDescription}
        </p>
      </header>

      <section>
        <h2 className="text-2xl font-semibold tracking-tight">
          What the SAT Tests
        </h2>
        <p className="mt-3 text-muted-foreground">{skill.description}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          Key Tips for {skill.name}
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
          {skill.keyTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>

      {samples.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            Sample {skill.name} Questions
          </h2>
          <p className="mt-3 text-muted-foreground">
            These are real practice questions pulled from our Digital SAT bank.
            Try each one before reading the highlighted correct answer.
          </p>
          <ol className="mt-6 space-y-8">
            {samples.map((sampleQuestion, questionIndex) => (
              <li
                key={sampleQuestion.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Question {questionIndex + 1} · {sampleQuestion.difficulty}
                </div>
                <div
                  className="mt-2 text-base leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: renderMixedContent(sampleQuestion.text),
                  }}
                />
                <ul className="mt-4 space-y-2">
                  {sampleQuestion.choices.map((choice) => {
                    const isCorrect = choice.id === sampleQuestion.correctAnswer;
                    return (
                      <li
                        key={choice.id}
                        className={
                          isCorrect
                            ? "rounded-md border border-emerald-500/60 bg-emerald-500/10 p-3"
                            : "rounded-md border border-border p-3"
                        }
                      >
                        <span className="font-semibold">{choice.id}.</span>{" "}
                        <span
                          dangerouslySetInnerHTML={{
                            __html: renderMixedContent(choice.text),
                          }}
                        />
                        {isCorrect && (
                          <span className="ml-2 text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            Correct
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          Practice {skill.name} Questions
        </h2>
        <p className="mt-3 text-muted-foreground">
          Drill {skill.name.toLowerCase()} questions in the{" "}
          <Link
            className="underline"
            to={`/bank/${skill.section === "Math" ? "math" : "reading"}/browse`}
          >
            Digital SAT {skill.section} question bank
          </Link>
          , or take a full-length{" "}
          <Link className="underline" to="/modules">
            practice module
          </Link>{" "}
          to see how this skill appears under test conditions.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">FAQs</h2>
        <div className="mt-4 space-y-5">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-base font-semibold">{faq.question}</h3>
              <p className="mt-1 text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Related {skill.section} Skills
        </h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {related.map((relatedSkill) => (
            <li key={relatedSkill.slug}>
              <Link
                to={`/sat-skill/${relatedSkill.slug}`}
                className="block rounded-xl border border-border p-4 transition hover:bg-muted"
              >
                <div className="font-semibold">{relatedSkill.name}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {relatedSkill.shortDescription}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default SatSkillDetail;
