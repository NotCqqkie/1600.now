import DOMPurify, { type Config } from "dompurify";
const CONFIG: Config = {
  ADD_ATTR: ["target"],
  FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "base", "link", "meta", "noscript"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
};

// Since ADD_ATTR allows target (e.g. target="_blank"), force a safe rel on any
// anchor that sets target so sanitized links can't reach window.opener.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node instanceof Element && node.tagName === "A" && node.hasAttribute("target")) {
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, CONFIG);
}
