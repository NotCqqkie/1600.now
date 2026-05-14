import { Link } from "react-router-dom";

import { PageSeo, buildFaqJsonLd, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";
import { seoVocabEntries } from "@/lib/seo-data/vocabSeo";

const faqs = [
  {
    question: "How many vocabulary words are on the Digital SAT?",
    answer:
      "The Digital SAT does not publish a set vocabulary list, but Words-in-Context questions consistently test a core group of around 200–300 academic words. This list covers those high-frequency SAT vocabulary words.",
  },
  {
    question: "What is the best way to study SAT vocabulary?",
    answer:
      "The most effective method is contextual study. Read each SAT vocabulary word with an example sentence, practice retrieving its meaning, and then apply it to a real SAT Words-in-Context question.",
  },
  {
    question: "Are flashcards good for SAT vocabulary?",
    answer:
      "Yes, spaced-repetition flashcards work well for SAT vocabulary because Words-in-Context questions reward fast recognition of a word's primary meaning in an academic passage.",
  },
];

const SatVocabularyIndex = () => {
  const grouped = {
    Easy: seoVocabEntries.filter((e) => e.difficulty === "Easy"),
    Medium: seoVocabEntries.filter((e) => e.difficulty === "Medium"),
    Hard: seoVocabEntries.filter((e) => e.difficulty === "Hard"),
  };

  const title = `SAT Vocabulary List: ${seoVocabEntries.length}+ Digital SAT Words in Context`;
  const description =
    "Complete Digital SAT vocabulary list with definitions. Study every high-frequency SAT Words-in-Context word, grouped by difficulty, with examples for each word.";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageSeo
        id="sat-vocabulary-index"
        title={title}
        description={description}
        jsonLd={[
          buildFaqJsonLd(faqs),
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "SAT Vocabulary", url: "https://1600.now/sat-vocabulary" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description,
            url: "https://1600.now/sat-vocabulary",
          },
        ]}
      />

      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">
          The Complete Digital SAT Vocabulary List
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Every high-frequency word tested on the Digital SAT Words-in-Context
          question type, organized by difficulty. Tap any word to see its
          definition, example usage, and how it shows up on the SAT.
        </p>
        <div className="mt-4 flex gap-2 text-sm">
          <Link className="rounded-full border px-4 py-1 hover:bg-muted" to="/vocab">
            Practice with flashcards
          </Link>
          <Link
            className="rounded-full border px-4 py-1 hover:bg-muted"
            to="/bank/reading/browse"
          >
            Browse Reading &amp; Writing questions
          </Link>
        </div>
      </header>

      {(["Easy", "Medium", "Hard"] as const).map((difficulty) => (
        <section key={difficulty} className="mb-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            SAT {difficulty} Vocabulary ({grouped[difficulty].length} words)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {difficulty === "Easy"
              ? "Words that appear in the easier half of Digital SAT Words-in-Context questions."
              : difficulty === "Medium"
                ? "Mid-difficulty SAT vocabulary that separates a 1300 from a 1450."
                : "The toughest SAT Words-in-Context vocabulary — these are the score-ceiling words."}
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {grouped[difficulty].map((entry) => (
              <li
                key={entry.slug}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{entry.word}</span>
                {entry.definition && (
                  <span className="ml-1 text-muted-foreground">— {entry.definition}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Frequently Asked Questions
        </h2>
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

export default SatVocabularyIndex;
