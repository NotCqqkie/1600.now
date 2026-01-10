// Parsing logic for test names
// Example: "August 2023 Form A SAT English Module 1"

export interface ModuleMetadata {
  id: string; // unique key for the module (e.g. "aug-2023-form-a-english-m1")
  year: number;
  month?: string;
  form?: string;
  subject: "Math" | "Reading & Writing";
  moduleNumber: 1 | 2;
  difficulty?: "Easy" | "Hard"; // If M2 is labeled adaptive
  testName: string;
  questionCount: number;
}

export const parseTestName = (testName: string): Partial<ModuleMetadata> | null => {
  if (!testName) return null;
  const lower = testName.toLowerCase();
  
  // Year
  const yearMatch = testName.match(/20\d{2}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : undefined;
  
  // Subject
  let subject: "Math" | "Reading & Writing" | undefined;
  if (lower.includes("math")) subject = "Math";
  else if (lower.includes("english") || lower.includes("reading") || lower.includes("writing")) subject = "Reading & Writing";
  
  // Module
  let moduleNumber: 1 | 2 | undefined;
  if (lower.includes("module 1")) moduleNumber = 1;
  else if (lower.includes("module 2")) moduleNumber = 2;
  
  // Form
  // "Form A", "Form B"
  const formMatch = testName.match(/Form\s+([A-Z0-9]+)/i);
  const form = formMatch ? formMatch[1] : undefined;
  
  // Month
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = months.find(m => testName.includes(m));

  // ID Generation
  if (year && subject && moduleNumber) {
    const safeName = testName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    return {
      id: safeName, 
      year,
      month,
      form,
      subject,
      moduleNumber,
      testName
    };
  }
  
  return null;
};
