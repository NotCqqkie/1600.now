export type BankSubject = "math" | "reading";
export type BankSourceId = "past" | "unofficial";
export type BankSourceFilter = BankSourceId | "all";

export const BANK_SOURCE_LABELS: Record<BankSourceFilter, string> = {
  unofficial: "Unofficial Bank",
  past: "Past SAT-based",
  all: "Both Banks",
};

export const DEFAULT_BANK_SOURCE: BankSourceFilter = "all";

export const normalizeBankSource = (value: string | null | undefined): BankSourceFilter => {
  if (value === "all") return "all";
  if (value === "past") return "past";
  if (value === "unofficial") return "unofficial";
  return DEFAULT_BANK_SOURCE;
};

export const buildBankQuestionKey = (
  bankType: BankSourceId,
  subject: BankSubject,
  sourceId: string,
): string => `bank-${bankType}-${subject}-${sourceId}`;
