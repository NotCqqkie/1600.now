export interface QuestionUiState {
  answer?: string;
  checkedAnswers?: Record<string, boolean>;
  attemptCount?: number;
  status?: string;
  flagged?: boolean;
  updatedAt?: number;
}

export type QuestionUiStateMap = Record<string, QuestionUiState>;

const QUESTION_UI_STATE_PREFIX = "question-ui-state:v1:";
const ANON_SUFFIX = "anon";

export const QUESTION_UI_STATE_EVENT = "app-question-ui-state-change";

export const questionUiStateStorageKey = (uid: string | null | undefined) =>
  `${QUESTION_UI_STATE_PREFIX}${uid ?? ANON_SUFFIX}`;

const getStorage = () =>
  typeof window === "undefined" ? null : window.localStorage;

const readJson = <T>(key: string, fallback: T): T => {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
};

const legacyKey = (storageId: string, field: "answer" | "checkedAnswers" | "status" | "flagged") =>
  `${storageId}-${field}`;

const parseLegacyCheckedAnswers = (raw: string | null) => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, boolean>)
      : undefined;
  } catch {
    return undefined;
  }
};

const readLegacyQuestionUiState = (storageId: string): QuestionUiState | null => {
  const storage = getStorage();
  if (!storage) return null;

  const answer = storage.getItem(legacyKey(storageId, "answer")) ?? undefined;
  const checkedAnswers = parseLegacyCheckedAnswers(storage.getItem(legacyKey(storageId, "checkedAnswers")));
  const status = storage.getItem(legacyKey(storageId, "status")) ?? undefined;
  const flaggedRaw = storage.getItem(legacyKey(storageId, "flagged"));
  const flagged = flaggedRaw === null ? undefined : flaggedRaw === "true";

  if (
    answer === undefined &&
    checkedAnswers === undefined &&
    status === undefined &&
    flagged === undefined
  ) {
    return null;
  }

  return {
    ...(answer !== undefined ? { answer } : {}),
    ...(checkedAnswers !== undefined ? { checkedAnswers } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(flagged !== undefined ? { flagged } : {}),
    updatedAt: 0,
  };
};

const removeLegacyQuestionUiState = (storageId: string) => {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(legacyKey(storageId, "answer"));
  storage.removeItem(legacyKey(storageId, "checkedAnswers"));
  storage.removeItem(legacyKey(storageId, "status"));
  storage.removeItem(legacyKey(storageId, "flagged"));
};

export const getQuestionUiStateMap = (
  uid: string | null | undefined,
): QuestionUiStateMap => readJson<QuestionUiStateMap>(questionUiStateStorageKey(uid), {});

export const saveQuestionUiStateMap = (
  uid: string | null | undefined,
  map: QuestionUiStateMap,
  options: { notify?: boolean } = {},
) => {
  writeJson(questionUiStateStorageKey(uid), map);
  if (options.notify !== false && typeof window !== "undefined") {
    window.dispatchEvent(new Event(QUESTION_UI_STATE_EVENT));
  }
};

export const mergeQuestionUiStateMaps = (
  local: QuestionUiStateMap,
  remote: QuestionUiStateMap,
): QuestionUiStateMap => {
  const merged: QuestionUiStateMap = { ...remote };

  for (const storageId of Object.keys(local)) {
    const localState = local[storageId];
    const remoteState = merged[storageId];
    if (!remoteState) {
      merged[storageId] = localState;
      continue;
    }

    const localUpdatedAt = localState.updatedAt ?? 0;
    const remoteUpdatedAt = remoteState.updatedAt ?? 0;
    merged[storageId] =
      localUpdatedAt >= remoteUpdatedAt
        ? { ...remoteState, ...localState, updatedAt: localUpdatedAt }
        : { ...localState, ...remoteState, updatedAt: remoteUpdatedAt };
  }

  return merged;
};

export const getQuestionUiState = (
  storageId: string,
  uid: string | null | undefined,
): QuestionUiState => {
  const state = getQuestionUiStateMap(uid)[storageId];
  if (state) return state;

  const legacy = readLegacyQuestionUiState(storageId);
  if (!legacy) return {};

  saveQuestionUiState(storageId, legacy, uid, { updatedAt: legacy.updatedAt, removeLegacy: true });
  return legacy;
};

export const getQuestionUiStates = (
  storageIds: string[],
  uid: string | null | undefined,
): QuestionUiStateMap => {
  const map = getQuestionUiStateMap(uid);
  const result: QuestionUiStateMap = {};
  let nextMap = map;
  let migratedLegacy = false;

  for (const storageId of storageIds) {
    const state = map[storageId];
    if (state) {
      result[storageId] = state;
      continue;
    }

    const legacy = readLegacyQuestionUiState(storageId);
    if (!legacy) {
      result[storageId] = {};
      continue;
    }

    if (nextMap === map) nextMap = { ...map };
    nextMap[storageId] = legacy;
    result[storageId] = legacy;
    removeLegacyQuestionUiState(storageId);
    migratedLegacy = true;
  }

  if (migratedLegacy) {
    saveQuestionUiStateMap(uid, nextMap);
  }

  return result;
};

export const saveQuestionUiState = (
  storageId: string,
  patch: QuestionUiState,
  uid: string | null | undefined,
  options: { updatedAt?: number; removeLegacy?: boolean; notify?: boolean } = {},
) => {
  const map = getQuestionUiStateMap(uid);
  const updatedAt = options.updatedAt ?? Date.now();
  const nextState = {
    ...map[storageId],
    ...patch,
    updatedAt,
  };
  Object.keys(nextState).forEach((key) => {
    if (nextState[key as keyof QuestionUiState] === undefined) {
      delete nextState[key as keyof QuestionUiState];
    }
  });
  map[storageId] = nextState;
  saveQuestionUiStateMap(uid, map, { notify: options.notify });
  if (options.removeLegacy) removeLegacyQuestionUiState(storageId);
};

const answeredStatuses = new Set(["answered", "correct-first", "correct-later", "incorrect"]);

export const getQuestionStatus = (
  storageId: string,
  uid: string | null | undefined,
) => getQuestionUiState(storageId, uid).status || "unanswered";

export const getQuestionAnswered = (
  storageId: string,
  uid: string | null | undefined,
) => {
  const state = getQuestionUiState(storageId, uid);
  return Boolean(state.answer) || answeredStatuses.has(state.status || "");
};

export const isQuestionFlagged = (
  storageId: string,
  uid: string | null | undefined,
) => getQuestionUiState(storageId, uid).flagged === true;

export const migrateLegacyQuestionUiState = (uid: string | null | undefined) => {
  const storage = getStorage();
  if (!storage) return;

  const storageIds = new Set<string>();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    const match = key.match(/^(.*)-(answer|checkedAnswers|status|flagged)$/);
    if (match) storageIds.add(match[1]);
  }

  if (storageIds.size === 0) return;

  let map = getQuestionUiStateMap(uid);
  for (const storageId of storageIds) {
    const legacy = readLegacyQuestionUiState(storageId);
    if (!legacy) continue;
    map = mergeQuestionUiStateMaps(
      { [storageId]: legacy },
      map,
    );
    removeLegacyQuestionUiState(storageId);
  }
  saveQuestionUiStateMap(uid, map, { notify: false });
};

export const subscribeToQuestionUiState = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(QUESTION_UI_STATE_EVENT, callback);
  return () => window.removeEventListener(QUESTION_UI_STATE_EVENT, callback);
};
