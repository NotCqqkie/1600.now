import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import katex from "katex";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function renderMixedContent(text: string): string {
  if (!text) return "";
  
  // Normalize line breaks:
  // 1. Literal "\n" (from JSON string) -> <br />
  // 2. Real newline characters -> <br />
  // 3. Double backslashes ( \\ ) -> <br />
  // 4. Quadruple backslashes ( \\\\ ) -> <br /><br />
  
  let processedText = text;
  
  // Handle various line break representations
  processedText = processedText.replace(/\\\\\\\\/g, '<br /><br />'); // Quad slash -> Double break
  processedText = processedText.replace(/\\\\/g, '<br />');           // Double slash -> Single break
  // Also handle single backslash if user encoded it poorly (safe fallback for simple text)
  // processedText = processedText.replace(/\\/g, '<br />'); // Removing this as it breaks LaTeX commands like \frac

  processedText = processedText.replace(/\\n/g, '<br />');            // Literal \n -> Single break
  processedText = processedText.replace(/\n/g, '<br />');             // Real newline -> Single break
  
  // Split by $...$ patterns, keeping the delimiters
  const parts = processedText.split(/(\$[^$]+\$)/g);
  
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
    // Plain text - return as-is, but convert newlines to breaks
    let html = part.replace(/\n/g, '<br />');

    // Handle Markdown-style formatting
    // Bold: **text**
    html = html.replace(/\*\*([^\s](?:.*?[^\s])?)\*\*/g, '<b>$1</b>');
    // Italic: *text*
    html = html.replace(/\*([^\s](?:.*?[^\s])?)\*/g, '<i>$1</i>');
    // Underline: __text__
    html = html.replace(/__([^\s](?:.*?[^\s])?)__/g, '<u>$1</u>');

    return html;
  }).join('');
}
