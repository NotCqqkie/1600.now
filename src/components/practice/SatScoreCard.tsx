import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SatScoreCardProps = {
  title: string;
  dateLabel: string;
  totalScore: number;
  readingWritingScore: number;
  mathScore: number;
  detailsTo?: string;
  className?: string;
  compact?: boolean;
  showcase?: boolean;
};

const ScoreBlock = ({
  label,
  score,
  range,
  compact,
  primary,
  showcase,
}: {
  label: string;
  score: number;
  range: string;
  compact?: boolean;
  primary?: boolean;
  showcase?: boolean;
}) => (
  <div className={cn(showcase ? "min-w-0" : primary ? compact ? "min-w-[130px]" : "min-w-[180px]" : compact ? "min-w-[96px]" : "min-w-[120px]")}>
    <div
      className={cn(
        "font-bold uppercase tracking-[-0.01em] text-[#202124] dark:text-slate-100",
        showcase ? "text-[10px] max-[480px]:text-[8px]" : compact ? "text-[10px]" : "text-[22px]",
        !primary && "normal-case font-medium leading-tight",
      )}
    >
      {label}
    </div>
    <div
      className={cn(
        "font-black leading-none tracking-[-0.06em] text-[#202124] dark:text-white",
        showcase
          ? primary ? "mt-2 text-[48px] max-[480px]:text-[38px]" : "mt-2 text-[32px] max-[480px]:text-[25px]"
          : primary
          ? compact ? "mt-2 text-[48px]" : "mt-5 text-[112px]"
          : compact ? "mt-2 text-[32px]" : "mt-5 text-[72px]",
      )}
    >
      {score}
    </div>
    <div className={cn("font-medium text-[#202124] dark:text-slate-200", showcase ? "mt-2 text-[14px] max-[480px]:text-[11px]" : compact ? "mt-2 text-[14px]" : "mt-6 text-[30px]")}>
      {range}
    </div>
  </div>
);

export const SatScoreCard = ({
  title,
  dateLabel,
  totalScore,
  readingWritingScore,
  mathScore,
  detailsTo,
  className,
  compact,
  showcase,
}: SatScoreCardProps) => {
  const action = (
    <span
      className={cn(
        "flex w-full items-center justify-center gap-4 rounded-full border-2 border-[#3350d4] font-bold text-[#3350d4] transition-colors dark:border-[#8fb7ff] dark:text-[#a9c8ff]",
        showcase ? "h-10 text-[14px] max-[480px]:h-9 max-[480px]:text-[12px]" : compact ? "h-10 text-[14px]" : "h-[106px] text-[30px]",
        detailsTo && "hover:bg-[#3350d4] hover:text-white dark:hover:bg-[#8fb7ff] dark:hover:text-[#101827]",
      )}
    >
      See Score Details
      <ArrowRight className={cn(compact ? "h-5 w-5" : "h-9 w-9")} />
    </span>
  );

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[28px] bg-white text-[#202124] shadow-[0_24px_70px_rgba(14,33,56,0.18)] ring-1 ring-black/[0.04] dark:bg-[#111d2e] dark:text-white dark:shadow-[0_24px_70px_rgba(0,0,0,0.42)] dark:ring-white/[0.08]",
        compact && "rounded-[18px] shadow-[0_14px_34px_rgba(14,33,56,0.14)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.36)]",
        showcase && "shadow-[14px_20px_30px_-24px_rgba(14,33,56,0.34)] ring-0 dark:shadow-[14px_20px_32px_-24px_rgba(0,0,0,0.56)] dark:ring-0",
        className,
      )}
    >
      <div className={cn("bg-[#c7dcff] dark:bg-[#243b63]", showcase ? "px-5 py-4 max-[480px]:px-4 max-[480px]:py-3" : compact ? "px-5 py-4" : "px-14 py-12")}>
        <h3
          className={cn(
            "font-black leading-none tracking-[-0.045em] text-[#202124] dark:text-white",
            showcase ? "text-[24px] max-[480px]:text-[22px]" : compact ? "text-[24px]" : "text-[54px]",
          )}
        >
          {title}
        </h3>
        <div className={cn("mt-2 font-medium text-[#202124] dark:text-slate-200", showcase ? "text-[16px] max-[480px]:text-[14px]" : compact ? "text-[16px]" : "text-[36px]")}>
          {dateLabel}
        </div>
      </div>

      <div className={cn(showcase ? "px-5 py-5 max-[480px]:px-4 max-[480px]:py-4" : compact ? "px-5 py-5" : "px-14 py-16")}>
        <div
          className={cn(
            "grid",
            showcase ? "grid-cols-[1.05fr_0.78fr_0.56fr] gap-4 max-[480px]:gap-3" : compact ? "gap-5" : "gap-8",
            !showcase && (compact ? "grid-cols-1 sm:grid-cols-[1.1fr_0.85fr_0.55fr]" : "grid-cols-1 md:grid-cols-[1.45fr_0.72fr_0.55fr]"),
          )}
        >
          <ScoreBlock label="TOTAL SCORE" score={totalScore} range="400 - 1600" primary compact={compact} showcase={showcase} />
          <ScoreBlock label="Reading and Writing" score={readingWritingScore} range="200 - 800" compact={compact} showcase={showcase} />
          <ScoreBlock label="Math" score={mathScore} range="200 - 800" compact={compact} showcase={showcase} />
        </div>

        <div className={cn(showcase ? "mt-5 max-[480px]:mt-4" : compact ? "mt-5" : "mt-12")}>
          {detailsTo ? (
            <Link to={detailsTo} aria-label={`See score details for ${title}`} className="block">
              {action}
            </Link>
          ) : (
            action
          )}
        </div>
      </div>
    </article>
  );
};
