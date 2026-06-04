import DOMPurify, { type Config } from "dompurify";

// Central sanitizer for any HTML string that will be rendered inline. Strips
// scripts, event handlers, javascript: URLs, and other XSS vectors while
// preserving the tags we actually render (KaTeX spans, callouts, lists,
// images, math, etc.).
const CONFIG: Config = {
  ADD_ATTR: ["target"],
  FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "base", "link", "meta", "noscript"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
};

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, CONFIG) as unknown as string;
}
