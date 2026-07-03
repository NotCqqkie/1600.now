import {
  arrayUnion,
  collection,
  doc,
  FirestoreError,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase/firebaseDb";

export const REPORT_REASONS = [
  { key: "incorrectAnswer", label: "Incorrect answer" },
  { key: "incorrectQuestion", label: "Incorrect question" },
  { key: "missingImage", label: "Missing / broken image" },
  { key: "corrupted", label: "Corrupted or unreadable content" },
  { key: "typo", label: "Typo or formatting error" },
  { key: "wrongExplanation", label: "Wrong or unclear explanation" },
] as const;

export type ReportReasonKey = (typeof REPORT_REASONS)[number]["key"];

type ReportCounts = Partial<Record<ReportReasonKey, number>> & {
  other?: number;
};

type FirestoreTimestampLike = {
  seconds: number;
};

type ReportData = Record<string, unknown> & {
  counts?: Partial<Record<ReportReasonKey | "other", unknown>>;
};

export interface QuestionReport {
  questionId: string;
  counts: ReportCounts;
  otherComments?: { text: string; timestamp: number; userId?: string }[];
  totalReports: number;
  lastReportedAt?: number | FirestoreTimestampLike;
}

const COLLECTION = "question_reports";
const REPORT_REASON_KEYS = [...REPORT_REASONS.map((reason) => reason.key), "other"] as const;

const normalizeReport = (data: ReportData): QuestionReport => {
  const counts: ReportCounts = {};
  for (const key of REPORT_REASON_KEYS) {
    const nested = data.counts?.[key];
    const legacy = data[`counts.${key}`];
    const value = typeof nested === "number" ? nested : legacy;
    if (typeof value === "number") counts[key] = value;
  }

  return {
    ...(data as unknown as QuestionReport),
    counts,
  };
};

export const submitQuestionReport = async (args: {
  questionId: string;
  reasons: ReportReasonKey[];
  otherText?: string;
  userId?: string;
}): Promise<void> => {
  if (!db) throw new Error("Reporting is unavailable right now.");
  const { questionId, reasons, otherText, userId } = args;
  const trimmedOther = (otherText?.trim() ?? "").slice(0, 500);
  if (reasons.length === 0 && !trimmedOther) {
    throw new Error("Pick at least one reason or describe the issue.");
  }

  const ref = doc(db, COLLECTION, questionId);
  const countsUpdate: Partial<Record<ReportReasonKey | "other", ReturnType<typeof increment>>> =
    {};
  for (const r of reasons) countsUpdate[r] = increment(1);
  if (trimmedOther) countsUpdate.other = increment(1);

  const payload: Record<string, unknown> = {
    questionId,
    counts: countsUpdate,
    totalReports: increment(1),
    lastReportedAt: serverTimestamp(),
  };
  if (trimmedOther) {
    payload.otherComments = arrayUnion({
      text: trimmedOther,
      timestamp: Date.now(),
      ...(userId ? { userId } : {}),
    });
  }

  try {
    await setDoc(ref, payload, { merge: true });
  } catch (err) {
    if (err instanceof FirestoreError && err.code === "permission-denied") {
      throw new Error(
        "You need to be signed in to report a question. Sign in and try again.",
      );
    }
    throw err;
  }
};

export const getQuestionReport = async (
  questionId: string,
): Promise<QuestionReport | null> => {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTION, questionId));
    if (!snap.exists()) return null;
    return normalizeReport(snap.data() as ReportData);
  } catch (err) {
    if (err instanceof FirestoreError && err.code === "permission-denied") return null;
    throw err;
  }
};

export const listQuestionReports = async (): Promise<QuestionReport[]> => {
  if (!db) return [];
  const reportsQuery = query(collection(db, COLLECTION), orderBy("lastReportedAt", "desc"));
  const snap = await getDocs(reportsQuery);
  return snap.docs.map((docSnap) => normalizeReport(docSnap.data() as ReportData));
};
