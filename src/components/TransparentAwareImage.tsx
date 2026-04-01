import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TransparentAwareImageProps {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  loading?: "eager" | "lazy";
}

const transparencyCache = new Map<string, boolean>();

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

export const TransparentAwareImage = ({
  src,
  alt,
  className,
  wrapperClassName,
  loading = "lazy",
}: TransparentAwareImageProps) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [hasTransparency, setHasTransparency] = useState(false);

  useEffect(() => {
    if (!isPngAsset(src)) {
      setHasTransparency(false);
      return;
    }

    const cached = transparencyCache.get(src);
    if (cached !== undefined) {
      setHasTransparency(cached);
      return;
    }

    setHasTransparency(false);
  }, [src]);

  useEffect(() => {
    if (imgRef.current?.complete) {
      detectTransparency();
    }
  }, [src]);

  const detectTransparency = () => {
    if (!isPngAsset(src)) {
      return;
    }

    const cached = transparencyCache.get(src);
    if (cached !== undefined) {
      setHasTransparency(cached);
      return;
    }

    const img = imgRef.current;
    if (!img || !img.complete) {
      return;
    }

    try {
      const transparent = hasTransparentPixel(img);
      transparencyCache.set(src, transparent);
      setHasTransparency(transparent);
    } catch {
      transparencyCache.set(src, false);
      setHasTransparency(false);
    }
  };

  return (
    <span
      className={cn(
        "inline-flex max-w-full justify-center",
        hasTransparency && "dark:rounded-md dark:bg-white dark:p-2",
        wrapperClassName
      )}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        onLoad={detectTransparency}
      />
    </span>
  );
};
