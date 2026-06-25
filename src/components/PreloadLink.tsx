import { forwardRef } from "react";
import { Link, type LinkProps } from "react-router-dom";

import { preloadRouteIntent } from "@/lib/routePreload";

export const PreloadLink = forwardRef<HTMLAnchorElement, LinkProps>(({
  to,
  onFocus,
  onPointerDown,
  onPointerEnter,
  onTouchStart,
  ...props
}, ref) => {
  const preload = () => preloadRouteIntent(to);

  return (
    <Link
      ref={ref}
      to={to}
      onFocus={(event) => {
        preload();
        onFocus?.(event);
      }}
      onPointerDown={(event) => {
        preload();
        onPointerDown?.(event);
      }}
      onPointerEnter={(event) => {
        preload();
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        preload();
        onTouchStart?.(event);
      }}
      {...props}
    />
  );
});

PreloadLink.displayName = "PreloadLink";
