# 1600 Prep Hub

This repo is organized around the React app in `src/`, source datasets in `src/data/`, raw import material in `data/raw/`, app assets in `public/` and `src/assets/`, and maintenance scripts in `scripts/`.

## Structure

- `src/`: application code
- `src/data/Modules/`: source SAT module files that feed `src/data/all_questions.ts`
- `public/images/`: runtime SAT image assets
- `docs/`: setup and deployment notes
- `scripts/`: one-off maintenance, migration, and audit scripts
- `scripts/reports/`: generated audit output
- `data/raw/`: raw source files used by import/generation scripts

## Notes

- The live bank question route is `src/pages/Question.tsx`.
- `dist/` is build output and should not be treated as source.
- Root-level generated duplicates and stale helper files have been removed to keep navigation focused on real source files.

