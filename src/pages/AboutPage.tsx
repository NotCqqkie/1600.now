import { Link } from "react-router-dom";

import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";

const contactEmail = "info@1600.now";

const AboutPage = () => {
  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id="about"
        title="About 1600.now"
        description="What 1600.now is, where the practice questions come from, why it is free, and how to get in touch."
        canonical="https://1600.now/about"
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "About", url: "https://1600.now/about" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: "About 1600.now",
            url: "https://1600.now/about",
          },
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        › <span className="text-foreground">About</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          About 1600.now
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          1600.now is a free practice platform for the Digital SAT. No paywall,
          no subscription, no locked features — every question, module, and
          tool on the site is available to anyone.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          What you can practice here
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
          <li>
            A <Link className="font-medium text-foreground underline" to="/bank">question bank</Link>{" "}
            with thousands of practice questions, each tagged by section,
            domain, skill, and difficulty, with a written explanation.
          </li>
          <li>
            Timed <Link className="font-medium text-foreground underline" to="/modules">practice modules</Link>{" "}
            and full-length practice tests that mirror the Digital SAT's module
            structure, question counts, and timing.
          </li>
          <li>
            A <Link className="font-medium text-foreground underline" to="/score-calculator">score calculator</Link>{" "}
            and free planning tools — percentile lookup, SAT-to-ACT conversion,
            study plan generation, and test-date countdowns.
          </li>
          <li>
            <Link className="font-medium text-foreground underline" to="/sat-vocabulary">Vocabulary review</Link>{" "}
            built around the words the Digital SAT actually tests.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Where the questions come from
        </h2>
        <p className="mt-3 text-muted-foreground">
          The practice questions on 1600.now are original content modeled on
          the official Digital SAT blueprint that College Board publishes: the
          same two sections, the same content domains and skills, and the same
          question formats. Difficulty ratings follow the easy, medium, and
          hard bands the test itself uses, so filtering the bank by skill and
          difficulty matches how the real exam is organized.
        </p>
        <p className="mt-3 text-muted-foreground">
          These are practice questions, not real test questions. They are meant
          to build the same skills the exam measures, and every question comes
          with a step-by-step explanation so a miss turns into something you
          can learn from.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">Why it is free</h2>
        <p className="mt-3 text-muted-foreground">
          Good SAT prep should not depend on what a family can spend. The
          entire site works without payment, and an account is optional — sign
          in only if you want your progress and analytics synced across
          devices.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">Get in touch</h2>
        <p className="mt-3 text-muted-foreground">
          Found an error in a question, have a suggestion, or need help with
          your account? Email{" "}
          <a
            className="font-medium text-foreground underline"
            href={`mailto:${contactEmail}`}
          >
            {contactEmail}
          </a>
          .
        </p>
        <p className="mt-3 text-muted-foreground">
          SAT® is a trademark registered by the College Board, which is not
          affiliated with, and does not endorse, this site.
        </p>
      </section>
    </article>
  );
};

export default AboutPage;
