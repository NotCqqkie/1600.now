import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_DATA_PATH = path.join(__dirname, '../data/raw/official_questions.json');
const OUTPUT_PATH = path.join(__dirname, '../src/data/official_questions.ts');

function transformQuestion(raw) {
    const isMath = raw.section === 'Math' || raw.domain === 'Problem-Solving and Data Analysis'; // Heuristic
    
    let text = raw.question_text || '';
    
    // Handler Passage
    if (raw.passage) {
        if (isMath) {
            // For Math, passage is usually context. Prepend it.
            text = raw.passage + "\n\n" + text;
        } else {
            // For English, use the delimiter expected by OfficialBankQuestion logic
            // Format: "Question Text \\\\ Passage Text"
            text = text + " \\\\\\\\ " + raw.passage; 
        }
    }

    // Map choices
    const choices = raw.choices ? raw.choices.map(c => ({
        id: c.letter,
        text: c.text
    })) : [];

    // Infer type
    const type = choices.length > 0 ? "multiple-choice" : "free-response";

    const questionCategory = {
        subject: raw.section === "Reading and Writing" ? "English" : raw.section,
        domain: raw.domain,
        skill: raw.skill,
        confidence: "high"
    };

    return {
        id: raw.id,
        section: raw.section,
        domain: raw.domain,
        skill: raw.skill,
        difficulty: raw.difficulty,
        rationale: raw.rationale,
        text: text,
        type: type,
        choices: choices.length ? choices : undefined,
        correctAnswer: raw.correct_answer,
        testName: "Official Question Bank",
        category: questionCategory
    };
}

// Check if file exists
if (!fs.existsSync(RAW_DATA_PATH)) {
    console.error(`Error: Source file not found at ${RAW_DATA_PATH}`);
    console.log("Please save the official question bank JSON to this file first.");
    process.exit(1);
}

try {
    const rawData = fs.readFileSync(RAW_DATA_PATH, 'utf-8');
    let questions = JSON.parse(rawData);
    
    // Handle nested array case (user pasted [ ... ] inside existing [] or similar)
    if (Array.isArray(questions) && questions.length === 1 && Array.isArray(questions[0])) {
        console.log("Detected nested array structure, flattening...");
        questions = questions[0];
    }

    console.log(`Loaded ${questions.length} questions.`);
    
    const transformed = questions.map(transformQuestion);
    
    const fileContent = `import { Question } from "./all_questions";\n\nexport const officialQuestions: Question[] = ${JSON.stringify(transformed, null, 2)};`;
    
    fs.writeFileSync(OUTPUT_PATH, fileContent);
    console.log(`Successfully wrote ${transformed.length} questions to ${OUTPUT_PATH}`);

} catch (error) {
    console.error("Error processing questions:", error);
}
