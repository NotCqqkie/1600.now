import fs from 'fs';
import path from 'path';

const ALL_QUESTIONS_PATH = path.resolve(
  import.meta.dirname ?? '.',
  '../src/data/all_questions.ts'
);

// ---- Load questions by stripping TS and eval-ing ----
const raw = fs.readFileSync(ALL_QUESTIONS_PATH, 'utf-8');

const arrayStartMarker = 'export const questions: Question[] = [';
const startIdx = raw.indexOf(arrayStartMarker);
if (startIdx === -1) {
  console.error('Could not find questions array in file');
  process.exit(1);
}

const arrayStart = startIdx + arrayStartMarker.length - 1;
const arrayContent = raw.slice(arrayStart);
const trimmed = arrayContent.trimEnd().replace(/;\s*$/, '');

let questions;
try {
  const fn = new Function('return ' + trimmed);
  questions = fn();
} catch (e) {
  console.error('Failed to parse questions array:', e.message);
  process.exit(1);
}

console.log(`Loaded ${questions.length} questions`);

// ---- Audit infrastructure ----
const errors = [];
const errorsByCategory = {};

function addError(qIndex, q, category, field, message, value) {
  let entry = errors.find(e => e.questionIndex === qIndex);
  if (!entry) {
    entry = {
      questionId: String(q.id ?? 'MISSING'),
      questionNumber: qIndex + 1,
      questionIndex: qIndex,
      testName: q.testName ?? q.test_name ?? 'UNKNOWN',
      errors: [],
    };
    errors.push(entry);
  }
  entry.errors.push({ category, field, message, value: truncate(value) });
  if (!errorsByCategory[category]) errorsByCategory[category] = [];
  errorsByCategory[category].push(String(q.id ?? `index_${qIndex}`));
}

function truncate(val, max = 300) {
  if (val === null || val === undefined) return String(val);
  const s = String(val);
  return s.length > max ? s.slice(0, max) + '...' : s;
}

// ---- Check functions ----

function checkMathDelimiters(str, qIndex, q, field) {
  if (!str) return;

  // Step 1: Remove escaped dollar signs \$ (these are literal dollar signs, not delimiters)
  let processed = str.replace(/\\\$/g, '@@ED@@');

  // Step 2: Remove $$ (display math) and count them separately
  const doubleDollarCount = (processed.match(/\$\$/g) || []).length;
  processed = processed.replace(/\$\$/g, '@@DD@@');

  // Step 3: Parse $ delimiters in paired context
  // Try to pair $ signs. Each pair $...$ is valid math.
  // Walk through and pair them up.
  const dollarPositions = [];
  for (let i = 0; i < processed.length; i++) {
    if (processed[i] === '$') {
      dollarPositions.push(i);
    }
  }

  const totalDollars = dollarPositions.length;

  if (totalDollars % 2 !== 0) {
    // Odd number of $ - there's definitely an unmatched delimiter.
    // Try to identify which ones are currency vs math.
    // Currency: $ at start of token, followed by digits+commas+periods, then whitespace/punctuation/end
    // e.g., "$25.7 million", "$1,000 US banknotes"
    // Math: $x$, $270$, $\frac{1}{2}$, etc.

    const currencyPattern = /\$(\d[\d,.]*)\s*(?:million|billion|thousand|hundred|US|dollar|cent|per\b|each\b|total|from|for|in\b|and\b|to\b|at\b|,|\.(?:\s|$)|\s|$)/g;
    const currencyPositions = new Set();
    let cm;
    while ((cm = currencyPattern.exec(processed)) !== null) {
      currencyPositions.add(cm.index);
    }

    const mathCount = totalDollars - currencyPositions.size;

    if (mathCount % 2 !== 0) {
      addError(qIndex, q, 'unmatched_math_delimiters', field,
        `Odd number of $ delimiters (${totalDollars} total, ${currencyPositions.size} likely currency)`,
        str);
    }

    if (currencyPositions.size > 0) {
      addError(qIndex, q, 'currency_dollar_in_text', field,
        `Currency $ signs (${currencyPositions.size}) in text that also uses $ for math`,
        str);
    }
  }

  // Also check for inequality symbols that break math delimiters
  // Pattern: $y< or $y> where < or > is an inequality, causing the math to not close
  if (/\$[a-zA-Z]*[<>]/.test(processed) && totalDollars % 2 !== 0) {
    addError(qIndex, q, 'inequality_breaks_math', field,
      'Inequality symbol (< or >) inside $ math may break delimiter pairing',
      str);
  }

  // $$ display math should come in pairs
  if (doubleDollarCount % 2 !== 0) {
    addError(qIndex, q, 'unmatched_display_math_delimiters', field,
      `Odd number of $$ delimiters (${doubleDollarCount})`,
      str);
  }
}

function checkLatexCommands(str, qIndex, q, field) {
  if (!str) return;

  // Check \frac not followed by opening brace
  const fracRegex = /\\frac\s*(?!\{)/g;
  let m;
  while ((m = fracRegex.exec(str)) !== null) {
    addError(qIndex, q, 'broken_latex_frac', field,
      '\\frac not followed by opening brace',
      str.slice(m.index, m.index + 40));
  }

  // Check for unclosed braces within math regions
  // Extract math regions between $ delimiters
  const processed = str.replace(/\\\$/g, ''); // remove escaped $
  const mathRegex = /\$([^$]+)\$/g;
  let match;
  while ((match = mathRegex.exec(processed)) !== null) {
    const region = match[1];
    let depth = 0;
    let broken = false;
    for (const ch of region) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth < 0) {
        addError(qIndex, q, 'unmatched_braces_in_math', field,
          'Extra closing brace in math expression',
          region);
        broken = true;
        break;
      }
    }
    if (!broken && depth > 0) {
      addError(qIndex, q, 'unmatched_braces_in_math', field,
        `Unclosed brace(s) in math expression (depth=${depth})`,
        region);
    }
  }

  // Check \sqrt not followed by brace, digit, backslash, or bracket
  const sqrtRegex = /\\sqrt(?!\{|\d|\\|\[| )/g;
  while ((m = sqrtRegex.exec(str)) !== null) {
    addError(qIndex, q, 'broken_latex_sqrt', field,
      '\\sqrt not followed by brace or digit',
      str.slice(m.index, m.index + 20));
  }
}

function checkBoldItalicMarkers(str, qIndex, q, field) {
  if (!str) return;

  const cleaned = str.replace(/\\\*/g, '');

  // Bold markers ** (must come in pairs)
  const doubleStar = (cleaned.match(/\*\*/g) || []).length;
  if (doubleStar % 2 !== 0) {
    addError(qIndex, q, 'unmatched_bold_markers', field,
      `Odd number of ** bold markers (${doubleStar})`,
      str);
  }

  // Underline/blank markers __
  // SAT questions use ____ (4+ underscores) as fill-in-the-blank markers.
  // These are legitimate and should not be flagged.
  // Remove blank markers (4+ underscores in a row) first, then check for orphan __
  const withoutBlanks = cleaned.replace(/_{4,}/g, '');
  // Now count remaining __ pairs
  const doubleUnderscore = (withoutBlanks.match(/__/g) || []).length;
  if (doubleUnderscore % 2 !== 0) {
    addError(qIndex, q, 'unmatched_underline_markers', field,
      `Odd number of __ underline markers (${doubleUnderscore}) after removing blanks`,
      str);
  }

  // Single italic * (after removing ** and math)
  const withoutDoubleStars = cleaned.replace(/\*\*/g, '');
  const withoutMath = withoutDoubleStars.replace(/\$[^$]*\$/g, '');
  const singleStar = (withoutMath.match(/\*/g) || []).length;
  if (singleStar % 2 !== 0) {
    addError(qIndex, q, 'unmatched_italic_markers', field,
      `Odd number of single * italic markers (${singleStar})`,
      str);
  }
}

function checkHTML(str, qIndex, q, field) {
  if (!str) return;

  // Malformed HTML tags with spaces like < br> or < /br>
  const malformedTags = str.match(/<\s+\w+>|<\s+\/\w+>/g);
  if (malformedTags) {
    addError(qIndex, q, 'malformed_html_tags', field,
      `Malformed HTML tags found: ${malformedTags.join(', ')}`,
      str);
  }

  // Check for actual HTML tags (not math < or > operators)
  // Remove math regions first to avoid false positives
  const withoutMath = str.replace(/\$[^$]+\$/g, '').replace(/\\\$/g, '');

  // Unclosed HTML tags (basic)
  const openTags = withoutMath.match(/<(?!br|img|hr|input|!)[a-z]+(?:\s[^>]*)?>/gi) || [];
  const closeTags = withoutMath.match(/<\/[a-z]+>/gi) || [];
  if (openTags.length > closeTags.length + 2) {
    addError(qIndex, q, 'unclosed_html_tags', field,
      `Possible unclosed HTML tags: ${openTags.length} opens vs ${closeTags.length} closes`,
      str);
  }
}

function checkEncoding(str, qIndex, q, field) {
  if (!str) return;

  // Raw unicode escapes - but exclude LaTeX commands starting with \u
  const strippedLatex = str.replace(/\\underline|\\underset|\\underbrace|\\unicode|\\uparrow|\\cup|\\uplus|\\unlhd|\\unrhd|\\units/g, '');
  if (/\\u[0-9a-fA-F]{4}/.test(strippedLatex)) {
    addError(qIndex, q, 'raw_unicode_escape', field,
      'Contains raw \\u escape sequence',
      strippedLatex.match(/\\u[0-9a-fA-F]{4}/)?.[0]);
  }

  // HTML entities that should be decoded
  const htmlEntities = str.match(/&(amp|lt|gt|nbsp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g);
  if (htmlEntities) {
    addError(qIndex, q, 'html_entities_not_decoded', field,
      `Contains HTML entities: ${[...new Set(htmlEntities)].join(', ')}`,
      str);
  }

  // Full-width characters mixed with ASCII (parentheses, question marks, etc.)
  const fullWidth = str.match(/[\uFF01-\uFF5E\uFF08\uFF09\u3000-\u303F]/g);
  if (fullWidth && fullWidth.length > 0) {
    const chars = [...new Set(fullWidth)].map(c => `U+${c.codePointAt(0).toString(16).toUpperCase()} '${c}'`);
    addError(qIndex, q, 'mixed_fullwidth_chars', field,
      `Contains ${fullWidth.length} full-width character(s): ${chars.join(', ')}`,
      str);
  }
}

// Additional checks

function checkBrokenMathFormatting(str, qIndex, q, field) {
  if (!str) return;

  // Check for * x * or * y * patterns that should be $x$ or $y$ (broken italic-as-variable formatting)
  // Pattern: * single_letter * where single letter is a math variable
  const brokenVarPattern = /\* ([a-zA-Z]) \*/g;
  const matches = [...str.matchAll(brokenVarPattern)];
  // Only flag if there are multiple occurrences (indicates systematic broken formatting)
  if (matches.length >= 2) {
    addError(qIndex, q, 'broken_variable_formatting', field,
      `Contains ${matches.length} instances of "* letter *" pattern (should be $letter$ or **letter**)`,
      str);
  }

  // Check for patterns like "(* x **, y *)" which is clearly broken math formatting
  if (/\(\* [a-zA-Z] \*\*/.test(str)) {
    addError(qIndex, q, 'broken_coordinate_formatting', field,
      'Contains broken coordinate formatting like "(* x **, y *)"',
      str);
  }
}

function checkSpecialCharacters(str, qIndex, q, field) {
  if (!str) return;

  // Check for replacement character (U+FFFD) indicating encoding issues
  if (str.includes('\uFFFD')) {
    addError(qIndex, q, 'replacement_character', field,
      'Contains Unicode replacement character (U+FFFD) indicating encoding corruption',
      str);
  }

  // Check for zero-width characters that might cause display issues
  const zwChars = str.match(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g);
  if (zwChars && zwChars.length > 0) {
    addError(qIndex, q, 'zero_width_characters', field,
      `Contains ${zwChars.length} zero-width or invisible Unicode character(s)`,
      str);
  }

  // Check for unusual whitespace
  const unusualWS = str.match(/[\u00A0\u2000-\u200A\u2028\u2029\u205F\u3000]/g);
  if (unusualWS && unusualWS.length > 0) {
    const types = [...new Set(unusualWS)].map(c => `U+${c.codePointAt(0).toString(16).toUpperCase()}`);
    addError(qIndex, q, 'unusual_whitespace', field,
      `Contains ${unusualWS.length} unusual whitespace character(s): ${types.join(', ')}`,
      str);
  }
}

function checkDuplicateContent(questions) {
  // Check for questions with identical text (beyond just ID duplicates)
  const textMap = new Map();
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const text = (q.text ?? q.question_text ?? '').trim();
    if (!text) continue;

    // Use first 100 chars as a fingerprint (full text matching is too strict due to minor variations)
    const key = text.slice(0, 100);
    if (textMap.has(key)) {
      const firstIdx = textMap.get(key);
      const firstQ = questions[firstIdx];
      // Only flag if different IDs but same test name
      if (String(q.id) !== String(firstQ.id) &&
          (q.testName ?? '') === (firstQ.testName ?? '')) {
        addError(i, q, 'duplicate_content_same_test', 'text',
          `Near-duplicate text (first 100 chars match question #${firstIdx + 1}, ID: ${firstQ.id})`,
          text.slice(0, 150));
      }
    } else {
      textMap.set(key, i);
    }
  }
}

function checkInconsistentLabels(str, qIndex, q, field) {
  if (!str) return;

  // Look for choice labels like "(A)" or "A." embedded in the question text
  // This might indicate that choices were not properly separated
  if (/\(A\)\s/.test(str) && /\(B\)\s/.test(str)) {
    addError(qIndex, q, 'embedded_choice_labels', field,
      'Question text contains embedded choice labels (A), (B), etc.',
      str);
  }
}

function checkMissingCorrectAnswerValidity(q, qIndex) {
  const correctAnswer = q.correctAnswer ?? q.correct_answer;
  const isFreeResponse = q.type === 'free-response' || q.is_fill_in_blank === true;

  if (!isFreeResponse && correctAnswer && q.choices && q.choices.length > 0) {
    // For multiple choice, answer should be A, B, C, or D
    if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      addError(qIndex, q, 'invalid_correct_answer', 'correctAnswer',
        `Correct answer "${correctAnswer}" is not A/B/C/D for multiple-choice question`,
        correctAnswer);
    }
  }
}

function checkImageReferences(q, qIndex) {
  // Check for image references in text that might indicate missing images
  const qText = q.text ?? q.question_text ?? '';

  // Check for [image] or [figure] placeholders
  if (/\[image\]|\[figure\]|\[graph\]|\[table\]|\[chart\]/i.test(qText)) {
    // Only flag if the question doesn't have actual images
    if (!q.image && (!q.images || q.images.length === 0) && (!q.questionImages || q.questionImages.length === 0)) {
      addError(qIndex, q, 'image_placeholder_no_image', 'text',
        'Question text references an image/figure/graph but no image is attached',
        qText);
    }
  }
}

// ---- Main audit loop ----
const seenIds = new Map();

for (let i = 0; i < questions.length; i++) {
  const q = questions[i];

  // === Field Validation ===

  // ID
  if (q.id === undefined || q.id === null || String(q.id).trim() === '') {
    addError(i, q, 'missing_id', 'id', 'Question ID is missing or empty', q.id);
  } else {
    const idStr = String(q.id);
    if (seenIds.has(idStr)) {
      addError(i, q, 'duplicate_id', 'id',
        `Duplicate ID (first seen at question #${seenIds.get(idStr) + 1})`,
        idStr);
    }
    seenIds.set(idStr, i);
  }

  // testName
  const testName = q.testName ?? q.test_name;
  if (!testName || String(testName).trim() === '') {
    addError(i, q, 'missing_test_name', 'testName', 'Test name is missing or empty', testName);
  }

  // question text
  const qText = q.text ?? q.question_text;
  if (!qText || String(qText).trim() === '') {
    addError(i, q, 'missing_question_text', 'text', 'Question text is null, empty, or whitespace-only', qText);
  } else if (qText.length < 10) {
    addError(i, q, 'short_question_text', 'text',
      `Question text is suspiciously short (${qText.length} chars)`,
      qText);
  }

  // correct answer
  const correctAnswer = q.correctAnswer ?? q.correct_answer;
  if (!correctAnswer || String(correctAnswer).trim() === '') {
    addError(i, q, 'missing_correct_answer', 'correctAnswer',
      'Correct answer is null or empty', correctAnswer);
  }

  const isFreeResponse = q.type === 'free-response' || q.is_fill_in_blank === true;

  // Choices validation
  if (!isFreeResponse) {
    if (!q.choices || !Array.isArray(q.choices)) {
      addError(i, q, 'missing_choices', 'choices', 'Choices array is missing or not an array', q.choices);
    } else {
      if (q.choices.length === 0) {
        addError(i, q, 'empty_choices', 'choices', 'Choices array is empty', null);
      } else if (q.choices.length !== 4) {
        addError(i, q, 'wrong_choice_count', 'choices',
          `Expected 4 choices, found ${q.choices.length}`,
          q.choices.map(c => c.id || c.label).join(', '));
      }

      const expectedLabels = ['A', 'B', 'C', 'D'];
      for (let ci = 0; ci < q.choices.length && ci < 4; ci++) {
        const choice = q.choices[ci];
        const label = choice.id ?? choice.label;
        if (label !== expectedLabels[ci]) {
          addError(i, q, 'wrong_choice_label', `choices[${ci}]`,
            `Expected label "${expectedLabels[ci]}", got "${label}"`,
            label);
        }

        const choiceText = choice.text ?? '';
        const choiceImage = choice.image ?? choice.images;
        if ((!choiceText || choiceText.trim() === '') && !choiceImage) {
          addError(i, q, 'empty_choice', `choices[${ci}]`,
            `Choice ${label} has no text and no image`,
            null);
        }
      }

      // correct_answer matches a choice label
      if (correctAnswer) {
        const labels = q.choices.map(c => c.id ?? c.label);
        if (!labels.includes(correctAnswer)) {
          addError(i, q, 'correct_answer_not_in_choices', 'correctAnswer',
            `Correct answer "${correctAnswer}" does not match any choice label (${labels.join(', ')})`,
            correctAnswer);
        }
      }
    }
  } else {
    if (!correctAnswer || String(correctAnswer).trim() === '') {
      addError(i, q, 'missing_correct_answer_free_response', 'correctAnswer',
        'Free response question has no correct answer', correctAnswer);
    }
  }

  // Passage
  const passage = q.passage;
  if (passage !== undefined && passage !== null && typeof passage === 'string' && passage.trim().length > 0 && passage.trim().length < 20) {
    addError(i, q, 'short_passage', 'passage',
      `Passage is suspiciously short (${passage.trim().length} chars)`,
      passage);
  }

  // Rationale
  if (q.rationale === undefined || q.rationale === null || (typeof q.rationale === 'string' && q.rationale.trim() === '')) {
    addError(i, q, 'missing_rationale', 'rationale',
      'Rationale is null or empty', null);
  }

  // Question text equals choice text
  if (qText && q.choices && Array.isArray(q.choices)) {
    for (const choice of q.choices) {
      if (choice.text && qText.trim() === choice.text.trim()) {
        addError(i, q, 'question_equals_choice', 'text',
          `Question text is identical to choice ${choice.id ?? choice.label}`,
          qText);
        break;
      }
    }
  }

  // Additional structural checks
  checkMissingCorrectAnswerValidity(q, i);
  checkImageReferences(q, i);

  // === Text-level checks on all text fields ===
  const allTextFields = [];
  if (qText) allTextFields.push({ field: 'text', value: qText });
  if (passage) allTextFields.push({ field: 'passage', value: passage });
  if (q.rationale) allTextFields.push({ field: 'rationale', value: q.rationale });
  if (q.choices && Array.isArray(q.choices)) {
    for (let ci = 0; ci < q.choices.length; ci++) {
      if (q.choices[ci].text) {
        allTextFields.push({ field: `choices[${ci}].text`, value: q.choices[ci].text });
      }
    }
  }

  for (const { field, value } of allTextFields) {
    checkMathDelimiters(value, i, q, field);
    checkLatexCommands(value, i, q, field);
    checkBoldItalicMarkers(value, i, q, field);
    checkHTML(value, i, q, field);
    checkEncoding(value, i, q, field);
    checkBrokenMathFormatting(value, i, q, field);
    checkSpecialCharacters(value, i, q, field);
    checkInconsistentLabels(value, i, q, field);
  }
}

// Cross-question checks
checkDuplicateContent(questions);

// ---- Build report ----
const totalErrors = errors.reduce((sum, e) => sum + e.errors.length, 0);
const questionsWithErrors = errors.length;

const categoryCounts = {};
for (const [cat, ids] of Object.entries(errorsByCategory)) {
  categoryCounts[cat] = ids.length;
}

const sortedCategories = Object.entries(categoryCounts)
  .sort((a, b) => b[1] - a[1]);

// Categorize by severity
const highSeverity = [
  'missing_question_text', 'missing_correct_answer', 'missing_id',
  'missing_test_name', 'missing_choices', 'empty_choices', 'wrong_choice_count',
  'empty_choice', 'correct_answer_not_in_choices', 'invalid_correct_answer',
  'missing_correct_answer_free_response', 'duplicate_id',
  'duplicate_content_same_test',
];
const mediumSeverity = [
  'unmatched_math_delimiters', 'unmatched_display_math_delimiters',
  'broken_latex_frac', 'unmatched_braces_in_math', 'broken_latex_sqrt',
  'unmatched_bold_markers', 'unmatched_underline_markers', 'unmatched_italic_markers',
  'malformed_html_tags', 'unclosed_html_tags',
  'mixed_fullwidth_chars', 'replacement_character',
  'broken_variable_formatting', 'broken_coordinate_formatting',
  'currency_math_dollar_conflict',
];
const lowSeverity = [
  'missing_rationale', 'short_question_text', 'short_passage',
  'question_equals_choice', 'raw_unicode_escape', 'html_entities_not_decoded',
  'zero_width_characters', 'unusual_whitespace',
  'embedded_choice_labels', 'image_placeholder_no_image',
];

let summary = `=== AUDIT SUMMARY ===\n`;
summary += `Total questions: ${questions.length}\n`;
summary += `Total issues found: ${totalErrors}\n`;
summary += `Questions with issues: ${questionsWithErrors}\n\n`;

summary += `--- HIGH SEVERITY (data correctness) ---\n`;
for (const cat of highSeverity) {
  if (categoryCounts[cat]) summary += `  ${cat}: ${categoryCounts[cat]}\n`;
}

summary += `\n--- MEDIUM SEVERITY (formatting/display) ---\n`;
for (const cat of mediumSeverity) {
  if (categoryCounts[cat]) summary += `  ${cat}: ${categoryCounts[cat]}\n`;
}

summary += `\n--- LOW SEVERITY (minor/informational) ---\n`;
for (const cat of lowSeverity) {
  if (categoryCounts[cat]) summary += `  ${cat}: ${categoryCounts[cat]}\n`;
}

// Filter for detailed report: exclude missing_rationale (too noisy, all 6075 have it)
const significantErrors = errors
  .filter(e => e.errors.some(err => err.category !== 'missing_rationale'))
  .map(e => ({
    questionId: e.questionId,
    questionNumber: e.questionNumber,
    testName: e.testName,
    errors: e.errors.filter(err => err.category !== 'missing_rationale'),
  }))
  .filter(e => e.errors.length > 0);

const report = {
  totalQuestions: questions.length,
  totalIssues: totalErrors,
  questionsWithIssues: questionsWithErrors,
  errorsByCategory,
  categoryCounts,
  severityBreakdown: {
    high: highSeverity.reduce((sum, c) => sum + (categoryCounts[c] || 0), 0),
    medium: mediumSeverity.reduce((sum, c) => sum + (categoryCounts[c] || 0), 0),
    low: lowSeverity.reduce((sum, c) => sum + (categoryCounts[c] || 0), 0),
  },
  errorDetails: significantErrors,
  rationaleIssuesCount: errorsByCategory['missing_rationale']?.length ?? 0,
  summary,
};

const reportPath = path.resolve(
  import.meta.dirname ?? '.',
  'audit_report.json'
);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nReport written to ${reportPath}`);
console.log('\n' + summary);

// Print high and medium severity errors in detail
const highMedErrors = significantErrors.filter(e =>
  e.errors.some(err => highSeverity.includes(err.category) || mediumSeverity.includes(err.category))
);

console.log(`\n=== HIGH + MEDIUM severity errors (${highMedErrors.length} questions) ===\n`);

for (const entry of highMedErrors) {
  const relevantErrors = entry.errors.filter(err =>
    highSeverity.includes(err.category) || mediumSeverity.includes(err.category)
  );
  console.log(`Question #${entry.questionNumber} (ID: ${entry.questionId}, Test: ${entry.testName})`);
  for (const err of relevantErrors) {
    const sev = highSeverity.includes(err.category) ? 'HIGH' : 'MED';
    console.log(`  [${sev}] [${err.category}] ${err.field}: ${err.message}`);
    if (err.value && err.value !== 'null' && err.value !== 'undefined') {
      console.log(`    Value: ${err.value.slice(0, 200)}`);
    }
  }
  console.log();
}
