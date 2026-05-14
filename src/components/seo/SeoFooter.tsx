import { Link } from "react-router-dom";

const columns = [
  {
    title: "SAT Tools",
    links: [
      { label: "SAT Score Calculator", to: "/score-calculator" },
      { label: "SAT Question Bank", to: "/bank" },
      { label: "Practice Tests", to: "/modules" },
      { label: "100 Hard Math", to: "/hard" },
      { label: "Vocabulary Flashcards", to: "/vocab" },
    ],
  },
  {
    title: "SAT Content Hubs",
    links: [
      { label: "SAT Vocabulary List", to: "/sat-vocabulary" },
      { label: "SAT Score Breakdowns", to: "/sat-score" },
      { label: "SAT Skill Guides", to: "/sat-skill" },
      { label: "SAT FAQ", to: "/sat-faq" },
      { label: "SAT Blog", to: "/blog" },
    ],
  },
  {
    title: "Free SAT Practice",
    links: [
      { label: "Free SAT Practice", to: "/free-sat-practice" },
      { label: "Digital SAT Prep", to: "/digital-sat-prep" },
      { label: "SAT Practice Test", to: "/sat-practice-test" },
      { label: "SAT Math Practice", to: "/sat-math-practice" },
      { label: "SAT Reading Practice", to: "/sat-reading-practice" },
      { label: "SAT Question Bank (Free)", to: "/sat-question-bank-free" },
    ],
  },
  {
    title: "Popular SAT Scores",
    links: [
      { label: "1600 SAT Score", to: "/sat-score/1600" },
      { label: "1500 SAT Score", to: "/sat-score/1500" },
      { label: "1400 SAT Score", to: "/sat-score/1400" },
      { label: "1300 SAT Score", to: "/sat-score/1300" },
      { label: "1200 SAT Score", to: "/sat-score/1200" },
      { label: "1100 SAT Score", to: "/sat-score/1100" },
    ],
  },
  {
    title: "SAT Guides",
    links: [
      { label: "How the Digital SAT Works", to: "/blog/how-the-digital-sat-works" },
      { label: "Digital SAT Scoring Explained", to: "/blog/digital-sat-scoring-explained" },
      { label: "How to Get a 1600", to: "/blog/how-to-get-a-1600" },
      { label: "Every SAT Math Formula", to: "/blog/sat-math-formulas" },
      { label: "How to Use Desmos on the SAT", to: "/blog/how-to-use-desmos-on-sat" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
      { label: "Contact Us", to: "mailto:info@1600.now" },
    ],
  },
];

export const SeoFooter = () => {
  return (
    <footer className="mt-16 border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {columns.map((col) => (
            <div key={col.title}>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.title}
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.to}>
                    {l.to.startsWith("mailto:") ? (
                      <a
                        href={l.to}
                        className="text-foreground/80 hover:text-foreground hover:underline"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        to={l.to}
                        className="text-foreground/80 hover:text-foreground hover:underline"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          1600.now is an independent Digital SAT prep platform. SAT® is a
          trademark registered by the College Board, which is not affiliated
          with, and does not endorse, 1600.now.
        </p>
      </div>
    </footer>
  );
};
