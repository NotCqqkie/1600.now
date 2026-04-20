# Question Bank Map

This file maps the question-bank sources used by the app. Counts are current as of this repo state.

## Source Summary

| Path | Format | Questions | Shape | Consumed by |
| --- | --- | ---: | --- | --- |
| `src/data/questions/math_past.json` | JSON array | 2,157 | `Question[]` from `src/data/all_questions.ts`; all Math, 1,569 multiple-choice and 588 free-response | Imported by `src/data/questionBank.ts`; normalized into the `past` bank and indirectly used by `src/data/modulePracticeBank.ts` for past-question lookup and practice-test/module assembly |
| `src/data/questions/reading_past.json` | JSON array | 3,869 | `Question[]` from `src/data/all_questions.ts`; all Reading and Writing, all multiple-choice | Imported by `src/data/questionBank.ts`; normalized into the `past` bank and indirectly used by `src/data/modulePracticeBank.ts` for past-question lookup and practice-test/module assembly |
| `src/data/Modules/*.json` | JSON arrays | 6,026 across 245 module files | Raw module records with `section`, `domain`, `skill`, `difficulty`, `question_number`, `test_name`, `passage`, `question_text`, `choices`, `is_fill_in_blank`, `correct_answer`, `rationale`, `id`, and optional `images` | Loaded by `src/data/modulePracticeBank.ts` with `import.meta.glob("./Modules/*.json", { eager: true, import: "default" })`; matched back to normalized past-bank questions by `id` |
| `src/data/unofficialQuestions.ts` | TypeScript array export | 3,263 | Exports `questions: Question[]`; 1,590 Reading and Writing, 1,673 Math, 3,149 multiple-choice and 114 free-response | Imported by `src/data/questionBank.ts`; normalized into the default `unofficial` bank |
| `src/data/official_questions.ts` | TypeScript array export | 99 | Exports `officialQuestions: Question[]`; all Math, 78 multiple-choice and 21 free-response | Imported by `src/data/officialQuestionBank.ts`; normalized for official-bank browsing and question rendering |
| `src/data/official_questions.json` | Missing | 0 | No file exists in this repo state | Not imported |
| `src/data/officialQuestionBank.ts` | TypeScript normalizer | 99 input questions | Wraps `official_questions.ts` records into `BankQuestion` objects with `sourceId`, `questionNumber`, `prompt`, `choices`, `correctAnswer`, `rationale`, image metadata, difficulty, and category | Imported by `src/pages/BankBrowse.tsx`, `src/pages/BankFiltered.tsx`, `src/pages/BankIndex.tsx`, and `src/pages/Question.tsx` |
| `src/data/questionBank.ts` | TypeScript normalizer | 9,289 input questions | Combines `math_past.json`, `reading_past.json`, and `unofficialQuestions.ts`; outputs normalized `BankQuestion` pools keyed by subject and source | Imported by bank pages, question pages, progress/session libs, `src/components/BankSourceToggle.tsx`, and `src/data/modulePracticeBank.ts` |
| `src/data/modulePracticeBank.ts` | TypeScript module/practice-set builder | 6,026 raw module records, backed by 6,026 past JSON questions | Converts raw module records into `PracticeModule`, `PracticeSet`, and `PracticeTestQuestionItem`; fills missing slots with matching past-bank questions where possible | Imported by module, practice-test, review, result, and navigation pages/libs |

## Shared Raw Question Shape

`src/data/all_questions.ts` defines the shared source question shape used by `math_past.json`, `reading_past.json`, `unofficialQuestions.ts`, and `official_questions.ts`:

```ts
interface Question {
  section?: string;
  domain?: string;
  skill?: string;
  difficulty?: string | null;
  active?: boolean | null;
  rationale?: string | null;
  category?: QuestionCategory;
  id: number | string;
  testName?: string;
  text: string;
  image?: string;
  choices?: { id: string; text?: string; image?: string }[];
  correctAnswer: string;
  type: "multiple-choice" | "free-response";
}
```

## Module JSON Shape

Each `src/data/Modules/*.json` file is an array of raw module records:

```ts
interface RawModuleQuestion {
  section: string;
  domain: string;
  skill: string;
  difficulty?: string | null;
  question_number: number;
  test_name: string;
  passage: string;
  question_text: string | null;
  choices: { label: string; text?: string }[];
  is_fill_in_blank: boolean;
  correct_answer: string;
  rationale?: string | null;
  id: string;
  images?: { src: string; alt?: string; local?: string }[];
}
```

## Module File Counts

`src/data/Modules/` contains 245 question JSON files with 6,026 raw module records. Non-question manifest files in that directory are `failed_images.json` and `image_manifest.json`.

| Module file group | Files | Questions | Notes |
| --- | ---: | ---: | --- |
| Reading and Writing module JSON files | 147 | 3,869 | Module records mirror `reading_past.json` IDs and are grouped by test, form, and module number |
| Math module JSON files | 98 | 2,157 | Module records mirror `math_past.json` IDs and are grouped by test, form, and module number |
| All `src/data/Modules/*.json` question files | 245 | 6,026 | Counts range from 16 to 27 records per file |

## Import And Consumption Flow

`questionBank.ts` imports `math_past.json`, `reading_past.json`, and `unofficialQuestions.ts`, normalizes records into `BankQuestion`, and exposes `getBankPool`, `getAllBankQuestions`, `getBankQuestion`, count helpers, and category filters.

`officialQuestionBank.ts` imports `official_questions.ts`, normalizes those records into `BankQuestion`, and exposes official-bank helpers for the bank browse/filter/index and question pages.

`modulePracticeBank.ts` imports every module JSON file with a Vite glob, parses the module metadata from each filename, matches module question IDs to the normalized past bank, builds visible practice modules and practice sets, and exports module/practice-test helpers plus `activePastQuestionSourceIds`.
