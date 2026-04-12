import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useThemeMode } from "@/hooks/useThemeMode";

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  href?: string;
  variant?: "full" | "mark" | "adaptive";
  collapsed?: boolean;
}

export const BrandLogo = ({
  className,
  imageClassName,
  href = "/",
  variant = "full",
  collapsed = false,
}: BrandLogoProps) => {
  const isDark = useThemeMode();

  const markSrc = isDark ? "/optimized/logo_mark_w_320.png" : "/optimized/logo_mark_b_320.png";
  const fullSrc = isDark ? "/optimized/logo_text_w_1200.png" : "/optimized/logo_text_b_1200.png";

  const content = (
    <span
      className={cn(
        variant === "mark"
          ? "relative block h-10 w-10 shrink-0 overflow-hidden"
          : "relative block h-10 w-[165px] shrink-0 overflow-hidden",
        className,
      )}
    >
      {variant === "adaptive" ? (
        <>
          <img
            src={fullSrc}
            alt="1600.now"
            className={cn(
              "absolute inset-0 h-full w-full object-contain object-left transition-[opacity,transform] duration-200 ease-out will-change-[opacity,transform]",
              collapsed
                ? "pointer-events-none opacity-0 -translate-x-1 scale-[0.985]"
                : "opacity-100 translate-x-0 scale-100",
              imageClassName,
            )}
            loading="eager"
            decoding="sync"
            fetchPriority="high"
          />
          <img
            src={markSrc}
            alt=""
            aria-hidden="true"
            className={cn(
              "absolute left-0 top-0 h-full w-9 object-contain object-left transition-[opacity,transform] duration-200 ease-out will-change-[opacity,transform]",
              collapsed
                ? "opacity-100 translate-x-0 scale-100"
                : "pointer-events-none opacity-0 translate-x-1 scale-[0.985]",
            )}
            loading="eager"
            decoding="sync"
            fetchPriority="high"
          />
        </>
      ) : (
        <img
          src={variant === "mark" ? markSrc : fullSrc}
          alt="1600.now"
          className={cn(
            "absolute inset-0 h-full w-full object-contain",
            imageClassName,
          )}
          loading="eager"
          decoding="sync"
          fetchPriority="high"
        />
      )}
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
