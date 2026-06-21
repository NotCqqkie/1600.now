import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ImageIntrinsicSize = {
  width: number;
  height: number;
};

interface TransparentAwareImageProps {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  loading?: "eager" | "lazy";
  trimWhitespace?: boolean;
  reserveWhiteBackground?: boolean;
  intrinsicSize?: ImageIntrinsicSize;
}

const transparencyCache = new Map<string, boolean>();
const trimmedImageCache = new Map<string, string>();
const TABLE_IMAGE_HEIGHT_REPLACEMENTS: readonly (readonly [string, string])[] = [
  ["max-h-[460px]", "max-h-[368px]"],
  ["max-h-[420px]", "max-h-[336px]"],
  ["max-h-[340px]", "max-h-[272px]"],
  ["max-h-[309px]", "max-h-[247px]"],
  ["max-h-[260px]", "max-h-[208px]"],
  ["max-h-[220px]", "max-h-[176px]"],
  ["max-h-[195px]", "max-h-[156px]"],
  ["sm:max-h-[260px]", "sm:max-h-[208px]"],
];
const BACKGROUND_CLUSTER_TOLERANCE = 30;
const CROP_BACKGROUND_TOLERANCE = 10;
const MIN_CROP_REDUCTION_PX = 24;
const CROP_PADDING_PX = 2;

type RgbaSample = {
  r: number;
  g: number;
  b: number;
  a: number;
};

const isPngAsset = (src: string) => /\.png(?:$|[?#])/i.test(src);

const isBitmapAsset = (src: string) => /\.(?:png|jpe?g|webp)(?:$|[?#])/i.test(src);

const isTableImageAlt = (alt: string) => /\btable\b/i.test(alt);

const hasExplicitQuestionImageSize = (className?: string) =>
  /\bquestion-image-size\b/.test(className ?? "");

const scaleTableImageClassName = (className?: string) => {
  let scaled = className ?? "";
  TABLE_IMAGE_HEIGHT_REPLACEMENTS.forEach(([from, to]) => {
    scaled = scaled.split(from).join(to);
  });
  return cn(scaled, "max-w-[80%] border-0 rounded-none");
};

const parseCssLength = (value: string, reference: number): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "none") return undefined;
  if (trimmed.endsWith("px")) return Number.parseFloat(trimmed);
  if (trimmed.endsWith("%")) return reference * (Number.parseFloat(trimmed) / 100);
  const numeric = Number.parseFloat(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const getReservedImageSize = (
  intrinsicSize: ImageIntrinsicSize,
  parentWidth: number,
  maxWidth: number | undefined,
  maxHeight: number | undefined,
): ImageIntrinsicSize => {
  let width = Math.min(intrinsicSize.width, parentWidth || intrinsicSize.width, maxWidth ?? Number.POSITIVE_INFINITY);
  let height = width * (intrinsicSize.height / intrinsicSize.width);

  if (maxHeight !== undefined && height > maxHeight) {
    height = maxHeight;
    width = height * (intrinsicSize.width / intrinsicSize.height);
  }

  return { width, height };
};

const hasTransparentPixel = (img: HTMLImageElement) => {
  const width = img.naturalWidth;
  const height = img.naturalHeight;

  if (!width || !height) {
    return false;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return false;
  }

  context.drawImage(img, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true;
    }
  }

  return false;
};

const channelsAreNear = (a: number, b: number, tolerance: number) =>
  Math.abs(a - b) <= tolerance;

const cropWhitespace = (img: HTMLImageElement): string | null => {
  const width = img.naturalWidth;
  const height = img.naturalHeight;

  if (!width || !height) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(img, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);

  const corners = [
    0,
    (width - 1) * 4,
    ((height - 1) * width) * 4,
    (((height - 1) * width) + (width - 1)) * 4,
  ];
  const backgroundSamples: RgbaSample[] = corners.map((offset) => ({
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
    a: data[offset + 3],
  }));
  const clusters: RgbaSample[][] = [];
  for (const sample of backgroundSamples) {
    let placed = false;
    for (const cluster of clusters) {
      const ref = cluster[0];
      if (
        channelsAreNear(sample.r, ref.r, BACKGROUND_CLUSTER_TOLERANCE) &&
        channelsAreNear(sample.g, ref.g, BACKGROUND_CLUSTER_TOLERANCE) &&
        channelsAreNear(sample.b, ref.b, BACKGROUND_CLUSTER_TOLERANCE)
      ) {
        cluster.push(sample);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([sample]);
  }
  clusters.sort((leftCluster, rightCluster) => {
    if (rightCluster.length !== leftCluster.length) return rightCluster.length - leftCluster.length;
    const leftLuminosity = leftCluster[0].r + leftCluster[0].g + leftCluster[0].b;
    const rightLuminosity = rightCluster[0].r + rightCluster[0].g + rightCluster[0].b;
    return rightLuminosity - leftLuminosity;
  });
  const winnerCluster = clusters[0];
  const clusterSum = winnerCluster.reduce(
    (acc, sample) => ({ r: acc.r + sample.r, g: acc.g + sample.g, b: acc.b + sample.b, a: acc.a + sample.a }),
    { r: 0, g: 0, b: 0, a: 0 },
  );
  const background = {
    r: clusterSum.r / winnerCluster.length,
    g: clusterSum.g / winnerCluster.length,
    b: clusterSum.b / winnerCluster.length,
    a: clusterSum.a / winnerCluster.length,
  };

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      const isTransparentBackground = alpha <= CROP_BACKGROUND_TOLERANCE;
      const matchesBackground =
        channelsAreNear(data[offset], background.r, CROP_BACKGROUND_TOLERANCE) &&
        channelsAreNear(data[offset + 1], background.g, CROP_BACKGROUND_TOLERANCE) &&
        channelsAreNear(data[offset + 2], background.b, CROP_BACKGROUND_TOLERANCE) &&
        channelsAreNear(alpha, background.a, CROP_BACKGROUND_TOLERANCE);

      if (isTransparentBackground || matchesBackground) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  const croppedWidth = maxX - minX + 1;
  const croppedHeight = maxY - minY + 1;
  const horizontalReduction = width - croppedWidth;
  const verticalReduction = height - croppedHeight;

  if (horizontalReduction < MIN_CROP_REDUCTION_PX && verticalReduction < MIN_CROP_REDUCTION_PX) {
    return null;
  }

  const paddedMinX = Math.max(0, minX - CROP_PADDING_PX);
  const paddedMinY = Math.max(0, minY - CROP_PADDING_PX);
  const paddedMaxX = Math.min(width - 1, maxX + CROP_PADDING_PX);
  const paddedMaxY = Math.min(height - 1, maxY + CROP_PADDING_PX);
  const paddedWidth = paddedMaxX - paddedMinX + 1;
  const paddedHeight = paddedMaxY - paddedMinY + 1;

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = paddedWidth;
  croppedCanvas.height = paddedHeight;

  const croppedContext = croppedCanvas.getContext("2d");
  if (!croppedContext) {
    return null;
  }

  croppedContext.drawImage(
    canvas,
    paddedMinX,
    paddedMinY,
    paddedWidth,
    paddedHeight,
    0,
    0,
    paddedWidth,
    paddedHeight,
  );

  return croppedCanvas.toDataURL("image/png");
};

export const TransparentAwareImage = ({
  src,
  alt,
  className,
  wrapperClassName,
  loading = "lazy",
  trimWhitespace = false,
  reserveWhiteBackground = false,
  intrinsicSize,
}: TransparentAwareImageProps) => {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [hasTransparency, setHasTransparency] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [reservedSize, setReservedSize] = useState<ImageIntrinsicSize | null>(null);
  const shouldReserveWhiteBackground = Boolean(
    reserveWhiteBackground &&
    intrinsicSize?.width &&
    intrinsicSize.height &&
    isBitmapAsset(src)
  );
  const imageClassName = isTableImageAlt(alt) && !hasExplicitQuestionImageSize(className)
    ? scaleTableImageClassName(className)
    : className;
  const cachedTrimmedInitial = trimWhitespace ? trimmedImageCache.get(src) : undefined;
  const [isReady, setIsReady] = useState(() =>
    (!trimWhitespace && !shouldReserveWhiteBackground) || Boolean(cachedTrimmedInitial)
  );

  useEffect(() => {
    let cancelled = false;

    const cachedTrimmed = trimWhitespace ? trimmedImageCache.get(src) : undefined;
    setResolvedSrc(cachedTrimmed ?? src);
    setIsReady((!trimWhitespace && !shouldReserveWhiteBackground) || Boolean(cachedTrimmed));
    const shouldDetectTransparency = isPngAsset(src);
    if (!shouldDetectTransparency) {
      setHasTransparency(false);
    }

    const cached = shouldDetectTransparency ? transparencyCache.get(src) : undefined;
    if (shouldDetectTransparency && cached !== undefined) {
      setHasTransparency(cached);
    } else if (shouldDetectTransparency) {
      setHasTransparency(false);
    }

    if (cached !== undefined && (!trimWhitespace || cachedTrimmed) && !shouldReserveWhiteBackground) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;

      if (shouldDetectTransparency) {
        const cachedTransparency = transparencyCache.get(src);
        if (cachedTransparency !== undefined) {
          setHasTransparency(cachedTransparency);
        } else {
          try {
            const transparent = hasTransparentPixel(img);
            transparencyCache.set(src, transparent);
            setHasTransparency(transparent);
          } catch {
            transparencyCache.set(src, false);
            setHasTransparency(false);
          }
        }
      }

      if (!trimWhitespace || trimmedImageCache.has(src)) {
        setIsReady(true);
        return;
      }

      try {
        const trimmed = cropWhitespace(img);
        if (trimmed) {
          trimmedImageCache.set(src, trimmed);
          setResolvedSrc(trimmed);
        }
      } catch (error) {
        console.error("Failed to crop transparent image:", error);
      }
      setIsReady(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      setIsReady(true);
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, trimWhitespace, shouldReserveWhiteBackground]);

  useLayoutEffect(() => {
    if (!shouldReserveWhiteBackground || !intrinsicSize || isReady) {
      setReservedSize(null);
      return;
    }

    const updateReservedSize = () => {
      const wrapper = wrapperRef.current;
      const img = imgRef.current;
      if (!wrapper || !img) return;

      const parentWidth = wrapper.parentElement?.getBoundingClientRect().width ?? intrinsicSize.width;
      const imageStyle = getComputedStyle(img);
      const maxWidth = parseCssLength(imageStyle.getPropertyValue("--question-image-max-width"), parentWidth);
      const maxHeight = parseCssLength(imageStyle.getPropertyValue("--question-image-max-height"), parentWidth);
      const nextSize = getReservedImageSize(intrinsicSize, parentWidth, maxWidth, maxHeight);

      setReservedSize((current) =>
        current &&
        Math.round(current.width) === Math.round(nextSize.width) &&
        Math.round(current.height) === Math.round(nextSize.height)
          ? current
          : nextSize
      );
    };

    updateReservedSize();

    const parent = wrapperRef.current?.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateReservedSize);
      return () => window.removeEventListener("resize", updateReservedSize);
    }

    const observer = new ResizeObserver(updateReservedSize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [imageClassName, intrinsicSize, isReady, shouldReserveWhiteBackground]);

  const reserveWrapperStyle = reservedSize
    ? {
        width: `${reservedSize.width}px`,
        height: `${reservedSize.height}px`,
      }
    : undefined;

  return (
    <span
      ref={wrapperRef}
      className={cn(
        "inline-flex max-w-full min-w-0 box-border justify-center",
        reservedSize && "question-image-loading-placeholder",
        hasTransparency && "dark:rounded-md dark:bg-white dark:p-2",
        wrapperClassName
      )}
      style={reserveWrapperStyle}
    >
      <img
        ref={imgRef}
        src={resolvedSrc}
        alt={alt}
        className={cn(imageClassName, shouldReserveWhiteBackground && "rounded-lg")}
        loading={loading}
        decoding="async"
        style={isReady ? undefined : { visibility: "hidden" }}
      />
    </span>
  );
};
