export type AnalyticsConsent = "granted" | "denied" | "unset";

const CONSENT_STORAGE_KEY = "analytics-consent";
const ANALYTICS_ORIGIN = "https://1600.now";
const CAMPAIGN_PARAMETERS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
const CAMPAIGN_VALUE_PATTERN = /^[a-z0-9][a-z0-9._~-]{0,99}$/i;
let sessionConsent: AnalyticsConsent | null = null;
let desiredUserId: string | null = null;
let latestPagePath: string | null = null;
let lastQueuedPagePath: string | null = null;
let lastSentPagePath: string | null = null;
let previousPageLocation: string | null = null;
let pageViewQueue = Promise.resolve();
const pendingPracticeCompletionIds = new Set<string>();
const trackedPracticeCompletionIds = new Set<string>();

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return "unset";
  if (sessionConsent) return sessionConsent;
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored === "granted" || stored === "denied") return stored;
  } catch {
    // localStorage may be unavailable (private mode, blocked cookies)
  }
  return "unset";
}

const toAnalyticsStorageConsent = (
  consent: AnalyticsConsent,
): Exclude<AnalyticsConsent, "unset"> =>
  consent === "denied" ? "denied" : "granted";

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, "unset">): void {
  if (typeof window === "undefined") return;
  sessionConsent = consent;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);
  } catch {
    // ignore persistence failures
  }
  if (consent === "granted") {
    void initAnalytics().then(() => {
      if (latestPagePath && lastSentPagePath !== latestPagePath) {
        lastQueuedPagePath = null;
        queuePageView(latestPagePath);
      }
    });
  } else {
    void import("@/lib/firebase/firebaseAnalytics").then((module) => {
      module.disableAnalyticsCollectionIfInitialized();
    });
  }
}

const loadAnalyticsBundle = async () => {
  const consent = getAnalyticsConsent();
  if (consent === "denied") return null;
  const { getAnalyticsPromise } = await import("@/lib/firebase/firebaseAnalytics");
  const initialStorageConsent = toAnalyticsStorageConsent(consent);
  let bundle = await getAnalyticsPromise(initialStorageConsent);
  const currentConsent = getAnalyticsConsent();
  if (currentConsent === "denied") {
    const { disableAnalyticsCollectionIfInitialized } = await import("@/lib/firebase/firebaseAnalytics");
    disableAnalyticsCollectionIfInitialized();
    return null;
  }
  const currentStorageConsent = toAnalyticsStorageConsent(currentConsent);
  if (currentStorageConsent !== initialStorageConsent) {
    bundle = await getAnalyticsPromise(currentStorageConsent);
  }
  return bundle;
};

export async function initAnalytics(): Promise<void> {
  const bundle = await loadAnalyticsBundle();
  if (!bundle) return;
  bundle.setUserId(
    bundle.analytics,
    getAnalyticsConsent() === "granted" ? desiredUserId : null,
  );
}

async function trackEvent(
  name: string,
  params?: Record<string, unknown>,
): Promise<boolean> {
  let bundle: Awaited<ReturnType<typeof loadAnalyticsBundle>>;
  try {
    bundle = await loadAnalyticsBundle();
  } catch {
    return false;
  }
  if (!bundle || getAnalyticsConsent() === "denied") return false;
  try {
    bundle.logEvent(bundle.analytics, name, params);
    return true;
  } catch {
    return false;
  }
}

export async function identifyUser(userId: string | null): Promise<void> {
  desiredUserId = userId;
  if (getAnalyticsConsent() !== "granted") return;
  const bundle = await loadAnalyticsBundle();
  if (!bundle || getAnalyticsConsent() !== "granted") return;
  bundle.setUserId(bundle.analytics, desiredUserId);
}

export function sanitizeAnalyticsPagePath(pagePath: string): string {
  let parsed: URL;
  try {
    parsed = new URL(pagePath, ANALYTICS_ORIGIN);
  } catch {
    return "/";
  }
  const sanitized = new URLSearchParams();
  for (const key of CAMPAIGN_PARAMETERS) {
    const value = parsed.searchParams.get(key)?.trim();
    if (value && CAMPAIGN_VALUE_PATTERN.test(value)) sanitized.set(key, value);
  }
  const pathname = parsed.pathname.startsWith("/") ? parsed.pathname : `/${parsed.pathname}`;
  const query = sanitized.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const analyticsPageLocation = (pagePath: string) => {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : ANALYTICS_ORIGIN;
  return new URL(pagePath, origin).toString();
};

const queuePageView = (pagePath: string) => {
  if (lastQueuedPagePath === pagePath) return;
  lastQueuedPagePath = pagePath;
  const sendPageView = async () => {
    const pageLocation = analyticsPageLocation(pagePath);
    const sent = await trackEvent("page_view", {
      page_path: pagePath,
      page_location: pageLocation,
      page_title: typeof document !== "undefined" ? document.title : undefined,
      ...(previousPageLocation ? { page_referrer: previousPageLocation } : {}),
    });
    if (!sent) return;
    lastSentPagePath = pagePath;
    previousPageLocation = pageLocation;
  };
  pageViewQueue = pageViewQueue.then(sendPageView, sendPageView);
};

export function trackPageView(pagePath: string): void {
  const sanitizedPagePath = sanitizeAnalyticsPagePath(pagePath);
  latestPagePath = sanitizedPagePath;
  queuePageView(sanitizedPagePath);
}

export function trackLogin(method: "password" | "google"): void {
  void trackEvent("login", { method });
}

export function trackSignUp(method: "password" | "google"): void {
  void trackEvent("sign_up", { method });
}

export function buildAppErrorAnalytics(
  message: string,
  params?: Record<string, unknown>,
): Record<string, unknown> {
  const normalizedMessage = message.toLowerCase();
  const errorType = /chunk|dynamically imported module/.test(normalizedMessage)
    ? "chunk_load"
    : /network|fetch|offline/.test(normalizedMessage)
      ? "network"
      : /permission|unauthorized|forbidden/.test(normalizedMessage)
        ? "permission"
        : /timeout|timed out/.test(normalizedMessage)
          ? "timeout"
          : params?.source === "error_boundary"
            ? "render"
            : "unknown";
  const source = ["unhandledrejection", "window_error", "error_boundary"].includes(
    String(params?.source),
  )
    ? String(params?.source)
    : "unknown";
  return { error_type: errorType, source };
}

export function trackAppError(message: string, params?: Record<string, unknown>): void {
  if (getAnalyticsConsent() !== "granted") return;
  void trackEvent("app_error", buildAppErrorAnalytics(message, params));
}

const analyticsInteger = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
};

const analyticsEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | "unknown" => allowed.includes(value as T) ? value as T : "unknown";

export type AnalyticsSubject = "math" | "reading_writing" | "mixed";
export type PracticeType = "question_bank" | "practice_set" | "module" | "practice_test";
export type PracticeEntryPoint = "bank" | "modules" | "study_plan" | "results" | "direct";
export type PracticeCompletionStatus = "completed" | "abandoned" | "timed_out";
export type AnalyticsAccuracyBand = "below_50" | "50_74" | "75_89" | "90_100";
export type AnalyticsDurationBand = "under_5m" | "5_14m" | "15_29m" | "30_59m" | "60m_plus";
export type AnalyticsTool =
  | "score_calculator"
  | "sat_to_act"
  | "percentile_calculator"
  | "psat_predictor"
  | "study_plan_generator"
  | "score_goal_finder"
  | "sat_countdown";

type PracticeContext = {
  practiceType: PracticeType;
  subject: AnalyticsSubject;
};

export const toAnalyticsAccuracyBand = (accuracy: number): AnalyticsAccuracyBand => {
  if (!Number.isFinite(accuracy) || accuracy < 50) return "below_50";
  if (accuracy < 75) return "50_74";
  if (accuracy < 90) return "75_89";
  return "90_100";
};

export const toAnalyticsDurationBand = (durationSeconds: number): AnalyticsDurationBand => {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 300) return "under_5m";
  if (durationSeconds < 900) return "5_14m";
  if (durationSeconds < 1_800) return "15_29m";
  if (durationSeconds < 3_600) return "30_59m";
  return "60m_plus";
};

const hasPersistentAnalyticsMarker = (key: string) => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const setPersistentAnalyticsMarker = (key: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    return;
  }
};

export function buildPracticeStartAnalytics(
  params: PracticeContext & { entryPoint: PracticeEntryPoint },
): Record<string, unknown> {
  return {
    practice_type: analyticsEnum(params.practiceType, ["question_bank", "practice_set", "module", "practice_test"]),
    subject: analyticsEnum(params.subject, ["math", "reading_writing", "mixed"]),
    entry_point: analyticsEnum(params.entryPoint, ["bank", "modules", "study_plan", "results", "direct"]),
  };
}

export function trackPracticeStart(
  params: Parameters<typeof buildPracticeStartAnalytics>[0],
): void {
  void trackEvent("practice_start", buildPracticeStartAnalytics(params));
}

export function buildAnswerSubmitAnalytics(
  params: PracticeContext & { isCorrect: boolean; attempt: "first" | "retry" },
): Record<string, unknown> {
  return {
    practice_type: analyticsEnum(params.practiceType, ["question_bank", "practice_set", "module", "practice_test"]),
    subject: analyticsEnum(params.subject, ["math", "reading_writing", "mixed"]),
    is_correct: params.isCorrect === true,
    attempt: analyticsEnum(params.attempt, ["first", "retry"]),
  };
}

export function trackAnswerSubmit(
  params: Parameters<typeof buildAnswerSubmitAnalytics>[0],
): void {
  void trackEvent("answer_submit", buildAnswerSubmitAnalytics(params));
}

export function buildPracticeCompleteAnalytics(
  params: PracticeContext & {
    status: PracticeCompletionStatus;
    accuracyBand?: AnalyticsAccuracyBand;
    durationBand: AnalyticsDurationBand;
  },
): Record<string, unknown> {
  return {
    practice_type: analyticsEnum(params.practiceType, ["question_bank", "practice_set", "module", "practice_test"]),
    subject: analyticsEnum(params.subject, ["math", "reading_writing", "mixed"]),
    status: analyticsEnum(params.status, ["completed", "abandoned", "timed_out"]),
    duration_band: analyticsEnum(params.durationBand, ["under_5m", "5_14m", "15_29m", "30_59m", "60m_plus"]),
    ...(params.accuracyBand === undefined
      ? {}
      : { accuracy_band: analyticsEnum(params.accuracyBand, ["below_50", "50_74", "75_89", "90_100"]) }),
  };
}

export function trackPracticeComplete(
  params: Parameters<typeof buildPracticeCompleteAnalytics>[0] & { completionId?: string },
): void {
  const completionId = params.completionId?.trim();
  const storageKey = completionId
    ? `analytics:practice_complete:${completionId}`
    : null;
  if (completionId) {
    if (
      pendingPracticeCompletionIds.has(completionId) ||
      trackedPracticeCompletionIds.has(completionId)
    ) return;
    if (storageKey && hasPersistentAnalyticsMarker(storageKey)) {
      trackedPracticeCompletionIds.add(completionId);
      return;
    }
    pendingPracticeCompletionIds.add(completionId);
  }
  void trackEvent("practice_complete", buildPracticeCompleteAnalytics(params)).then((sent) => {
    if (!completionId) return;
    pendingPracticeCompletionIds.delete(completionId);
    if (!sent) return;
    trackedPracticeCompletionIds.add(completionId);
    if (storageKey) setPersistentAnalyticsMarker(storageKey);
  });
}

export function buildToolCompleteAnalytics(params: {
  tool: AnalyticsTool;
  outcome: "success" | "invalid_input" | "cancelled" | "error";
}): Record<string, unknown> {
  return {
    tool: analyticsEnum(params.tool, [
      "score_calculator",
      "sat_to_act",
      "percentile_calculator",
      "psat_predictor",
      "study_plan_generator",
      "score_goal_finder",
      "sat_countdown",
    ]),
    outcome: analyticsEnum(params.outcome, ["success", "invalid_input", "cancelled", "error"]),
  };
}

export function trackToolComplete(
  params: Parameters<typeof buildToolCompleteAnalytics>[0],
): void {
  void trackEvent("tool_complete", buildToolCompleteAnalytics(params));
}

export type StudyPlanUploadFormat = "pdf" | "image";
export type StudyPlanUploadOutcome =
  | "success"
  | "cancelled"
  | "unsupported"
  | "too_large"
  | "too_many_pages"
  | "too_many_pixels"
  | "parse_error";
export type StudyPlanTaskActionKind =
  | "lesson"
  | "missed-review"
  | "timed-set"
  | "module"
  | "checklist";
export type StudyPlanTimingMode = "untimed" | "countdown" | "module" | "offline";

export function trackStudyPlanUpload(params: {
  format: StudyPlanUploadFormat;
  outcome: StudyPlanUploadOutcome;
  durationMs: number;
}): void {
  void trackEvent("study_plan_upload", buildStudyPlanUploadAnalytics(params));
}

export function buildStudyPlanUploadAnalytics(
  params: Parameters<typeof trackStudyPlanUpload>[0],
): Record<string, unknown> {
  return {
    report_format: analyticsEnum(params.format, ["pdf", "image"]),
    outcome: analyticsEnum(params.outcome, [
      "success",
      "cancelled",
      "unsupported",
      "too_large",
      "too_many_pages",
      "too_many_pixels",
      "parse_error",
    ]),
    duration_ms: analyticsInteger(params.durationMs, 0, 600_000),
  };
}

export function trackStudyPlanSaved(params: {
  mode: "create" | "edit";
  taskCount: number;
  planLengthDays: number;
  minutesPerDay: number;
  hasScoreReport: boolean;
  storage: "anonymous" | "account";
}): void {
  void trackEvent(
    params.mode === "create" ? "study_plan_created" : "study_plan_updated",
    buildStudyPlanSavedAnalytics(params),
  );
}

export function buildStudyPlanSavedAnalytics(
  params: Parameters<typeof trackStudyPlanSaved>[0],
): Record<string, unknown> {
  return {
    mode: analyticsEnum(params.mode, ["create", "edit"]),
    task_count: analyticsInteger(params.taskCount, 0, 1_000),
    plan_length_days: analyticsInteger(params.planLengthDays, 0, 730),
    minutes_per_day: analyticsInteger(params.minutesPerDay, 0, 240),
    has_score_report: params.hasScoreReport === true,
    storage: analyticsEnum(params.storage, ["anonymous", "account"]),
  };
}

export function trackStudyPlanTaskLaunch(params: {
  actionKind: StudyPlanTaskActionKind;
  timingMode: StudyPlanTimingMode;
  overdue: boolean;
}): void {
  void trackEvent("study_plan_task_launch", buildStudyPlanTaskLaunchAnalytics(params));
}

export function buildStudyPlanTaskLaunchAnalytics(
  params: Parameters<typeof trackStudyPlanTaskLaunch>[0],
): Record<string, unknown> {
  return {
    action_kind: analyticsEnum(params.actionKind, ["lesson", "missed-review", "timed-set", "module", "checklist"]),
    timing_mode: analyticsEnum(params.timingMode, ["untimed", "countdown", "module", "offline"]),
    overdue: params.overdue === true,
  };
}

export function trackStudyPlanTaskCompletion(params: {
  actionKind: StudyPlanTaskActionKind;
  timingMode: StudyPlanTimingMode;
  accuracyBand?: "below_50" | "50_74" | "75_89" | "90_100";
  elapsedMinutes?: number;
}): void {
  void trackEvent("study_plan_task_completion", buildStudyPlanTaskCompletionAnalytics(params));
}

export function buildStudyPlanTaskCompletionAnalytics(
  params: Parameters<typeof trackStudyPlanTaskCompletion>[0],
): Record<string, unknown> {
  return {
    action_kind: analyticsEnum(params.actionKind, ["lesson", "missed-review", "timed-set", "module", "checklist"]),
    timing_mode: analyticsEnum(params.timingMode, ["untimed", "countdown", "module", "offline"]),
    ...(params.accuracyBand === undefined
      ? {}
      : { accuracy_band: analyticsEnum(params.accuracyBand, ["below_50", "50_74", "75_89", "90_100"]) }),
    ...(params.elapsedMinutes === undefined
      ? {}
      : { elapsed_minutes: analyticsInteger(params.elapsedMinutes, 0, 240) }),
  };
}

export function trackStudyPlanRebalance(params: {
  decision: "apply" | "cancel";
  changeCount: number;
}): void {
  void trackEvent("study_plan_rebalance", buildStudyPlanRebalanceAnalytics(params));
}

export function buildStudyPlanRebalanceAnalytics(
  params: Parameters<typeof trackStudyPlanRebalance>[0],
): Record<string, unknown> {
  return {
    decision: analyticsEnum(params.decision, ["apply", "cancel"]),
    change_count: analyticsInteger(params.changeCount, 0, 100),
  };
}

export function trackStudyPlanCalendarNavigation(params: {
  action: "previous" | "next" | "today" | "next_assignment";
  view: "month" | "agenda";
}): void {
  void trackEvent("study_plan_calendar_navigation", buildStudyPlanCalendarNavigationAnalytics(params));
}

export function buildStudyPlanCalendarNavigationAnalytics(
  params: Parameters<typeof trackStudyPlanCalendarNavigation>[0],
): Record<string, unknown> {
  return {
    action: analyticsEnum(params.action, ["previous", "next", "today", "next_assignment"]),
    view: analyticsEnum(params.view, ["month", "agenda"]),
  };
}

export function trackStudyPlanPrint(params: {
  taskCount: number;
  planLengthDays: number;
}): void {
  void trackEvent("study_plan_print", buildStudyPlanPrintAnalytics(params));
}

export function buildStudyPlanPrintAnalytics(
  params: Parameters<typeof trackStudyPlanPrint>[0],
): Record<string, unknown> {
  return {
    task_count: analyticsInteger(params.taskCount, 0, 1_000),
    plan_length_days: analyticsInteger(params.planLengthDays, 0, 730),
  };
}
