import { vocabularySets, type VocabWord } from "@/data/vocabulary";

export interface SeoVocabEntry extends Omit<VocabWord, "difficulty"> {
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  rawDifficulty: number;
  setId: string;
}

const difficultyFromRaw = (difficulty: number): SeoVocabEntry["difficulty"] => {
  if (difficulty <= 5) return "Easy";
  if (difficulty <= 6) return "Medium";
  return "Hard";
};

export const toSlug = (word: string) =>
  word.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const buildEntries = (): SeoVocabEntry[] => {
  const entries: SeoVocabEntry[] = [];
  const seen = new Set<string>();
  for (const set of vocabularySets) {
    for (const w of set.words) {
      const slug = toSlug(w.word);
      if (seen.has(slug)) continue;
      seen.add(slug);
      entries.push({
        ...w,
        slug,
        difficulty: difficultyFromRaw(w.difficulty),
        rawDifficulty: w.difficulty,
        setId: set.id,
      });
    }
  }
  return entries.sort((leftEntry, rightEntry) => leftEntry.word.localeCompare(rightEntry.word));
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
