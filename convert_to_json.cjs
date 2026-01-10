const fs = require('fs');
const path = require('path');

try {
    let content = fs.readFileSync('src/data/questions_data.ts', 'utf8');
    
    // Find the start of the array
    const startIndex = content.indexOf('export const allQuestions = [');
    if (startIndex === -1) {
        // Try alternative
        const altIndex = content.indexOf('const questions: Question[] = [');
        if (altIndex !== -1) {
             content = content.substring(altIndex);
             content = content.replace('const questions: Question[] =', '');
        } else {
             throw new Error('Could not find start of questions array');
        }
    } else {
        content = content.substring(startIndex);
        content = content.replace('export const allQuestions =', '');
    }
    
    // Remove export default at the end
    content = content.replace(/export default questions;/, '');
    
    // Trim
    content = content.trim();
    if (content.endsWith(';')) content = content.slice(0, -1);
    
    const questions = eval('(' + content + ')');
    
    console.log(`Parsed ${questions.length} questions.`);
    
    fs.writeFileSync('src/data/questions.json', JSON.stringify(questions, null, 2));
    console.log('Successfully wrote src/data/questions.json');
    
} catch (e) {
    console.error('Error converting file:', e);
}
