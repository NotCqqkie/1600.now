import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceFiles = [
  "src/data/questionImageMap.ts",
  "src/data/unofficialQuestionImageMap.ts",
];
const outputPath = path.join(root, "src/data/questionImageSizing.generated.ts");
const imageBase = "/images/SAT-Style%20Questions/";
const sizeRank = {
  compact: 0,
  standard: 1,
  wide: 2,
  large: 3,
  tall: 4,
  xlarge: 5,
};

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
    const imageMap = readImageMap(sourceFile);
    for (const [questionId, entry] of Object.entries(imageMap)) {
      for (const image of entry.questionImages ?? []) {
        refs.push({
          questionId,
          kind: "question",
          src: toCanonicalSrc(image.src),
          alt: image.alt ?? "",
        });
      }
      for (const [choiceId, src] of Object.entries(entry.choiceImages ?? {})) {
        refs.push({
          questionId,
          choiceId,
          kind: "choice",
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

const readDimensions = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return readPngDimensions(buffer);
  if (extension === ".jpg" || extension === ".jpeg") return readJpegDimensions(buffer);
  if (extension === ".svg") return readSvgDimensions(buffer);
  if (extension === ".webp") return readWebpDimensions(buffer);
  return { width: 0, height: 0 };
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

const refs = collectRefs();
const sizesBySrc = new Map();
const counts = { compact: 0, standard: 0, wide: 0, large: 0, tall: 0, xlarge: 0 };

for (const ref of refs) {
  const filePath = toLocalPath(ref.src);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing image asset: ${ref.src}`);
  }
  const stats = fs.statSync(filePath);
  const { width, height } = readDimensions(filePath);
  const area = width * height;
  const bytesPerPixel = area ? stats.size / area : 0;
  const size = classify(ref, {
    width,
    height,
    bytesPerPixel,
    alt: ref.alt,
  });
  sizesBySrc.set(ref.src, mergeSize(sizesBySrc.get(ref.src), size));
}

for (const size of sizesBySrc.values()) {
  counts[size] += 1;
}

const entries = [...sizesBySrc.entries()]
  .filter(([, size]) => size !== "standard")
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([src, size]) => `  ${JSON.stringify(src)}: ${JSON.stringify(size)},`);

const output = [
  'export type QuestionImageDisplaySize = "compact" | "standard" | "wide" | "large" | "tall" | "xlarge";',
  "",
  "export const questionImageDisplaySizeBySrc: Record<string, QuestionImageDisplaySize> = {",
  ...entries,
  "};",
  "",
].join("\n");

fs.writeFileSync(outputPath, output);
console.log(`Wrote ${path.relative(root, outputPath)}`);
console.log(
  Object.entries(counts)
    .map(([size, count]) => `${size}:${count}`)
    .join(" "),
);
