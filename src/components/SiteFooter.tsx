import { PreloadLink } from "@/components/PreloadLink";
import { satTools } from "@/lib/seo-data/satTools";

const columnTitleClassName =
  "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60";
const linkClassName =
  "text-[11px] leading-snug text-muted-foreground/70 hover:text-foreground hover:underline";

const practiceLinks = [
  { to: "/bank", label: "SAT Question Bank" },
  { to: "/modules", label: "Practice Modules" },
  { to: "/hard", label: "Hardest SAT Questions" },
  { to: "/sat-vocabulary", label: "SAT Vocabulary" },
];

const scoreLinks = [
  { to: "/score-calculator", label: "SAT Score Calculator" },
  { to: "/sat-score", label: "SAT Score Guides" },
  { to: "/good-sat-score", label: "What Is a Good SAT Score?" },
  { to: "/average-sat-score", label: "Average SAT Score" },
  { to: "/sat-percentile-calculator", label: "SAT Percentile Calculator" },
];

const guideLinks = [
  { to: "/digital-sat-guide", label: "Digital SAT Guide" },
  { to: "/digital-sat-math", label: "Digital SAT Math" },
  { to: "/digital-sat-reading-writing", label: "Digital SAT Reading and Writing" },
  { to: "/bluebook-app-guide", label: "Bluebook App Guide" },
  { to: "/desmos-sat-guide", label: "Desmos Calculator Guide" },
  { to: "/sat-vs-act", label: "SAT vs ACT" },
  { to: "/how-to-study-for-sat", label: "How to Study for the SAT" },
  { to: "/sat-practice-tests", label: "SAT Practice Tests" },
  { to: "/sat-for-international-students", label: "SAT for International Students" },
  { to: "/sat-faq", label: "SAT FAQ" },
  { to: "/blog", label: "SAT Blog" },
];

const toolLinks = satTools.map((tool) => ({
  to: `/${tool.slug}`,
  label: tool.name,
}));

const moreLinks = [
  { to: "/college", label: "SAT Scores by College" },
  { to: "/in", label: "SAT in India" },
  { to: "/ae", label: "SAT in the UAE" },
  { to: "/sat-resources", label: "SAT Resources" },
  { to: "/about", label: "About 1600.now" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Service" },
];

const columns = [
  { title: "Practice", links: practiceLinks },
  { title: "Scores", links: scoreLinks },
  { title: "Guides", links: guideLinks },
  { title: "Tools", links: toolLinks },
  { title: "More", links: moreLinks },
];

export const SiteFooter = () => {
  return (
    <footer className="border-t border-border/40">
      <nav
        aria-label="Site footer"
        className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-6 gap-y-8 px-6 py-10 sm:grid-cols-3 lg:grid-cols-5"
      >
        {columns.map((column) => (
          <div key={column.title}>
            <p className={columnTitleClassName}>{column.title}</p>
            <ul className="mt-3 space-y-1.5">
              {column.links.map((link) => (
                <li key={link.to}>
                  <PreloadLink to={link.to} className={linkClassName}>
                    {link.label}
                  </PreloadLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </footer>
  );
};
