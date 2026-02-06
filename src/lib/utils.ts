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
  
  const applyInlineFormatting = (content: string): string => {
    let html = content.replace(/\n/g, "<br />");

    // Bold: **text**
    html = html.replace(/\*\*([^*]+?)\*\*/g, (_, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `<b>${trimmed}</b>` : _;
    });

    // Underline: __text__
    html = html.replace(/__([^_]+?)__/g, (_, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `<u>${trimmed}</u>` : _;
    });

    // Italic (asterisks): *text* (supports spacing like "* n *")
    html = html.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, (_, prefix: string, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `${prefix}<i>${trimmed}</i>` : _;
    });

    // Italic (underscores): _text_ (supports spacing like "_ n _")
    html = html.replace(/(^|[^_])_([^_]+?)_(?!_)/g, (_, prefix: string, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `${prefix}<i>${trimmed}</i>` : _;
    });

    return html;
  };

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
    return applyInlineFormatting(part);
  }).join('');
}
