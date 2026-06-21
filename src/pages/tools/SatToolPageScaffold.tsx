import { type ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  PageSeo,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildWebApplicationJsonLd,
  type FaqItem,
} from "@/components/seo/PageSeo";
import { type SatToolMeta } from "@/lib/seo-data/satTools";

const HOME_URL = "https://1600.now/";

export const TOOL_PAGE_CLASS = "mx-auto max-w-3xl px-6 py-10";
export const TOOL_INPUT_CLASS =
  "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2";
export const TOOL_SECTION_HEADING_CLASS =
  "text-2xl font-semibold tracking-tight";
export const TOOL_FORM_CARD_CLASS = "mt-8 rounded-xl border border-border p-6";
export const TOOL_RESULT_CARD_CLASS = "rounded-xl border border-border p-6";
export const TOOL_INFO_TABLE_WRAPPER_CLASS =
  "mt-4 overflow-x-auto rounded-lg border border-border";
export const TOOL_INFO_TABLE_CLASS = "w-full min-w-[560px] text-left text-sm";
export const TOOL_INFO_TABLE_HEAD_CLASS = "bg-muted/70";
export const TOOL_INFO_TABLE_HEADER_CELL_CLASS = "px-4 py-3 font-semibold";
export const TOOL_INFO_TABLE_ROW_CLASS = "border-t border-border";
export const TOOL_INFO_TABLE_CELL_CLASS = "px-4 py-3 text-muted-foreground";

interface SatToolPageScaffoldProps {
  meta: SatToolMeta;
  faqs: FaqItem[];
  children: ReactNode;
}

const FaqSection = ({ faqs }: { faqs: FaqItem[] }) => (
  <section className="mt-10">
    <h2 className={TOOL_SECTION_HEADING_CLASS}>FAQs</h2>
    <div className="mt-4 space-y-5">
      {faqs.map((faq) => (
        <div key={faq.question}>
          <h3 className="text-base font-semibold">{faq.question}</h3>
          <p className="mt-1 text-muted-foreground">{faq.answer}</p>
        </div>
      ))}
    </div>
  </section>
);

export const SatToolPageScaffold = ({
  meta,
  faqs,
  children,
}: SatToolPageScaffoldProps) => {
  const url = `https://1600.now/${meta.slug}`;

  return (
    <div className={TOOL_PAGE_CLASS}>
      <PageSeo
        id={`tool-${meta.slug}`}
        title={meta.metaTitle}
        description={meta.metaDescription}
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: HOME_URL },
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

      {children}
      <FaqSection faqs={faqs} />
    </div>
  );
};
