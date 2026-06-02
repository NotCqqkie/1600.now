import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SAT_STYLE_IMAGE_BASE = "/images/SAT-Style%20Questions/";

const getBasename = (input: string): string => {
  const normalized = input.replace(/\\/g, "/").trim();
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
};

export function normalizePublicAssetPath(path: string): string {
  if (!path) return path;

  const trimmed = path.trim();
  if (!trimmed || /^(?:https?:|data:|blob:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  const [pathAndQuery, hash = ""] = trimmed.split("#");
  const [pathname, query = ""] = pathAndQuery.split("?");
  let normalizedPath = pathname.replace(/\\/g, "/");

  if (/^\/?images_labeled\//i.test(normalizedPath)) {
    const basename = getBasename(normalizedPath);
    normalizedPath = `${SAT_STYLE_IMAGE_BASE}${basename}`;
  } else if (/^\/?images\//i.test(normalizedPath) && !normalizedPath.startsWith("/")) {
    normalizedPath = `/${normalizedPath}`;
  }

  const encodedPath = normalizedPath
    .split("/")
    .map((segment, index) => {
      if (index === 0 && segment === "") return "";
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/");

  const querySuffix = query ? `?${query}` : "";
  const hashSuffix = hash ? `#${hash}` : "";
  return `${encodedPath}${querySuffix}${hashSuffix}`;
}
