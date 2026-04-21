// Identify groups of questions that differ ONLY in numbers (same signature post-number-normalization)
// but have distinct raw text. Exclude any group where ANY member has an image.
// Output a JSON work plan for Codex workers to rewrite the non-imaged questions.

import fs from 'node:fs';
import path from 'node:path';

const repo = '/Users/lukefinigan/Documents/1600-prep-hub';

const { questions: unofficial } = await import(path.join(repo, 'src/data/unofficialQuestions.ts'));
const mathPast = JSON.parse(fs.readFileSync(path.join(repo, 'src/data/questions/math_past.json'), 'utf8'));
const readingPast = JSON.parse(fs.readFileSync(path.join(repo, 'src/data/questions/reading_past.json'), 'utf8'));
const { questionImageMap: mainImgMap } = await import(path.join(repo, 'src/data/questionImageMap.ts'));
const { questionImageMap: unoImgMap } = await import(path.join(repo, 'src/data/unofficialQuestionImageMap.ts'));

const imageMaps = [mainImgMap || {}, unoImgMap || {}];
const hasImage = (q) =>
  Boolean(q.image) || Boolean(q.imageSrc) ||
  Boolean(q.questionImages?.length) || Boolean(q.images?.length) ||
  imageMaps.some(m => m[q.id]);

const signature = (text) =>
  (text || '').toLowerCase().replace(/\s+/g, ' ').replace(/[-+]?\d[\d,]*(?:\.\d+)?/g, 'N').trim();

const exactKey = (text) => (text || '').replace(/\s+/g, ' ').trim();

function analyze(name, arr) {
  const groups = new Map();
  for (const q of arr) {
    const sig = signature(q.text);
    if (!sig) continue;
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push(q);
  }
  const work = [];
  for (const [sig, items] of groups) {
    if (items.length < 2) continue;
    // Skip groups where all items share exact text (those should already be deduped)
    const distinctRaw = new Set(items.map((q) => exactKey(q.text)));
    if (distinctRaw.size < 2) continue;
    const withImg = items.filter(hasImage);
    const withoutImg = items.filter((q) => !hasImage(q));
    // Only rewrite non-imaged duplicates; keep imaged ones intact
    if (withoutImg.length === 0) continue;
    // If there's at least one imaged anchor OR multiple non-imaged, rewrite all non-imaged except the first
    const keepUntouched = withImg.length > 0 ? null : withoutImg[0];
    for (const q of withoutImg) {
      if (q === keepUntouched) continue;
      work.push({
        bank: name,
        id: String(q.id),
        signature: sig.slice(0, 120),
        groupSize: items.length,
        withImageIds: withImg.map((x) => String(x.id)),
        nonImageIds: withoutImg.map((x) => String(x.id)),
      });
    }
  }
  console.log(`${name}: ${groups.size} sig-groups, ${work.length} rewrites queued`);
  return work;
}

// PAST bank only. Unofficial bank must NOT be content-rewritten (user rule).
void unofficial;
const plan = [
  ...analyze('math_past', mathPast),
  ...analyze('reading_past', readingPast),
];

fs.writeFileSync(path.join(repo, 'scripts/numeric_template_work.json'), JSON.stringify(plan, null, 2));
console.log(`Total rewrites queued: ${plan.length}`);
console.log(`Wrote scripts/numeric_template_work.json`);
