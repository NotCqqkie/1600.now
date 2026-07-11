import {
  arrayUnion,
  collection,
  doc,
  type DocumentData,
  FirestoreError,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  serverTimestamp,
  startAfter,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase/firebaseDb";
import { initializeFirebaseAppCheck } from "@/lib/firebase/firebaseApp";

export const REPORT_REASONS = [
  { key: "incorrectAnswer", label: "Incorrect answer" },
  { key: "incorrectQuestion", label: "Incorrect question" },
  { key: "missingImage", label: "Missing / broken image" },
  { key: "corrupted", label: "Corrupted or unreadable content" },
  { key: "typo", label: "Typo or formatting error" },
  { key: "wrongExplanation", label: "Wrong or unclear explanation" },
] as const;

export type ReportReasonKey = (typeof REPORT_REASONS)[number]["key"];

export type ReportCounts = Partial<Record<ReportReasonKey, number>> & {
  other?: number;
};

type FirestoreTimestampLike = {
  seconds: number;
};

export interface QuestionReport {
  questionId: string;
  counts: ReportCounts;
  otherComments?: { text: string; timestamp: number; userId?: string }[];
  totalReports: number;
  lastReportedAt?: number | FirestoreTimestampLike;
}

const COLLECTION = "question_reports";
const QUOTA_COLLECTION = "question_report_quotas";
const MAX_COMMENT_LENGTH = 500;
const MAX_COMMENTS_PER_REPORT = 100;
export const QUESTION_REPORT_PAGE_SIZE = 50;
const REPORT_REASON_KEYS = [...REPORT_REASONS.map((reason) => reason.key), "other"] as const;
const REPORT_REASON_KEY_SET = new Set<string>(REPORT_REASON_KEYS);
const QUESTION_REPORT_ID_PATTERN = /^(?:hard-(?:[1-9]|[1-9]\d|100)|bank-(?:past|unofficial)-(?:math|reading)-[0-9a-f]{8})$/;

type ReportReasonWithOther = ReportReasonKey | "other";
type UnknownRecord = Record<string, unknown>;

export type QuestionReportCursor = QueryDocumentSnapshot<DocumentData>;

export interface QuestionReportPage {
  reports: QuestionReport[];
  cursor: QuestionReportCursor | null;
  hasMore: boolean;
}

const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const asNonNegativeInteger = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;

export const isValidQuestionReportId = (questionId: string): boolean =>
  QUESTION_REPORT_ID_PATTERN.test(questionId);

const normalizeReasonKeys = (reasons: readonly ReportReasonKey[]): ReportReasonKey[] =>
  Array.from(new Set(reasons)).filter((reason) => REPORT_REASON_KEY_SET.has(reason));

export const buildQuestionReportCountMap = <T,>(
  reasons: readonly ReportReasonKey[],
  includeOther: boolean,
  value: T,
): Partial<Record<ReportReasonWithOther, T>> => {
  const counts: Partial<Record<ReportReasonWithOther, T>> = {};
  for (const reason of normalizeReasonKeys(reasons)) counts[reason] = value;
  if (includeOther) counts.other = value;
  return counts;
};

const normalizeCounts = (data: UnknownRecord): ReportCounts => {
  const nested = isRecord(data.counts) ? data.counts : {};
  const counts: ReportCounts = {};
  for (const key of REPORT_REASON_KEYS) {
    const nestedValue = asNonNegativeInteger(nested[key]) ?? 0;
    const legacyValue = asNonNegativeInteger(data[`counts.${key}`]) ?? 0;
    const combined = nestedValue + legacyValue;
    if (combined > 0 && Number.isSafeInteger(combined)) counts[key] = combined;
  }
  return counts;
};

const normalizeComment = (
  value: unknown,
): { text: string; timestamp: number; userId?: string } | null => {
  if (!isRecord(value) || typeof value.text !== "string") return null;
  const text = value.text.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!text) return null;
  const timestamp = asNonNegativeInteger(value.timestamp);
  if (timestamp === undefined || timestamp === 0) return null;
  const userId = typeof value.userId === "string" && value.userId.length <= 128
    ? value.userId
    : undefined;
  return { text, timestamp, ...(userId ? { userId } : {}) };
};

const normalizeLastReportedAt = (
  value: unknown,
): number | FirestoreTimestampLike | undefined => {
  const numberValue = asNonNegativeInteger(value);
  if (numberValue !== undefined) return numberValue;
  if (!isRecord(value) || typeof value.seconds !== "number" || !Number.isFinite(value.seconds)) {
    return undefined;
  }
  return { seconds: value.seconds };
};

export const normalizeQuestionReport = (
  value: unknown,
  fallbackQuestionId: string,
): QuestionReport => {
  const data = isRecord(value) ? value : {};
  const questionId = typeof data.questionId === "string"
    && data.questionId === fallbackQuestionId
    && isValidQuestionReportId(data.questionId)
    ? data.questionId
    : fallbackQuestionId;
  const comments = Array.isArray(data.otherComments)
    ? data.otherComments
        .slice(0, MAX_COMMENTS_PER_REPORT)
        .map(normalizeComment)
        .filter((comment): comment is NonNullable<ReturnType<typeof normalizeComment>> => comment !== null)
    : [];
  const lastReportedAt = normalizeLastReportedAt(data.lastReportedAt);
  return {
    questionId,
    counts: normalizeCounts(data),
    totalReports: asNonNegativeInteger(data.totalReports) ?? 0,
    ...(comments.length ? { otherComments: comments } : {}),
    ...(lastReportedAt === undefined ? {} : { lastReportedAt }),
  };
};

export const submitQuestionReport = async (args: {
  questionId: string;
  reasons: ReportReasonKey[];
  otherText?: string;
  userId?: string;
}): Promise<void> => {
  if (!db) throw new Error("Reporting is unavailable right now.");
  initializeFirebaseAppCheck();
  const { questionId, reasons, otherText, userId } = args;
  if (!isValidQuestionReportId(questionId)) throw new Error("This question cannot be reported.");
  if (!userId) throw new Error("Sign in to report a question.");
  const validReasons = normalizeReasonKeys(reasons);
  const trimmedOther = (otherText?.trim() ?? "").slice(0, MAX_COMMENT_LENGTH);
  if (validReasons.length === 0 && !trimmedOther) {
    throw new Error("Pick at least one reason or describe the issue.");
  }

  const ref = doc(db, COLLECTION, questionId);
  const countsUpdate = buildQuestionReportCountMap(
    validReasons,
    Boolean(trimmedOther),
    increment(1),
  );

  const payload: Record<string, unknown> = {
    questionId,
    counts: countsUpdate,
    totalReports: increment(1),
    lastReportedAt: serverTimestamp(),
    reporterIds: arrayUnion(userId),
  };
  if (trimmedOther) {
    payload.otherComments = arrayUnion({
      text: trimmedOther,
      timestamp: Date.now(),
      ...(userId ? { userId } : {}),
    });
  }

  try {
    const batch = writeBatch(db);
    batch.set(ref, payload, { merge: true });
    batch.set(doc(db, QUOTA_COLLECTION, userId), {
      userId,
      totalReports: increment(1),
      lastQuestionId: questionId,
      lastReportedAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();
  } catch (err) {
    if (err instanceof FirestoreError && err.code === "permission-denied") {
      throw new Error(
        "This report could not be submitted. You may already have reported this question or reached the report limit.",
      );
    }
    throw err;
  }
};

export const getQuestionReport = async (
  questionId: string,
): Promise<QuestionReport | null> => {
  if (!db) return null;
  initializeFirebaseAppCheck();
  try {
    const snap = await getDoc(doc(db, COLLECTION, questionId));
    if (!snap.exists()) return null;
    return normalizeQuestionReport(snap.data(), snap.id);
  } catch (err) {
    if (err instanceof FirestoreError && err.code === "permission-denied") return null;
    throw err;
  }
};

export const listQuestionReportsPage = async (
  cursor: QuestionReportCursor | null = null,
  pageSize = QUESTION_REPORT_PAGE_SIZE,
): Promise<QuestionReportPage> => {
  if (!db) return { reports: [], cursor: null, hasMore: false };
  initializeFirebaseAppCheck();
  const boundedPageSize = Number.isFinite(pageSize)
    ? Math.min(100, Math.max(1, Math.floor(pageSize)))
    : QUESTION_REPORT_PAGE_SIZE;
  const reportsQuery = cursor
    ? query(
        collection(db, COLLECTION),
        orderBy("lastReportedAt", "desc"),
        startAfter(cursor),
        limit(boundedPageSize + 1),
      )
    : query(
        collection(db, COLLECTION),
        orderBy("lastReportedAt", "desc"),
        limit(boundedPageSize + 1),
      );
  const snap = await getDocs(reportsQuery);
  const visibleDocs = snap.docs.slice(0, boundedPageSize);
  return {
    reports: visibleDocs.map((docSnap) => normalizeQuestionReport(docSnap.data(), docSnap.id)),
    cursor: visibleDocs[visibleDocs.length - 1] ?? null,
    hasMore: snap.docs.length > boundedPageSize,
  };
};
