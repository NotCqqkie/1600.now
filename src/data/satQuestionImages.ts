import { questionImageMap, type QuestionImageMapEntry } from "./questionImageMap";
import { satImageManifest } from "./satImageManifest";
import { questionImageMap as unofficialQuestionImageMap } from "./unofficialQuestionImageMap";
import {
  questionImageDisplaySizeBySrc,
  type QuestionImageDisplaySize,
} from "./questionImageSizing.generated";

export interface ResolvedSatImage {
  src: string;
  alt: string;
  displaySize?: QuestionImageDisplaySize;
}

const SAT_IMAGE_BASE = "/images/SAT-Style%20Questions/";
const SAT_IMAGE_MANIFEST_BASE = "/images/SAT-Style%20Questions/";

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getBasename = (input: string): string | undefined => {
  if (!input) return undefined;
  const normalized = input.replace(/\\/g, "/").trim();
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1];
};

const getFileExtension = (input: string): string => {
  const basename = getBasename(input);
  if (!basename) return "";
  const dotIndex = basename.lastIndexOf(".");
  return dotIndex >= 0 ? basename.slice(dotIndex) : "";
};

const toCanonicalSatImagePath = (input: string): string | undefined => {
  const rawName = getBasename(input);
  if (!rawName) return undefined;
  const decodedName = safeDecodeURIComponent(rawName);
  return `${SAT_IMAGE_BASE}${encodeURIComponent(decodedName)}`;
};

const toManifestSatImagePath = (path: string): string =>
  path.replace(SAT_IMAGE_BASE, SAT_IMAGE_MANIFEST_BASE);

const toPublicSatImagePath = (path: string): string =>
  path.replace(SAT_IMAGE_MANIFEST_BASE, SAT_IMAGE_BASE);

const idAliasToManifestPath = new Map<string, string>();

const registerAlias = (alias: string | undefined, targetPath: string) => {
  if (!alias) return;
  const normalizedAlias = safeDecodeURIComponent(alias).trim().toLowerCase();
  if (!normalizedAlias || idAliasToManifestPath.has(normalizedAlias)) return;
  idAliasToManifestPath.set(normalizedAlias, targetPath);
};

const allQuestionImageMaps: Record<string, QuestionImageMapEntry>[] = [
  questionImageMap,
  unofficialQuestionImageMap as Record<string, QuestionImageMapEntry>,
];

const getQuestionImageEntry = (questionId: string): QuestionImageMapEntry | undefined => {
  for (const imageMap of allQuestionImageMaps) {
    const entry = imageMap[questionId];
    if (entry) return entry;
  }
  return undefined;
};

allQuestionImageMaps.forEach((imageMap) => Object.entries(imageMap).forEach(([questionId, entry]) => {
  entry.questionImages?.forEach((image, index) => {
    const normalizedPath = toCanonicalSatImagePath(image.src);
    if (!normalizedPath || !satImageManifest.has(toManifestSatImagePath(normalizedPath))) return;

    const extension = getFileExtension(normalizedPath);
    registerAlias(questionId, normalizedPath);
    registerAlias(`${questionId}${extension}`, normalizedPath);
    registerAlias(`${questionId}_${index + 1}`, normalizedPath);
    registerAlias(`${questionId}_${index + 1}${extension}`, normalizedPath);
  });

  Object.entries(entry.choiceImages ?? {}).forEach(([choiceId, path]) => {
    const normalizedPath = toCanonicalSatImagePath(path);
    if (!normalizedPath || !satImageManifest.has(toManifestSatImagePath(normalizedPath))) return;

    const extension = getFileExtension(normalizedPath);
    registerAlias(`${questionId}_${choiceId}`, normalizedPath);
    registerAlias(`${questionId}_${choiceId}${extension}`, normalizedPath);
  });
}));

export const normalizeSatImagePath = (path: string | undefined): string | undefined => {
  if (!path) return undefined;

  const normalized = path.replace(/\\/g, "/").trim();
  const candidates = new Set<string>();

  if (normalized.startsWith("/images/")) {
    const encodedFull = normalized
      .split("/")
      .map((segment, index) =>
        index === 0 ? segment : encodeURIComponent(safeDecodeURIComponent(segment))
      )
      .join("/");
    candidates.add(encodedFull);
    candidates.add(normalized);
  }

  const canonicalSatPath = toCanonicalSatImagePath(normalized);
  if (canonicalSatPath) {
    candidates.add(canonicalSatPath);
  }

  const basename = getBasename(normalized);
  if (basename) {
    const aliasMatch = idAliasToManifestPath.get(safeDecodeURIComponent(basename).toLowerCase());
    if (aliasMatch) {
      candidates.add(aliasMatch);
    }
  }

  for (const candidate of candidates) {
    if (satImageManifest.has(toManifestSatImagePath(candidate))) {
      return toPublicSatImagePath(candidate);
    }
  }

  return undefined;
};

export const getSatImageDisplaySize = (
  path: string | undefined,
): QuestionImageDisplaySize | undefined => {
  const normalized = normalizeSatImagePath(path);
  if (!normalized) return undefined;
  return questionImageDisplaySizeBySrc[normalized] ?? "standard";
};

const buildQuestionImageAlt = (questionId: string, index: number, total: number): string =>
  total > 1
    ? `SAT question ${questionId} image ${index + 1}`
    : `SAT question ${questionId} image`;

const buildChoiceImageAlt = (questionId: string, choiceId: string): string =>
  `SAT question ${questionId} choice ${choiceId} image`;

export const resolveSatQuestionImages = (
  questionId: string | number,
  fallbackImage?: string,
): ResolvedSatImage[] | undefined => {
  const id = String(questionId);
  const supplemental = getQuestionImageEntry(id);
  const supplementalImages = supplemental?.questionImages
    ?.map((img, index, images): ResolvedSatImage | null => {
      const src = normalizeSatImagePath(img.src);
      if (!src) return null;
      return {
        src,
        alt: img.alt?.trim() || buildQuestionImageAlt(id, index, images.length),
        displaySize: getSatImageDisplaySize(src),
      };
    })
    .filter((img): img is ResolvedSatImage => Boolean(img));

  if (supplementalImages && supplementalImages.length > 0) {
    return supplementalImages;
  }

  const stemImage = normalizeSatImagePath(fallbackImage);
  if (!stemImage) return undefined;

  return [
    {
      src: stemImage,
      alt: buildQuestionImageAlt(id, 0, 1),
      displaySize: getSatImageDisplaySize(stemImage),
    },
  ];
};

export const resolveSatChoiceImage = (
  questionId: string | number,
  choiceId: string,
  explicitImage?: string,
): string | undefined => {
  const explicit = normalizeSatImagePath(explicitImage);
  if (explicit) return explicit;

  const supplemental = getQuestionImageEntry(String(questionId));
  return normalizeSatImagePath(supplemental?.choiceImages?.[choiceId]);
};

export const getSatChoiceImageAlt = (questionId: string | number, choiceId: string): string =>
  buildChoiceImageAlt(String(questionId), choiceId);
