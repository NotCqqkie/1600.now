import assert from "node:assert/strict";

import { deleteApp, initializeApp } from "firebase/app";
import {
  arrayUnion,
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getFirestore,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "now-483609";
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8089";
const [host, rawPort] = emulatorHost.split(":");
const port = Number(rawPort);
const apps = [];

const clearEmulator = async () => {
  const response = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  assert.equal(response.ok, true, `Failed to clear Firestore emulator: ${response.status}`);
};

const createClient = (uid, claims = {}) => {
  const app = initializeApp({ projectId }, `rules-${uid}-${apps.length}`);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, port, {
    mockUserToken: {
      sub: uid,
      email: `${uid}@example.test`,
      email_verified: true,
      ...claims,
    },
  });
  return db;
};

const expectDenied = async (label, operation) => {
  try {
    await operation();
  } catch (error) {
    assert.match(String(error?.code), /permission-denied/);
    process.stdout.write(`PASS ${label}\n`);
    return;
  }
  assert.fail(`${label} unexpectedly succeeded`);
};

const reportPayload = (questionId, uid, overrides = {}) => ({
  questionId,
  counts: { typo: increment(1) },
  totalReports: increment(1),
  lastReportedAt: serverTimestamp(),
  reporterIds: arrayUnion(uid),
  ...overrides,
});

const quotaPayload = (questionId, uid) => ({
  userId: uid,
  totalReports: increment(1),
  lastQuestionId: questionId,
  lastReportedAt: serverTimestamp(),
});

const createReport = (db, questionId, uid, overrides = {}) => {
  const batch = writeBatch(db);
  batch.set(
    doc(db, "question_reports", questionId),
    reportPayload(questionId, uid, overrides),
    { merge: true },
  );
  batch.set(
    doc(db, "question_report_quotas", uid),
    quotaPayload(questionId, uid),
    { merge: true },
  );
  return batch.commit();
};

const updateReportWithQuota = (db, questionId, uid, reportUpdate) => {
  const batch = writeBatch(db);
  batch.update(doc(db, "question_reports", questionId), reportUpdate);
  batch.set(
    doc(db, "question_report_quotas", uid),
    quotaPayload(questionId, uid),
    { merge: true },
  );
  return batch.commit();
};

const run = async () => {
  assert.equal(Number.isInteger(port), true, `Invalid Firestore emulator port: ${rawPort}`);
  await clearEmulator();

  const userOneId = "rules-user-one";
  const userTwoId = "rules-user-two";
  const userThreeId = "rules-user-three";
  const userOne = createClient(userOneId);
  const userTwo = createClient(userTwoId);
  const userThree = createClient(userThreeId);
  const bypassUserId = "rules-bypass-user";
  const bypassUser = createClient(bypassUserId);
  const admin = createClient("rules-admin", { admin: true });
  const questionId = "bank-past-math-deadbeef";

  await createReport(userOne, questionId, userOneId);
  process.stdout.write("PASS valid create\n");

  await expectDenied("duplicate UID rejection", () =>
    createReport(userOne, questionId, userOneId),
  );

  await createReport(userTwo, questionId, userTwoId, {
    counts: { wrongExplanation: increment(1) },
  });
  process.stdout.write("PASS second UID valid increment\n");

  const aggregate = await getDoc(doc(admin, "question_reports", questionId));
  assert.equal(aggregate.exists(), true);
  assert.deepEqual(aggregate.data().counts, { typo: 1, wrongExplanation: 1 });
  assert.equal(aggregate.data().totalReports, 2);
  assert.deepEqual(aggregate.data().reporterIds, [userOneId, userTwoId]);

  await expectDenied("report without quota rejection", () =>
    setDoc(
      doc(bypassUser, "question_reports", "bank-past-math-bad00001"),
      reportPayload("bank-past-math-bad00001", bypassUserId),
      { merge: true },
    ),
  );

  await expectDenied("quota without report rejection", () =>
    setDoc(
      doc(bypassUser, "question_report_quotas", bypassUserId),
      quotaPayload("bank-past-math-bad00002", bypassUserId),
      { merge: true },
    ),
  );

  await expectDenied("quota reset rejection", () =>
    updateDoc(doc(userOne, "question_report_quotas", userOneId), {
      totalReports: 0,
      lastQuestionId: questionId,
      lastReportedAt: serverTimestamp(),
    }),
  );

  await expectDenied("quota deletion rejection", () =>
    deleteDoc(doc(userOne, "question_report_quotas", userOneId)),
  );

  await expectDenied("one quota increment cannot authorize multiple reports", () => {
    const firstId = "bank-past-math-bad00003";
    const secondId = "bank-past-math-bad00004";
    const batch = writeBatch(bypassUser);
    batch.set(
      doc(bypassUser, "question_reports", firstId),
      reportPayload(firstId, bypassUserId),
      { merge: true },
    );
    batch.set(
      doc(bypassUser, "question_reports", secondId),
      reportPayload(secondId, bypassUserId),
      { merge: true },
    );
    batch.set(
      doc(bypassUser, "question_report_quotas", bypassUserId),
      quotaPayload(secondId, bypassUserId),
      { merge: true },
    );
    return batch.commit();
  });

  await expectDenied("arbitrary field rejection", () =>
    createReport(userOne, "bank-past-math-cafebabe", userOneId, { arbitrary: true }),
  );

  await expectDenied("invalid counter type rejection", () =>
    createReport(userOne, "bank-past-math-0123abcd", userOneId, { counts: { typo: "1" } }),
  );

  await expectDenied("oversized comment rejection", () =>
    createReport(userOne, "bank-past-math-1234abcd", userOneId, {
      counts: { other: increment(1) },
      otherComments: arrayUnion({
        text: "x".repeat(501),
        timestamp: Date.now(),
        userId: userOneId,
      }),
    }),
  );

  await expectDenied("invalid question ID rejection", () =>
    createReport(userOne, "hard-101", userOneId),
  );

  await expectDenied("counter deletion rejection", () =>
    updateReportWithQuota(userThree, questionId, userThreeId, {
      "counts.typo": deleteField(),
      totalReports: increment(1),
      lastReportedAt: serverTimestamp(),
      reporterIds: arrayUnion(userThreeId),
    }),
  );

  await expectDenied("counter decrement rejection", () =>
    updateReportWithQuota(userThree, questionId, userThreeId, {
      "counts.typo": increment(-1),
      totalReports: increment(1),
      lastReportedAt: serverTimestamp(),
      reporterIds: arrayUnion(userThreeId),
    }),
  );

  const unchanged = await getDoc(doc(admin, "question_reports", questionId));
  assert.deepEqual(unchanged.data().counts, { typo: 1, wrongExplanation: 1 });
  assert.equal(unchanged.data().totalReports, 2);

  const cappedUserId = "rules-capped-user";
  const cappedUser = createClient(cappedUserId);
  for (let index = 0; index < 200; index += 1) {
    const cappedQuestionId = `bank-unofficial-reading-${index.toString(16).padStart(8, "0")}`;
    await createReport(cappedUser, cappedQuestionId, cappedUserId);
  }
  await expectDenied("per-UID quota limit rejection", () =>
    createReport(cappedUser, "bank-unofficial-reading-000000c8", cappedUserId),
  );
  const cappedQuota = await getDoc(doc(admin, "question_report_quotas", cappedUserId));
  assert.equal(cappedQuota.data().totalReports, 200);
  process.stdout.write("Question report rules regression suite passed.\n");
};

try {
  await run();
} finally {
  await Promise.all(apps.map((app) => deleteApp(app)));
}
