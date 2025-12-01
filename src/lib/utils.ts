import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import katex from "katex";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function renderMixedContent(text: string): string {
  // Split by $...$ patterns, keeping the delimiters
  const parts = text.split(/(\$[^$]+\$)/g);
  
  return parts.map(part => {
    if (part.startsWith('$') && part.endsWith('$')) {
      // This is a math section - extract content and render with KaTeX
      const mathContent = part.slice(1, -1);
      try {
        return katex.renderToString(mathContent, {
          displayMode: false,
          throwOnError: false,
          trust: true,
          strict: false
        });
      } catch (error) {
        console.error('KaTeX error:', error);
        return part; // Return original on error
      }
    }
    // Plain text - return as-is
    return part;
  }).join('');
}
