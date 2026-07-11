const LOOPBACK_ORIGIN_PATTERN =
  /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?=\/|[?#]|$)/i;
const LOOPBACK_URL_PATTERN =
  /https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?=\/|[?#"'<> \t\r\n]|$)[^"'<> \t\r\n]*/gi;

const quotedAttributeValue = (tag, attribute) => {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*([\"'])([^\"']*)\\1`, "i");
  return tag.match(pattern)?.[2] ?? null;
};

const isModulePreload = (tag) =>
  quotedAttributeValue(tag, "rel")
    ?.split(/\s+/)
    .some((value) => value.toLowerCase() === "modulepreload") ?? false;

export const isLoopbackHttpUrl = (value) => LOOPBACK_ORIGIN_PATTERN.test(value);

export const pruneLoopbackModulePreloads = (html) =>
  html.replace(/<link\b[^>]*>/gi, (linkTag) => {
    if (!isModulePreload(linkTag)) return linkTag;
    const href = quotedAttributeValue(linkTag, "href");
    return href && isLoopbackHttpUrl(href) ? "" : linkTag;
  });

export const normalizeLoopbackAttributeUrls = (html) =>
  html.replace(/<[^>]+>/g, (tag) => {
    if (/^<link\b/i.test(tag) && isModulePreload(tag)) return tag;
    return tag.replace(
      /\b(href|src)(\s*=\s*)([\"'])([^\"']*)\3/gi,
      (attribute, name, separator, quote, value) => {
        if (!isLoopbackHttpUrl(value)) return attribute;
        const suffix = value.replace(LOOPBACK_ORIGIN_PATTERN, "");
        const relativeUrl = suffix.startsWith("/") ? suffix : `/${suffix}`;
        return `${name}${separator}${quote}${relativeUrl}${quote}`;
      },
    );
  });

export const findLoopbackUrls = (html) =>
  Array.from(new Set(html.match(LOOPBACK_URL_PATTERN) ?? []));

export const assertNoLoopbackUrls = (html, context = "Prerendered HTML") => {
  const loopbackUrls = findLoopbackUrls(html);
  if (loopbackUrls.length === 0) return;
  throw new Error(
    `${context} contains loopback URLs: ${loopbackUrls.slice(0, 3).join(", ")}`,
  );
};
