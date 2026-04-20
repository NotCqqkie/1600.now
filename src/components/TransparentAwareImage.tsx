import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TransparentAwareImageProps {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  loading?: "eager" | "lazy";
  trimWhitespace?: boolean;
}

const transparencyCache = new Map<string, boolean>();
const trimmedImageCache = new Map<string, string>();

const isPngAsset = (src: string) => /\.png(?:$|[?#])/i.test(src);

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
  const backgroundSamples = corners.map((offset) => ({
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
    a: data[offset + 3],
  }));

  // Cluster corners by color similarity, then pick the largest cluster.
  // Ties are broken by luminosity — background is nearly always lighter than content.
  const clusterTolerance = 30;
  const clusters: (typeof backgroundSamples)[] = [];
  for (const sample of backgroundSamples) {
    let placed = false;
    for (const cluster of clusters) {
      const ref = cluster[0];
      if (
        channelsAreNear(sample.r, ref.r, clusterTolerance) &&
        channelsAreNear(sample.g, ref.g, clusterTolerance) &&
        channelsAreNear(sample.b, ref.b, clusterTolerance)
      ) {
        cluster.push(sample);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([sample]);
  }
  clusters.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const lumA = a[0].r + a[0].g + a[0].b;
    const lumB = b[0].r + b[0].g + b[0].b;
    return lumB - lumA;
  });
  const winnerCluster = clusters[0];
  const clusterSum = winnerCluster.reduce(
    (acc, s) => ({ r: acc.r + s.r, g: acc.g + s.g, b: acc.b + s.b, a: acc.a + s.a }),
    { r: 0, g: 0, b: 0, a: 0 },
  );
  const background = {
    r: clusterSum.r / winnerCluster.length,
    g: clusterSum.g / winnerCluster.length,
    b: clusterSum.b / winnerCluster.length,
    a: clusterSum.a / winnerCluster.length,
  };

  const tolerance = 10;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      const isTransparentBackground = alpha <= tolerance;
      const matchesBackground =
        channelsAreNear(data[offset], background.r, tolerance) &&
        channelsAreNear(data[offset + 1], background.g, tolerance) &&
        channelsAreNear(data[offset + 2], background.b, tolerance) &&
        channelsAreNear(alpha, background.a, tolerance);

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

  if (horizontalReduction < 24 && verticalReduction < 24) {
    return null;
  }

  const padding = 2;
  const paddedMinX = Math.max(0, minX - padding);
  const paddedMinY = Math.max(0, minY - padding);
  const paddedMaxX = Math.min(width - 1, maxX + padding);
  const paddedMaxY = Math.min(height - 1, maxY + padding);
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
}: TransparentAwareImageProps) => {
  const [hasTransparency, setHasTransparency] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const cachedTrimmedInitial = trimWhitespace ? trimmedImageCache.get(src) : undefined;
  const [isReady, setIsReady] = useState(() => !trimWhitespace || Boolean(cachedTrimmedInitial));

  useEffect(() => {
    let cancelled = false;

    const cachedTrimmed = trimWhitespace ? trimmedImageCache.get(src) : undefined;
    setResolvedSrc(cachedTrimmed ?? src);
    setIsReady(!trimWhitespace || Boolean(cachedTrimmed));
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

    if (cached !== undefined && (!trimWhitespace || cachedTrimmed)) {
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
      } catch {
        // Keep the original image if client-side trimming fails.
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
  }, [src, trimWhitespace]);

  return (
    <span
      className={cn(
        "inline-flex max-w-full justify-center",
        hasTransparency && "dark:rounded-md dark:bg-white dark:p-2",
        wrapperClassName
      )}
    >
      <img
        src={resolvedSrc}
        alt={alt}
        className={className}
        loading={loading}
        style={isReady ? undefined : { visibility: "hidden" }}
      />
    </span>
  );
};
