import { Link } from "react-router-dom";
import { countryPageClasses } from "./countryPageClasses";

interface CountrySection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

interface CountryFaq {
  question: string;
  answer: string;
}

export const CountrySections = ({ sections }: { sections: CountrySection[] }) => (
  <>
    {sections.map((section) => (
      <section key={section.heading} className={countryPageClasses.section}>
        <h2 className={countryPageClasses.sectionTitle}>{section.heading}</h2>
        {section.paragraphs.map((paragraph, paragraphIndex) => (
          <p key={paragraphIndex} className={countryPageClasses.paragraph}>
            {paragraph}
          </p>
        ))}
        {section.bullets && section.bullets.length > 0 && (
          <ul className={countryPageClasses.bulletList}>
            {section.bullets.map((bullet, bulletIndex) => (
              <li key={bulletIndex}>{bullet}</li>
            ))}
          </ul>
        )}
      </section>
    ))}
  </>
);

export const CountryFaqSection = ({ faqs }: { faqs: CountryFaq[] }) => (
  <section className={countryPageClasses.section}>
    <h2 className={countryPageClasses.sectionTitle}>FAQs</h2>
    <div className={countryPageClasses.faqList}>
      {faqs.map((faq) => (
        <div key={faq.question}>
          <h3 className={countryPageClasses.faqQuestion}>{faq.question}</h3>
          <p className={countryPageClasses.faqAnswer}>{faq.answer}</p>
        </div>
      ))}
    </div>
  </section>
);

export const CountryActionLink = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className={countryPageClasses.actionLink}>
    {label}
  </Link>
);
