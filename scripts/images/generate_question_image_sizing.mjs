import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceFiles = [
  "src/data/questionImageMap.ts",
  "src/data/unofficialQuestionImageMap.ts",
];
const outputPath = path.join(root, "src/data/questionImageSizing.generated.ts");
const generatedImageDir = path.join(root, "public/generated/sat-images");
const generatedImageBase = "/generated/sat-images/";
const imageBase = "/images/SAT-Style%20Questions/";
const maxOptimizedWidth = 1600;
const maxOptimizedHeight = 1280;
const sizeRank = {
  compact: 0,
  standard: 1,
  wide: 2,
  large: 3,
  tall: 4,
  xlarge: 5,
};

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  sharp = null;
}

const findObjectLiteral = (text) => {
  const exportIndex = text.indexOf("export const questionImageMap");
  const start = text.indexOf("{", exportIndex);
  const end = text.lastIndexOf("\n};");
  if (exportIndex === -1 || start === -1 || end === -1) {
    throw new Error("Could not find questionImageMap object literal");
  }
  return text.slice(start, end + 2);
};

const readImageMap = (relativePath) => {
  const text = fs.readFileSync(path.join(root, relativePath), "utf8");
  return Function(`return (${findObjectLiteral(text)})`)();
};

const toCanonicalSrc = (src) => {
  const basename = path.basename(decodeURIComponent(src).replace(/\\/g, "/"));
  return `${imageBase}${encodeURIComponent(basename)}`;
};

const toLocalPath = (src) => {
  const basename = path.basename(decodeURIComponent(src).replace(/\\/g, "/"));
  return path.join(root, "public/images/SAT-Style Questions", basename);
};

const collectRefs = () => {
  const refs = [];
  for (const sourceFile of sourceFiles) {
    const source = sourceFile.includes("unofficial") ? "unofficial" : "official";
    const imageMap = readImageMap(sourceFile);
    for (const [questionId, entry] of Object.entries(imageMap)) {
      for (const image of entry.questionImages ?? []) {
        refs.push({
          questionId,
          kind: "question",
          source,
          src: toCanonicalSrc(image.src),
          alt: image.alt ?? "",
        });
      }
      for (const [choiceId, src] of Object.entries(entry.choiceImages ?? {})) {
        refs.push({
          questionId,
          choiceId,
          kind: "choice",
          source,
          src: toCanonicalSrc(src),
          alt: "",
        });
      }
    }
  }
  return refs;
};

const readPngDimensions = (buffer) => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
});

const readJpegDimensions = (buffer) => {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return { width: 0, height: 0 };
};

const readSvgDimensions = (buffer) => {
  const svg = buffer.toString("utf8");
  const viewBox = svg.match(/\bviewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (viewBox) {
    return {
      width: Number(viewBox[1]),
      height: Number(viewBox[2]),
    };
  }
  const width = svg.match(/\bwidth=["']([\d.]+)/i);
  const height = svg.match(/\bheight=["']([\d.]+)/i);
  return {
    width: width ? Number(width[1]) : 0,
    height: height ? Number(height[1]) : 0,
  };
};

const readWebpDimensions = (buffer) => {
  const type = buffer.toString("ascii", 12, 16);
  if (type === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (type === "VP8 ") {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (type === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return { width: 0, height: 0 };
};

const readDimensions = (filePath, buffer) => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return readPngDimensions(buffer);
  if (extension === ".jpg" || extension === ".jpeg") return readJpegDimensions(buffer);
  if (extension === ".svg") return readSvgDimensions(buffer);
  if (extension === ".webp") return readWebpDimensions(buffer);
  return { width: 0, height: 0 };
};

const readPngHasAlpha = (buffer) => {
  if (buffer.length < 26 || buffer.toString("ascii", 1, 4) !== "PNG") return false;
  const colorType = buffer[25];
  return colorType === 4 || colorType === 6;
};

const atLeast = (size, minimum) =>
  sizeRank[size] >= sizeRank[minimum] ? size : minimum;

const classifyQuestionImage = ({ width, height, bytesPerPixel, alt }) => {
  const area = width * height;
  const maxDimension = Math.max(width, height);
  const aspectRatio = width / height;
  const detailAlt = /\b(table|graph|scatterplot|histogram|box plot|chart|data)\b/i.test(alt);

  if (!width || !height) return "standard";
  if (aspectRatio >= 2.4 && width >= 760) return "wide";
  if (height >= 900) return "tall";
  if (width <= 520 && height <= 260) return "compact";
  if (area <= 150_000 && bytesPerPixel < 0.22 && maxDimension < 500) return "compact";

  let size = "standard";
  if (
    area >= 850_000 ||
    width >= 3_000 ||
    height >= 3_600 ||
    (area >= 450_000 && bytesPerPixel >= 0.35) ||
    (area >= 900_000 && bytesPerPixel >= 0.18)
  ) {
    size = "xlarge";
  } else if (
    area >= 1_250_000 ||
    maxDimension >= 900 ||
    bytesPerPixel >= 0.2 ||
    (area >= 350_000 && bytesPerPixel >= 0.1)
  ) {
    size = "large";
  }

  return detailAlt ? atLeast(size, "large") : size;
};

const classifyChoiceImage = ({ width, height, bytesPerPixel }) => {
  const area = width * height;
  const maxDimension = Math.max(width, height);
  const aspectRatio = width / height;

  if (!width || !height) return "standard";
  if (aspectRatio >= 2.4 && width >= 420) return "wide";
  if (width <= 180 && height <= 180) return "compact";
  if (area <= 90_000 && bytesPerPixel < 0.35) return "compact";
  if (area >= 350_000 || maxDimension >= 650 || bytesPerPixel >= 0.45) return "xlarge";
  if (area >= 210_000 || maxDimension >= 500 || bytesPerPixel >= 0.32) return "large";
  return "standard";
};

const classify = (ref, metrics) =>
  ref.kind === "choice"
    ? classifyChoiceImage(metrics)
    : classifyQuestionImage(metrics);

const mergeSize = (current, next) => {
  if (!current) return next;
  return sizeRank[next] > sizeRank[current] ? next : current;
};

const escapeTsString = (value) => JSON.stringify(value);

const getImageSizes = (displaySize, kind) => {
  if (kind === "choice") {
    if (displaySize === "compact") return "(max-width: 640px) 50vw, 180px";
    if (displaySize === "wide") return "(max-width: 640px) 100vw, 420px";
    return "(max-width: 640px) 100vw, 520px";
  }
  if (displaySize === "compact") return "(max-width: 640px) 100vw, 340px";
  if (displaySize === "wide") return "(max-width: 900px) 100vw, 720px";
  if (displaySize === "xlarge") return "(max-width: 1000px) 100vw, 940px";
  return "(max-width: 800px) 100vw, 680px";
};

const getHasTransparentPixel = async (filePath, fallbackHasAlpha) => {
  if (!sharp || !fallbackHasAlpha) return fallbackHasAlpha;
  try {
    const stats = await sharp(filePath, { limitInputPixels: false }).ensureAlpha().stats();
    return (stats.channels[3]?.min ?? 255) < 255;
  } catch {
    return fallbackHasAlpha;
  }
};

const createOptimizedVariant = async ({ filePath, src, buffer, hasTransparentPixel, shouldTrim }) => {
  if (!sharp || path.extname(filePath).toLowerCase() === ".svg") return null;

  const basename = path.basename(decodeURIComponent(src), path.extname(src));
  const hash = createHash("sha1").update(buffer).digest("hex").slice(0, 10);
  const extension = hasTransparentPixel ? "png" : "webp";
  const outputName = `${basename}-${hash}.${extension}`;
  const outputPath = path.join(generatedImageDir, outputName);
  const outputSrc = `${generatedImageBase}${encodeURIComponent(outputName)}`;

  let pipeline = sharp(filePath, { limitInputPixels: false }).rotate();
  if (shouldTrim) {
    pipeline = pipeline.trim({ threshold: 10 });
  }
  pipeline = pipeline.resize({
    width: maxOptimizedWidth,
    height: maxOptimizedHeight,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (hasTransparentPixel) {
    pipeline = pipeline.png({ compressionLevel: 9, palette: true });
  } else {
    pipeline = pipeline.flatten({ background: "#fff" }).webp({ quality: 92, effort: 4 });
  }

  const info = await pipeline.toFile(outputPath);
  return {
    src: outputSrc,
    width: info.width,
    height: info.height,
    type: hasTransparentPixel ? "image/png" : "image/webp",
  };
};

const refs = collectRefs();
const refsBySrc = new Map();
for (const ref of refs) {
  const current = refsBySrc.get(ref.src);
  if (!current) {
    refsBySrc.set(ref.src, { ...ref, refs: [ref] });
    continue;
  }
  current.refs.push(ref);
  current.kind = current.kind === "choice" || ref.kind === "choice" ? "choice" : current.kind;
  current.source = current.source === "unofficial" || ref.source === "unofficial" ? "unofficial" : current.source;
  current.alt = current.alt || ref.alt;
}

fs.rmSync(generatedImageDir, { recursive: true, force: true });
fs.mkdirSync(generatedImageDir, { recursive: true });

const sizesBySrc = new Map();
const dimensionsBySrc = new Map();
const metadataBySrc = new Map();
const counts = { compact: 0, standard: 0, wide: 0, large: 0, tall: 0, xlarge: 0 };
let optimizedCount = 0;

for (const ref of refsBySrc.values()) {
  const filePath = toLocalPath(ref.src);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing image asset: ${ref.src}`);
  }
  const buffer = fs.readFileSync(filePath);
  const stats = fs.statSync(filePath);
  const { width, height } = readDimensions(filePath, buffer);
  const area = width * height;
  const bytesPerPixel = area ? stats.size / area : 0;
  const size = classify(ref, {
    width,
    height,
    bytesPerPixel,
    alt: ref.alt,
  });
  const hasTransparentPixel = await getHasTransparentPixel(filePath, readPngHasAlpha(buffer));
  const shouldTrim = ref.kind === "choice" || ref.source === "unofficial";
  const variant = await createOptimizedVariant({
    filePath,
    src: ref.src,
    buffer,
    hasTransparentPixel,
    shouldTrim,
  });

  sizesBySrc.set(ref.src, mergeSize(sizesBySrc.get(ref.src), size));
  if (!dimensionsBySrc.has(ref.src)) {
    dimensionsBySrc.set(ref.src, { width, height });
  }
  if (variant) optimizedCount += 1;
  metadataBySrc.set(ref.src, {
    width,
    height,
    bytes: stats.size,
    displaySize: size,
    hasTransparentPixel,
    optimizedSrc: variant?.src,
    optimizedWidth: variant?.width,
    optimizedHeight: variant?.height,
    optimizedType: variant?.type,
    srcSet: variant ? `${variant.src} ${variant.width}w` : undefined,
    sizes: getImageSizes(size, ref.kind),
  });
}

for (const size of sizesBySrc.values()) {
  counts[size] += 1;
}

const entries = [...sizesBySrc.entries()]
  .filter(([, size]) => size !== "standard")
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([src, size]) => `  ${escapeTsString(src)}: ${escapeTsString(size)},`);

const dimensionEntries = [...dimensionsBySrc.entries()]
  .filter(([, dimensions]) => dimensions.width > 0 && dimensions.height > 0)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([src, dimensions]) => (
    `  ${escapeTsString(src)}: { width: ${dimensions.width}, height: ${dimensions.height} },`
  ));

const metadataEntries = [...metadataBySrc.entries()]
  .filter(([, metadata]) => metadata.width > 0 && metadata.height > 0)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([src, metadata]) => {
    const fields = [
      `width: ${metadata.width}`,
      `height: ${metadata.height}`,
      `bytes: ${metadata.bytes}`,
      `displaySize: ${escapeTsString(metadata.displaySize)}`,
      `hasTransparentPixel: ${metadata.hasTransparentPixel}`,
    ];
    if (metadata.optimizedSrc) fields.push(`optimizedSrc: ${escapeTsString(metadata.optimizedSrc)}`);
    if (metadata.optimizedWidth) fields.push(`optimizedWidth: ${metadata.optimizedWidth}`);
    if (metadata.optimizedHeight) fields.push(`optimizedHeight: ${metadata.optimizedHeight}`);
    if (metadata.optimizedType) fields.push(`optimizedType: ${escapeTsString(metadata.optimizedType)}`);
    if (metadata.srcSet) fields.push(`srcSet: ${escapeTsString(metadata.srcSet)}`);
    if (metadata.sizes) fields.push(`sizes: ${escapeTsString(metadata.sizes)}`);
    return `  ${escapeTsString(src)}: { ${fields.join(", ")} },`;
  });

const output = [
  'export type QuestionImageDisplaySize = "compact" | "standard" | "wide" | "large" | "tall" | "xlarge";',
  "",
  "export interface QuestionImageDimensions {",
  "  width: number;",
  "  height: number;",
  "}",
  "",
  "export interface QuestionImageAssetMetadata extends QuestionImageDimensions {",
  "  bytes: number;",
  "  displaySize: QuestionImageDisplaySize;",
  "  hasTransparentPixel: boolean;",
  "  optimizedSrc?: string;",
  "  optimizedWidth?: number;",
  "  optimizedHeight?: number;",
  "  optimizedType?: string;",
  "  srcSet?: string;",
  "  sizes?: string;",
  "}",
  "",
  "export const questionImageDisplaySizeBySrc: Record<string, QuestionImageDisplaySize> = {",
  ...entries,
  "};",
  "",
  "export const questionImageDimensionsBySrc: Record<string, QuestionImageDimensions> = {",
  ...dimensionEntries,
  "};",
  "",
  "export const questionImageAssetMetadataBySrc: Record<string, QuestionImageAssetMetadata> = {",
  ...metadataEntries,
  "};",
  "",
].join("\n");

fs.writeFileSync(outputPath, output);
console.log(`Wrote ${path.relative(root, outputPath)}`);
console.log(`Wrote ${optimizedCount} optimized images to ${path.relative(root, generatedImageDir)}`);
console.log(
  Object.entries(counts)
    .map(([size, count]) => `${size}:${count}`)
    .join(" "),
);
