import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getPreferredDarkMode, THEME_EVENT, THEME_STORAGE_KEY } from "@/lib/theme";

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
  const [isDark, setIsDark] = useState(getPreferredDarkMode);

  useEffect(() => {
    const syncTheme = () => {
      setIsDark(getPreferredDarkMode());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        syncTheme();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_EVENT, syncTheme);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_EVENT, syncTheme);
    };
  }, []);

  const src = variant === "mark"
    ? (isDark ? "/optimized/logo_w_160.png" : "/optimized/logo_b_160.png")
    : (isDark ? "/optimized/logo_text_w_600.png" : "/optimized/logo_text_b_600.png");

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
