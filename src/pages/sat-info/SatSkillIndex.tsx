import { Link } from "react-router-dom";

import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";
import { satSkills } from "@/lib/seo-data/satSkillsData";

const title = "Digital SAT Skills List: Every Math & Reading Skill Tested";
const description =
  "Browse every skill tested on the Digital SAT, by section and domain. Learn the skill, see key tips, and jump to targeted practice questions.";

const SatSkillIndex = () => {
  const mathSkills = satSkills.filter((skill) => skill.section === "Math");
  const readingSkills = satSkills.filter((skill) => skill.section === "Reading & Writing");

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageSeo
        id="sat-skill-index"
        title={title}
        description={description}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "SAT Skills", url: "https://1600.now/sat-skill" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description,
            url: "https://1600.now/sat-skill",
          },
        ]}
      />

      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">
          Every Skill Tested on the Digital SAT
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          A complete list of the skills the Digital SAT tests, grouped by
          section and domain. Click a skill for a focused breakdown, key tips,
          and targeted practice.
        </p>
      </header>

      {[
        { heading: "Digital SAT Math Skills", list: mathSkills },
        { heading: "Digital SAT Reading & Writing Skills", list: readingSkills },
      ].map((group) => (
        <section key={group.heading} className="mb-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            {group.heading}
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {group.list.map((skill) => (
              <li key={skill.slug}>
                <Link
                  to={`/sat-skill/${skill.slug}`}
                  className="block rounded-xl border border-border p-4 transition hover:bg-muted"
                >
                  <div className="font-semibold">{skill.name}</div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {skill.domain}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {skill.shortDescription}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default SatSkillIndex;
