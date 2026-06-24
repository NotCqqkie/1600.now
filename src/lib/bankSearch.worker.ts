import { MAX_TIME_SPENT_FILTER_SECONDS } from "@/lib/questionBankFilters";
import type {
  BankSearchIndexRow,
  BankSearchProgressEntry,
  BankSearchQueryRequest,
  BankSearchResult,
  BankSearchWorkerRequest,
  BankSearchWorkerResponse,
} from "@/lib/bankSearchTypes";
import type { BankSourceFilter } from "@/data/bankTypes";

const indexCache = new Map<BankSourceFilter, Promise<BankSearchIndexRow[]>>();

const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const WORD_CHARACTER_PATTERN = /[a-z0-9]/;
const WORD_TERM_PATTERN = /^[a-z0-9]+$/;

const matchesSearchTerm = (searchText: string, term: string): boolean => {
  if (!WORD_TERM_PATTERN.test(term)) return searchText.includes(term);

  let index = searchText.indexOf(term);
  while (index !== -1) {
    if (index === 0 || !WORD_CHARACTER_PATTERN.test(searchText[index - 1])) return true;
    index = searchText.indexOf(term, index + 1);
  }
  return false;
};

const loadSearchIndex = (bankSource: BankSourceFilter): Promise<BankSearchIndexRow[]> => {
  const cached = indexCache.get(bankSource);
  if (cached) return cached;

  const promise = fetch(`/generated/bank-search/${bankSource}.json`).then((response) => {
    if (!response.ok) throw new Error(`Failed to load bank search index: ${response.status}`);
    return response.json() as Promise<BankSearchIndexRow[]>;
  }).catch((error) => {
    indexCache.delete(bankSource);
    throw error;
  });
  indexCache.set(bankSource, promise);
  return promise;
};

const getEmptyProgress = (): BankSearchProgressEntry => ({
  isMarkedForReview: false,
  attempts: [],
  totalTimeSpentSeconds: 0,
});

const isSolved = (progress: BankSearchProgressEntry): boolean =>
  progress.attempts.some((attempt) => attempt.result === "correct");

const isAnsweredIncorrectly = (progress: BankSearchProgressEntry): boolean =>
  progress.attempts.length > 0 && !isSolved(progress);

const rowPassesFilters = (
  row: BankSearchIndexRow,
  request: BankSearchQueryRequest,
): boolean => {
  const filters = request.filters;
  const stableId = row[1];
  const difficulty = row[5];
  const inPracticeTests = row[8];
  const progress = request.progress[stableId] ?? getEmptyProgress();

  if (filters.difficulty.length > 0) {
    const normalizedDifficulty = (difficulty ?? "").trim().toLowerCase();
    if (!filters.difficulty.includes(normalizedDifficulty as typeof filters.difficulty[number])) return false;
  }

  if (filters.markedForReview !== "all") {
    if (filters.markedForReview === "yes" && !progress.isMarkedForReview) return false;
    if (filters.markedForReview === "no" && progress.isMarkedForReview) return false;
  }

  if (filters.solved !== "all") {
    const solved = isSolved(progress);
    if (filters.solved === "yes" && !solved) return false;
    if (filters.solved === "no" && solved) return false;
  }

  if (filters.answeredIncorrectly !== "all") {
    const incorrect = isAnsweredIncorrectly(progress);
    if (filters.answeredIncorrectly === "yes" && !incorrect) return false;
    if (filters.answeredIncorrectly === "no" && !isSolved(progress)) return false;
  }

  const [minTimeSpent, maxTimeSpent] = filters.timeSpentRange;
  if (progress.totalTimeSpentSeconds < minTimeSpent) return false;
  if (
    maxTimeSpent < MAX_TIME_SPENT_FILTER_SECONDS &&
    progress.totalTimeSpentSeconds > maxTimeSpent
  ) {
    return false;
  }

  if (filters.activeQuestions !== "all") {
    if (filters.activeQuestions === "active" && !inPracticeTests) return false;
    if (filters.activeQuestions === "exclude-active" && inPracticeTests) return false;
  }

  return true;
};

const rowToResult = (row: BankSearchIndexRow): BankSearchResult => ({
  id: row[0],
  stableId: row[1],
  sourceId: row[2],
  bankType: row[3],
  subject: row[4],
  difficulty: row[5],
  category: {
    domain: row[6],
    skill: row[7],
  },
  inPracticeTests: row[8],
  previewText: row[9],
});

const searchIndex = async (request: BankSearchQueryRequest): Promise<BankSearchResult[]> => {
  const terms = normalizeSearchText(request.query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const rows = await loadSearchIndex(request.bankSource);
  const results: BankSearchResult[] = [];

  for (const row of rows) {
    if (!rowPassesFilters(row, request)) continue;
    const searchText = row[10];
    if (terms.every((term) => matchesSearchTerm(searchText, term))) {
      results.push(rowToResult(row));
    }
  }

  return results;
};

self.onmessage = (event: MessageEvent<BankSearchWorkerRequest>) => {
  const request = event.data;

  if (request.type === "warm") {
    void loadSearchIndex(request.bankSource);
    return;
  }

  void searchIndex(request)
    .then((results) => {
      const response: BankSearchWorkerResponse = {
        type: "result",
        requestId: request.requestId,
        query: request.query,
        results,
      };
      self.postMessage(response);
    })
    .catch(() => {
      const response: BankSearchWorkerResponse = {
        type: "error",
        requestId: request.requestId,
      };
      self.postMessage(response);
    });
};
