import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useThemeMode } from "@/hooks/useThemeMode";

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  href?: string;
  variant?: "full" | "mark" | "adaptive";
  collapsed?: boolean;
}

const highPriorityImageProps = { fetchpriority: "high" } as const;

export const BrandLogo = ({
  className,
  imageClassName,
  href = "/",
  variant = "full",
  collapsed = false,
}: BrandLogoProps) => {
  const isDark = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();

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
            alt=""
            aria-hidden="true"
            className={cn(
              "absolute inset-0 h-full w-full object-contain object-left",
              collapsed ? "pointer-events-none opacity-0" : "opacity-100",
              imageClassName,
            )}
            loading="eager"
            decoding="sync"
            {...highPriorityImageProps}
          />
          <img
            src={markSrc}
            alt=""
            aria-hidden="true"
            className={cn(
              "absolute left-0 top-0 h-full w-9 object-contain object-left",
              collapsed ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            loading="eager"
            decoding="sync"
            {...highPriorityImageProps}
          />
        </>
      ) : (
        <img
          src={variant === "mark" ? markSrc : fullSrc}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 h-full w-full object-contain",
            imageClassName,
          )}
          loading="eager"
          decoding="sync"
          {...highPriorityImageProps}
        />
      )}
    </span>
  );

  return (
    <Link
      to={href}
      className="inline-flex items-center no-underline"
      aria-label="1600.now homepage"
      onClick={(event) => {
        if (event.defaultPrevented) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (location.pathname === href) {
          const startY = window.scrollY || document.documentElement.scrollTop;
          if (startY <= 0) return;
          const duration = 500;
          const startTime = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            window.scrollTo(0, startY * (1 - eased));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        } else {
          navigate(href);
        }
      }}
    >
      {content}
    </Link>
  );
};
