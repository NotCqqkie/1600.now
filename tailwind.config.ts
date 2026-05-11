import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Design-system roles. `sans` is Inter (body workhorse), `display` is
        // Inter Tight (headings + big numbers), `num` is Inter Tight with
        // tabular-nums for counts/scores/time, `mono` is JetBrains Mono
        // (metadata/IDs only), `serif-italic` is Instrument Serif Italic
        // (used exactly once — the home hero "best score.").
        'minion': ['"Minion Pro"', '"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'sans-serif'],
        num:  ['"Inter Tight"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
        'serif-italic': ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      fontSize: {
        // Display sizes — Inter Tight, tight tracking, near-1.0 line-height.
        'display-xl':   ['clamp(48px, 7.4vw, 108px)', { lineHeight: '0.98', letterSpacing: '-0.04em',  fontWeight: '600' }],
        'display-lg':   ['clamp(40px, 5.6vw, 84px)',  { lineHeight: '0.98', letterSpacing: '-0.04em',  fontWeight: '600' }],
        'display-md':   ['clamp(36px, 4.4vw, 54px)',  { lineHeight: '1.0',  letterSpacing: '-0.035em', fontWeight: '600' }],
        'display-sm':   ['clamp(32px, 3.8vw, 42px)',  { lineHeight: '1.0',  letterSpacing: '-0.03em',  fontWeight: '600' }],
        'display-xs':   ['30px', { lineHeight: '1.1',  letterSpacing: '-0.025em', fontWeight: '600' }],

        // Headings (column titles, modal titles, card titles).
        'h-section':    ['52px', { lineHeight: '1.05', letterSpacing: '-0.035em', fontWeight: '600' }],
        'h-column':     ['22px', { lineHeight: '1.1',  letterSpacing: '-0.015em', fontWeight: '600' }],
        'h-domain':     ['17px', { lineHeight: '1.3',  letterSpacing: '-0.01em',  fontWeight: '600' }],
        'h-card':       ['24px', { lineHeight: '1.1',  letterSpacing: '-0.02em',  fontWeight: '600' }],

        // Number-only scales (consumers must add font-num + tabular-nums).
        'num-hero':     ['clamp(64px, 8.6vw, 132px)', { lineHeight: '0.95', letterSpacing: '-0.04em',  fontWeight: '700' }],
        'num-score':    ['96px', { lineHeight: '0.95', letterSpacing: '-0.045em', fontWeight: '700' }],
        'num-flash':    ['120px',{ lineHeight: '1.0',  letterSpacing: '-0.035em', fontWeight: '500' }],
        'num-input':    ['36px', { lineHeight: '1.0',  letterSpacing: '-0.025em', fontWeight: '600' }],
        'num-progress': ['30px', { lineHeight: '1.0',  letterSpacing: '-0.02em',  fontWeight: '600' }],

        // Body / UI scales.
        'body-lg':    ['18px', { lineHeight: '1.55', fontWeight: '400' }],
        'body':       ['16px', { lineHeight: '1.5',  fontWeight: '400' }],
        'body-sm':    ['14px', { lineHeight: '1.5',  fontWeight: '400' }],
        'ui':         ['14px', { lineHeight: '1.0',  letterSpacing: '-0.005em' }],
        'ui-sm':      ['13px', { lineHeight: '1.4',  letterSpacing: '-0.005em' }],
        'meta':       ['12px', { lineHeight: '1.3' }],
        'eyebrow':    ['11px', { lineHeight: '1',    letterSpacing: '0.14em' }],
        'kbd':        ['10px', { lineHeight: '1',    letterSpacing: '0.04em' }],

        // Back-compat aliases — older code references these.
        'hero':    ['clamp(44px, 6.2vw, 84px)', { lineHeight: '0.98', letterSpacing: '-0.035em', fontWeight: '500' }],
        'lede':    ['19px', { lineHeight: '1.55', fontWeight: '300' }],
        'h2':      ['30px', { lineHeight: '1',    letterSpacing: '-0.02em',  fontWeight: '500' }],
        'h3':      ['20px', { lineHeight: '1.2',  letterSpacing: '-0.015em', fontWeight: '500' }],
        'h3-sm':   ['17px', { lineHeight: '1.2',  letterSpacing: '-0.01em',  fontWeight: '500' }],
        'stat-xl': ['72px', { lineHeight: '0.95', letterSpacing: '-0.04em',  fontWeight: '600' }],
        'stat-lg': ['34px', { lineHeight: '1',    letterSpacing: '-0.025em', fontWeight: '600' }],
        'stat':    ['15px', { lineHeight: '1',    letterSpacing: '-0.01em',  fontWeight: '600' }],
      },
      colors: {
        // ── Design system ink palette ──────────────────────────
        // Wrapped in rgb(var(--token) / <alpha-value>) so consumers can
        // do `text-ink/70` or `bg-ds-good/12` for tints.
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          mid: "rgb(var(--ink-mid) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          "muted-dim": "rgb(var(--ink-muted-dim) / <alpha-value>)",
          // `ink-fixed` does NOT flip in dark mode. Use it for text on the
          // accent button, sidebar active state, toast/tooltip dark fills.
          fixed: "rgb(var(--ink-fixed) / <alpha-value>)",
        },
        ds: {
          accent: "rgb(var(--ds-accent) / <alpha-value>)",
          "accent-deep": "rgb(var(--ds-accent-deep) / <alpha-value>)",
          good: "rgb(var(--ds-good) / <alpha-value>)",
          "good-tint": "rgb(var(--ds-good-tint) / 0.12)",
          bad: "rgb(var(--ds-bad) / <alpha-value>)",
          "bad-tint": "rgb(var(--ds-bad) / 0.12)",
          "line-soft": "rgb(var(--ds-line-soft) / 0.08)",
          line: "rgb(var(--ds-line-soft) / 0.10)",
        },
        cobalt: {
          DEFAULT: "rgb(var(--cobalt) / <alpha-value>)",
          deep: "rgb(var(--cobalt-deep) / <alpha-value>)",
          ink: "rgb(var(--cobalt-ink) / <alpha-value>)",
        },

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "scale-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.95)" },
        },
        "bounce-in": {
          "0%": { opacity: "0", transform: "scale(0.3)" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
        "pulse-success": {
          "0%": { boxShadow: "0 0 0 0 rgba(34, 197, 94, 0.7)" },
          "70%": { boxShadow: "0 0 0 10px rgba(34, 197, 94, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(34, 197, 94, 0)" },
        },
        "pulse-error": {
          "0%": { boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.7)" },
          "70%": { boxShadow: "0 0 0 10px rgba(239, 68, 68, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(239, 68, 68, 0)" },
        },
        "flip-in": {
          from: { transform: "rotateY(-90deg)", opacity: "0" },
          to: { transform: "rotateY(0)", opacity: "1" },
        },
        "card-reveal": {
          from: { opacity: "0", transform: "scale(0.8) rotateY(-10deg)" },
          to: { opacity: "1", transform: "scale(1) rotateY(0)" },
        },
        "confetti": {
          "0%": { transform: "translateY(0) rotate(0)", opacity: "1" },
          "100%": { transform: "translateY(-100px) rotate(720deg)", opacity: "0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "shimmer": {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        "match-success": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)", boxShadow: "0 0 20px rgba(34, 197, 94, 0.5)" },
          "100%": { transform: "scale(1)" },
        },
        "stagger-fade": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out": "fade-out 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "slide-down": "slide-down 0.4s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "scale-out": "scale-out 0.2s ease-out",
        "bounce-in": "bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "shake": "shake 0.5s ease-in-out",
        "pulse-success": "pulse-success 0.6s ease-out",
        "pulse-error": "pulse-error 0.6s ease-out",
        "flip-in": "flip-in 0.4s ease-out",
        "card-reveal": "card-reveal 0.35s ease-out",
        "confetti": "confetti 1s ease-out forwards",
        "float": "float 3s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "match-success": "match-success 0.4s ease-out",
        "stagger-fade": "stagger-fade 0.3s ease-out forwards",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
