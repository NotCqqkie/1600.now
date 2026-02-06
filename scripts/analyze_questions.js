
const fs = require('fs');
const path = require('path');

const questionsPath = path.join(__dirname, '../src/data/questions.json');
const categoryMapPath = path.join(__dirname, '../src/data/category_map.json');

const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
const categoryMap = JSON.parse(fs.readFileSync(categoryMapPath, 'utf8'));

const errors = [];
const deletes = [];
const latexFixes = [];
const categoryMismatches = [];

const mathRegex = /[+\-=<>^]|\b\d+x\b|\\frac/;
const latexDelimRegex = /\$.*\$/;
const imageRefRegex = /figure|shown above|graph|plot|diagram/i;

questions.forEach(q => {
    // Determine if it's a math question
    const isMath = q.test_name.includes('Math') || (categoryMap[q.id] && categoryMap[q.id].subject === 'Math');
    if (!isMath) return;

    const fullText = (q.passage || '') + ' ' + (q.question_text || '');
    
    // Check for missing image reference
    // Logic: if text refers to image but no image in choices or passage
    // Note: The structure of image fields in questions.json is not fully clear from the snippet.
    // The snippet showed "choices": [{ "label": "A", "text": "...", "image": "..."? }]
    // We didn't see an image field in the root.
    // If "figure" or "graph" is mentioned, we expect an image url somewhere? 
    // Wait, the user said "referencing an image / content that it doesnt have".
    // I'll check if the text says "shown" but I don't see any 'image' property in the question object.
    // I'll log these for manual review or safe deletion if confident.
    
    if (imageRefRegex.test(fullText)) {
         // Check if there is any image property. 
         // Based on previous view, I didn't see 'image' in the root.
         // I'll check if 'image' key exists in q or q.choices.
         const hasImage = q.image || (q.choices && q.choices.some(c => c.image));
         if (!hasImage) {
             // Deletes
             deletes.push({ id: q.id, reason: 'Reference to image but no image found', text: fullText.substring(0, 100) });
         }
    }

    // Check for missing LaTeX
    // Heuristic: specific math symbols not inside $...$
    // This is hard to perfect with regex, but we can catch obvious ones.
    // Example: "2x + 5 = 10" without $
    // We look for patterns like " x " or " = " that are NOT between $...$
    
    // Simple check: if text has math-like symbols but no $, flag it.
    if (mathRegex.test(fullText) && !latexDelimRegex.test(fullText)) {
        // Exclude some common text cases
        if (!fullText.includes('http')) {
             latexFixes.push({ id: q.id, text: fullText.substring(0, 100) });
        }
    }
    
    // Also check for "broken" latex like "$ 2x $" (spaces) or unclosed $.
    const dollarCount = (fullText.match(/\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
        errors.push({ id: q.id, reason: 'Unbalanced LaTeX delimiters', text: fullText.substring(0, 100) });
    }
});

console.log('Deletes:', deletes.length);
if (deletes.length > 0) console.log(JSON.stringify(deletes.slice(0, 5), null, 2));

console.log('LaTeX Fixes Needed:', latexFixes.length);
if (latexFixes.length > 0) console.log(JSON.stringify(latexFixes.slice(0, 5), null, 2));

console.log('Other Errors:', errors.length);
if (errors.length > 0) console.log(JSON.stringify(errors.slice(0, 5), null, 2));

