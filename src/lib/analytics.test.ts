import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firebaseAnalyticsMocks = vi.hoisted(() => {
  const bundle = {
    analytics: {},
    logEvent: vi.fn(),
    setUserId: vi.fn(),
  };
  return {
    bundle,
    disableAnalyticsCollectionIfInitialized: vi.fn(),
    getAnalyticsPromise: vi.fn(async () => bundle),
  };
});

vi.mock("@/lib/firebase/firebaseAnalytics", () => ({
  disableAnalyticsCollectionIfInitialized:
    firebaseAnalyticsMocks.disableAnalyticsCollectionIfInitialized,
  getAnalyticsPromise: firebaseAnalyticsMocks.getAnalyticsPromise,
}));

const createBrowserGlobals = (storedConsent?: "granted" | "denied") => {
  const storage = new Map<string, string>();
  if (storedConsent) storage.set("analytics-consent", storedConsent);
  vi.stubGlobal("window", {
    location: { origin: "https://1600.now" },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  vi.stubGlobal("document", { title: "Final route title" });
  return storage;
};

beforeEach(() => {
  vi.resetModules();
  firebaseAnalyticsMocks.disableAnalyticsCollectionIfInitialized.mockReset();
  firebaseAnalyticsMocks.getAnalyticsPromise.mockReset();
  firebaseAnalyticsMocks.getAnalyticsPromise.mockResolvedValue(firebaseAnalyticsMocks.bundle);
  firebaseAnalyticsMocks.bundle.logEvent.mockReset();
  firebaseAnalyticsMocks.bundle.setUserId.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analytics consent", () => {
  it("uses cookieless measurement by default and honors explicit revocation", async () => {
    createBrowserGlobals();
    const {
      getAnalyticsConsent,
      initAnalytics,
      setAnalyticsConsent,
    } = await import("@/lib/analytics");

    expect(getAnalyticsConsent()).toBe("unset");
    await initAnalytics();
    expect(firebaseAnalyticsMocks.getAnalyticsPromise).toHaveBeenCalledWith("denied");
    expect(firebaseAnalyticsMocks.bundle.setUserId).toHaveBeenCalledWith(
      firebaseAnalyticsMocks.bundle.analytics,
      null,
    );

    setAnalyticsConsent("granted");
    await vi.waitFor(() => {
      expect(firebaseAnalyticsMocks.getAnalyticsPromise).toHaveBeenCalledWith("granted");
    });

    setAnalyticsConsent("denied");
    await vi.waitFor(() => {
      expect(firebaseAnalyticsMocks.disableAnalyticsCollectionIfInitialized).toHaveBeenCalled();
    });
    expect(getAnalyticsConsent()).toBe("denied");
  });

  it("does not initialize when a visitor has already opted out", async () => {
    createBrowserGlobals("denied");
    const { initAnalytics } = await import("@/lib/analytics");

    await initAnalytics();

    expect(firebaseAnalyticsMocks.getAnalyticsPromise).not.toHaveBeenCalled();
  });

  it("restores only the current user ID after consent is granted", async () => {
    createBrowserGlobals();
    const { identifyUser, setAnalyticsConsent } = await import("@/lib/analytics");

    await identifyUser("user-before-consent");
    expect(firebaseAnalyticsMocks.bundle.setUserId).not.toHaveBeenCalled();

    setAnalyticsConsent("granted");
    await vi.waitFor(() => {
      expect(firebaseAnalyticsMocks.bundle.setUserId).toHaveBeenLastCalledWith(
        firebaseAnalyticsMocks.bundle.analytics,
        "user-before-consent",
      );
    });

    setAnalyticsConsent("denied");
    await vi.waitFor(() => {
      expect(firebaseAnalyticsMocks.disableAnalyticsCollectionIfInitialized).toHaveBeenCalled();
    });
    await identifyUser("current-user");
    firebaseAnalyticsMocks.bundle.setUserId.mockClear();
    setAnalyticsConsent("granted");
    await vi.waitFor(() => {
      expect(firebaseAnalyticsMocks.bundle.setUserId).toHaveBeenLastCalledWith(
        firebaseAnalyticsMocks.bundle.analytics,
        "current-user",
      );
    });
  });

  it("has no executable inline scripts or unconditional analytics in the HTML shell", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    const executableScripts = scripts.filter(([, attributes]) =>
      !/\btype=["']application\/ld\+json["']/i.test(attributes),
    );

    expect(executableScripts.length).toBeGreaterThan(0);
    for (const [, attributes, body] of executableScripts) {
      expect(attributes).toMatch(/\bsrc=["'][^"']+["']/i);
      expect(body.trim()).toBe("");
    }
    expect(html).not.toContain("googletagmanager.com");
    expect(html).not.toContain("gtag('config'");
    expect(html).not.toContain("window.dataLayer");
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it("keeps Firebase hosting CSP compatible with App Check without inline script execution", () => {
    const firebaseConfig = JSON.parse(
      readFileSync(new URL("../../firebase.json", import.meta.url), "utf8"),
    ) as {
      hosting: {
        headers: Array<{ headers: Array<{ key: string; value: string }> }>;
      };
    };
    const csp = firebaseConfig.hosting.headers
      .flatMap((entry) => entry.headers)
      .find((header) => header.key === "Content-Security-Policy")?.value;
    expect(csp).toBeTruthy();

    const directives = new Map(
      csp?.split(";").map((directive) => {
        const [name, ...values] = directive.trim().split(/\s+/);
        return [name, values] as const;
      }),
    );
    expect(directives.get("script-src")).not.toContain("'unsafe-inline'");
    expect(directives.get("script-src")).toEqual(expect.arrayContaining([
      "https://www.google.com/recaptcha/",
      "https://www.gstatic.com/recaptcha/",
    ]));
    expect(directives.get("connect-src")).toContain("https://www.google.com/recaptcha/");
    expect(directives.get("frame-src")).toEqual(expect.arrayContaining([
      "https://www.google.com/recaptcha/",
      "https://recaptcha.google.com/recaptcha/",
    ]));
  });
});

describe("page-view analytics", () => {
  it("removes search, session, auth, embed, hash, and UI parameters", async () => {
    const { sanitizeAnalyticsPagePath } = await import("@/lib/analytics");

    expect(sanitizeAnalyticsPagePath(
      "/bank?q=private+search&session=secret&embed=1&code=auth&difficulty=hard#answer",
    )).toBe("/bank");
    expect(sanitizeAnalyticsPagePath(
      "/sat-resources?utm_source=counselor&utm_medium=resource&utm_campaign=fall_2026&q=private",
    )).toBe(
      "/sat-resources?utm_source=counselor&utm_medium=resource&utm_campaign=fall_2026",
    );
    expect(sanitizeAnalyticsPagePath(
      "/sat-resources?utm_campaign=contains%20private%20text",
    )).toBe("/sat-resources");
  });

  it("sends one page view per rendered path after final metadata", async () => {
    createBrowserGlobals();
    const { trackPageView } = await import("@/lib/analytics");

    trackPageView("/bank?q=first&utm_source=counselor");
    trackPageView("/bank?q=second&utm_source=counselor");
    await vi.waitFor(() => {
      expect(firebaseAnalyticsMocks.bundle.logEvent).toHaveBeenCalledTimes(1);
    });
    expect(firebaseAnalyticsMocks.bundle.logEvent).toHaveBeenLastCalledWith(
      firebaseAnalyticsMocks.bundle.analytics,
      "page_view",
      {
        page_path: "/bank?utm_source=counselor",
        page_location: "https://1600.now/bank?utm_source=counselor",
        page_title: "Final route title",
      },
    );

    (document as { title: string }).title = "Modules title";
    trackPageView("/modules?session=private");
    await vi.waitFor(() => {
      expect(firebaseAnalyticsMocks.bundle.logEvent).toHaveBeenCalledTimes(2);
    });
    expect(firebaseAnalyticsMocks.bundle.logEvent).toHaveBeenLastCalledWith(
      firebaseAnalyticsMocks.bundle.analytics,
      "page_view",
      {
        page_path: "/modules",
        page_location: "https://1600.now/modules",
        page_title: "Modules title",
        page_referrer: "https://1600.now/bank?utm_source=counselor",
      },
    );

    trackPageView("/bank?q=third&utm_source=counselor");
    await vi.waitFor(() => {
      expect(firebaseAnalyticsMocks.bundle.logEvent).toHaveBeenCalledTimes(3);
    });
  });
});

describe("funnel analytics", () => {
  it("builds low-cardinality practice and tool payloads", async () => {
    const {
      buildAnswerSubmitAnalytics,
      buildPracticeCompleteAnalytics,
      buildPracticeStartAnalytics,
      buildToolCompleteAnalytics,
      toAnalyticsAccuracyBand,
      toAnalyticsDurationBand,
    } = await import("@/lib/analytics");

    expect(buildPracticeStartAnalytics({
      practiceType: "module",
      subject: "math",
      entryPoint: "study_plan",
    })).toEqual({
      practice_type: "module",
      subject: "math",
      entry_point: "study_plan",
    });
    expect(buildAnswerSubmitAnalytics({
      practiceType: "question_bank",
      subject: "reading_writing",
      isCorrect: true,
      attempt: "first",
    })).toEqual({
      practice_type: "question_bank",
      subject: "reading_writing",
      is_correct: true,
      attempt: "first",
    });
    expect(buildPracticeCompleteAnalytics({
      practiceType: "practice_test",
      subject: "mixed",
      status: "completed",
      accuracyBand: "75_89",
      durationBand: "60m_plus",
    })).toEqual({
      practice_type: "practice_test",
      subject: "mixed",
      status: "completed",
      accuracy_band: "75_89",
      duration_band: "60m_plus",
    });
    expect(buildToolCompleteAnalytics({
      tool: "score_calculator",
      outcome: "success",
    })).toEqual({ tool: "score_calculator", outcome: "success" });
    expect([49, 50, 75, 90].map(toAnalyticsAccuracyBand)).toEqual([
      "below_50",
      "50_74",
      "75_89",
      "90_100",
    ]);
    expect([299, 300, 900, 1_800, 3_600].map(toAnalyticsDurationBand)).toEqual([
      "under_5m",
      "5_14m",
      "15_29m",
      "30_59m",
      "60m_plus",
    ]);
  });

  it("sends each completed result once without including its session ID", async () => {
    createBrowserGlobals();
    const { trackPracticeComplete } = await import("@/lib/analytics");
    const completion = {
      practiceType: "module" as const,
      subject: "math" as const,
      status: "completed" as const,
      accuracyBand: "75_89" as const,
      durationBand: "15_29m" as const,
      completionId: "private-session-id",
    };

    trackPracticeComplete(completion);
    trackPracticeComplete(completion);

    await vi.waitFor(() => {
      expect(firebaseAnalyticsMocks.bundle.logEvent).toHaveBeenCalledTimes(1);
    });
    expect(firebaseAnalyticsMocks.bundle.logEvent).toHaveBeenCalledWith(
      firebaseAnalyticsMocks.bundle.analytics,
      "practice_complete",
      expect.not.objectContaining({ completionId: expect.anything() }),
    );
    expect(JSON.stringify(firebaseAnalyticsMocks.bundle.logEvent.mock.calls)).not.toContain(
      "private-session-id",
    );
  });

  it("reduces errors to fixed categories without sending messages or stacks", async () => {
    const { buildAppErrorAnalytics } = await import("@/lib/analytics");

    expect(buildAppErrorAnalytics(
      "Failed to fetch private-user@example.com",
      {
        source: "error_boundary",
        componentStack: "private component stack",
        sessionId: "private-session",
      },
    )).toEqual({ error_type: "network", source: "error_boundary" });
  });

  it("does not retain IDs, answer text, exact scores, or arbitrary values", async () => {
    const {
      buildAnswerSubmitAnalytics,
      buildPracticeStartAnalytics,
      buildToolCompleteAnalytics,
    } = await import("@/lib/analytics");
    const payloads = [
      buildPracticeStartAnalytics({
        practiceType: "private-id" as "module",
        subject: "private-subject" as "math",
        entryPoint: "direct",
        sessionId: "private-session",
      } as Parameters<typeof buildPracticeStartAnalytics>[0]),
      buildAnswerSubmitAnalytics({
        practiceType: "question_bank",
        subject: "math",
        isCorrect: false,
        attempt: "retry",
        questionId: "private-question",
        selectedAnswer: "private-answer",
      } as Parameters<typeof buildAnswerSubmitAnalytics>[0]),
      buildToolCompleteAnalytics({
        tool: "private-tool" as "score_calculator",
        outcome: "success",
        score: 1420,
      } as Parameters<typeof buildToolCompleteAnalytics>[0]),
    ];

    expect(payloads[0]).toEqual({
      practice_type: "unknown",
      subject: "unknown",
      entry_point: "direct",
    });
    expect(payloads[2]).toEqual({ tool: "unknown", outcome: "success" });
    expect(JSON.stringify(payloads)).not.toMatch(
      /private-session|private-question|private-answer|1420/,
    );
  });

  it("emits the study-plan creation key event", async () => {
    createBrowserGlobals();
    const { trackStudyPlanSaved } = await import("@/lib/analytics");

    trackStudyPlanSaved({
      mode: "create",
      taskCount: 18,
      planLengthDays: 42,
      minutesPerDay: 45,
      hasScoreReport: true,
      storage: "account",
    });

    await vi.waitFor(() => {
      expect(firebaseAnalyticsMocks.bundle.logEvent).toHaveBeenCalledWith(
        firebaseAnalyticsMocks.bundle.analytics,
        "study_plan_created",
        expect.objectContaining({ mode: "create" }),
      );
    });
  });
});

describe("study-plan analytics", () => {
  it("builds only fixed, privacy-safe planner payload fields", async () => {
    const {
      buildStudyPlanCalendarNavigationAnalytics,
      buildStudyPlanPrintAnalytics,
      buildStudyPlanRebalanceAnalytics,
      buildStudyPlanSavedAnalytics,
      buildStudyPlanTaskCompletionAnalytics,
      buildStudyPlanTaskLaunchAnalytics,
      buildStudyPlanUploadAnalytics,
    } = await import("@/lib/analytics");
    const payloads = [
      buildStudyPlanUploadAnalytics({
        format: "pdf",
        outcome: "success",
        durationMs: 1_234,
        fileName: "private-score-report.pdf",
        extractedText: "private OCR text",
      } as Parameters<typeof buildStudyPlanUploadAnalytics>[0]),
      buildStudyPlanSavedAnalytics({
        mode: "create",
        taskCount: 18,
        planLengthDays: 42,
        minutesPerDay: 45,
        hasScoreReport: true,
        storage: "account",
        totalScore: 1420,
      } as Parameters<typeof buildStudyPlanSavedAnalytics>[0]),
      buildStudyPlanTaskLaunchAnalytics({
        actionKind: "timed-set",
        timingMode: "countdown",
        overdue: false,
        assignmentId: "private-assignment-id",
        taskTitle: "Private task title",
      } as Parameters<typeof buildStudyPlanTaskLaunchAnalytics>[0]),
      buildStudyPlanTaskCompletionAnalytics({
        actionKind: "timed-set",
        timingMode: "countdown",
        accuracyBand: "75_89",
        elapsedMinutes: 27,
        missedSkills: ["Private skill"],
      } as Parameters<typeof buildStudyPlanTaskCompletionAnalytics>[0]),
      buildStudyPlanRebalanceAnalytics({ decision: "apply", changeCount: 2 }),
      buildStudyPlanCalendarNavigationAnalytics({ action: "next", view: "month" }),
      buildStudyPlanPrintAnalytics({ taskCount: 18, planLengthDays: 42 }),
    ];

    const serialized = JSON.stringify(payloads);
    expect(serialized).not.toContain("private-score-report.pdf");
    expect(serialized).not.toContain("private OCR text");
    expect(serialized).not.toContain("1420");
    expect(serialized).not.toContain("private-assignment-id");
    expect(serialized).not.toContain("Private task title");
    expect(serialized).not.toContain("Private skill");
  });

  it("replaces unexpected enum values instead of retaining arbitrary strings", async () => {
    const { buildStudyPlanUploadAnalytics } = await import("@/lib/analytics");
    const payload = buildStudyPlanUploadAnalytics({
      format: "private-file-name.pdf" as "pdf",
      outcome: "private extracted text" as "success",
      durationMs: 100,
    });

    expect(payload).toEqual({
      report_format: "unknown",
      outcome: "unknown",
      duration_ms: 100,
    });
  });
});
