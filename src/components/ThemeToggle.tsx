import { Moon, Sun } from "lucide-react";
import {
  applyTheme,
} from "@/lib/theme";
import { useThemeMode } from "@/hooks/useThemeMode";

export const ThemeToggle = ({ compact = false }: { compact?: boolean }) => {
  const isDark = useThemeMode();

  const toggleTheme = () => {
    applyTheme(!isDark);
  };

  return (
    compact ? (
      <button
        type="button"
        onClick={toggleTheme}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>
    ) : (
      <button
        type="button"
        onClick={toggleTheme}
        className="relative h-8 w-14 rounded-full bg-gradient-to-r from-sky-300 to-blue-400 dark:from-indigo-900 dark:to-slate-800 p-1 transition-all duration-500 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-inner"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-200/30 to-orange-200/20 dark:from-purple-500/20 dark:to-blue-500/10 transition-all duration-500" />

        <div
          className={`
            relative h-6 w-6 rounded-full bg-white dark:bg-slate-200 shadow-lg
            transform transition-all duration-300
            ${isDark ? "translate-x-6" : "translate-x-0"}
            flex items-center justify-center
          `}
          style={{
            transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
            boxShadow: isDark
              ? "0 2px 8px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.2)"
              : "0 2px 8px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.8)",
          }}
        >
          <div className={`transition-all duration-500 ${isDark ? "rotate-[360deg]" : "rotate-0"}`}>
            {isDark ? (
              <Moon className="h-3.5 w-3.5 text-indigo-600" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>
        </div>

        <div className={`absolute inset-0 overflow-hidden rounded-full pointer-events-none transition-opacity duration-500 ${isDark ? "opacity-100" : "opacity-0"}`}>
          <div className="absolute top-1.5 left-2 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
          <div className="absolute top-3 left-3.5 w-0.5 h-0.5 bg-white/70 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
          <div className="absolute top-1 left-5 w-0.5 h-0.5 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: "600ms" }} />
        </div>
      </button>
    )
  );
};
