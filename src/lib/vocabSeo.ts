import { vocabularySets, type VocabWord } from "@/data/vocabulary";

export interface SeoVocabEntry extends VocabWord {
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  setId: string;
}

const difficultyFromSetId = (setId: string): SeoVocabEntry["difficulty"] => {
  if (setId.endsWith("easy")) return "Easy";
  if (setId.endsWith("medium")) return "Medium";
  return "Hard";
};

export const toSlug = (word: string) =>
  word.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const buildEntries = (): SeoVocabEntry[] => {
  const entries: SeoVocabEntry[] = [];
  const seen = new Set<string>();
  for (const set of vocabularySets) {
    const difficulty = difficultyFromSetId(set.id);
    for (const w of set.words) {
      const slug = toSlug(w.word);
      if (seen.has(slug)) continue;
      seen.add(slug);
      entries.push({ ...w, slug, difficulty, setId: set.id });
    }
  }
  return entries.sort((a, b) => a.word.localeCompare(b.word));
};

export const seoVocabEntries = buildEntries();

export const seoVocabBySlug = new Map(
  seoVocabEntries.map((entry) => [entry.slug, entry]),
);

export const getRelatedVocab = (
  slug: string,
  count = 6,
): SeoVocabEntry[] => {
  const idx = seoVocabEntries.findIndex((e) => e.slug === slug);
  if (idx < 0) return seoVocabEntries.slice(0, count);
  const before = seoVocabEntries.slice(Math.max(0, idx - count), idx);
  const after = seoVocabEntries.slice(idx + 1, idx + 1 + count);
  return [...before, ...after].slice(0, count);
};
