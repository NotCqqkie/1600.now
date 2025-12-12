import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="relative h-8 w-14 rounded-full bg-gradient-to-r from-sky-300 to-blue-400 dark:from-indigo-900 dark:to-slate-800 p-1 transition-all duration-500 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-inner"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Track glow effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-200/30 to-orange-200/20 dark:from-purple-500/20 dark:to-blue-500/10 transition-all duration-500" />
      
      {/* Sliding knob with physics spring animation */}
      <div
        className={`
          relative h-6 w-6 rounded-full bg-white dark:bg-slate-200 shadow-lg
          transform transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${isDark ? 'translate-x-6' : 'translate-x-0'}
          flex items-center justify-center
        `}
        style={{
          boxShadow: isDark 
            ? '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.2)' 
            : '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.8)'
        }}
      >
        {/* Icon with rotation animation */}
        <div className={`transition-all duration-500 ${isDark ? 'rotate-[360deg]' : 'rotate-0'}`}>
          {isDark ? (
            <Moon className="h-3.5 w-3.5 text-indigo-600" />
          ) : (
            <Sun className="h-3.5 w-3.5 text-amber-500" />
          )}
        </div>
      </div>
      
      {/* Stars for dark mode */}
      <div className={`absolute inset-0 overflow-hidden rounded-full pointer-events-none transition-opacity duration-500 ${isDark ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute top-1.5 left-2 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="absolute top-3 left-3.5 w-0.5 h-0.5 bg-white/70 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
        <div className="absolute top-1 left-5 w-0.5 h-0.5 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
      </div>
    </button>
  );
};
