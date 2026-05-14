// Identify questions that REFERENCE a visual (table/figure/graph/chart/diagram/shown above/below)
// but have no image attached via any known source.
//
// Output: scripts/_data/missing_image_suspects.json — worker plan for image lookup/attach.

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

// Strong signals: the QUESTION STEM explicitly asks the reader to use a visual.
const VISUAL_REFS = [
  /\b(?:based on|according to) the (?:table|figure|graph|chart|diagram|scatterplot|histogram)\b/i,
  /\bthe (?:table|figure|graph|chart|diagram|scatterplot|histogram) (?:above|below|shown)\b/i,
  /\b(?:table|figure|graph|chart|scatterplot|histogram) (?:above|below) (?:shows|summariz|depict|represent|display)/i,
  /\bsummariz(?:es|ed) the (?:distribution|results|data)\b[\s\S]{0,200}?\?\s*$/i,
  /\b(?:shown|given|displayed|depicted) in the (?:table|figure|graph|chart|diagram|scatterplot)\b/i,
  /\bthe scatterplot (?:above|below|shows|shown)\b/i,
  /\bthe data (?:in|from) the (?:table|figure|graph|chart)\b/i,
  // Stem opens referencing unseen set — strong indicator of a stripped table
  /^\s*one of these (?:participants|individuals|students|items|values|people|subjects|samples|cases)\b/i,
  /^\s*which of the following (?:is|was) (?:true )?(?:based on|according to) the (?:table|figure|graph|chart)\b/i,
  /\bthese (?:participants|individuals|students|items|values|people|subjects|samples|cases) (?:will be|were) (?:selected|chosen)\b/i,
];

// Noise: figurative or narrative mentions — skip.
const SAFE_PHRASES = [
  /\bperiodic table\b/i,
  /\btable of contents\b/i,
];

function suspects(name, arr) {
  const out = [];
  for (const q of arr) {
    if (hasImage(q)) continue;
    const text = q.text || q.prompt || q.passage || '';
    if (!text) continue;
    if (SAFE_PHRASES.some((r) => r.test(text))) continue;
    if (!VISUAL_REFS.some((r) => r.test(text))) continue;
    out.push({
      bank: name,
      id: String(q.id),
      textPreview: text.slice(0, 160),
    });
  }
  console.log(`${name}: ${out.length} suspects`);
  return out;
}

const all = [
  ...suspects('unofficialQuestions', unofficial),
  ...suspects('math_past', mathPast),
  ...suspects('reading_past', readingPast),
];

fs.writeFileSync(path.join(repo, 'scripts/_data/missing_image_suspects.json'), JSON.stringify(all, null, 2));
console.log(`Total suspects: ${all.length}`);
console.log(`Wrote scripts/_data/missing_image_suspects.json`);
