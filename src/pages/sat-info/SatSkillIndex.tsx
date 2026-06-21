import { Link } from "react-router-dom";

import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";
import { satSkills } from "@/lib/seo-data/satSkillsData";

type SatSkill = (typeof satSkills)[number];

type SkillGroup = {
  heading: string;
  list: SatSkill[];
};

const PAGE_ID = "sat-skill-index";
const PAGE_TITLE = "Digital SAT Skills List: Every Math & Reading Skill Tested";
const PAGE_DESCRIPTION =
  "Browse every skill tested on the Digital SAT, by section and domain. Learn the skill, see key tips, and jump to targeted practice questions.";
const HOME_URL = "https://1600.now/";
const SAT_SKILL_URL = "https://1600.now/sat-skill";
const MATH_SECTION: SatSkill["section"] = "Math";
const READING_WRITING_SECTION: SatSkill["section"] = "Reading & Writing";
const SECTION_HEADING_CLASS = "text-2xl font-semibold tracking-tight";

const SKILL_GROUPS: SkillGroup[] = [
  {
    heading: "Digital SAT Math Skills",
    list: satSkills.filter((skill) => skill.section === MATH_SECTION),
  },
  {
    heading: "Digital SAT Reading & Writing Skills",
    list: satSkills.filter((skill) => skill.section === READING_WRITING_SECTION),
  },
];

const skillPracticeHref = (skill: SatSkill) =>
  `/bank/${skill.section === "Math" ? "math" : "reading"}/skill/${encodeURIComponent(skill.officialSkill)}`;

const SatSkillIndex = () => {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageSeo
        id={PAGE_ID}
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: HOME_URL },
            { name: "SAT Skills", url: SAT_SKILL_URL },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
            url: SAT_SKILL_URL,
          },
        ]}
      />

      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">
          Every Skill Tested on the Digital SAT
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          A complete list of the skills the Digital SAT tests, grouped by
          section and domain. Click a skill to open targeted practice.
        </p>
      </header>

      <section className="mb-10 rounded-xl border border-border p-5">
        <h2 className={SECTION_HEADING_CLASS}>
          How to use this skill list
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-muted-foreground">
          <li>Start with the domain that caused the most misses on your last timed module.</li>
          <li>Open one skill, drill it until the miss type is clear, then return to a mixed module.</li>
          <li>Do not study every skill evenly. Spend more time on repeated misses and high-frequency fundamentals.</li>
          <li>For Math, check whether Desmos would have shortened the solution. For Reading and Writing, identify the exact rule or text proof.</li>
        </ol>
      </section>

      {SKILL_GROUPS.map((group) => (
        <section key={group.heading} className="mb-10">
          <h2 className={SECTION_HEADING_CLASS}>
            {group.heading}
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {group.list.map((skill) => (
              <li key={skill.slug}>
                <Link
                  to={skillPracticeHref(skill)}
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
