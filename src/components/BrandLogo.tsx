import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

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
  const lightSrc = variant === "mark" ? "/logo_b.png" : "/logo_text_b.png";
  const darkSrc = variant === "mark" ? "/logo_w.png" : "/logo_text_w.png";

  const content = (
    <span
      className={cn(
        variant === "mark"
          ? "relative block h-10 w-10 shrink-0 overflow-hidden"
          : "relative block h-10 w-[150px] shrink-0 overflow-hidden",
        className,
      )}
    >
      <img
        src={lightSrc}
        alt="1600.now"
        className={cn(
          "absolute inset-0 h-full w-full object-contain opacity-100 transition-opacity duration-100 dark:opacity-0",
          imageClassName,
        )}
        loading="eager"
        decoding="async"
      />
      <img
        src={darkSrc}
        alt="1600.now"
        className={cn(
          "absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-100 dark:opacity-100",
          imageClassName,
        )}
        loading="eager"
        decoding="async"
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
