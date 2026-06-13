import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildWebApplicationJsonLd,
} from "@/components/seo/PageSeo";
import { satToolBySlug } from "@/lib/seo-data/satTools";
const SAT_TO_ACT: [number, number][] = [
  [1600, 36], [1590, 36], [1580, 36], [1570, 35], [1560, 35],
  [1550, 35], [1540, 35], [1530, 34], [1520, 34], [1510, 34],
  [1500, 34], [1490, 33], [1480, 33], [1470, 33], [1460, 33],
  [1450, 32], [1440, 32], [1430, 32], [1420, 32], [1410, 31],
  [1400, 31], [1390, 31], [1380, 30], [1370, 30], [1360, 30],
  [1350, 29], [1340, 29], [1330, 29], [1320, 28], [1310, 28],
  [1300, 28], [1290, 27], [1280, 27], [1270, 27], [1260, 27],
  [1250, 26], [1240, 26], [1230, 26], [1220, 25], [1210, 25],
  [1200, 25], [1190, 24], [1180, 24], [1170, 24], [1160, 24],
  [1150, 23], [1140, 23], [1130, 23], [1120, 22], [1110, 22],
  [1100, 22], [1090, 21], [1080, 21], [1070, 21], [1060, 21],
  [1050, 20], [1040, 20], [1030, 20], [1020, 20], [1010, 19],
  [1000, 19], [990, 19], [980, 18], [970, 18], [960, 18],
  [950, 18], [940, 17], [930, 17], [920, 17], [910, 17], [900, 16],
];

const satToAct = (sat: number): number | null => {
  if (sat < 900 || sat > 1600) return null;
  const rounded = Math.round(sat / 10) * 10;
  const row = SAT_TO_ACT.find(([s]) => s === rounded);
  return row ? row[1] : null;
};

const actToSat = (act: number): number | null => {
  if (act < 16 || act > 36) return null;
  const match = SAT_TO_ACT.find(([, a]) => a === act);
  return match ? match[0] : null;
};

const SatToActConverter = () => {
  const meta = satToolBySlug.get("sat-to-act-converter")!;
  const [sat, setSat] = useState<string>("1400");
  const [act, setAct] = useState<string>("");

  const satResult = useMemo(() => {
    const satScore = Number(sat);
    return Number.isFinite(satScore) ? satToAct(satScore) : null;
  }, [sat]);

  const actResult = useMemo(() => {
    const actScore = Number(act);
    return Number.isFinite(actScore) ? actToSat(actScore) : null;
  }, [act]);

  const url = `https://1600.now/${meta.slug}`;
  const faqs = [
    {
      question: "Which concordance table does this converter use?",
      answer:
        "The official 2018 College Board × ACT concordance tables, which remain the concordance of record for the Digital SAT in 2026.",
    },
    {
      question: "Do colleges accept SAT-to-ACT conversions?",
      answer:
        "Most colleges either publish both SAT and ACT ranges or use concordance tables internally. They do not convert for you — send whichever score looks stronger after conversion.",
    },
    {
      question: "Is there a single best score to send?",
      answer:
        "Send the score with the higher percentile. If your SAT percentile is higher than the equivalent ACT percentile, send SAT, and vice versa.",
    },
    {
      question: "What if my score isn't on the table?",
      answer:
        "SAT scores below 900 or above 1600, and ACT scores below 16 or above 36, fall outside the official concordance. The tool rounds SAT scores to the nearest 10.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageSeo
        id={`tool-${meta.slug}`}
        title={meta.metaTitle}
        description={meta.metaDescription}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: meta.name, url },
          ]),
          buildFaqJsonLd(faqs),
          buildWebApplicationJsonLd({
            name: meta.name,
            url,
            description: meta.metaDescription,
          }),
        ]}
      />

      <nav className="mb-6 text-sm text-muted-foreground">
        <Link className="hover:underline" to="/">
          Home
        </Link>{" "}
        › <span className="text-foreground">{meta.name}</span>
      </nav>

      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
        {meta.name}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{meta.intro}</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border p-6">
          <label className="text-sm font-semibold">SAT total score</label>
          <input
            type="number"
            min={900}
            max={1600}
            step={10}
            value={sat}
            onChange={(event) => setSat(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
          />
          <div className="mt-4 text-sm text-muted-foreground">
            Equivalent ACT composite
          </div>
          <div className="mt-1 text-3xl font-semibold">
            {satResult ?? "—"}
          </div>
        </div>

        <div className="rounded-xl border border-border p-6">
          <label className="text-sm font-semibold">ACT composite</label>
          <input
            type="number"
            min={16}
            max={36}
            step={1}
            value={act}
            onChange={(event) => setAct(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
          />
          <div className="mt-4 text-sm text-muted-foreground">
            Equivalent SAT total
          </div>
          <div className="mt-1 text-3xl font-semibold">
            {actResult ?? "—"}
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Full concordance table
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2">SAT</th>
                <th className="py-2">ACT</th>
              </tr>
            </thead>
            <tbody>
              {SAT_TO_ACT.filter((_, rowIndex) => rowIndex % 2 === 0).map(([satScore, actScore]) => (
                <tr key={satScore} className="border-b border-border/40">
                  <td className="py-1.5">{satScore}</td>
                  <td className="py-1.5">{actScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Which score should you send?
        </h2>
        <p className="mt-3 text-muted-foreground">
          Concordance is not a reward chart; it is a comparison tool. Use it to decide which test better represents your application, then check the college's actual score policy for superscoring and test-optional rules.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className="px-4 py-3 font-semibold">Situation</th>
                <th className="px-4 py-3 font-semibold">Decision</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">SAT converts to a higher ACT than your actual ACT</td>
                <td className="px-4 py-3 text-muted-foreground">Send SAT unless a college specifically prefers ACT section data.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">ACT converts to a higher SAT than your actual SAT</td>
                <td className="px-4 py-3 text-muted-foreground">Send ACT and use SAT practice only if you plan to retest.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">Scores are equivalent</td>
                <td className="px-4 py-3 text-muted-foreground">Send the test with stronger section balance or the score your college superscores best.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Common concordance mistakes
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Comparing SAT total score to ACT composite without checking the official concordance band.</li>
          <li>Assuming equivalent scores have identical section strengths.</li>
          <li>Sending both scores when one clearly converts higher and the college does not require both.</li>
        </ul>
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
    </div>
  );
};

export default SatToActConverter;
