import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useThemeMode } from "@/hooks/useThemeMode";

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  href?: string;
  variant?: "full" | "mark";
}

export const BrandLogo = ({
  className,
  imageClassName,
  href = "/",
  variant = "full",
}: BrandLogoProps) => {
  const isDark = useThemeMode();

  const src = variant === "mark"
    ? (isDark ? "/optimized/logo_mark_w_320.png" : "/optimized/logo_mark_b_320.png")
    : (isDark ? "/optimized/logo_text_w_1200.png" : "/optimized/logo_text_b_1200.png");

  const content = (
    <span
      className={cn(
        variant === "mark"
          ? "relative block h-10 w-10 shrink-0 overflow-hidden"
          : "relative block h-10 w-[165px] shrink-0 overflow-hidden",
        className,
      )}
    >
      <img
        src={src}
        alt="1600.now"
        className={cn(
          "absolute inset-0 h-full w-full object-contain",
          imageClassName,
        )}
        loading="eager"
        decoding="sync"
        fetchPriority="high"
      />
    </span>
  );

  return (
    <Link
      to={href}
      className="inline-flex items-center no-underline"
      aria-label="1600.now homepage"
    >
      {content}
    </Link>
  );
};
