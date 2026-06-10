import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  REPORT_REASONS,
  type ReportReasonKey,
  getQuestionReport,
  submitQuestionReport,
  type QuestionReport,
} from "@/lib/questionReports";

export const ReportQuestionDialog = ({
  open,
  onOpenChange,
  questionId,
  portalContainer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string | undefined;
  portalContainer?: HTMLElement | null;
}) => {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<ReportReasonKey>>(new Set());
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<QuestionReport | null>(null);

  useEffect(() => {
    if (!open || !questionId) return;
    setSelected(new Set());
    setOtherText("");
    setExisting(null);
    let cancelled = false;
    getQuestionReport(questionId)
      .then((report) => {
        if (!cancelled) setExisting(report);
      })
      .catch(() => {
        if (!cancelled) setExisting(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, questionId]);

  const toggle = (key: ReportReasonKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!questionId) return;
    setSubmitting(true);
    try {
      await submitQuestionReport({
        questionId,
        reasons: Array.from(selected),
        otherText,
        userId: user?.id,
      });
      toast.success("Report submitted. Thanks for flagging this!");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" container={portalContainer}>
        <DialogHeader>
          <DialogTitle>Report a question</DialogTitle>
        </DialogHeader>

        {existing && existing.totalReports > 0 && (
          <div className="rounded-md border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              Previously reported {existing.totalReports}{" "}
              {existing.totalReports === 1 ? "time" : "times"}
            </div>
            <ul className="mt-1 space-y-0.5">
              {REPORT_REASONS.map((reason) => {
                const count = existing.counts?.[reason.key] ?? 0;
                if (!count) return null;
                return (
                  <li key={reason.key}>
                    {reason.label}: {count}
                  </li>
                );
              })}
              {existing.counts?.other ? <li>Other: {existing.counts.other}</li> : null}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          {REPORT_REASONS.map((reason) => (
            <label
              key={reason.key}
              htmlFor={`report-${reason.key}`}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                id={`report-${reason.key}`}
                checked={selected.has(reason.key)}
                onCheckedChange={() => toggle(reason.key)}
              />
              <span>{reason.label}</span>
            </label>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="report-other" className="text-sm">
            Other (describe the issue)
          </Label>
          <textarea
            id="report-other"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Anything else we should know?"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || (selected.size === 0 && !otherText.trim())}
          >
            {submitting ? "Submitting…" : "Submit report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
