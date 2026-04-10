import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePublicAssetPath(path: string): string {
  if (!path) return path;

  const trimmed = path.trim();
  if (!trimmed || /^(?:https?:|data:|blob:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  const [pathAndQuery, hash = ""] = trimmed.split("#");
  const [pathname, query = ""] = pathAndQuery.split("?");
  const normalizedPath = pathname.replace(/\\/g, "/");
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
