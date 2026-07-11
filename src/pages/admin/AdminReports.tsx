import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminUser } from "@/lib/admin";
import {
  QUESTION_REPORT_PAGE_SIZE,
  REPORT_REASONS,
  listQuestionReportsPage,
  type QuestionReport,
  type QuestionReportCursor,
  type ReportReasonKey,
} from "@/lib/questionReports";
import { loadBankQuestionBySourceId, type BankSubject } from "@/data/questionBank";

type AdminReportRow = QuestionReport & {
  preview?: string;
};

type ParsedStableId = {
  subject: BankSubject;
  sourceId: string;
};

const REPORT_STATUS_PANEL_CLASS =
  "rounded-md border border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground";

const REASON_LABEL_BY_KEY = Object.fromEntries(
  REPORT_REASONS.map((reason) => [reason.key, reason.label]),
) as Record<ReportReasonKey, string>;

const parseStableId = (
  id: string,
): ParsedStableId | null => {
  const match = id.match(/^bank-(?:past|unofficial)-(math|reading)-([0-9a-f]{8})$/);
  if (!match) return null;
  return { subject: match[1] as BankSubject, sourceId: match[2] };
};

const enrich = async (report: QuestionReport): Promise<AdminReportRow> => {
  const parsed = parseStableId(report.questionId);
  if (!parsed) return report;
  const question = await loadBankQuestionBySourceId(parsed.subject, parsed.sourceId, "all");
  const text = question?.questionText ?? question?.prompt ?? question?.passage ?? "";
  const preview = text.replace(/\s+/g, " ").trim().slice(0, 160);
  return { ...report, preview };
};

const enrichPage = (reports: QuestionReport[]): Promise<AdminReportRow[]> =>
  Promise.all(
    reports.map(async (report) => {
      try {
        return await enrich(report);
      } catch {
        return report;
      }
    }),
  );

const formatTimestamp = (ts: number | { seconds: number } | undefined): string => {
  if (!ts) return "—";
  const ms = typeof ts === "number" ? ts : ts.seconds * 1000;
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
};

const AdminReports = () => {
  const { user, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<AdminReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cursor, setCursor] = useState<QuestionReportCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const allowed = isAdminUser(user);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setReports(null);
    setError(null);
    setCursor(null);
    setHasMore(false);
    setLoadingMore(false);
    listQuestionReportsPage(null, QUESTION_REPORT_PAGE_SIZE)
      .then(async (page) => ({ page, rows: await enrichPage(page.reports) }))
      .then(({ page, rows }) => {
        if (cancelled) return;
        setReports(rows);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load reports.";
        setError(message);
        toast.error(message);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, refreshKey]);

  const handleLoadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listQuestionReportsPage(cursor, QUESTION_REPORT_PAGE_SIZE);
      const rows = await enrichPage(page.reports);
      setReports((current) => {
        const next = current ? [...current] : [];
        const seen = new Set(next.map((report) => report.questionId));
        for (const row of rows) {
          if (!seen.has(row.questionId)) next.push(row);
        }
        return next;
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load more reports.";
      setError(message);
      toast.error(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const totals = useMemo(() => {
    if (!reports) return { docs: 0, reports: 0, comments: 0 };
    let totalReports = 0;
    let totalComments = 0;
    for (const r of reports) {
      totalReports += Number.isFinite(r.totalReports) ? r.totalReports : 0;
      totalComments += Array.isArray(r.otherComments) ? r.otherComments.length : 0;
    }
    return { docs: reports.length, reports: totalReports, comments: totalComments };
  }, [reports]);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Question reports</h1>
          <p className="text-sm text-muted-foreground">
            {totals.docs} loaded questions · {totals.reports} total flags · {totals.comments} comments
          </p>
        </div>
        <div className="flex gap-2">
          {hasMore && (
            <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={reports === null}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && reports === null && (
        <div className={REPORT_STATUS_PANEL_CLASS}>
          Loading reports…
        </div>
      )}

      {reports !== null && reports.length === 0 && (
        <div className={REPORT_STATUS_PANEL_CLASS}>
          No reports yet.
        </div>
      )}

      <div className="space-y-3">
        {reports?.map((report) => (
          <article
            key={report.questionId}
            className="rounded-lg border border-border/70 bg-card p-4 shadow-sm"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="space-y-0.5">
                <div className="font-mono text-xs text-muted-foreground">{report.questionId}</div>
                {report.preview && (
                  <div className="text-sm text-foreground">{report.preview}{report.preview.length === 160 ? "…" : ""}</div>
                )}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div className="text-base font-semibold text-foreground">
                  {report.totalReports} {report.totalReports === 1 ? "flag" : "flags"}
                </div>
                <div>last: {formatTimestamp(report.lastReportedAt)}</div>
              </div>
            </header>

            {report.counts && Object.keys(report.counts).length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {Object.entries(report.counts).map(([key, count]) => {
                  if (!count) return null;
                  const label = key === "other" ? "Other" : REASON_LABEL_BY_KEY[key] ?? key;
                  return (
                    <li
                      key={key}
                      className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5"
                    >
                      {label}: {count}
                    </li>
                  );
                })}
              </ul>
            )}

            {report.otherComments && report.otherComments.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Comments ({report.otherComments.length})
                </div>
                <ul className="space-y-1.5">
                  {report.otherComments.map((comment, commentIndex) => (
                    <li
                      key={`${report.questionId}-c-${commentIndex}`}
                      className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm"
                    >
                      <div className="whitespace-pre-wrap">{comment.text}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {formatTimestamp(comment.timestamp)}
                        {comment.userId ? ` · ${comment.userId}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
};

export default AdminReports;
