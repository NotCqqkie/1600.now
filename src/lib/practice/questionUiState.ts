import { resolvePastStableId } from "@/data/pastIdAliases";

export interface QuestionUiState {
  answer?: string;
  checkedAnswers?: Record<string, boolean>;
  attemptCount?: number;
  status?: string;
  flagged?: boolean;
  updatedAt?: number;
}

export type QuestionUiStateMap = Record<string, QuestionUiState>;
const LEGACY_QUESTION_UI_STATE_FIELDS = ["answer", "checkedAnswers", "status", "flagged"] as const;
type LegacyQuestionUiStateField = (typeof LEGACY_QUESTION_UI_STATE_FIELDS)[number];
type SaveQuestionUiStateMapOptions = Readonly<{ notify?: boolean }>;
type SaveQuestionUiStateOptions = SaveQuestionUiStateMapOptions &
  Readonly<{ updatedAt?: number; removeLegacy?: boolean }>;

const QUESTION_UI_STATE_PREFIX = "question-ui-state:v1:";
const ANON_SUFFIX = "anon";

const QUESTION_UI_STATE_EVENT = "app-question-ui-state-change";
const LEGACY_QUESTION_UI_STATE_KEY_PATTERN = /^(.*)-(answer|checkedAnswers|status|flagged)$/;

export const questionUiStateStorageKey = (uid: string | null | undefined): string =>
  `${QUESTION_UI_STATE_PREFIX}${uid ?? ANON_SUFFIX}`;

const getStorage = (): Storage | null =>
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

const writeJson = (key: string, value: unknown): void => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
};

const legacyKey = (storageId: string, field: LegacyQuestionUiStateField): string =>
  `${storageId}-${field}`;

const parseLegacyCheckedAnswers = (raw: string | null): Record<string, boolean> | undefined => {
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

const removeLegacyQuestionUiState = (storageId: string): void => {
  const storage = getStorage();
  if (!storage) return;
  for (const field of LEGACY_QUESTION_UI_STATE_FIELDS) {
    storage.removeItem(legacyKey(storageId, field));
  }
};

export const getQuestionUiStateMap = (
  uid: string | null | undefined,
): QuestionUiStateMap => {
  const key = questionUiStateStorageKey(uid);
  const map = readJson<QuestionUiStateMap>(key, {});
  let changed = false;
  let nextMap = map;

  for (const storageId of Object.keys(map)) {
    const canonicalStorageId = resolvePastStableId(storageId);
    if (canonicalStorageId === storageId) continue;
    if (nextMap === map) nextMap = { ...map };
    const existing = nextMap[canonicalStorageId];
    const legacy = nextMap[storageId];
    nextMap[canonicalStorageId] = mergeQuestionUiStateMaps(
      { [canonicalStorageId]: legacy },
      existing ? { [canonicalStorageId]: existing } : {},
    )[canonicalStorageId];
    delete nextMap[storageId];
    changed = true;
  }

  if (changed) writeJson(key, nextMap);
  return nextMap;
};

export const saveQuestionUiStateMap = (
  uid: string | null | undefined,
  map: QuestionUiStateMap,
  options: SaveQuestionUiStateMapOptions = {},
): void => {
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

  saveQuestionUiState(storageId, legacy, uid, {
    updatedAt: legacy.updatedAt,
    removeLegacy: true,
    notify: false,
  });
  return legacy;
};

export const getQuestionUiStates = (
  storageIds: readonly string[],
  uid: string | null | undefined,
): QuestionUiStateMap => {
  const map = getQuestionUiStateMap(uid);
  const result: QuestionUiStateMap = {};
  let nextMap = map;
  const migratedStorageIds: string[] = [];

  for (const storageId of storageIds) {
    const state = nextMap[storageId];
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
    migratedStorageIds.push(storageId);
  }

  if (migratedStorageIds.length > 0) {
    saveQuestionUiStateMap(uid, nextMap, { notify: false });
    migratedStorageIds.forEach(removeLegacyQuestionUiState);
  }

  return result;
};

export const saveQuestionUiState = (
  storageId: string,
  patch: QuestionUiState,
  uid: string | null | undefined,
  options: SaveQuestionUiStateOptions = {},
): void => {
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

export const getQuestionStatus = (
  storageId: string,
  uid: string | null | undefined,
): string => getQuestionUiState(storageId, uid).status || "unanswered";

export const migrateLegacyQuestionUiState = (uid: string | null | undefined): void => {
  const storage = getStorage();
  if (!storage) return;

  const storageIds = new Set<string>();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    const match = key.startsWith(QUESTION_UI_STATE_PREFIX)
      ? null
      : key.match(LEGACY_QUESTION_UI_STATE_KEY_PATTERN);
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

export const subscribeToQuestionUiState = (callback: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(QUESTION_UI_STATE_EVENT, callback);
  return () => window.removeEventListener(QUESTION_UI_STATE_EVENT, callback);
};
