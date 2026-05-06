import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
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
        'minion': ['"Minion Pro"', '"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['Geist', 'system-ui', 'sans-serif'],
        num:  ['"Inter Tight"', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'hero':    ['clamp(44px, 6.2vw, 84px)', { lineHeight: '0.98', letterSpacing: '-0.035em', fontWeight: '500' }],
        'lede':    ['19px', { lineHeight: '1.55', fontWeight: '300' }],
        'h2':      ['30px', { lineHeight: '1',    letterSpacing: '-0.02em',  fontWeight: '500' }],
        'h3':      ['20px', { lineHeight: '1.2',  letterSpacing: '-0.015em', fontWeight: '500' }],
        'h3-sm':   ['17px', { lineHeight: '1.2',  letterSpacing: '-0.01em',  fontWeight: '500' }],
        'stat-xl': ['72px', { lineHeight: '0.95', letterSpacing: '-0.04em',  fontWeight: '600' }],
        'stat-lg': ['34px', { lineHeight: '1',    letterSpacing: '-0.025em', fontWeight: '600' }],
        'stat':    ['15px', { lineHeight: '1',    letterSpacing: '-0.01em',  fontWeight: '600' }],
        'body':    ['16px', { lineHeight: '1.6' }],
        'ui':      ['14px', { lineHeight: '1' }],
        'ui-sm':   ['13px', { lineHeight: '1.5' }],
        'meta':    ['12px', { lineHeight: '1' }],
        'eyebrow': ['11px', { lineHeight: '1', letterSpacing: '0.12em' }],
        'kbd':     ['10px', { lineHeight: '1', letterSpacing: '0.04em' }],
      },
      colors: {
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
