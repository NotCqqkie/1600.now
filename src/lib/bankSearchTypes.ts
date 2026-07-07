import type { BankSourceFilter, BankSourceId, BankSubject } from "@/data/bankTypes";
import type { QuestionBankFilters } from "@/lib/questionBankFilters";

export type BankSearchDifficulty = "Easy" | "Medium" | "Hard" | null;

export type BankSearchIndexRow = readonly [
  id: number,
  stableId: string,
  sourceId: string,
  bankType: BankSourceId,
  subject: BankSubject,
  difficulty: BankSearchDifficulty,
  domain: string,
  skill: string,
  inPracticeTests: boolean,
  previewText: string,
  searchText: string,
  scoreBand: number | null,
];

export interface BankSearchResult {
  id: number;
  stableId: string;
  sourceId: string;
  bankType: BankSourceId;
  subject: BankSubject;
  difficulty: BankSearchDifficulty;
  scoreBand: number | null;
  category: {
    domain: string;
    skill: string;
  };
  inPracticeTests: boolean;
  previewText: string;
}

export interface BankSearchProgressEntry {
  isMarkedForReview: boolean;
  attempts: readonly { result: "correct" | "incorrect" }[];
  totalTimeSpentSeconds: number;
}

export interface BankSearchWarmRequest {
  type: "warm";
  bankSource: BankSourceFilter;
}

export interface BankSearchQueryRequest {
  type: "query";
  requestId: number;
  bankSource: BankSourceFilter;
  query: string;
  filters: QuestionBankFilters;
  progress: Record<string, BankSearchProgressEntry | undefined>;
}

export type BankSearchWorkerRequest = BankSearchWarmRequest | BankSearchQueryRequest;

export interface BankSearchQueryResponse {
  type: "result";
  requestId: number;
  query: string;
  results: BankSearchResult[];
}

export interface BankSearchErrorResponse {
  type: "error";
  requestId: number;
}

export type BankSearchWorkerResponse = BankSearchQueryResponse | BankSearchErrorResponse;
