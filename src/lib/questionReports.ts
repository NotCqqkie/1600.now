import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  const trimmedOther = otherText?.trim() ?? "";
  if (reasons.length === 0 && !trimmedOther) {
    throw new Error("Pick at least one reason or describe the issue.");
  }

  const ref = doc(db, COLLECTION, questionId);
  const countsUpdate: Record<string, unknown> = {};
  for (const r of reasons) countsUpdate[`counts.${r}`] = increment(1);
  if (trimmedOther) countsUpdate["counts.other"] = increment(1);

  const existing = await getDoc(ref);
  const existingComments =
    (existing.data()?.otherComments as QuestionReport["otherComments"]) ?? [];
  const nextComments = trimmedOther
    ? [
        ...existingComments,
        { text: trimmedOther, timestamp: Date.now(), ...(userId ? { userId } : {}) },
      ]
    : existingComments;

  await setDoc(
    ref,
    {
      questionId,
      ...countsUpdate,
      totalReports: increment(1),
      lastReportedAt: serverTimestamp(),
      otherComments: nextComments,
    },
    { merge: true },
  );
};

export const getQuestionReport = async (
  questionId: string,
): Promise<QuestionReport | null> => {
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTION, questionId));
  if (!snap.exists()) return null;
  return snap.data() as QuestionReport;
};

export const listQuestionReports = async (): Promise<QuestionReport[]> => {
  if (!db) return [];
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => d.data() as QuestionReport);
};
