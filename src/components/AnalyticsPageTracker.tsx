import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { sanitizeAnalyticsPagePath, trackPageView } from "@/lib/analytics";

interface AnalyticsPageTrackerProps {
  pathname?: string;
  search?: string;
}

export const AnalyticsPageTracker = ({
  pathname,
  search,
}: AnalyticsPageTrackerProps = {}) => {
  const routeLocation = useLocation();
  const renderedPathname = pathname ?? routeLocation.pathname;
  const renderedSearch = pathname === undefined ? routeLocation.search : search ?? "";
  const pagePath = sanitizeAnalyticsPagePath(renderedPathname + renderedSearch);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => trackPageView(pagePath));
    return () => window.cancelAnimationFrame(frame);
  }, [pagePath]);

  return null;
};
