import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Attempt } from "@/hooks/useUserProgress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PreviousAttemptsDialogProps {
  attempts: Attempt[];
  questionText?: string;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

export function PreviousAttemptsDialog({ attempts, questionText }: PreviousAttemptsDialogProps) {
  if (!attempts || attempts.length === 0) {
    return null;
  }
  const chronoAttempts = [...attempts].sort((leftAttempt, rightAttempt) => leftAttempt.timestamp - rightAttempt.timestamp);
  interface Session {
    attempts: Attempt[];
    summary: string;
    lastAttempt: Attempt;
    totalDuration: number;
    result: "correct" | "incorrect";
    recoveredAfterIncorrect: boolean;
  }

  const sessions: Session[] = [];
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
      attempts: [...currentGroup],
      summary,
      lastAttempt: last,
      totalDuration,
      result: last.result,
      recoveredAfterIncorrect: last.result === "correct" && incorrectCount > 0,
    });
    currentGroup = [];
  };

  for (const att of chronoAttempts) {
    if (currentGroup.length === 0) {
      currentGroup.push(att);
    } else {
      const last = currentGroup[currentGroup.length - 1];
      if (att.timestamp - last.timestamp > 20 * 60 * 1000) {
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
            {displaySessions.map((session, index) => (
              <div
                key={index}
                className="border rounded-lg p-4 space-y-3 bg-card"
              >
                <div className="flex items-center justify-between">
                  <Badge
                    className={
                      session.result === "incorrect"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-green-600 hover:bg-green-700"
                    }
                  >
                    {session.result === "correct" ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> {session.summary}</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> {session.summary}</>
                    )}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-2 text-right">
                    {formatDateTime(session.lastAttempt.timestamp)}
                  </span>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    {session.result === 'correct' ? 'Answer' : 'Last Answer'}
                  </p>
                  <p className="font-medium text-lg font-mono">
                     {(() => {
                        const ans = session.lastAttempt.answer || "—";
                        const match = ans.match(/^([A-D])\./);
                        return match ? match[1] : ans;
                     })()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Time Taken</p>
                    <p className="font-medium">{formatDuration(session.totalDuration)}</p>
                  </div>
                  <div>

                    <p className="text-sm text-muted-foreground">Date/Time</p>

                    <p className="font-medium">{formatDateTime(session.lastAttempt.timestamp)}</p>

                  </div>

                </div>



                {session.lastAttempt.explanation && (

                  <div>

                    <p className="text-sm text-muted-foreground">Explanation</p>

                    <p className="text-sm">{session.lastAttempt.explanation}</p>

                  </div>

                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
