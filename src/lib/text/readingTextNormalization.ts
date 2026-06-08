export const normalizeReadingText = (text: string | null | undefined): string => {
  if (!text) return text || "";
  return text.replace(/\r\n?/g, "\n");
};

export const normalizeReadingDisplayText = (text: string | null | undefined): string => {
  let normalized = normalizeReadingText(text);
  if (!normalized) return normalized;
  normalized = normalized.replace(/<(?:b|strong)[^>]*>\s*(Text\s*[1-4])\s*<\/(?:b|strong)>/gi, "$1");
  normalized = normalized.replace(/([.?!])\s*(Text)\s*([1-4])(?=\b)/gi, "$1\nText $3");
  normalized = normalized.replace(/(^|\n)\s*Text\s*([1-4])(?=\b)/gi, "$1Text $2");
  normalized = normalized.replace(/(^|\n)(Text\s+[1-4])\s+(?=[A-Z“"(<])/g, "$1$2\n");
  normalized = normalized.replace(/\[\s+/g, "[").replace(/\s+\]/g, "]");

  return normalized;
};
