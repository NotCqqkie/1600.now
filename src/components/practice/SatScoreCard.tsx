import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TOTAL_SCORE_LABEL = "TOTAL SCORE";
const READING_WRITING_LABEL = "Reading and Writing";
const MATH_LABEL = "Math";
const TOTAL_SCORE_RANGE = "400 - 1600";
const SECTION_SCORE_RANGE = "200 - 800";
const ACTION_LABEL = "See Score Details";
const CARD_BASE_CLASS = "overflow-hidden rounded-[28px] bg-white text-[#202124] shadow-[0_24px_70px_rgba(14,33,56,0.18)] ring-1 ring-black/[0.04] dark:bg-[#111d2e] dark:text-white dark:shadow-[0_24px_70px_rgba(0,0,0,0.42)] dark:ring-white/[0.08]";
const CARD_COMPACT_CLASS = "rounded-[18px] shadow-[0_14px_34px_rgba(14,33,56,0.14)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.36)]";
const CARD_SHOWCASE_CLASS = "shadow-[14px_20px_30px_-24px_rgba(14,33,56,0.34)] ring-0 dark:shadow-[14px_20px_32px_-24px_rgba(0,0,0,0.56)] dark:ring-0";
const HEADER_BASE_CLASS = "bg-[#c7dcff] dark:bg-[#243b63]";
const TITLE_BASE_CLASS = "font-black leading-none tracking-[-0.045em] text-[#202124] dark:text-white";
const DATE_BASE_CLASS = "mt-2 font-medium text-[#202124] dark:text-slate-200";
const SCORE_BLOCK_LABEL_BASE_CLASS = "font-bold uppercase tracking-[-0.01em] text-[#202124] dark:text-slate-100";
const SCORE_BLOCK_LABEL_SECONDARY_CLASS = "normal-case font-medium leading-tight";
const SCORE_BLOCK_SCORE_BASE_CLASS = "font-black leading-none tracking-[-0.06em] text-[#202124] dark:text-white";
const SCORE_BLOCK_RANGE_BASE_CLASS = "font-medium text-[#202124] dark:text-slate-200";
const GRID_BASE_CLASS = "grid";
const ACTION_BASE_CLASS = "flex w-full items-center justify-center gap-4 rounded-full border-2 border-[#3350d4] font-bold text-[#3350d4] transition-colors dark:border-[#8fb7ff] dark:text-[#a9c8ff]";
const ACTION_LINKED_CLASS = "hover:bg-[#3350d4] hover:text-white dark:hover:bg-[#8fb7ff] dark:hover:text-[#101827]";

type SatScoreCardProps = Readonly<{
  title: string;
  dateLabel: string;
  totalScore: number;
  readingWritingScore: number;
  mathScore: number;
  detailsTo?: string;
  className?: string;
  compact?: boolean;
  showcase?: boolean;
}>;

type ScoreBlockProps = Readonly<{
  label: string;
  score: number;
  range: string;
  compact?: boolean;
  primary?: boolean;
  showcase?: boolean;
}>;

const getScoreBlockWidthClass = (
  compact?: boolean,
  primary?: boolean,
  showcase?: boolean,
): string => {
  if (showcase) return "min-w-0";
  if (primary) return compact ? "min-w-[130px]" : "min-w-[180px]";
  return compact ? "min-w-[96px]" : "min-w-[120px]";
};

const getScoreLabelSizeClass = (compact?: boolean, showcase?: boolean): string =>
  showcase ? "text-[10px] max-[480px]:text-[8px]" : compact ? "text-[10px]" : "text-[22px]";

const getScoreValueSizeClass = (
  compact?: boolean,
  primary?: boolean,
  showcase?: boolean,
): string => {
  if (showcase) {
    return primary
      ? "mt-2 text-[48px] max-[480px]:text-[38px]"
      : "mt-2 text-[32px] max-[480px]:text-[25px]";
  }
  if (primary) return compact ? "mt-2 text-[48px]" : "mt-5 text-[112px]";
  return compact ? "mt-2 text-[32px]" : "mt-5 text-[72px]";
};

const getRangeSizeClass = (compact?: boolean, showcase?: boolean): string =>
  showcase ? "mt-2 text-[14px] max-[480px]:text-[11px]" : compact ? "mt-2 text-[14px]" : "mt-6 text-[30px]";

const getActionSizeClass = (compact?: boolean, showcase?: boolean): string =>
  showcase ? "h-10 text-[14px] max-[480px]:h-9 max-[480px]:text-[12px]" : compact ? "h-10 text-[14px]" : "h-[106px] text-[30px]";

const getHeaderPaddingClass = (compact?: boolean, showcase?: boolean): string =>
  showcase ? "px-5 py-4 max-[480px]:px-4 max-[480px]:py-3" : compact ? "px-5 py-4" : "px-14 py-12";

const getBodyPaddingClass = (compact?: boolean, showcase?: boolean): string =>
  showcase ? "px-5 py-5 max-[480px]:px-4 max-[480px]:py-4" : compact ? "px-5 py-5" : "px-14 py-16";

const getGridGapClass = (compact?: boolean, showcase?: boolean): string =>
  showcase ? "grid-cols-[1.05fr_0.78fr_0.56fr] gap-4 max-[480px]:gap-3" : compact ? "gap-5" : "gap-8";

const getGridColumnsClass = (compact?: boolean, showcase?: boolean): string | false =>
  !showcase && (compact ? "grid-cols-1 sm:grid-cols-[1.1fr_0.85fr_0.55fr]" : "grid-cols-1 md:grid-cols-[1.45fr_0.72fr_0.55fr]");

const getActionWrapClass = (compact?: boolean, showcase?: boolean): string =>
  showcase ? "mt-5 max-[480px]:mt-4" : compact ? "mt-5" : "mt-12";

const ScoreBlock = ({
  label,
  score,
  range,
  compact,
  primary,
  showcase,
}: ScoreBlockProps) => (
  <div className={getScoreBlockWidthClass(compact, primary, showcase)}>
    <div
      className={cn(
        SCORE_BLOCK_LABEL_BASE_CLASS,
        getScoreLabelSizeClass(compact, showcase),
        !primary && SCORE_BLOCK_LABEL_SECONDARY_CLASS,
      )}
    >
      {label}
    </div>
    <div
      className={cn(
        SCORE_BLOCK_SCORE_BASE_CLASS,
        getScoreValueSizeClass(compact, primary, showcase),
      )}
    >
      {score}
    </div>
    <div className={cn(SCORE_BLOCK_RANGE_BASE_CLASS, getRangeSizeClass(compact, showcase))}>
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
        ACTION_BASE_CLASS,
        getActionSizeClass(compact, showcase),
        detailsTo && ACTION_LINKED_CLASS,
      )}
    >
      {ACTION_LABEL}
      <ArrowRight className={compact ? "h-5 w-5" : "h-9 w-9"} />
    </span>
  );

  return (
    <article
      className={cn(
        CARD_BASE_CLASS,
        compact && CARD_COMPACT_CLASS,
        showcase && CARD_SHOWCASE_CLASS,
        className,
      )}
    >
      <div className={cn(HEADER_BASE_CLASS, getHeaderPaddingClass(compact, showcase))}>
        <h3
          className={cn(
            TITLE_BASE_CLASS,
            showcase ? "text-[24px] max-[480px]:text-[22px]" : compact ? "text-[24px]" : "text-[54px]",
          )}
        >
          {title}
        </h3>
        <div className={cn(DATE_BASE_CLASS, showcase ? "text-[16px] max-[480px]:text-[14px]" : compact ? "text-[16px]" : "text-[36px]")}>
          {dateLabel}
        </div>
      </div>

      <div className={getBodyPaddingClass(compact, showcase)}>
        <div
          className={cn(
            GRID_BASE_CLASS,
            getGridGapClass(compact, showcase),
            getGridColumnsClass(compact, showcase),
          )}
        >
          <ScoreBlock label={TOTAL_SCORE_LABEL} score={totalScore} range={TOTAL_SCORE_RANGE} primary compact={compact} showcase={showcase} />
          <ScoreBlock label={READING_WRITING_LABEL} score={readingWritingScore} range={SECTION_SCORE_RANGE} compact={compact} showcase={showcase} />
          <ScoreBlock label={MATH_LABEL} score={mathScore} range={SECTION_SCORE_RANGE} compact={compact} showcase={showcase} />
        </div>

        <div className={getActionWrapClass(compact, showcase)}>
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
