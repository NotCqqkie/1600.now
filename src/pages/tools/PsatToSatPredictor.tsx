import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/components/seo/PageSeo";
import { satToolBySlug } from "@/lib/seo-data/satTools";

const predictSat = (psat: number, monthsUntilSat: number) => {
  if (psat < 320 || psat > 1520) return null;
  const baseline = Math.min(1600, psat);
  const expected = Math.min(1600, baseline + Math.min(monthsUntilSat, 12) * 10);
  const low = Math.max(400, baseline + Math.floor((expected - baseline) * 0.5));
  const high = Math.min(1600, expected + 30);
  return { baseline, expected: Math.round(expected / 10) * 10, low, high };
};

const PsatToSatPredictor = () => {
  const meta = satToolBySlug.get("psat-to-sat-predictor")!;
  const [psat, setPsat] = useState<string>("1200");
  const [months, setMonths] = useState<string>("6");

  const result = useMemo(() => {
    const p = Number(psat);
    const m = Number(months);
    if (!Number.isFinite(p) || !Number.isFinite(m) || m < 0) return null;
    return predictSat(p, m);
  }, [psat, months]);

  const url = `https://1600.now/${meta.slug}`;
  const faqs = [
    {
      question: "How accurate is the PSAT-to-SAT prediction?",
      answer:
        "The PSAT and SAT share a vertical scale, so your PSAT score is a direct predictor of current SAT ability. Typical growth is 60–120 points with 6–12 months of prep.",
    },
    {
      question: "Does the PSAT 10 and PSAT/NMSQT use the same prediction?",
      answer:
        "Yes. Both tests use the 320–1520 scale and predict SAT scores identically. The PSAT/NMSQT (taken junior fall) is especially predictive because it is closer in time to most SAT test dates.",
    },
    {
      question: "What is a good PSAT score?",
      answer:
        "A PSAT above 1200 puts you on track for a 1300+ SAT. A PSAT above 1400 is National Merit territory and predicts a 1500+ SAT with prep.",
    },
    {
      question: "Can I score higher than the PSAT ceiling on the SAT?",
      answer:
        "Yes. The PSAT caps at 1520, but because the SAT has the same scale and extends to 1600, a perfect PSAT still leaves room to grow on the SAT.",
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
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: meta.name,
            url,
            applicationCategory: "EducationalApplication",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
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

      <div className="mt-8 rounded-xl border border-border p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold">
              PSAT total score (320–1520)
            </label>
            <input
              type="number"
              min={320}
              max={1520}
              step={10}
              value={psat}
              onChange={(e) => setPsat(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">
              Months until your SAT
            </label>
            <input
              type="number"
              min={0}
              max={12}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Growth modeling caps at 12 months — beyond that, gains taper without a refreshed plan.
            </p>
          </div>
        </div>
        {result ? (
          <div className="mt-6 grid gap-3">
            <div>
              <div className="text-sm text-muted-foreground">
                Current predicted SAT (no additional prep)
              </div>
              <div className="text-2xl font-semibold">{result.baseline}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">
                Projected SAT after {months} months of consistent prep
              </div>
              <div className="text-3xl font-semibold">{result.expected}</div>
              <div className="text-sm text-muted-foreground">
                Likely range: {result.low}–{result.high}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Enter a PSAT score between 320 and 1520.
          </p>
        )}
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          How the PSAT-to-SAT prediction works
        </h2>
        <p className="mt-3 text-muted-foreground">
          The PSAT and SAT share a vertical scale — a 1200 on the PSAT and a
          1200 on the SAT represent the same ability level. The prediction
          above uses your PSAT as a baseline and adds roughly 10 points per
          month of consistent prep, which is the median growth rate for
          students using a structured study plan.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">FAQs</h2>
        <div className="mt-4 space-y-5">
          {faqs.map((f) => (
            <div key={f.question}>
              <h3 className="text-base font-semibold">{f.question}</h3>
              <p className="mt-1 text-muted-foreground">{f.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default PsatToSatPredictor;
