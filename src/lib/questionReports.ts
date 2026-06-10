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

export type ReportCounts = Partial<Record<ReportReasonKey, number>> & {
  other?: number;
};

export interface QuestionReport {
  questionId: string;
  counts: ReportCounts;
  otherComments?: { text: string; timestamp: number; userId?: string }[];
  totalReports: number;
  lastReportedAt?: number;
}

const COLLECTION = "question_reports";

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
  const countsUpdate: Record<string, unknown> = {};
  for (const r of reasons) countsUpdate[`counts.${r}`] = increment(1);
  if (trimmedOther) countsUpdate["counts.other"] = increment(1);

  const payload: Record<string, unknown> = {
    questionId,
    ...countsUpdate,
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
    return snap.data() as QuestionReport;
  } catch (err) {
    if (err instanceof FirestoreError && err.code === "permission-denied") return null;
    throw err;
  }
};

export const listQuestionReports = async (): Promise<QuestionReport[]> => {
  if (!db) return [];
  const reportsQuery = query(collection(db, COLLECTION), orderBy("lastReportedAt", "desc"));
  const snap = await getDocs(reportsQuery);
  return snap.docs.map((docSnap) => docSnap.data() as QuestionReport);
};
