# Question Bank Map

This file maps the question-bank data sources used by the app. Counts are from the current files in `src/data` and exclude non-question manifests.

## Raw Question Sources

| Path | Format | Questions | Schema / shape | Imported / consumed by |
| --- | --- | ---: | --- | --- |
| `src/data/questions/math_past.json` | JSON array | 2,157 | Past SAT question objects with `section`, `domain`, `skill`, `difficulty`, `rationale`, `id`, `testName`, `text`, `choices`, `correctAnswer`, and `type`. Multiple-choice choices use `{ id, text }`. | Imported by `src/data/questionBank.ts`, combined into the `past` bank, normalized into `BankQuestion`, and used by bank pages plus practice/module flows. |
| `src/data/questions/reading_past.json` | JSON array | 3,869 | Same past SAT question object shape as `math_past.json`, with Reading and Writing metadata. | Imported by `src/data/questionBank.ts`, combined into the `past` bank, normalized into `BankQuestion`, and used by bank pages plus practice/module flows. |
| `src/data/Modules/*.json` | JSON arrays | 6,173 across 246 question files | Module question objects with snake_case fields: `section`, `domain`, `skill`, `difficulty`, `question_number`, `test_name`, `passage`, `question_text`, `choices`, `is_fill_in_blank`, `correct_answer`, `rationale`, `id`, and optional `images`. Choices use `{ label, text }`. | Eagerly imported by `src/data/modulePracticeBank.ts` via `import.meta.glob("./Modules/*.json")`; matched back to normalized past-bank questions by `id` and used to build modules and practice sets. |
| `src/data/unofficialQuestions.ts` | TypeScript export | 15,859 | Exports `questions: Question[]` using the shared `Question` shape from `src/data/all_questions.ts`: optional metadata/category fields, `id`, `testName`, `text`, optional `image`, optional `choices`, `correctAnswer`, and `type`. | Imported by `src/data/questionBank.ts` as the `unofficial` bank, normalized into `BankQuestion`, and used by bank browse/filter/question flows. |
| `src/data/official_questions.ts` | TypeScript export | 411 | Exports `officialQuestions: Question[]` using the shared `Question` shape from `src/data/all_questions.ts`, often with `category` metadata and optional image fields. | Imported by `src/data/officialQuestionBank.ts`, normalized into that module's `BankQuestion` shape, and used by pages that include official-bank views or official lookup. |

## Derived Bank Modules

| Path | Format | Questions | Schema / shape | Imported / consumed by |
| --- | --- | ---: | --- | --- |
| `src/data/officialQuestionBank.ts` | TypeScript module | 411 derived from `official_questions.ts` | Defines the official-bank `BankQuestion` interface and normalizes official source questions into prompt, passage, choices, type, answer, rationale, images, difficulty, and category fields. | Imported by `src/pages/BankIndex.tsx`, `src/pages/BankBrowse.tsx`, `src/pages/BankFiltered.tsx`, and `src/pages/Question.tsx`. |
| `src/data/questionBank.ts` | TypeScript module | 21,885 raw questions from past + unofficial sources | Defines shared app-facing bank types (`BankQuestion`, `BankChoice`, `BankSubject`, source filters) and normalizes raw source questions into subject-specific pools with stable storage keys and category metadata. | Imported by bank pages, `src/pages/Question.tsx`, `src/pages/Analysis.tsx`, `src/pages/Home.tsx`, `src/data/modulePracticeBank.ts`, and supporting components. |
| `src/data/modulePracticeBank.ts` | TypeScript module | 6,173 raw module questions before filtering/replacement | Defines `PracticeModule`, `PracticeSet`, and replacement metadata. Converts raw module JSON into visible modules and practice sets by matching module question IDs to normalized past-bank questions. | Imported by modules, module review/results, practice test start/transition/review/results, navigation/session libs, and `src/pages/Question.tsx`. |

## Supporting Types

| Path | Format | Questions | Schema / shape | Imported / consumed by |
| --- | --- | ---: | --- | --- |
| `src/data/all_questions.ts` | TypeScript types | 0 | Defines the shared raw `Question` and `QuestionCategory` TypeScript interfaces. It intentionally contains no question data. | Imported by module `.ts` data files and bank normalizers for source typing. |

## Module File Notes

- `src/data/Modules/` contains 246 JSON question files consumed by `modulePracticeBank.ts`.
- `src/data/Modules/image_manifest.json` is not a question source and is excluded from the count above.
- `src/data/Modules/` also contains 245 legacy TypeScript module files with question arrays. They are not consumed by `modulePracticeBank.ts`, which only imports `./Modules/*.json`.
- `src/data/official_questions.json` is referenced in the queue/rules as a possible source, but it is not present in this checkout; the current official source is `src/data/official_questions.ts`.

## Consumer Summary

- General bank browsing and filtering flows use `src/data/questionBank.ts`.
- Official-bank views use `src/data/officialQuestionBank.ts`.
- Full module and practice-test flows use `src/data/modulePracticeBank.ts`.
- Future audits that edit raw question text or answer data should target the raw source files listed above, not the derived bank modules.
