import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import type { Attempt } from "@/hooks/useUserProgress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PreviousAttemptsDialogProps {
  attempts: Attempt[];
}

interface AttemptSession {
  summary: string;
  lastAttempt: Attempt;
  totalDuration: number;
  result: Attempt["result"];
}

const SESSION_GAP_MS = 20 * 60 * 1000;
const ATTEMPT_LABEL_CLASS = "text-sm text-muted-foreground";
const ATTEMPT_ICON_CLASS = "h-3 w-3 mr-1";
const CORRECT_BADGE_CLASS = "bg-green-600 hover:bg-green-700";
const INCORRECT_BADGE_CLASS = "bg-red-600 hover:bg-red-700";
const DATE_TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
};

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', DATE_TIME_FORMAT_OPTIONS);
}

function formatAttemptAnswer(answer: string): string {
  const ans = answer || "—";
  const match = ans.match(/^([A-D])\./);
  return match ? match[1] : ans;
}

export function PreviousAttemptsDialog({ attempts }: PreviousAttemptsDialogProps) {
  if (!attempts || attempts.length === 0) {
    return null;
  }
  const chronoAttempts = [...attempts].sort((leftAttempt, rightAttempt) => leftAttempt.timestamp - rightAttempt.timestamp);

  const sessions: AttemptSession[] = [];
  let currentGroup: Attempt[] = [];

  const finishSession = () => {
    if (currentGroup.length === 0) return;

    const last = currentGroup[currentGroup.length - 1];
    const totalDuration = currentGroup.reduce((acc, curr) => acc + curr.durationSeconds, 0);
    const incorrectCount = currentGroup.filter(a => a.result === 'incorrect').length;
    let summary = "";

    if (last.result === 'correct') {
      if (incorrectCount === 0) {
        summary = "Correct on first try";
      } else {
        summary = `Correct after ${incorrectCount} incorrect attempt${incorrectCount === 1 ? '' : 's'}`;
      }
    } else {
      summary = `${incorrectCount} incorrect attempt${incorrectCount === 1 ? '' : 's'}`;
    }

    sessions.push({
      summary,
      lastAttempt: last,
      totalDuration,
      result: last.result,
    });
    currentGroup = [];
  };

  for (const att of chronoAttempts) {
    if (currentGroup.length === 0) {
      currentGroup.push(att);
    } else {
      const last = currentGroup[currentGroup.length - 1];
      if (att.timestamp - last.timestamp > SESSION_GAP_MS) {
        finishSession();
        currentGroup.push(att);
      } else {
        currentGroup.push(att);
        if (att.result === 'correct') {
          finishSession();
        }
      }
    }
  }
  finishSession();
  const displaySessions = [...sessions].reverse();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg hover:bg-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Previous attempts</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {displaySessions.map((session, index) => {
              const dateTimeLabel = formatDateTime(session.lastAttempt.timestamp);

              return (
                <div
                  key={index}
                  className="border rounded-lg p-4 space-y-3 bg-card"
                >
                  <div className="flex items-center justify-between">
                    <Badge
                      className={
                        session.result === "incorrect"
                          ? INCORRECT_BADGE_CLASS
                          : CORRECT_BADGE_CLASS
                      }
                    >
                      {session.result === "correct" ? (
                        <><CheckCircle2 className={ATTEMPT_ICON_CLASS} /> {session.summary}</>
                      ) : (
                        <><XCircle className={ATTEMPT_ICON_CLASS} /> {session.summary}</>
                      )}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-2 text-right">
                      {dateTimeLabel}
                    </span>
                  </div>

                  <div>
                    <p className={ATTEMPT_LABEL_CLASS}>
                      {session.result === 'correct' ? 'Answer' : 'Last Answer'}
                    </p>
                    <p className="font-medium text-lg font-mono">
                       {formatAttemptAnswer(session.lastAttempt.answer)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className={ATTEMPT_LABEL_CLASS}>Time Taken</p>
                      <p className="font-medium">{formatDuration(session.totalDuration)}</p>
                    </div>
                    <div>
                      <p className={ATTEMPT_LABEL_CLASS}>Date/Time</p>
                      <p className="font-medium">{dateTimeLabel}</p>
                    </div>
                  </div>

                  {session.lastAttempt.explanation && (
                    <div>
                      <p className={ATTEMPT_LABEL_CLASS}>Explanation</p>
                      <p className="text-sm">{session.lastAttempt.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
